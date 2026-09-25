import {
	addToCartSchema,
	CartRepository,
	CustomError,
	parseRequest,
	ProductRepository,
	Route,
	sendData,
	sendNoContent,
} from "#lib";

export default new Route({
	description: "Manage cart",
	auth: { GET: { required: true }, POST: { required: true }, DELETE: { required: true } },
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
