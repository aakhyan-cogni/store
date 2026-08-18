import { Route } from "#lib";

export default new Route({
	description: "Health check",
	GET: ({ res }) => {
		res.writeHead(200, { "Content-Type": "application/json" });
		res.end(JSON.stringify({ status: "ok", timestamp: Date.now() }));
	},
});
