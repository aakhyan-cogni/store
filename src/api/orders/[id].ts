import { CustomError, OrderRepository, parseRequest, parseRouteId, Route, sendData, updateOrderSchema } from "#lib";

function orderIdFrom(params: Record<string, string> | undefined) {
	const id = parseRouteId(params?.id);
	if (!id) throw new CustomError(404, "order not found");
	return id;
}

export default new Route({
	description: "Read or cancel one of the caller's orders",
	auth: { GET: { required: true }, PATCH: { required: true } },
	GET: async ({ res, db, user, params }) => {
		if (!user) throw new Error("user undefined");

		const order = await new OrderRepository(db).getById(user.id, orderIdFrom(params));
		sendData(res, order);
	},
	PATCH: async ({ res, db, user, params, body }) => {
		if (!user) throw new Error("user undefined");
		const id = orderIdFrom(params);

		// The schema admits CANCELLED only, so any other status is a 400.
		parseRequest(updateOrderSchema, body);

		const order = await new OrderRepository(db).cancel(user.id, id);
		sendData(res, order);
	},
});
