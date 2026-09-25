import {
	CustomError,
	parseRequest,
	parseRouteId,
	ProductRepository,
	Route,
	sendData,
	sendNoContent,
	updateProductSchema,
} from "#lib";

function productIdFrom(params: Record<string, string> | undefined) {
	const id = parseRouteId(params?.id);
	if (!id) throw new CustomError(404, "product not found");
	return id;
}

export default new Route({
	description: "Get / update / delete a single product",
	auth: {
		PATCH: { required: true, roles: ["ADMIN"] },
		DELETE: { required: true, roles: ["ADMIN"] },
	},
	GET: async ({ res, params, db }) => {
		const product = await new ProductRepository(db).get(productIdFrom(params));
		sendData(res, product);
	},
	PATCH: async ({ res, params, db, body }) => {
		const id = productIdFrom(params);
		const data = parseRequest(updateProductSchema, body);

		const product = await new ProductRepository(db).update(id, data);
		sendData(res, product);
	},
	DELETE: async ({ res, params, db }) => {
		await new ProductRepository(db).delete(productIdFrom(params));
		sendNoContent(res);
	},
});
