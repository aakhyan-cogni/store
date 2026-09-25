import { randomUUID } from "node:crypto";
import { registerRoutes } from "../registry/index.js";
import { DB } from "../db/index.js";
import { Logger } from "./Logger.js";
import { Parser } from "./Parser.js";
import { Server as NodeServer, type IncomingMessage, type ServerResponse } from "http";
import type { RegisteredRoute, Route } from "./Route.js";
import { HTTP_METHODS, type HTTPMethod } from "#src/types";
import { authorizeRequest } from "../auth/middleware.js";
import { toErrorResponse } from "../errors.js";
import { loadEnv } from "../env.js";
import { getRequestUrl } from "../utils.js";
import { sendError, sendNoContent } from "../responses.js";
import postgres from "postgres";

const BODY_METHODS = new Set<HTTPMethod>(["POST", "PUT", "PATCH"]);

/** How long a client may take over its headers, and over the whole request. */
const HEADERS_TIMEOUT_MS = 10_000;
const REQUEST_TIMEOUT_MS = 30_000;

/** How long in-flight requests get to finish once shutdown has started. */
const DRAIN_TIMEOUT_MS = 10_000;
const IDLE_SWEEP_MS = 250;

function isHTTPMethod(method: string | undefined): method is HTTPMethod {
	return HTTP_METHODS.includes(method as HTTPMethod);
}

export class Server extends NodeServer {
	public readonly logger = Logger.init();
	public staticRoutes = new Map<string, Route>();
	public dynamicRoutes: RegisteredRoute[] = [];
	private readonly db: postgres.Sql;
	private shuttingDown: Promise<void> | undefined;

	public constructor() {
		super();
		this.logger.info("Initiated Server...");
		this.db = DB.initialize(this).getClient();
		this.headersTimeout = HEADERS_TIMEOUT_MS;
		this.requestTimeout = REQUEST_TIMEOUT_MS;
	}

	public dispatchRequests() {
		this.on("request", (req, res) => void this.handleRequest(req, res));
	}

	private async handleRequest(req: IncomingMessage, res: ServerResponse<IncomingMessage>) {
		const requestId = randomUUID();
		const startedAt = performance.now();
		let userId: number | undefined;
		let path = "<missing>";
		res.setHeader("x-request-id", requestId);
		let accessLogged = false;
		const logAccess = () => {
			if (accessLogged) return;
			accessLogged = true;
			this.logger.http({
				message: "request",
				method: req.method ?? "UNKNOWN",
				path,
				status: res.writableFinished ? res.statusCode : 499,
				duration_ms: Number((performance.now() - startedAt).toFixed(2)),
				request_id: requestId,
				...(userId === undefined ? {} : { user_id: userId }),
			});
		};
		res.once("finish", logAccess);
		res.once("close", logAccess);

		try {
			if (!req.url) {
				this.logger.error(`[${requestId}] URL missing in request`);
				return sendError(res, 500, "INTERNAL_ERROR", "Internal Server Error");
			}
			const url = getRequestUrl(req);
			path = url.pathname;
			const corsAllowed = this.applyCors(req, res);

			if (req.method === "OPTIONS") {
				const allowed = this.allowedMethods(path);
				if (!allowed.length) return sendError(res, 404, "NOT_FOUND", "Resource not found");
				const advertised = this.advertisedMethods(allowed);
				res.setHeader("allow", advertised.join(", "));
				if (corsAllowed) {
					res.setHeader("access-control-allow-methods", advertised.join(", "));
					res.setHeader("access-control-allow-headers", "Authorization, Content-Type");
				}
				return sendNoContent(res);
			}

			// Narrowed rather than cast: `req.method` is whatever the client
			// sent, and the union only covers what this server implements.
			const routeMethod = req.method === "HEAD" ? "GET" : req.method;
			if (!isHTTPMethod(routeMethod)) {
				const allowed = this.allowedMethods(path);
				if (allowed.length) res.setHeader("allow", this.advertisedMethods(allowed).join(", "));
				return sendError(res, 501, "NOT_IMPLEMENTED", "Method not implemented");
			}
			const method = routeMethod;

			const resolved = this.resolveHandler(path, method);
			if (!resolved) {
				const allowed = this.allowedMethods(path);
				// RFC 9110: a 405 has to say what the resource does support.
				if (allowed.length) {
					res.setHeader("allow", this.advertisedMethods(allowed).join(", "));
					return sendError(res, 405, "METHOD_NOT_ALLOWED", "Method not allowed");
				}
				return sendError(res, 404, "NOT_FOUND", "Resource not found");
			}
			const { handler, params, auth } = resolved;

			const authorization = authorizeRequest(req, auth);
			if (!authorization.authorized) {
				if (authorization.status === 401) res.setHeader("WWW-Authenticate", "Bearer");
				this.logger.warn(`[${requestId}] Rejected ${method}:${path} with ${authorization.status}`);
				return sendError(
					res,
					authorization.status,
					authorization.status === 401 ? "UNAUTHENTICATED" : "FORBIDDEN",
					authorization.status === 401 ? "Authentication required" : "Access forbidden",
				);
			}
			userId = authorization.user?.id;

			let body: unknown;
			if (BODY_METHODS.has(method)) {
				try {
					body = await Parser.parseBody(req);
				} catch (err) {
					this.logger.warn(`[${requestId}] Failed to parse request body for ${method}:${path}`);
					return sendError(res, 400, "VALIDATION_FAILED", "Request body could not be parsed");
				}
			}

			try {
				await handler({
					req,
					res,
					...(params && { params }),
					...(authorization.user && { user: authorization.user }),
					query: url.searchParams,
					body,
					db: this.db,
					server: this,
				});
			} catch (err) {
				const { status, body: errorBody, logLevel, logMessage } = toErrorResponse(err, requestId);

				this.logger[logLevel](`${method}:${path} ${logMessage}`);
				if (res.headersSent) return res.end();
				res.statusCode = status;
				res.setHeader("content-type", "application/json");
				const payload = JSON.stringify(errorBody);
				res.setHeader("content-length", Buffer.byteLength(payload));
				res.end(payload);
			}
		} catch (err) {
			const { status, body, logLevel, logMessage } = toErrorResponse(err, requestId);
			this.logger[logLevel](logMessage);
			if (res.headersSent) return res.end();
			res.statusCode = status;
			res.setHeader("content-type", "application/json");
			const payload = JSON.stringify(body);
			res.setHeader("content-length", Buffer.byteLength(payload));
			res.end(payload);
		}
	}

	private applyCors(req: IncomingMessage, res: ServerResponse<IncomingMessage>) {
		const origin = req.headers.origin;
		res.setHeader("vary", "Origin");
		if (origin && loadEnv().CORS_ORIGINS.includes(origin)) {
			res.setHeader("access-control-allow-origin", origin);
			res.setHeader("access-control-expose-headers", "x-request-id, retry-after");
			return true;
		}
		return false;
	}

	private advertisedMethods(methods: HTTPMethod[]) {
		const advertised: string[] = [];
		for (const method of methods) {
			advertised.push(method);
			if (method === "GET") advertised.push("HEAD");
		}
		advertised.push("OPTIONS");
		return advertised;
	}

	private resolveHandler(path: string, method: HTTPMethod) {
		const staticRoute = this.staticRoutes.get(`${method}:${path}`);
		const handler = staticRoute?.[method];
		if (staticRoute && handler) return { handler, params: undefined, auth: staticRoute.auth?.[method] };

		for (const dynamicRoute of this.dynamicRoutes) {
			if (dynamicRoute.method !== method) continue;
			const match = path.match(dynamicRoute.regex);
			if (!match) continue;
			const params: Record<string, string> = {};
			dynamicRoute.params.forEach((name, idx) => {
				params[name] = match[idx + 1]!;
			});
			return { handler: dynamicRoute.route[method]!, params, auth: dynamicRoute.route.auth?.[method] };
		}
		return null;
	}

	/** Which methods this path answers, read back out of the route tables. */
	private allowedMethods(path: string) {
		const allowed = HTTP_METHODS.filter((method) => Boolean(this.staticRoutes.get(`${method}:${path}`)?.[method]));
		for (const route of this.dynamicRoutes) {
			if (route.regex.test(path) && !allowed.includes(route.method)) allowed.push(route.method);
		}
		return allowed;
	}

	public async start() {
		// Before anything binds a port or opens a connection: a bad secret or a
		// missing URL should stop the boot, not surface as a 500 later.
		const env = loadEnv();

		try {
			await this.db`select 1`;
		} catch (e) {
			const error = e as Error;
			this.logger.error({ message: error.message, stack: error.stack });
			throw e;
		}

		await registerRoutes(this);

		this.dispatchRequests();
		this.listen(env.PORT, () => {
			this.logger.info(`Server has started, listening on http://localhost:${env.PORT}`);
		});
	}

	/**
	 * Stops accepting work, lets what is in flight finish, and only then closes
	 * the pool — in that order, because ending the pool first would fail every
	 * request currently mid-query.
	 *
	 * Bounded: `close` alone waits for every keep-alive socket to go idle, so a
	 * single parked client would otherwise hold the process open until the
	 * orchestrator kills it.
	 */
	public async shutdown() {
		// A second SIGTERM joins the shutdown already running rather than
		// starting a competing one.
		return (this.shuttingDown ??= this.drainAndClose());
	}

	private async drainAndClose() {
		this.logger.info("Shutting down...");

		const closed = new Promise<void>((resolve) => super.close(() => resolve()));

		// Swept repeatedly, not once: a keep-alive socket that goes idle after
		// its request finishes would otherwise hold `close` open until the
		// client happened to hang up.
		this.closeIdleConnections();
		const sweep = setInterval(() => this.closeIdleConnections(), IDLE_SWEEP_MS).unref();

		const drained = await Promise.race([
			closed.then(() => true),
			new Promise<false>((resolve) => setTimeout(() => resolve(false), DRAIN_TIMEOUT_MS).unref()),
		]);
		clearInterval(sweep);

		if (!drained) {
			this.logger.warn(`In-flight requests did not finish within ${DRAIN_TIMEOUT_MS}ms, closing anyway`);
			this.closeAllConnections();
		}

		await DB.getInstance().close();
		this.logger.info("Shutdown complete");
	}
}
