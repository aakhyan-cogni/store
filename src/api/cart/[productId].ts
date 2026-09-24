import { CartRepository, CustomError, parseRouteId, ProductRepository, Route, updateCartItemSchema } from "#lib";

export default new Route({
	description: "Cart Product management",
	auth: { PATCH: { required: true }, DELETE: { required: true } },
	PATCH: async ({ res, db, user, body, params }) => {
		if (!user) throw new Error("user not defined");
		const productId = parseRouteId(params?.productId);
		const data = updateCartItemSchema.parse(body);
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

		res.end(JSON.stringify(updated));
	},
	// Deliberately does not require the product to still be listed: a delisted
	// line has to be removable, or the cart holding it can never check out.
	DELETE: async ({ res, db, user, params }) => {
		if (!user) throw new Error("user not defined");
		const productId = parseRouteId(params?.productId);
		if (!productId) throw new CustomError(404, "item does not exist in cart");

		const removed = await new CartRepository(db).removeItem(user.id, productId);
		if (!removed) throw new CustomError(404, "item does not exist in cart");

		res.writeHead(204).end();
	},
});
