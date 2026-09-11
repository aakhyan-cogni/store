import { CategoryRepository, CustomError, newProductSchema, ProductRepository, Route } from "#lib";

export default new Route({
	description: "New product creation",
	auth: {
		POST: { required: true, roles: ["ADMIN"] },
	},
	POST: async ({ body, res, db }) => {
		const data = newProductSchema.parse(body);
		const categoryRepo = new CategoryRepository(db);
		const productRepo = new ProductRepository(db);

		if (!(await categoryRepo.exists(data.category_id)))
			throw new CustomError(400, `category_id '${data.category_id}' doesn't exist.`);

		const product = await productRepo.create(data);
		res.writeHead(201).end(JSON.stringify({ message: "Successfully created new product", product }));
	},
});
