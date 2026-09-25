import { describe, expect, it } from "vitest";
import cartItemRoute from "../src/api/cart/[productId].js";
import cartRoute from "../src/api/cart/index.js";
import orderRoute from "../src/api/orders/[id].js";
import ordersRoute from "../src/api/orders/index.js";
import { generateOpenApiDocument, type OpenApiDocument } from "../src/lib/openapi.js";
import { createRouteCatalogue } from "../src/lib/registry/routeCatalogue.js";

function operation(document: OpenApiDocument, path: string, method: string) {
	return document.paths[path]?.[method] as Record<string, any>;
}

describe("Cart and Order OpenAPI contracts", () => {
	it("documents every authenticated Cart and Order operation", async () => {
		const document = await generateOpenApiDocument(
			createRouteCatalogue([
				{ path: "/api/cart", route: cartRoute },
				{ path: "/api/cart/[productId]", route: cartItemRoute },
				{ path: "/api/orders", route: ordersRoute },
				{ path: "/api/orders/[id]", route: orderRoute },
			]),
		);

		for (const [path, methods] of Object.entries(document.paths)) {
			for (const contract of Object.values(methods)) {
				expect(contract.security, path).toEqual([{ bearerAuth: [] }]);
				expect(contract.responses, path).toHaveProperty("401");
			}
		}

		expect(operation(document, "/api/cart", "get").responses["200"]).toMatchObject({
			content: { "application/json": { schema: { properties: { data: { $ref: "#/components/schemas/Cart" } } } } },
		});
		expect(operation(document, "/api/cart", "post")).toMatchObject({
			requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } },
			responses: { "201": {}, "400": {}, "404": {}, "409": {} },
		});
		expect(operation(document, "/api/cart", "post").responses["201"]).toMatchObject({
			content: {
				"application/json": {
					schema: { properties: { data: { $ref: "#/components/schemas/CartMutationResult" } } },
				},
			},
		});
		expect(operation(document, "/api/cart", "delete").responses["204"]).not.toHaveProperty("content");

		const updateCartItem = operation(document, "/api/cart/{productId}", "patch");
		expect(updateCartItem.parameters).toEqual([
			expect.objectContaining({ name: "productId", in: "path", required: true, example: "7" }),
		]);
		expect(updateCartItem.responses).toMatchObject({ "200": {}, "400": {}, "404": {}, "409": {} });
		expect(operation(document, "/api/cart/{productId}", "delete").responses).toMatchObject({
			"204": {},
			"404": {},
		});
		expect(operation(document, "/api/cart/{productId}", "delete").responses["204"]).not.toHaveProperty("content");

		expect(operation(document, "/api/orders", "get").responses["200"]).toMatchObject({
			content: {
				"application/json": { schema: { properties: { data: { $ref: "#/components/schemas/OrderList" } } } },
			},
		});
		expect(operation(document, "/api/orders", "post").responses).toMatchObject({ "201": {}, "409": {} });
		expect(operation(document, "/api/orders", "post").responses["201"]).toMatchObject({
			content: { "application/json": { schema: { properties: { data: { $ref: "#/components/schemas/Order" } } } } },
		});

		const cancelOrder = operation(document, "/api/orders/{id}", "patch");
		expect(cancelOrder.parameters).toEqual([
			expect.objectContaining({ name: "id", in: "path", required: true, example: "42" }),
		]);
		expect(cancelOrder.requestBody).toMatchObject({
			required: true,
			content: { "application/json": { schema: { properties: { status: { const: "CANCELLED" } } } } },
		});
		expect(cancelOrder.responses).toMatchObject({ "200": {}, "400": {}, "404": {}, "409": {} });
		expect(operation(document, "/api/orders/{id}", "get").responses).toMatchObject({ "200": {}, "404": {} });
	});
});
