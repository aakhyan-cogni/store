import { parseProductQuery, ProductRepository, Route, sendData } from "#lib";

export default new Route({
	description: "Browse products, with optional search, filters and paging",
	GET: async ({ res, db, query }) => {
		const parsedQuery = parseProductQuery(query);
		const productRepo = new ProductRepository(db);
		const { products, total } = await productRepo.getAll(parsedQuery);

		sendData(res, products, {
			meta: { limit: parsedQuery.limit, offset: parsedQuery.offset, total },
		});
	},
});
