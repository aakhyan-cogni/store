import { categoryListWireSchema, CategoryRepository, Route, sendData } from "#lib";

export default new Route({
	description: "Get all categories",
	contracts: {
		GET: {
			summary: "List Categories",
			tags: ["Catalogue"],
			responses: {
				200: { description: "All Categories", data: categoryListWireSchema },
			},
		},
	},
	GET: async ({ res, db }) => {
		const categoryRepo = new CategoryRepository(db);
		const categories = await categoryRepo.getAll();

		sendData(res, categories);
	},
});
