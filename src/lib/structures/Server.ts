import { registerRoutes, DB } from "#lib";
import { Logger } from "./Logger.js";
import { Parser } from "./Parser.js";
import { Server as NodeServer } from "http";
import { z } from "zod";
import type { RegisteredRoute, Route } from "./Route.js";
import type { HTTPMethod } from "#src/types";
import { authorizeRequest } from "../auth/middleware.js";
import { getRequestUrl } from "../utils.js";
import type postgres from "postgres";

const BODY_METHODS = new Set<HTTPMethod>(["POST", "PUT", "PATCH"]);

export class Server extends NodeServer {
	public readonly logger = Logger.init();
	public staticRoutes = new Map<string, Route>();
	public dynamicRoutes: RegisteredRoute[] = [];
	public readonly knownPaths = new Set<string>();
	private readonly db: postgres.Sql;

	public constructor() {
		super();
		this.logger.info("Initiated Server...");
		this.db = DB.initialize(this).getClient();
	}

	public dispatchRequests() {
		this.on("request", async (req, res) => {
			if (!req.url) {
				this.logger.error(`URL missing in request from ${req.socket.remoteAddress ?? "unknown"}`);
				return res.writeHead(500).end();
			}
			const url = getRequestUrl(req);
			const path = url.pathname;
			const method = req.method as HTTPMethod;

			const resolved = this.resolveHandler(path, method);
			if (!resolved) {
				return res.writeHead(this.knownPaths.has(path) || this.hasDynamicMatch(path) ? 405 : 404).end();
			}
			const { handler, params, auth } = resolved;

			const authorization = authorizeRequest(req, auth);
			if (!authorization.authorized) {
				if (authorization.status === 401) res.setHeader("WWW-Authenticate", "Bearer");
				this.logger.warn(`Rejected ${method}:${path} with ${authorization.status}`);
				return res.writeHead(authorization.status).end();
			}

			let body: unknown;
			if (BODY_METHODS.has(method)) {
				try {
					body = await Parser.parseBody(req);
				} catch (err) {
					this.logger.warn(`Failed to parse request body for ${method}:${path}: ${(err as Error).message}`);
					return res.writeHead(400).end();
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
				if (err instanceof z.ZodError) {
					const errMsg = Object.values(err.flatten().fieldErrors).flat().join(", ");
					this.logger.warn(`Validation failed for ${method}:${path}: ${errMsg}`);
					return res.writeHead(400).end(errMsg);
				}
				this.logger.error(err);
				res.writeHead(500);
				res.end();
			}
		});
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

	private hasDynamicMatch(path: string) {
		return this.dynamicRoutes.some((route) => route.regex.test(path));
	}

	public async start() {
		const port = Number(process.env.PORT);
		if (!process.env.PORT || Number.isNaN(port)) {
			throw new Error(`Invalid PORT environment variable: ${process.env.PORT}`);
		}

		try {
			await this.db`select 1`;
		} catch (e) {
			this.logger.error((e as Error).message, { ...(e as Error), message: "" });
			throw e;
		}

		await registerRoutes(this);

		this.dispatchRequests();
		this.listen(port, () => {
			this.logger.info(`Server has started, listening on http://localhost:${port}`);
		});
	}

	public async shutdown() {
		await DB.getInstance().close();

		return new Promise<void>((resolve, reject) => {
			super.close((err) => {
				if (err) reject(err);
				else resolve();
			});
		});
	}
}
