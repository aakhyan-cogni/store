import { validate } from "@scalar/openapi-parser";
import { z } from "zod";
import { HTTP_METHODS, type HTTPMethod } from "../types/index.js";
import { API_ERROR_CODES, type ApiErrorCode } from "./responses.js";
import type {
	ContractExample,
	ContractSchema,
	ErrorContract,
	MethodAuth,
	OperationContract,
	ParameterContract,
	ResponseContract,
} from "./structures/Route.js";
import type { RouteCatalogueEntry } from "./registry/routeCatalogue.js";

type JsonObject = Record<string, unknown>;

export interface OpenApiDocument extends JsonObject {
	openapi: "3.1.0";
	jsonSchemaDialect: "https://json-schema.org/draft/2020-12/schema";
	info: { title: string; version: string; description?: string };
	servers: Array<{ url: string }>;
	paths: Record<string, Record<string, JsonObject>>;
	components: {
		schemas: Record<string, JsonObject>;
		securitySchemes: Record<string, JsonObject>;
	};
}

export interface OpenApiOptions {
	title?: string;
	version?: string;
	description?: string;
	servers?: readonly string[];
}

export interface OpenApiContractIssue {
	path: string;
	method: HTTPMethod;
	message: string;
}

export class OpenApiGenerationError extends Error {
	public readonly issues: readonly OpenApiContractIssue[];

	public constructor(issues: readonly OpenApiContractIssue[]) {
		super(`OpenAPI generation failed:\n${issues.map(formatIssue).join("\n")}`);
		this.name = "OpenApiGenerationError";
		this.issues = issues;
	}
}

/** Build and validate one OpenAPI 3.1 document from the runtime route catalogue. */
export async function generateOpenApiDocument(
	catalogue: readonly RouteCatalogueEntry[],
	options: OpenApiOptions = {},
): Promise<OpenApiDocument> {
	const context = new GenerationContext();
	const paths = buildPaths(catalogue, context);

	if (context.issues.length > 0) throw new OpenApiGenerationError(context.issues);

	const document: OpenApiDocument = {
		openapi: "3.1.0",
		jsonSchemaDialect: "https://json-schema.org/draft/2020-12/schema",
		info: {
			title: options.title ?? "Store API",
			version: options.version ?? "1.0.0",
			...(options.description === undefined ? {} : { description: options.description }),
		},
		servers: [...(options.servers ?? ["http://localhost:3000"])].sort(compareText).map((url) => ({ url })),
		paths,
		components: {
			schemas: context.sortedComponents(),
			securitySchemes: {
				bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
			},
		},
	};

	const result = await validate(document);
	if (!result.valid) {
		const messages = result.errors.map((error) => {
			const path = Array.isArray(error.path) ? error.path.join("/") : error.path;
			return path ? `${path}: ${error.message}` : error.message;
		});
		throw new Error(`Generated OpenAPI document is invalid:\n${messages.join("\n")}`);
	}

	return document;
}

class GenerationContext {
	public readonly issues: OpenApiContractIssue[] = [];
	private readonly components = new Map<string, JsonObject>();
	private readonly componentSchemas = new Map<string, { schema: ContractSchema["schema"]; owner: string }>();

	public constructor() {
		this.components.set("ApiError", {
			type: "object",
			properties: {
				code: { type: "string", enum: [...API_ERROR_CODES] },
				message: { type: "string" },
				details: {},
			},
			required: ["code", "message"],
			additionalProperties: false,
		});
		this.components.set("ApiErrorResponse", {
			type: "object",
			properties: { error: { $ref: "#/components/schemas/ApiError" } },
			required: ["error"],
			additionalProperties: false,
		});
	}

	public addIssue(entry: Pick<RouteCatalogueEntry, "path" | "method">, message: string) {
		this.issues.push({ path: entry.path, method: entry.method, message });
	}

	public schema(contract: ContractSchema, entry: Pick<RouteCatalogueEntry, "path" | "method">) {
		const converted = this.convertSchema(contract, entry);
		if (!converted) return {};
		if (!contract.componentName) return converted;

		const name = contract.componentName;
		if (name === "ApiError" || name === "ApiErrorResponse") {
			this.addIssue(entry, `component name ${name} is reserved`);
			return {};
		}

		const existing = this.componentSchemas.get(name);
		if (existing && existing.schema !== contract.schema) {
			this.addIssue(entry, `component name ${name} conflicts with ${existing.owner}`);
			return {};
		}
		if (!existing) {
			this.componentSchemas.set(name, { schema: contract.schema, owner: `${entry.method} ${entry.path}` });
			this.components.set(name, rewriteLocalReferences(converted, name));
		}

		return { $ref: `#/components/schemas/${escapeJsonPointer(name)}` };
	}

	public inlineSchema(contract: ContractSchema, entry: Pick<RouteCatalogueEntry, "path" | "method">) {
		const converted = this.convertSchema(contract, entry);
		if (contract.componentName) this.schema(contract, entry);
		return converted;
	}

	public sortedComponents() {
		return Object.fromEntries([...this.components].sort(([left], [right]) => compareText(left, right)));
	}

	private convertSchema(
		contract: ContractSchema,
		entry: Pick<RouteCatalogueEntry, "path" | "method">,
	): JsonObject | null {
		try {
			return toPlainObject(
				z.toJSONSchema(contract.schema, {
					target: "draft-2020-12",
					unrepresentable: "throw",
					cycles: "throw",
					reused: "inline",
				}),
			);
		} catch (error) {
			this.addIssue(entry, `schema cannot be represented: ${errorMessage(error)}`);
			return null;
		}
	}
}

function buildPaths(catalogue: readonly RouteCatalogueEntry[], context: GenerationContext) {
	const paths: Record<string, Record<string, JsonObject>> = {};
	const operationIds = new Map<string, string>();
	const pathShapes = new Map<string, string>();
	const entries = [...catalogue].sort(compareEntries);

	for (const entry of entries) {
		if (!entry.handler) {
			context.addIssue(entry, "operation contract has no registered handler");
			continue;
		}
		if (!entry.contract) {
			context.addIssue(entry, "registered handler has no operation contract");
			continue;
		}

		const shape = entry.path.replace(/\[[^\]/]+\]/g, "[]");
		const shapeOwner = pathShapes.get(shape);
		if (shapeOwner && shapeOwner !== entry.path) {
			context.addIssue(entry, `path conflicts with ${shapeOwner}`);
		} else {
			pathShapes.set(shape, entry.path);
		}

		validatePathParameters(entry, entry.contract, context);
		validateSuccessResponse(entry, entry.contract, context);

		const openApiPath = toOpenApiPath(entry.path);
		const method = entry.method.toLowerCase();
		const pathItem = (paths[openApiPath] ??= {});
		if (pathItem[method]) {
			context.addIssue(entry, `duplicate ${entry.method} operation for ${openApiPath}`);
			continue;
		}

		const operationId = entry.contract.operationId ?? deriveOperationId(entry.method, entry.path);
		const operationOwner = operationIds.get(operationId);
		if (operationOwner) {
			context.addIssue(entry, `operationId ${operationId} is already used by ${operationOwner}`);
		} else {
			operationIds.set(operationId, `${entry.method} ${entry.path}`);
		}

		pathItem[method] = buildOperation(entry, entry.contract, operationId, context);
	}

	return Object.fromEntries(Object.entries(paths).sort(([left], [right]) => compareText(left, right)));
}

function buildOperation(
	entry: RouteCatalogueEntry,
	contract: OperationContract,
	operationId: string,
	context: GenerationContext,
): JsonObject {
	return {
		summary: contract.summary,
		...(contract.description === undefined ? {} : { description: contract.description }),
		tags: [...(contract.tags ?? [defaultTag(entry.path)])].sort(compareText),
		operationId,
		security: entry.auth?.required ? [{ bearerAuth: [] }] : [],
		...(entry.auth?.roles?.length ? { "x-required-roles": [...entry.auth.roles].sort(compareText) } : {}),
		...(contract.parameters ? { parameters: buildParameters(entry, contract, context) } : {}),
		...(contract.requestBody ? { requestBody: buildRequestBody(entry, contract, context) } : {}),
		responses: buildResponses(entry, contract, entry.auth, context),
	};
}

function buildParameters(entry: RouteCatalogueEntry, contract: OperationContract, context: GenerationContext) {
	const parameters: JsonObject[] = [];
	const pathContracts = contract.parameters?.path ?? {};

	for (const name of [...entry.params].sort(compareText)) {
		const parameter = pathContracts[name];
		if (!parameter) continue;
		parameters.push({
			name,
			in: "path",
			required: true,
			description: parameter.description,
			schema: context.schema(parameter, entry),
			...parameterExamples(parameter),
		});
	}

	const query = contract.parameters?.query;
	if (!query) return parameters;
	const schema = context.inlineSchema(query, entry);
	if (!schema || schema.type !== "object" || !isJsonObject(schema.properties)) {
		context.addIssue(entry, "query parameters schema must be an object");
		return parameters;
	}
	const required = new Set(Array.isArray(schema.required) ? schema.required.filter(isString) : []);
	for (const [name, propertySchema] of Object.entries(schema.properties).sort(([left], [right]) =>
		compareText(left, right),
	)) {
		parameters.push({
			name,
			in: "query",
			required: required.has(name),
			schema: propertySchema,
		});
	}
	return parameters;
}

function buildRequestBody(entry: RouteCatalogueEntry, contract: OperationContract, context: GenerationContext) {
	const request = contract.requestBody!;
	const schema = context.schema(request, entry);
	const examples = mapExamples(request.examples);
	return {
		...(request.description === undefined ? {} : { description: request.description }),
		...(request.required === undefined ? {} : { required: request.required }),
		content: Object.fromEntries(
			[...(request.contentTypes ?? ["application/json"])]
				.sort(compareText)
				.map((contentType) => [contentType, { schema, ...(examples ? { examples } : {}) }]),
		),
	};
}

function buildResponses(
	entry: RouteCatalogueEntry,
	contract: OperationContract,
	auth: MethodAuth | undefined,
	context: GenerationContext,
) {
	const responses: Record<string, JsonObject> = {};
	const declared = Object.entries(contract.responses)
		.map(([status, response]) => [Number(status), response] as const)
		.sort(([left], [right]) => left - right);

	for (const [status, response] of declared) {
		responses[String(status)] =
			status >= 200 && status < 300
				? buildSuccessResponse(entry, status, response, context)
				: buildErrorResponse(entry, status, response, context);
	}
	if (auth?.required && !responses["401"]) {
		responses["401"] = buildErrorResponse(
			entry,
			401,
			derivedError("Authentication required", "UNAUTHENTICATED"),
			context,
		);
	}
	if (auth?.required && auth.roles?.length && !responses["403"]) {
		responses["403"] = buildErrorResponse(entry, 403, derivedError("Insufficient role", "FORBIDDEN"), context);
	}

	return Object.fromEntries(Object.entries(responses).sort(([left], [right]) => Number(left) - Number(right)));
}

function buildSuccessResponse(
	entry: RouteCatalogueEntry,
	status: number,
	response: ResponseContract,
	context: GenerationContext,
): JsonObject {
	const headers = responseHeaders(false);
	if (status === 204) return { description: response.description, headers };

	const properties: JsonObject = { data: response.data ? context.schema(response.data, entry) : {} };
	const required = ["data"];
	if (response.meta) {
		properties.meta = context.schema(response.meta, entry);
		required.push("meta");
	}
	const examples = mapExamples(response.examples);
	return {
		description: response.description,
		headers,
		content: {
			"application/json": {
				schema: { type: "object", properties, required, additionalProperties: false },
				...(examples ? { examples } : {}),
			},
		},
	};
}

function buildErrorResponse(
	entry: RouteCatalogueEntry,
	status: number,
	response: ResponseContract,
	context: GenerationContext,
): JsonObject {
	const errors = response.errors ?? [];
	const schema =
		errors.length === 0
			? { $ref: "#/components/schemas/ApiErrorResponse" }
			: {
					oneOf: errors.map((error) => errorSchema(entry, error, context)),
				};
	const examples = mapExamples(response.examples);
	return {
		description: response.description,
		headers: responseHeaders(status === 429 || errors.some(({ code }) => code === "RATE_LIMITED")),
		content: {
			"application/json": {
				schema,
				...(examples ? { examples } : {}),
			},
		},
	};
}

function errorSchema(entry: RouteCatalogueEntry, error: ErrorContract, context: GenerationContext) {
	const errorProperties: JsonObject = { code: { const: error.code } };
	if (error.details) errorProperties.details = context.schema(error.details, entry);
	return {
		...(error.description === undefined ? {} : { description: error.description }),
		allOf: [
			{ $ref: "#/components/schemas/ApiErrorResponse" },
			{
				type: "object",
				properties: { error: { type: "object", properties: errorProperties } },
			},
		],
	};
}

function responseHeaders(includeRetryAfter: boolean) {
	return {
		"x-request-id": { description: "Request correlation identifier", schema: { type: "string", format: "uuid" } },
		...(includeRetryAfter
			? { "retry-after": { description: "Seconds before retrying", schema: { type: "integer", minimum: 0 } } }
			: {}),
	};
}

function validatePathParameters(entry: RouteCatalogueEntry, contract: OperationContract, context: GenerationContext) {
	const expected = new Set(entry.params);
	const documented = new Set(Object.keys(contract.parameters?.path ?? {}));
	for (const name of [...expected].sort(compareText)) {
		if (!documented.has(name)) context.addIssue(entry, `path parameter ${name} is not documented`);
	}
	for (const name of [...documented].sort(compareText)) {
		if (!expected.has(name)) context.addIssue(entry, `documented path parameter ${name} is not present in the route`);
	}
}

function validateSuccessResponse(entry: RouteCatalogueEntry, contract: OperationContract, context: GenerationContext) {
	if (!Object.keys(contract.responses).some((status) => Number(status) >= 200 && Number(status) < 300)) {
		context.addIssue(entry, "operation has no successful response");
	}
}

function parameterExamples(parameter: ParameterContract) {
	if (parameter.examples) return { examples: mapExamples(parameter.examples) };
	if (parameter.example !== undefined) return { example: parameter.example };
	return {};
}

function mapExamples(
	examples: Readonly<Record<string, ContractExample>> | undefined,
): Record<string, JsonObject> | null {
	if (!examples) return null;
	return Object.fromEntries(
		Object.entries(examples)
			.sort(([left], [right]) => compareText(left, right))
			.map(([name, example]) => [
				name,
				{
					...(example.summary === undefined ? {} : { summary: example.summary }),
					...(example.description === undefined ? {} : { description: example.description }),
					value: example.value,
				},
			]),
	);
}

function derivedError(description: string, code: ApiErrorCode): ResponseContract {
	return { description, errors: [{ code }] };
}

function deriveOperationId(method: HTTPMethod, path: string) {
	const segments = path.split("/").filter(Boolean);
	return (
		method.toLowerCase() +
		segments
			.map((segment) => {
				const dynamic = /^\[([^\]]+)\]$/.exec(segment);
				return dynamic ? `By${pascalCase(dynamic[1]!)}` : pascalCase(segment);
			})
			.join("")
	);
}

function defaultTag(path: string) {
	const segment =
		path
			.split("/")
			.filter(Boolean)
			.find((part) => part !== "api") ?? "API";
	return pascalCase(segment);
}

function pascalCase(value: string) {
	return value
		.split(/[^A-Za-z0-9]+/)
		.filter(Boolean)
		.map((part) => part[0]!.toUpperCase() + part.slice(1))
		.join("");
}

function toOpenApiPath(path: string) {
	return path.replace(/\[([^\]/]+)\]/g, "{$1}");
}

function rewriteLocalReferences(schema: JsonObject, componentName: string): JsonObject {
	const prefix = `#/components/schemas/${escapeJsonPointer(componentName)}`;
	return JSON.parse(JSON.stringify(schema).replace(/"#\/$defs\//g, `"${prefix}/$defs/`)) as JsonObject;
}

function escapeJsonPointer(value: string) {
	return value.replace(/~/g, "~0").replace(/\//g, "~1");
}

function toPlainObject(value: unknown) {
	return JSON.parse(JSON.stringify(value)) as JsonObject;
}

function compareEntries(left: RouteCatalogueEntry, right: RouteCatalogueEntry) {
	return compareText(left.path, right.path) || HTTP_METHODS.indexOf(left.method) - HTTP_METHODS.indexOf(right.method);
}

function compareText(left: string, right: string) {
	if (left < right) return -1;
	if (left > right) return 1;
	return 0;
}

function formatIssue(issue: OpenApiContractIssue) {
	return `- ${issue.method} ${issue.path}: ${issue.message}`;
}

function errorMessage(error: unknown) {
	return error instanceof Error ? error.message : String(error);
}

function isJsonObject(value: unknown): value is JsonObject {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
	return typeof value === "string";
}
