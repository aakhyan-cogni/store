import type { Route, Server } from "#src/lib/structures";
import type { HTTPMethod } from "#src/types";
import { readdir } from "node:fs/promises";
import { buildApiRoute, compileRoute, isDynamicRoute } from "../utils.js";

export async function registerRoutes(server: Server) {
	await registerFolder(server, "");
}

async function registerFolder(server: Server, folder: string) {
	const items = (await readdir(`${process.cwd()}/dist/api/${folder}`)).filter(filterRoute);
	const files = items.filter((r) => r.endsWith(".js"));

	for (const file of files) {
		const importPath = folder ? `../../api/${folder}/${file}` : `../../api/${file}`;
		const route = (await import(importPath)).default as Route;
		const apiRoute = buildApiRoute(folder, file);
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
					server.logger.info(`Registered [${method}] for ${apiRoute}`);
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

	const subFolders = items.filter((r) => !r.endsWith(".js"));
	for (const subFolder of subFolders) {
		await registerFolder(server, folder ? `${folder}/${subFolder}` : subFolder);
	}
}

function filterRoute(route: string) {
	if (route.endsWith(".js") || !route.includes(".")) return true;
	return false;
}

function getMethods(): HTTPMethod[] {
	return ["DELETE", "GET", "PATCH", "POST", "PUT"];
}
