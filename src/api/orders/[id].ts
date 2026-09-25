import {
	CustomError,
	OrderRepository,
	orderWireSchema,
	parseRequest,
	parseRouteId,
	Route,
	sendData,
	updateOrderSchema,
	validationDetailsWireSchema,
} from "#lib";
import { z } from "zod";

const orderIdParameter = {
	schema: z.string().regex(/^[1-9]\d*$/),
	description: "The order identifier",
	example: "42",
};

function orderIdFrom(params: Record<string, string> | undefined) {
	const id = parseRouteId(params?.id);
	if (!id) throw new CustomError(404, "order not found");
	return id;
}

export default new Route({
	description: "Read or cancel one of the caller's orders",
	auth: { GET: { required: true }, PATCH: { required: true } },
	contracts: {
		GET: {
			summary: "Get an order",
			tags: ["Order"],
			parameters: { path: { id: orderIdParameter } },
			responses: {
				200: { description: "The order and its items", data: orderWireSchema },
				404: { description: "The order does not exist", errors: [{ code: "NOT_FOUND" }] },
			},
		},
		PATCH: {
			summary: "Cancel an order",
			description: "Only an Order awaiting payment and owned by the caller can be cancelled.",
			tags: ["Order"],
			parameters: { path: { id: orderIdParameter } },
			requestBody: {
				description: "The cancellation status transition",
				required: true,
				schema: updateOrderSchema,
			},
			responses: {
				200: { description: "The cancelled order", data: orderWireSchema },
				400: {
					description: "The request body is invalid",
					errors: [{ code: "VALIDATION_FAILED", details: validationDetailsWireSchema }],
				},
				404: { description: "The order does not exist", errors: [{ code: "NOT_FOUND" }] },
				409: {
					description: "The order is paid or already cancelled",
					errors: [{ code: "CONFLICT" }],
				},
			},
		},
	},
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
