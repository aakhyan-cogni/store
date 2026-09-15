import { addToCartSchema, CartRepository, CustomError, ProductRepository, Route } from "#lib";

export default new Route({
	description: "Manage cart",
	auth: { GET: { required: true }, POST: { required: true } },
	GET: async ({ res, db, user }) => {
		if (!user) throw new Error("user undefined");
		const userId = user.id;
		const cartItems = await new CartRepository(db).getByUserId(userId);
		res.end(JSON.stringify(cartItems));
	},
	POST: async ({ res, db, user, body }) => {
		if (!user) throw new Error("user undefined");
		const data = addToCartSchema.parse(body);

		// Check if product exists
		const exists = await new ProductRepository(db).exists(data.product_id);
		if (!exists) throw new CustomError(404, "product not found");
		const cartRepo = new CartRepository(db);
		const currItemQuantity = (await cartRepo.findItem(user.id, data.product_id))?.quantity ?? 0;

		if (exists.stock < currItemQuantity + data.quantity)
			throw new CustomError(409, "Requested quantity exceeds available stock");

		const addToCart = await cartRepo.upsertItem(user.id, data.product_id, data.quantity);

		res.writeHead(201).end(JSON.stringify(addToCart));
	},
});
