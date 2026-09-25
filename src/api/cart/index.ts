import {
	addToCartSchema,
	cartMutationResultWireSchema,
	cartWireSchema,
	CartRepository,
	CustomError,
	parseRequest,
	ProductRepository,
	Route,
	sendData,
	sendNoContent,
	validationDetailsWireSchema,
} from "#lib";

export default new Route({
	description: "Manage cart",
	auth: { GET: { required: true }, POST: { required: true }, DELETE: { required: true } },
	contracts: {
		GET: {
			summary: "List cart items",
			tags: ["Cart"],
			responses: { 200: { description: "The caller's cart", data: cartWireSchema } },
		},
		POST: {
			summary: "Add a product to the cart",
			tags: ["Cart"],
			requestBody: {
				description: "The product and quantity to add",
				required: true,
				schema: addToCartSchema,
			},
			responses: {
				201: { description: "The stored cart item", data: cartMutationResultWireSchema },
				400: {
					description: "The request body is invalid",
					errors: [{ code: "VALIDATION_FAILED", details: validationDetailsWireSchema }],
				},
				404: { description: "The product does not exist", errors: [{ code: "NOT_FOUND" }] },
				409: {
					description: "The requested quantity exceeds available stock",
					errors: [{ code: "CONFLICT" }],
				},
			},
		},
		DELETE: {
			summary: "Clear the cart",
			description: "Clearing an empty cart also succeeds.",
			tags: ["Cart"],
			responses: { 204: { description: "The cart was cleared" } },
		},
	},
	GET: async ({ res, db, user }) => {
		if (!user) throw new Error("user undefined");
		const userId = user.id;
		const cartItems = await new CartRepository(db).getByUserId(userId);
		sendData(res, cartItems);
	},
	POST: async ({ res, db, user, body }) => {
		if (!user) throw new Error("user undefined");
		const data = parseRequest(addToCartSchema, body);

		// Check if product exists
		const exists = await new ProductRepository(db).exists(data.product_id);
		if (!exists) throw new CustomError(404, "product not found");
		const cartRepo = new CartRepository(db);
		const currItemQuantity = (await cartRepo.findItem(user.id, data.product_id))?.quantity ?? 0;

		if (exists.stock < currItemQuantity + data.quantity)
			throw new CustomError(409, "Requested quantity exceeds available stock");

		const addToCart = await cartRepo.upsertItem(user.id, data.product_id, data.quantity);

		sendData(res, addToCart, { status: 201 });
	},
	// Idempotent: clearing an already-empty cart is not an error.
	DELETE: async ({ res, db, user }) => {
		if (!user) throw new Error("user undefined");
		await new CartRepository(db).clearCart(user.id);

		sendNoContent(res);
	},
});
