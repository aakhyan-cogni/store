import {
	paginationWireSchema,
	parseProductQuery,
	productListWireSchema,
	productQueryContractSchema,
	ProductRepository,
	Route,
	sendData,
	validationDetailsWireSchema,
} from "#lib";

export default new Route({
	description: "Browse products, with optional search, filters and paging",
	contracts: {
		GET: {
			summary: "Browse Products",
			description: "Returns listed Products matching the supplied search, Category, Price, and pagination filters.",
			tags: ["Catalogue"],
			parameters: { query: { schema: productQueryContractSchema, componentName: "ProductQuery" } },
			responses: {
				200: {
					description: "A page of listed Products",
					data: productListWireSchema,
					meta: paginationWireSchema,
				},
				400: {
					description: "Invalid search, filter, or pagination parameters",
					errors: [{ code: "VALIDATION_FAILED", details: validationDetailsWireSchema }],
				},
			},
		},
	},
	GET: async ({ res, db, query }) => {
		const parsedQuery = parseProductQuery(query);
		const productRepo = new ProductRepository(db);
		const { products, total } = await productRepo.getAll(parsedQuery);

		sendData(res, products, {
			meta: { limit: parsedQuery.limit, offset: parsedQuery.offset, total },
		});
	},
});
