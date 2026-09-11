import { CategoryRepository, Route } from "#lib";

export default new Route({
	description: "Get all categories",
	auth: { GET: { required: true } },
	GET: async ({ res, db }) => {
		const categoryRepo = new CategoryRepository(db);
		const categories = await categoryRepo.getAll();

		res.end(JSON.stringify(categories));
	},
});
