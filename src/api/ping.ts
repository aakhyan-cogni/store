import { Route } from "#lib";

export default new Route({
	description: "Health check",
	GET: ({ res }) => {
		res.end(JSON.stringify({ status: "ok", timestamp: Date.now() }));
	},
});
