import { CategoryRepository, newCategorySchema, parseRequest, Route, sendData } from "#lib";

export default new Route({
	description: "Create new category",
	auth: { POST: { required: true, roles: ["ADMIN"] } },
	POST: async ({ res, db, body }) => {
		const categoryRepo = new CategoryRepository(db);
		const data = parseRequest(newCategorySchema, body);

		const category = await categoryRepo.create(data);
		sendData(res, category, { status: 201 });
	},
});
