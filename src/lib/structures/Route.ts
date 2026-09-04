import type { Awaitable, HTTPMethod, UserRole } from "#src/types";
import type { IncomingMessage, ServerResponse } from "http";
import type { Server } from "./Server.js";
import type postgres from "postgres";

export class Route {
	public description?: string | undefined;
	public auth?: RouteAuth | undefined;
	public GET?(options: MethodOptions): Awaitable<unknown>;
	public POST?(options: MethodOptions): Awaitable<unknown>;
	public PUT?(options: MethodOptions): Awaitable<unknown>;
	public PATCH?(options: MethodOptions): Awaitable<unknown>;
	public DELETE?(options: MethodOptions): Awaitable<unknown>;

	public constructor(data: RouteOptions) {
		this.description = data.description;
		this.auth = data.auth;
		if (data.GET) this.GET = data.GET;
		if (data.POST) this.POST = data.POST;
		if (data.PUT) this.PUT = data.PUT;
		if (data.PATCH) this.PATCH = data.PATCH;
		if (data.DELETE) this.DELETE = data.DELETE;
	}
}

interface RouteOptions {
	description?: string;
	auth?: RouteAuth;
	GET?: (options: MethodOptions) => Awaitable<unknown>;
	POST?: (options: MethodOptions) => Awaitable<unknown>;
	PUT?: (options: MethodOptions) => Awaitable<unknown>;
	PATCH?: (options: MethodOptions) => Awaitable<unknown>;
	DELETE?: (options: MethodOptions) => Awaitable<unknown>;
}

export type RouteAuth = Partial<Record<HTTPMethod, MethodAuth>>;

export interface MethodAuth {
	required: boolean;
	roles?: UserRole[];
}

export interface RequestUser {
	id: number;
	role: UserRole;
}

export interface MethodOptions {
	req: IncomingMessage;
	res: ServerResponse<IncomingMessage>;
	params?: Record<string, string>;
	query: URLSearchParams;
	body?: unknown;
	user?: RequestUser;
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
