import {
	CartRepository,
	cartMutationResultWireSchema,
	CustomError,
	parseRequest,
	parseRouteId,
	ProductRepository,
	Route,
	sendData,
	sendNoContent,
	updateCartItemSchema,
	validationDetailsWireSchema,
} from "#lib";
import { z } from "zod";

const productIdParameter = {
	schema: z.string().regex(/^[1-9]\d*$/),
	description: "The product identifier for the cart item",
	example: "7",
};

export default new Route({
	description: "Cart Product management",
	auth: { PATCH: { required: true }, DELETE: { required: true } },
	contracts: {
		PATCH: {
			summary: "Update a cart item",
			tags: ["Cart"],
			parameters: { path: { productId: productIdParameter } },
			requestBody: {
				description: "The replacement quantity",
				required: true,
				schema: updateCartItemSchema,
			},
			responses: {
				200: { description: "The updated stored cart item", data: cartMutationResultWireSchema },
				400: {
					description: "The request body is invalid",
					errors: [{ code: "VALIDATION_FAILED", details: validationDetailsWireSchema }],
				},
				404: {
					description: "The product or cart item does not exist",
					errors: [{ code: "NOT_FOUND" }],
				},
				409: {
					description: "The requested quantity exceeds available stock",
					errors: [{ code: "CONFLICT" }],
				},
			},
		},
		DELETE: {
			summary: "Remove a cart item",
			description: "The product may be removed even when it is no longer listed.",
			tags: ["Cart"],
			parameters: { path: { productId: productIdParameter } },
			responses: {
				204: { description: "The cart item was removed" },
				404: { description: "The cart item does not exist", errors: [{ code: "NOT_FOUND" }] },
			},
		},
	},
	PATCH: async ({ res, db, user, body, params }) => {
		if (!user) throw new Error("user not defined");
		const productId = parseRouteId(params?.productId);
		const data = parseRequest(updateCartItemSchema, body);
		if (!productId) throw new CustomError(404, "product not found");

		const productRepo = new ProductRepository(db);
		const cartRepo = new CartRepository(db);

		const exists = await productRepo.exists(productId);
		if (!exists) throw new CustomError(404, "product not found");
		const { stock } = exists;
		const item = await cartRepo.findItem(user.id, productId);
		if (!item) throw new CustomError(404, "item does not exist in cart");
		if (data.quantity > stock) throw new CustomError(409, "Requested quantity exceeds available stock");

		// Between the read above and this write, another request may have
		// removed the line: a vanished row is a 404, not a validation failure.
		const updated = await cartRepo.updateQuantity(user.id, productId, data.quantity);
		if (!updated) throw new CustomError(404, "item does not exist in cart");

		sendData(res, updated);
	},
	// Deliberately does not require the product to still be listed: a delisted
	// line has to be removable, or the cart holding it can never check out.
	DELETE: async ({ res, db, user, params }) => {
		if (!user) throw new Error("user not defined");
		const productId = parseRouteId(params?.productId);
		if (!productId) throw new CustomError(404, "item does not exist in cart");

		const removed = await new CartRepository(db).removeItem(user.id, productId);
		if (!removed) throw new CustomError(404, "item does not exist in cart");

		sendNoContent(res);
	},
});
