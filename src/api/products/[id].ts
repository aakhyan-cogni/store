import {
	CustomError,
	parseRequest,
	parseRouteId,
	productWireSchema,
	ProductRepository,
	Route,
	sendData,
	sendNoContent,
	updateProductSchema,
	validationDetailsWireSchema,
} from "#lib";
import { z } from "zod";

const productIdParameter = {
	schema: z.coerce.number().int().positive(),
	description: "The Product identifier",
	example: 7,
} as const;

function productIdFrom(params: Record<string, string> | undefined) {
	const id = parseRouteId(params?.id);
	if (!id) throw new CustomError(404, "product not found");
	return id;
}

export default new Route({
	description: "Get / update / delete a single product",
	auth: {
		PATCH: { required: true, roles: ["ADMIN"] },
		DELETE: { required: true, roles: ["ADMIN"] },
	},
	contracts: {
		GET: {
			summary: "Get a Product",
			tags: ["Catalogue"],
			parameters: { path: { id: productIdParameter } },
			responses: {
				200: { description: "The listed Product", data: productWireSchema },
				404: { description: "Product not found", errors: [{ code: "NOT_FOUND" }] },
			},
		},
		PATCH: {
			summary: "Update a Product",
			description: "Updates at least one supplied Product field.",
			tags: ["Catalogue"],
			parameters: { path: { id: productIdParameter } },
			requestBody: {
				description: "The Product fields to update",
				required: true,
				schema: updateProductSchema,
				componentName: "UpdateProduct",
			},
			responses: {
				200: { description: "Product updated", data: productWireSchema },
				400: {
					description: "Invalid Product data or unknown Category",
					errors: [{ code: "VALIDATION_FAILED", details: validationDetailsWireSchema }],
				},
				404: { description: "Product not found", errors: [{ code: "NOT_FOUND" }] },
			},
		},
		DELETE: {
			summary: "Delete a Product",
			description: "Delists the Product from the public catalogue.",
			tags: ["Catalogue"],
			parameters: { path: { id: productIdParameter } },
			responses: {
				204: { description: "Product delisted" },
				404: { description: "Product not found", errors: [{ code: "NOT_FOUND" }] },
			},
		},
	},
	GET: async ({ res, params, db }) => {
		const product = await new ProductRepository(db).get(productIdFrom(params));
		sendData(res, product);
	},
	PATCH: async ({ res, params, db, body }) => {
		const id = productIdFrom(params);
		const data = parseRequest(updateProductSchema, body);

		const product = await new ProductRepository(db).update(id, data);
		sendData(res, product);
	},
	DELETE: async ({ res, params, db }) => {
		await new ProductRepository(db).delete(productIdFrom(params));
		sendNoContent(res);
	},
});
