import type { Awaitable, HTTPMethod, UserRole } from "#src/types";
import type { IncomingMessage, ServerResponse } from "http";
import type { Server } from "./Server.js";
import type postgres from "postgres";
import type { ZodType } from "zod";
import type { ApiErrorCode } from "../responses.js";

export class Route {
	public description?: string | undefined;
	public auth?: RouteAuth | undefined;
	public contracts: RouteContracts;
	public GET?(options: MethodOptions): Awaitable<unknown>;
	public POST?(options: MethodOptions): Awaitable<unknown>;
	public PUT?(options: MethodOptions): Awaitable<unknown>;
	public PATCH?(options: MethodOptions): Awaitable<unknown>;
	public DELETE?(options: MethodOptions): Awaitable<unknown>;

	public constructor(data: RouteOptions) {
		this.description = data.description;
		this.auth = data.auth;
		this.contracts = data.contracts ?? {};
		if (data.GET) this.GET = data.GET;
		if (data.POST) this.POST = data.POST;
		if (data.PUT) this.PUT = data.PUT;
		if (data.PATCH) this.PATCH = data.PATCH;
		if (data.DELETE) this.DELETE = data.DELETE;
	}
}

export interface RouteOptions {
	description?: string;
	auth?: RouteAuth;
	contracts?: RouteContracts;
	GET?: RouteHandler;
	POST?: RouteHandler;
	PUT?: RouteHandler;
	PATCH?: RouteHandler;
	DELETE?: RouteHandler;
}

export type RouteHandler = (options: MethodOptions) => Awaitable<unknown>;

export type RouteContracts = Partial<Record<HTTPMethod, OperationContract>>;

/** A schema plus the stable component name to use when it is shared. */
export interface ContractSchema {
	schema: ZodType;
	componentName?: string;
}

export interface ContractExample {
	summary?: string;
	description?: string;
	value: unknown;
}

export interface ParameterContract extends ContractSchema {
	description: string;
	example?: unknown;
	examples?: Readonly<Record<string, ContractExample>>;
}

export interface OperationParameters {
	path?: Readonly<Record<string, ParameterContract>>;
	query?: ContractSchema;
}

export interface RequestBodyContract extends ContractSchema {
	description?: string;
	required?: boolean;
	contentTypes?: readonly string[];
	examples?: Readonly<Record<string, ContractExample>>;
}

export interface ErrorContract {
	code: ApiErrorCode;
	description?: string;
	details?: ContractSchema;
}

export interface ResponseContract {
	description: string;
	data?: ContractSchema;
	meta?: ContractSchema;
	errors?: readonly ErrorContract[];
	examples?: Readonly<Record<string, ContractExample>>;
}

export interface OperationContract {
	summary: string;
	description?: string;
	tags?: readonly string[];
	operationId?: string;
	parameters?: OperationParameters;
	requestBody?: RequestBodyContract;
	responses: Readonly<Record<number, ResponseContract>>;
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
