import { parseProductQuery, ProductRepository, Route } from "#lib";

export default new Route({
	description: "Browse products, with optional search, filters and paging",
	auth: { GET: { required: true } },
	GET: async ({ res, db, query }) => {
		const productRepo = new ProductRepository(db);
		const products = await productRepo.getAll(parseProductQuery(query));

		res.end(JSON.stringify(products));
	},
});
