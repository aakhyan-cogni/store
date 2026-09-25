import { describe, expect, it } from "vitest";
import categoriesRoute from "../src/api/categories/all.js";
import newCategoryRoute from "../src/api/categories/new.js";
import productRoute from "../src/api/products/[id].js";
import productsRoute from "../src/api/products/all.js";
import newProductRoute from "../src/api/products/new.js";
import { generateOpenApiDocument, type OpenApiDocument } from "../src/lib/openapi.js";
import { createRouteCatalogue } from "../src/lib/registry/routeCatalogue.js";

function operation(document: OpenApiDocument, path: string, method: string) {
	return document.paths[path]?.[method] as Record<string, any>;
}

describe("catalogue OpenAPI contracts", () => {
	it("documents Product and Category operations from the real routes", async () => {
		const catalogue = createRouteCatalogue([
			{ path: "/api/categories/all", route: categoriesRoute },
			{ path: "/api/categories/new", route: newCategoryRoute },
			{ path: "/api/products/[id]", route: productRoute },
			{ path: "/api/products/all", route: productsRoute },
			{ path: "/api/products/new", route: newProductRoute },
		]);
		const document = await generateOpenApiDocument(catalogue);

		const browseProducts = operation(document, "/api/products/all", "get");
		expect(browseProducts.security).toEqual([]);
		expect(browseProducts.parameters.map(({ name }: { name: string }) => name)).toEqual([
			"category_id",
			"limit",
			"max_price",
			"min_price",
			"offset",
			"q",
		]);
		expect(
			Object.fromEntries(browseProducts.parameters.map((parameter: any) => [parameter.name, parameter.schema])),
		).toMatchObject({
			category_id: { type: "integer", exclusiveMinimum: 0 },
			limit: { type: "integer", exclusiveMinimum: 0, default: 20 },
			max_price: { type: "string", pattern: "^(\\d+)(?:\\.(\\d{1,2}))?$" },
			min_price: { type: "string", pattern: "^(\\d+)(?:\\.(\\d{1,2}))?$" },
			offset: { type: "integer", minimum: 0, default: 0 },
			q: { type: "string" },
		});
		expect(browseProducts.responses["200"].content["application/json"].schema.properties).toEqual({
			data: { $ref: "#/components/schemas/ProductList" },
			meta: { $ref: "#/components/schemas/Pagination" },
		});
		const validationError = browseProducts.responses["400"].content["application/json"].schema.oneOf[0];
		expect(validationError.allOf[0]).toEqual({ $ref: "#/components/schemas/ApiErrorResponse" });
		expect(validationError.allOf[1].properties.error.properties).toMatchObject({
			code: { const: "VALIDATION_FAILED" },
			details: { $ref: "#/components/schemas/ValidationDetails" },
		});

		const getProduct = operation(document, "/api/products/{id}", "get");
		expect(getProduct).toMatchObject({
			security: [],
			parameters: [{ name: "id", in: "path", required: true }],
			responses: { 200: expect.any(Object), 404: expect.any(Object) },
		});

		for (const method of ["patch", "delete"]) {
			expect(operation(document, "/api/products/{id}", method)).toMatchObject({
				security: [{ bearerAuth: [] }],
				"x-required-roles": ["ADMIN"],
				responses: { 401: expect.any(Object), 403: expect.any(Object), 404: expect.any(Object) },
			});
		}
		expect(operation(document, "/api/products/{id}", "delete").responses["204"]).not.toHaveProperty("content");

		const createProduct = operation(document, "/api/products/new", "post");
		expect(createProduct).toMatchObject({
			security: [{ bearerAuth: [] }],
			"x-required-roles": ["ADMIN"],
			requestBody: { required: true },
			responses: { 201: expect.any(Object), 400: expect.any(Object) },
		});

		expect(operation(document, "/api/categories/all", "get")).toMatchObject({
			security: [],
			responses: { 200: expect.any(Object) },
		});
		expect(operation(document, "/api/categories/new", "post")).toMatchObject({
			security: [{ bearerAuth: [] }],
			"x-required-roles": ["ADMIN"],
			requestBody: { required: true },
			responses: { 201: expect.any(Object), 400: expect.any(Object), 409: expect.any(Object) },
		});
	});
});
