import { orderListWireSchema, OrderRepository, orderWireSchema, Route, sendData } from "#lib";

export default new Route({
	description: "Check out the cart, and list the caller's orders",
	auth: { GET: { required: true }, POST: { required: true } },
	contracts: {
		GET: {
			summary: "List orders",
			tags: ["Order"],
			responses: { 200: { description: "The caller's orders", data: orderListWireSchema } },
		},
		POST: {
			summary: "Check out the cart",
			description: "Creates an order for every item in the cart and clears the cart.",
			tags: ["Order"],
			responses: {
				201: { description: "The created order", data: orderWireSchema },
				409: {
					description: "The Cart is empty, contains an unlisted Product, or contains a Product with insufficient Stock",
					errors: [{ code: "CONFLICT" }],
				},
			},
		},
	},
	GET: async ({ res, db, user }) => {
		if (!user) throw new Error("user undefined");
		const orders = await new OrderRepository(db).getByUserId(user.id);

		sendData(res, orders);
	},
	POST: async ({ res, db, user }) => {
		if (!user) throw new Error("user undefined");
		const order = await new OrderRepository(db).checkout(user.id);

		sendData(res, order, { status: 201 });
	},
});
