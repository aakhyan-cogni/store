import type { RegisteredRoute, Route, Server } from "#src/lib/structures";
import { compileRoute } from "../utils.js";
import { discoverRouteCatalogue, type RouteCatalogueEntry } from "./routeCatalogue.js";

export async function registerRoutes(server: Server) {
	registerRouteCatalogue(server, await discoverRouteCatalogue());
}

export interface RouteRegistry {
	staticRoutes: Map<string, Route>;
	dynamicRoutes: RegisteredRoute[];
	logger: { info(message: string): unknown };
}

export function registerRouteCatalogue(server: RouteRegistry, catalogue: readonly RouteCatalogueEntry[]) {
	for (const entry of catalogue) {
		if (!entry.handler) continue;

		if (entry.params.length) {
			server.dynamicRoutes.push({
				method: entry.method,
				params: [...entry.params],
				path: entry.path,
				regex: compileRoute(entry.path).regex,
				route: entry.route,
			});
		} else {
			server.staticRoutes.set(`${entry.method}:${entry.path}`, entry.route);
		}

		server.logger.info(`Registered [${entry.method}] for ${entry.path}`);
	}
}
