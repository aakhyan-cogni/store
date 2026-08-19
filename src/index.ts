import { Server } from "#lib";

const server = new Server();
await server.start();

const shutdown = async () => {
	await server.shutdown();
	process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
