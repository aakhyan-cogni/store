import { registerRoutes } from "#src/lib/registry";
import { Logger } from "./Logger.js";
import { Server as NodeServer } from "http";
import type { RegisteredRoute, Route } from "./Route.js";
import type { HTTPMethod } from "#src/types";

export class Server extends NodeServer {
	public readonly logger = Logger.init();
	public staticRoutes: Map<string, Route> = new Map<string, Route>();
	public dynamicRoutes: RegisteredRoute[] = [];
	public readonly knownPaths = new Set<string>();
	public constructor() {
		super();
		this.logger.info("Initiated Server...");
	}

	public dispatchRequests() {
		this.on("request", async (req, res) => {
			if (!req.url) {
				this.logger.error(`URL missing in req`, req);
				return res.writeHead(500).end();
			}
			const path = new URL(`http://${process.env.HOST ?? "localhost"}${req.url}`).pathname;
			const method = req.method as HTTPMethod;
			const key = `${method}:${path}`;
			const potentialRoute = this.staticRoutes.get(key);
			if (potentialRoute && potentialRoute[method]) {
				try {
					await potentialRoute[method]({ req, res });
				} catch (err) {
					this.logger.error(err);
					res.writeHead(500);
					res.end();
				}
			} else if (this.knownPaths.has(path)) {
				res.writeHead(405).end();
			} else {
				let dynaMatched = false;
				for (const dynamicRoute of this.dynamicRoutes) {
					const match = path.match(dynamicRoute.regex);
					if (!match) continue;
					dynaMatched = true;
					if (dynamicRoute.method !== method) continue;
					const params: Record<string, string> = {};

					dynamicRoute.params.forEach((name, idx) => {
						params[name] = match[idx + 1]!;
					});

					await dynamicRoute.route[method]!({
						req,
						res,
						params,
					});
					return;
				}
				if (dynaMatched) res.writeHead(405).end();
				else res.writeHead(404).end();
			}
		});
	}

	public async start() {
		await registerRoutes(this);
		this.listen(process.env.PORT, () => {
			this.logger.info(`Server has started, listening on http://localhost:${process.env.PORT}`);
		});
		this.dispatchRequests();
	}

	public buildApiRoute(path: string) {
		return path.slice(5, -3);
	}
}
