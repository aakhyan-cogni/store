import { Route, sendData } from "#lib";

export default new Route({
	description: "Health check",
	GET: ({ res }) => {
		sendData(res, { status: "ok", timestamp: Date.now() });
	},
});
