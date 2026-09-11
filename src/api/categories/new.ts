import { CategoryRepository, newCategorySchema, ProductRepository, Route } from "#lib";

export default new Route({
	description: "Create new category",
	auth: { POST: { required: true, roles: ["ADMIN"] } },
	POST: async ({ res, db, body }) => {
		const categoryRepo = new CategoryRepository(db);
		const data = newCategorySchema.parse(body);

		const category = await categoryRepo.create(data);
		res.writeHead(201);
		res.end(JSON.stringify({ message: "Successfully created new category", category }));
	},
});
