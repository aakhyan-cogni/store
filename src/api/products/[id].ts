import { CustomError, ProductRepository, Route, updateProductSchema } from "#lib";

export default new Route({
	description: "Get / update / delete a single product",
	auth: {
		PATCH: { required: true, roles: ["ADMIN"] },
		DELETE: { required: true, roles: ["ADMIN"] },
		GET: { required: true },
	},
	GET: async ({ res, params, db }) => {
		if (!params || !params.id) throw new Error("params is undefined");
		const id = Number(params.id);
		if (isNaN(id)) throw new CustomError(404, "product not found");

		const product = await new ProductRepository(db).get(id);
		res.end(JSON.stringify({ product }));
	},
	PATCH: async ({ res, params, db, body }) => {
		if (!params || !params.id) throw new Error("params is undefined");
		const id = Number(params.id);
		if (isNaN(id)) throw new CustomError(404, "product not found");

		const data = updateProductSchema.parse(body);

		const product = await new ProductRepository(db).update(id, data);
		res.end(JSON.stringify({ message: "Updated product", product }));
	},
	DELETE: async ({ res, params, db }) => {
		if (!params || !params.id) throw new Error("params is undefined");
		const id = Number(params.id);
		if (isNaN(id)) throw new CustomError(404, "product not found");

		await new ProductRepository(db).delete(id);
		res.writeHead(204).end();
	},
});
