import type { Route, Server } from "#src/lib/structures";
import type { HTTPMethod } from "#src/types";
import { readdir } from "node:fs/promises";
import { compileRoute, isDynamicRoute } from "../utils.js";

export async function registerRoutes(server: Server) {
	const routeFolder = (await readdir(`${process.cwd()}/dist/api`)).filter(filterRoute);
	const rootFiles = routeFolder.filter((r) => r.endsWith(".js"));
	for (const file of rootFiles) {
		const path = `../../api/${file}`;
		const route = (await import(path)).default as Route;
		const apiRoute = server.buildApiRoute(path);
		if (isDynamicRoute(apiRoute)) {
			const { regex, params } = compileRoute(apiRoute);
			for (const method of getMethods()) {
				if (route[method]) {
					server.dynamicRoutes.push({
						method,
						params,
						path: apiRoute,
						regex,
						route,
					});
					server.logger.info(`Registered dynamically [${method}] for ${apiRoute}`);
				}
			}
		} else {
			for (const method of getMethods()) {
				if (route[method]) {
					server.staticRoutes.set(`${method}:${apiRoute}`, route);
					server.knownPaths.add(apiRoute);
					server.logger.info(`Registered [${method}] for ${apiRoute}`);
				}
			}
		}
	}

	async function registerRecursively(folder: string, past = "") {
		const items = (await readdir(`${process.cwd()}/dist/api/${past + folder}`)).filter(filterRoute);
		const files = items.filter((r) => r.endsWith(".js"));
		for (const file of files) {
			const path = `../../api/${folder}/${file}`;
			const route = (await import(path)).default as Route;
			const apiRoute = server.buildApiRoute(path);
			if (isDynamicRoute(apiRoute)) {
				const { regex, params } = compileRoute(apiRoute);
				for (const method of getMethods()) {
					if (route[method]) {
						server.dynamicRoutes.push({
							method,
							params,
							path: apiRoute,
							regex,
							route,
						});
						server.logger.info(`Registered dynamically [${method}] for ${apiRoute}`);
					}
				}
			} else {
				for (const method of getMethods()) {
					if (route[method]) {
						server.staticRoutes.set(`${method}:${apiRoute}`, route);
						server.knownPaths.add(apiRoute);
						server.logger.info(`Registered [${method}] for ${apiRoute}`);
					}
				}
			}
		}
		for (const innerFolder of items.filter((r) => !r.endsWith(".js"))) {
			await registerRecursively(innerFolder, `${folder}/`);
		}
	}
	for (const folder of routeFolder.filter((r) => !r.endsWith(".js"))) {
		await registerRecursively(folder);
	}
}

function filterRoute(route: string) {
	if (route.endsWith(".js") || !route.includes(".")) return true;
	return false;
}

function getMethods(): HTTPMethod[] {
	return ["DELETE", "GET", "PATCH", "POST", "PUT"];
}
