import { ProductRepository, Route } from "#lib";

export default new Route({
	description: "Get all products",
	auth: { GET: { required: true } },
	GET: async ({ res, db }) => {
		const productRepo = new ProductRepository(db);
		const products = await productRepo.getAll();

		res.end(JSON.stringify(products));
	},
});
