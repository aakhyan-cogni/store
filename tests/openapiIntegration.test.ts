import { validate } from "@scalar/openapi-parser";
import { beforeAll, describe, expect, it } from "vitest";
import type { ApiInformation } from "../src/apiInfo.js";
import type { OpenApiDocument } from "../src/lib/openapi.js";
import type { RouteCatalogueEntry } from "../src/lib/registry/routeCatalogue.js";

type OpenApiModule = typeof import("../src/lib/openapi.js");
type RouteCatalogueModule = typeof import("../src/lib/registry/routeCatalogue.js");

const expectedOperations = [
	"POST /api/auth/login",
	"POST /api/auth/register",
	"GET /api/cart",
	"POST /api/cart",
	"DELETE /api/cart",
	"PATCH /api/cart/[productId]",
	"DELETE /api/cart/[productId]",
	"GET /api/categories/all",
	"POST /api/categories/new",
	"GET /api/orders",
	"POST /api/orders",
	"GET /api/orders/[id]",
	"PATCH /api/orders/[id]",
	"GET /api/ping",
	"GET /api/products/[id]",
	"PATCH /api/products/[id]",
	"DELETE /api/products/[id]",
	"GET /api/products/all",
	"POST /api/products/new",
];

let catalogue: readonly RouteCatalogueEntry[];
let document: OpenApiDocument;
let information: ApiInformation;
let generateOpenApiDocument: OpenApiModule["generateOpenApiDocument"];
let serializeOpenApiDocument: OpenApiModule["serializeOpenApiDocument"];

beforeAll(async () => {
	const [catalogueModule, openApiModule, informationModule] = await Promise.all([
		compiledModule<RouteCatalogueModule>("lib/registry/routeCatalogue.js"),
		compiledModule<OpenApiModule>("lib/openapi.js"),
		compiledModule<{ apiInformation: ApiInformation }>("apiInfo.js"),
	]);

	catalogue = await catalogueModule.discoverRouteCatalogue();
	generateOpenApiDocument = openApiModule.generateOpenApiDocument;
	serializeOpenApiDocument = openApiModule.serializeOpenApiDocument;
	information = informationModule.apiInformation;
	document = await generateOpenApiDocument(catalogue, information);
});

describe("compiled route catalogue OpenAPI contract", () => {
	it("validates the complete real catalogue and preserves handler-contract parity", async () => {
		expect(operationKeys(catalogue)).toEqual(expectedOperations);
		expect(catalogue.every(({ handler, contract }) => handler !== undefined && contract !== undefined)).toBe(true);
		expect(documentOperationKeys(document)).toEqual(expectedOperations.map(toDocumentOperationKey).sort());
		expect((await validate(document)).valid).toBe(true);
	});

	it("documents representative access, input, path, pagination, response, and rate-limit contracts", () => {
		expect(operation(document, "/api/ping", "get").security).toEqual([]);
		expect(operation(document, "/api/cart", "get").security).toEqual([{ bearerAuth: [] }]);
		expect(operation(document, "/api/products/new", "post")).toMatchObject({
			security: [{ bearerAuth: [] }],
			"x-required-roles": ["ADMIN"],
			requestBody: { required: true },
			responses: { 201: expect.any(Object) },
		});

		const browseProducts = operation(document, "/api/products/all", "get");
		expect(
			browseProducts.parameters.map(({ name, in: location }: { name: string; in: string }) => [name, location]),
		).toEqual([
			["category_id", "query"],
			["limit", "query"],
			["max_price", "query"],
			["min_price", "query"],
			["offset", "query"],
			["q", "query"],
		]);
		expect(browseProducts.responses["200"].content["application/json"].schema.properties).toEqual({
			data: { $ref: "#/components/schemas/ProductList" },
			meta: { $ref: "#/components/schemas/Pagination" },
		});

		expect(operation(document, "/api/products/{id}", "get").parameters).toMatchObject([
			{ name: "id", in: "path", required: true },
		]);
		expect(operation(document, "/api/auth/login", "post").responses["429"].headers).toHaveProperty("retry-after");
		expect(operation(document, "/api/auth/register", "post").responses).toHaveProperty("201");
		expect(operation(document, "/api/cart", "delete").responses["204"]).not.toHaveProperty("content");
	});

	it("serializes repeated generation to byte-identical JSON", async () => {
		const first = serializeOpenApiDocument(document);
		const second = serializeOpenApiDocument(await generateOpenApiDocument(catalogue, information));

		expect(second).toBe(first);
	});
});

function compiledModule<T>(path: string) {
	const url = new URL(`../dist/${path}`, import.meta.url);
	return import(/* @vite-ignore */ url.href) as Promise<T>;
}

function operation(documentValue: OpenApiDocument, path: string, method: string) {
	return documentValue.paths[path]?.[method] as Record<string, any>;
}

function operationKeys(entries: readonly RouteCatalogueEntry[]) {
	return entries.map(({ method, path }) => `${method} ${path}`);
}

function documentOperationKeys(documentValue: OpenApiDocument) {
	return Object.entries(documentValue.paths)
		.flatMap(([path, pathItem]) => Object.keys(pathItem).map((method) => `${method.toUpperCase()} ${path}`))
		.sort();
}

function toDocumentOperationKey(key: string) {
	return key.replace(/\[([^\]]+)\]/g, "{$1}");
}
