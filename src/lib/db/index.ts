import type { Server } from "#lib";
import postgres from "postgres";

export class DB {
	private static instance: DB | undefined;
	private client: postgres.Sql;
	private constructor(server: Server) {
		server.logger.info("Initiated DB...");
		this.client = postgres(process.env.DATABASE_URL);
	}
	public static getInstance(server: Server): DB {
		return this.instance ?? (this.instance = new DB(server));
	}
	public getClient() {
		return this.client;
	}
}
