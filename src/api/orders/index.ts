import { OrderRepository, Route, sendData } from "#lib";

export default new Route({
	description: "Check out the cart, and list the caller's orders",
	auth: { GET: { required: true }, POST: { required: true } },
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
