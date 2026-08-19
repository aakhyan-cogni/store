import type { Awaitable, HTTPMethod } from "#src/types";
import type { IncomingMessage, ServerResponse } from "http";
import type { Server } from "./Server.js";
import type postgres from "postgres";

export class Route {
	public description?: string | undefined;
	public GET?(options: MethodOptions): Awaitable<unknown>;
	public POST?(options: MethodOptions): Awaitable<unknown>;
	public PUT?(options: MethodOptions): Awaitable<unknown>;
	public PATCH?(options: MethodOptions): Awaitable<unknown>;
	public DELETE?(options: MethodOptions): Awaitable<unknown>;

	public constructor(data: RouteOptions) {
		this.description = data.description;
		if (data.GET) this.GET = data.GET;
		if (data.POST) this.POST = data.POST;
		if (data.PUT) this.PUT = data.PUT;
		if (data.PATCH) this.PATCH = data.PATCH;
		if (data.DELETE) this.DELETE = data.DELETE;
	}
}

interface RouteOptions {
	description?: string;
	GET?: (options: MethodOptions) => Awaitable<unknown>;
	POST?: (options: MethodOptions) => Awaitable<unknown>;
	PUT?: (options: MethodOptions) => Awaitable<unknown>;
	PATCH?: (options: MethodOptions) => Awaitable<unknown>;
	DELETE?: (options: MethodOptions) => Awaitable<unknown>;
}

interface MethodOptions {
	req: IncomingMessage;
	res: ServerResponse<IncomingMessage>;
	params?: Record<string, string>;
	query: URLSearchParams;
	body?: unknown;
	server: Server;
	db: postgres.Sql;
}

export interface RegisteredRoute {
	method: HTTPMethod;
	path: string;
	regex: RegExp;
	params: string[];
	route: Route;
}
