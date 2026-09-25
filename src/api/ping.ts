import { healthWireSchema, Route, sendData } from "#lib";

export default new Route({
	description: "Health check",
	contracts: {
		GET: {
			summary: "Check API health",
			description: "Reports whether the API process is available and returns the current server timestamp.",
			tags: ["Health"],
			responses: {
				200: {
					description: "The API is healthy",
					data: healthWireSchema,
					examples: {
						healthy: {
							summary: "Healthy response",
							value: { data: { status: "ok", timestamp: 1_758_739_200_000 } },
						},
					},
				},
			},
		},
	},
	GET: ({ res }) => {
		sendData(res, { status: "ok", timestamp: Date.now() });
	},
});
