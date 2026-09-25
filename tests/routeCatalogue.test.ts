import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { registerRouteCatalogue, type RouteRegistry } from "../src/lib/registry/registerRoute.js";
import { createRouteCatalogue, discoverRouteCatalogue } from "../src/lib/registry/routeCatalogue.js";
import { Route, type OperationContract } from "../src/lib/structures/Route.js";

function contract(summary: string): OperationContract {
	return { summary, responses: { 200: { description: "Success" } } };
}

describe("createRouteCatalogue", () => {
	it("creates deterministic static and dynamic operation entries", () => {
		const getProduct = vi.fn();
		const createCategory = vi.fn();
		const productRoute = new Route({
			auth: { GET: { required: true, roles: ["USER"] } },
			contracts: {
				GET: contract("Get a Product"),
				DELETE: contract("Delete a Product"),
			},
			GET: getProduct,
		});
		const categoryRoute = new Route({
			contracts: { POST: contract("Create a Category") },
			POST: createCategory,
		});

		const catalogue = createRouteCatalogue([
			{ path: "/api/products/[id]", route: productRoute },
			{ path: "/api/categories", route: categoryRoute },
		]);

		expect(catalogue.map(({ method, path }) => `${method}:${path}`)).toEqual([
			"POST:/api/categories",
			"GET:/api/products/[id]",
			"DELETE:/api/products/[id]",
		]);
		expect(catalogue[0]).toMatchObject({
			path: "/api/categories",
			method: "POST",
			params: [],
			handler: createCategory,
			contract: { summary: "Create a Category" },
		});
		expect(catalogue[1]).toMatchObject({
			path: "/api/products/[id]",
			method: "GET",
			params: ["id"],
			handler: getProduct,
			auth: { required: true, roles: ["USER"] },
			contract: { summary: "Get a Product" },
		});
	});

	it("retains missing and stale contract parity inputs", () => {
		const route = new Route({
			contracts: { DELETE: contract("Stale contract") },
			GET: vi.fn(),
		});

		const catalogue = createRouteCatalogue([{ path: "/api/products", route }]);

		expect(catalogue).toHaveLength(2);
		expect(catalogue[0]).toMatchObject({ method: "GET", handler: expect.any(Function), contract: undefined });
		expect(catalogue[1]).toMatchObject({ method: "DELETE", handler: undefined, contract: expect.any(Object) });
	});
});

describe("registerRouteCatalogue", () => {
	it("populates runtime tables from handler entries", () => {
		const staticRoute = new Route({ GET: vi.fn() });
		const dynamicRoute = new Route({
			contracts: { DELETE: contract("Stale contract") },
			GET: vi.fn(),
		});
		const catalogue = createRouteCatalogue([
			{ path: "/api/products/[id]", route: dynamicRoute },
			{ path: "/api/ping", route: staticRoute },
		]);
		const registry: RouteRegistry = {
			staticRoutes: new Map(),
			dynamicRoutes: [],
			logger: { info: vi.fn() },
		};

		registerRouteCatalogue(registry, catalogue);

		expect(registry.staticRoutes.get("GET:/api/ping")).toBe(staticRoute);
		expect(registry.dynamicRoutes).toHaveLength(1);
		expect(registry.dynamicRoutes[0]).toMatchObject({
			method: "GET",
			path: "/api/products/[id]",
			params: ["id"],
			route: dynamicRoute,
		});
		expect(registry.dynamicRoutes[0]?.regex.test("/api/products/42")).toBe(true);
		expect(registry.logger.info).toHaveBeenCalledTimes(2);
	});
});

describe("discoverRouteCatalogue", () => {
	const temporaryDirectories: string[] = [];

	afterEach(async () => {
		await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })));
	});

	it("imports route modules in deterministic path order", async () => {
		const apiDirectory = await mkdtemp(join(tmpdir(), "store-route-catalogue-"));
		temporaryDirectories.push(apiDirectory);
		const files = ["products/[id].js", "ping.js", "auth/login.js"];
		for (const file of files) {
			const path = join(apiDirectory, ...file.split("/"));
			await mkdir(dirname(path), { recursive: true });
			await writeFile(path, "// Imported through the test seam.\n");
		}

		const imported: string[] = [];
		const routes = new Map([
			["auth/login.js", new Route({ POST: vi.fn() })],
			["ping.js", new Route({ GET: vi.fn() })],
			["products/[id].js", new Route({ GET: vi.fn() })],
		]);
		const catalogue = await discoverRouteCatalogue({
			apiDirectory,
			importModule: async (moduleUrl) => {
				const file = relative(apiDirectory, fileURLToPath(moduleUrl)).split(sep).join("/");
				imported.push(file);
				return { default: routes.get(file) };
			},
		});

		expect(imported).toEqual(["auth/login.js", "ping.js", "products/[id].js"]);
		expect(catalogue.map(({ method, path, params }) => ({ method, path, params }))).toEqual([
			{ method: "POST", path: "/api/auth/login", params: [] },
			{ method: "GET", path: "/api/ping", params: [] },
			{ method: "GET", path: "/api/products/[id]", params: ["id"] },
		]);
	});
});
