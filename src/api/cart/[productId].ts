import { CartRepository, CustomError, ProductRepository, Route, updateCartItemSchema } from "#lib";

export default new Route({
	description: "Cart Product management",
	auth: { PATCH: { required: true }, DELETE: { required: true } },
	PATCH: async ({ res, db, user, body, params }) => {
		if (!user) throw new Error("user not defined");
		const productId = Number(params?.productId);
		const data = updateCartItemSchema.parse(body);
		if (isNaN(productId)) throw new CustomError(404, "product not found");

		const productRepo = new ProductRepository(db);
		const cartRepo = new CartRepository(db);

		const exists = await productRepo.exists(productId);
		if (!exists) throw new CustomError(404, "product not found");
		const { stock } = exists;
		const item = await cartRepo.findItem(user.id, productId);
		if (!item) throw new CustomError(404, "item does not exist in cart");
		if (data.quantity > stock) throw new CustomError(409, "Requested quantity exceeds available stock");

		const updated = await cartRepo.updateQuantity(user.id, productId, data.quantity);

		res.end(JSON.stringify(updated));
	},
	DELETE: async ({ res, db, user, params }) => {
		if (!user) throw new Error("user not defined");
		const productId = Number(params?.productId);
		if (isNaN(productId)) throw new CustomError(404, "product not found");

		const productRepo = new ProductRepository(db);
		const cartRepo = new CartRepository(db);

		const exists = await productRepo.exists(productId);
		if (!exists) throw new CustomError(404, "product not found");

		await cartRepo.removeItem(user.id, productId);
		res.writeHead(204).end();
	},
});
