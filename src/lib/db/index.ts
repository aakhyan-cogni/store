import type { Server } from "#lib";
import postgres from "postgres";
export * from "./repositories/index.js";

export class DB {
	private static instance: DB | undefined;
	private client: postgres.Sql;
	private constructor(server: Server) {
		server.logger.info("Initiated DB...");
		this.client = postgres(process.env.DATABASE_URL);
	}
	public static initialize(server: Server) {
		return this.instance ?? (this.instance = new DB(server));
	}
	public static getInstance(): DB {
		if (!this.instance) throw new Error("DB uninitialized");
		return this.instance;
	}
	public getClient() {
		return this.client;
	}
	public async close() {
		return this.client.end();
	}
}
export * from "./types.js";
