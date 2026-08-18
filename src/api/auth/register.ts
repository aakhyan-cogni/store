import { Parser, Route } from "#lib";

export default new Route({
	description: "Register a new user",
	POST: async ({ req, res }) => {
		res.writeHead(201, { "Content-Type": "application/json" });
		res.end(JSON.stringify({ message: "registered" }));
	},
});
