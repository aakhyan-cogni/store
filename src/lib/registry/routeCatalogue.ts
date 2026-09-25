import { readdir } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { HTTPMethod } from "#src/types";
import { HTTP_METHODS } from "#src/types";
import { Route, type MethodAuth, type OperationContract, type RouteHandler } from "../structures/Route.js";
import { buildApiRoute, compileRoute } from "../utils.js";

export interface RouteDefinition {
	path: string;
	route: Route;
}

/**
 * One row for every handler or contract declared by a route module.
 *
 * `handler` and `contract` are deliberately explicit unions with `undefined`.
 * A generator can therefore report both an undocumented handler and a stale
 * contract instead of discovery silently dropping either one.
 */
export interface RouteCatalogueEntry {
	path: string;
	method: HTTPMethod;
	handler: RouteHandler | undefined;
	params: readonly string[];
	auth: MethodAuth | undefined;
	contract: OperationContract | undefined;
	route: Route;
}

export type RouteModuleImporter = (moduleUrl: string) => Promise<unknown>;

export interface RouteDiscoveryOptions {
	apiDirectory?: string;
	importModule?: RouteModuleImporter;
}

const DEFAULT_API_DIRECTORY = fileURLToPath(new URL("../../api/", import.meta.url));

export function createRouteCatalogue(definitions: Iterable<RouteDefinition>): RouteCatalogueEntry[] {
	const catalogue: RouteCatalogueEntry[] = [];
	const orderedDefinitions = [...definitions].sort((left, right) => compareText(left.path, right.path));

	for (const { path, route } of orderedDefinitions) {
		const { params } = compileRoute(path);
		for (const method of HTTP_METHODS) {
			const handler = route[method];
			const contract = route.contracts[method];
			if (!handler && !contract) continue;

			catalogue.push({
				path,
				method,
				handler,
				params,
				auth: route.auth?.[method],
				contract,
				route,
			});
		}
	}

	return catalogue;
}

/** Discover compiled route modules without constructing runtime services. */
export async function discoverRouteCatalogue(options: RouteDiscoveryOptions = {}) {
	const apiDirectory = options.apiDirectory ?? DEFAULT_API_DIRECTORY;
	const importModule = options.importModule ?? ((moduleUrl: string) => import(moduleUrl));
	const files = await findRouteFiles(apiDirectory);
	const definitions: RouteDefinition[] = [];

	for (const file of files) {
		const moduleValue = await importModule(pathToFileURL(file).href);
		const route = readDefaultRoute(moduleValue, file);
		const relativeFile = relative(apiDirectory, file);
		const parts = relativeFile.split(sep);
		const fileName = parts.pop()!;
		const folder = parts.join("/");
		definitions.push({ path: buildApiRoute(folder, fileName), route });
	}

	return createRouteCatalogue(definitions);
}

async function findRouteFiles(directory: string): Promise<string[]> {
	const entries = await readdir(directory, { withFileTypes: true });
	entries.sort((left, right) => compareText(left.name, right.name));
	const files: string[] = [];

	for (const entry of entries) {
		const path = join(directory, entry.name);
		if (entry.isDirectory()) {
			files.push(...(await findRouteFiles(path)));
		} else if (entry.isFile() && entry.name.endsWith(".js")) {
			files.push(path);
		}
	}

	return files;
}

function compareText(left: string, right: string) {
	if (left < right) return -1;
	if (left > right) return 1;
	return 0;
}

function readDefaultRoute(moduleValue: unknown, file: string) {
	if (
		typeof moduleValue !== "object" ||
		moduleValue === null ||
		!("default" in moduleValue) ||
		!(moduleValue.default instanceof Route)
	) {
		throw new TypeError(`Route module ${file} must default export a Route`);
	}

	return moduleValue.default;
}
