import { validate } from "@scalar/openapi-parser";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { generateOpenApiDocument, OpenApiGenerationError, type OpenApiDocument } from "../src/lib/openapi.js";
import { createRouteCatalogue } from "../src/lib/registry/routeCatalogue.js";
import { Route, type OperationContract } from "../src/lib/structures/Route.js";

function operation(document: OpenApiDocument, path: string, method: string) {
	return document.paths[path]?.[method] as Record<string, any>;
}

describe("generateOpenApiDocument", () => {
	it("emits and validates the complete operation contract", async () => {
		const product = { schema: z.object({ id: z.number().int(), name: z.string() }), componentName: "Product" };
		const catalogue = createRouteCatalogue([
			{
				path: "/api/products/[id]",
				route: new Route({
					auth: { GET: { required: true, roles: ["ADMIN"] }, DELETE: { required: false } },
					contracts: {
						GET: {
							summary: "Get a product",
							tags: ["Catalogue"],
							parameters: {
								path: { id: { schema: z.string().regex(/^\d+$/), description: "Product identifier" } },
								query: { schema: z.object({ includeHidden: z.boolean().optional() }) },
							},
							responses: {
								200: { description: "Product", data: product },
								429: {
									description: "Rate limit exceeded",
									errors: [{ code: "RATE_LIMITED", description: "Retry later" }],
								},
							},
						},
						DELETE: {
							summary: "Delete a product",
							parameters: {
								path: { id: { schema: z.string().regex(/^\d+$/), description: "Product identifier" } },
							},
							responses: { 204: { description: "Deleted" } },
						},
					},
					GET: vi.fn(),
					DELETE: vi.fn(),
				}),
			},
			{
				path: "/api/products",
				route: new Route({
					contracts: {
						POST: {
							summary: "Create a product",
							requestBody: {
								schema: z.object({ name: z.string() }),
								required: true,
								examples: { basic: { value: { name: "Kettle" } } },
							},
							responses: { 201: { description: "Created", data: product } },
						},
					},
					POST: vi.fn(),
				}),
			},
		]);

		const document = await generateOpenApiDocument(catalogue, {
			title: "Shop",
			version: "2.1.0",
			servers: ["http://localhost:4000"],
		});

		expect((await validate(document)).valid).toBe(true);
		expect(document.info).toEqual({ title: "Shop", version: "2.1.0" });
		expect(document.servers).toEqual([{ url: "http://localhost:4000" }]);
		expect(operation(document, "/api/products/{id}", "get")).toMatchObject({
			operationId: "getApiProductsById",
			tags: ["Catalogue"],
			security: [{ bearerAuth: [] }],
			"x-required-roles": ["ADMIN"],
			parameters: [
				{ name: "id", in: "path", required: true, description: "Product identifier" },
				{ name: "includeHidden", in: "query", required: false },
			],
		});
		expect(operation(document, "/api/products/{id}", "get").responses["200"]).toMatchObject({
			headers: { "x-request-id": expect.any(Object) },
			content: {
				"application/json": {
					schema: {
						type: "object",
						properties: { data: { $ref: "#/components/schemas/Product" } },
						required: ["data"],
					},
				},
			},
		});
		expect(operation(document, "/api/products/{id}", "get").responses["401"]).toBeDefined();
		expect(operation(document, "/api/products/{id}", "get").responses["403"]).toBeDefined();
		expect(operation(document, "/api/products/{id}", "get").responses["429"].headers).toHaveProperty("retry-after");
		expect(operation(document, "/api/products/{id}", "delete")).toMatchObject({ security: [] });
		expect(operation(document, "/api/products/{id}", "delete").responses["204"]).not.toHaveProperty("content");
		expect(document.components.schemas).toHaveProperty("ApiErrorResponse");
		expect(document.components.schemas).toHaveProperty("Product");
	});

	it("is deterministic for catalogue and option ordering", async () => {
		const first = new Route({
			contracts: { GET: success("First") },
			GET: vi.fn(),
		});
		const second = new Route({
			contracts: { POST: success("Second", 201) },
			POST: vi.fn(),
		});
		const definitions = [
			{ path: "/api/z", route: second },
			{ path: "/api/a", route: first },
		];

		const left = await generateOpenApiDocument(createRouteCatalogue(definitions), { servers: ["/z", "/a"] });
		const right = await generateOpenApiDocument(createRouteCatalogue([...definitions].reverse()), {
			servers: ["/a", "/z"],
		});

		expect(JSON.stringify(left)).toBe(JSON.stringify(right));
	});

	it("aggregates contract failures with their route and method", async () => {
		const recursive: z.ZodType<unknown> = z.lazy(() => z.object({ child: recursive.optional() }));
		const catalogue = createRouteCatalogue([
			{ path: "/api/missing", route: new Route({ GET: vi.fn() }) },
			{ path: "/api/stale", route: new Route({ contracts: { POST: success("Stale", 201) } }) },
			{
				path: "/api/items/[id]",
				route: routeWithContract({
					summary: "Broken item",
					operationId: "sharedId",
					parameters: { path: { slug: { schema: z.string(), description: "Wrong parameter" } } },
					responses: { 400: { description: "No success", data: { schema: z.date() } } },
				}),
			},
			{
				path: "/api/items/[slug]",
				route: routeWithContract({
					summary: "Conflicting item",
					operationId: "sharedId",
					parameters: { path: { slug: { schema: z.string(), description: "Slug" } } },
					responses: { 200: { description: "Recursive", data: { schema: recursive } } },
				}),
			},
		]);

		const error = await generateOpenApiDocument(catalogue).catch((reason: unknown) => reason);

		expect(error).toBeInstanceOf(OpenApiGenerationError);
		expect((error as Error).message).toContain("GET /api/missing: registered handler has no operation contract");
		expect((error as Error).message).toContain("POST /api/stale: operation contract has no registered handler");
		expect((error as Error).message).toContain("GET /api/items/[id]: path parameter id is not documented");
		expect((error as Error).message).toContain("GET /api/items/[id]: operation has no successful response");
		expect((error as Error).message).toContain("GET /api/items/[slug]: path conflicts with /api/items/[id]");
		expect((error as Error).message).toContain("GET /api/items/[slug]: operationId sharedId is already used");
		expect((error as Error).message).toContain("GET /api/items/[slug]: schema cannot be represented");
	});

	it("rejects conflicting component names", async () => {
		const catalogue = createRouteCatalogue([
			{
				path: "/api/a",
				route: routeWithContract({
					summary: "A",
					responses: { 200: { description: "A", data: { schema: z.string(), componentName: "Value" } } },
				}),
			},
			{
				path: "/api/b",
				route: routeWithContract({
					summary: "B",
					responses: { 200: { description: "B", data: { schema: z.number(), componentName: "Value" } } },
				}),
			},
		]);

		await expect(generateOpenApiDocument(catalogue)).rejects.toThrow(
			"GET /api/b: component name Value conflicts with GET /api/a",
		);
	});
});

function success(summary: string, status = 200): OperationContract {
	return { summary, responses: { [status]: { description: summary } } };
}

function routeWithContract(contract: OperationContract) {
	return new Route({ contracts: { GET: contract }, GET: vi.fn() });
}
