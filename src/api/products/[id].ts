import { Route } from "#lib";

export default new Route({
	description: "Get / update / delete a single product",
	GET: async ({ req, res }) => {
		res.writeHead(200, { "Content-Type": "application/json" });
		res.end(JSON.stringify({ product: null }));
	},
	PUT: async ({ req, res }) => {
		res.writeHead(200, { "Content-Type": "application/json" });
		res.end(JSON.stringify({ message: "updated" }));
	},
	DELETE: async ({ req, res }) => {
		res.writeHead(204);
		res.end();
	},
});
