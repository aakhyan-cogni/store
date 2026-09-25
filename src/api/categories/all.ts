import { CategoryRepository, Route, sendData } from "#lib";

export default new Route({
	description: "Get all categories",
	GET: async ({ res, db }) => {
		const categoryRepo = new CategoryRepository(db);
		const categories = await categoryRepo.getAll();

		sendData(res, categories);
	},
});
