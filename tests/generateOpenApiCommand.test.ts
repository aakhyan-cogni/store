import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runOpenApiCommandMain, type OpenApiCommandDependencies } from "../src/commands/generateOpenApi.js";
import type { OpenApiDocument } from "../src/lib/openapi.js";

const document: OpenApiDocument = {
	openapi: "3.1.0",
	jsonSchemaDialect: "https://json-schema.org/draft/2020-12/schema",
	info: { title: "Store API", version: "1.0.0", description: "A simple CRUD REST API" },
	servers: [{ url: "http://localhost:3000" }],
	paths: {},
	components: { schemas: {}, securitySchemes: {} },
};

describe("OpenAPI generation command", () => {
	const directories: string[] = [];

	afterEach(async () => {
		await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true })));
	});

	it("writes the configured default output and passes check mode", async () => {
		const directory = await temporaryDirectory();
		const { dependencies, output } = commandContext();

		expect(await runOpenApiCommandMain([], directory, dependencies, output)).toBe(0);
		expect(JSON.parse(await readFile(join(directory, "openapi.json"), "utf8"))).toEqual(document);
		expect(await runOpenApiCommandMain(["--check"], directory, dependencies, output)).toBe(0);
		expect(output.log).toHaveBeenCalledWith(expect.stringContaining("OpenAPI output is current"));
	});

	it("writes a selected output path", async () => {
		const directory = await temporaryDirectory();
		const { dependencies, output } = commandContext();
		const selectedPath = join("generated", "contract.json");

		expect(await runOpenApiCommandMain(["--output", selectedPath], directory, dependencies, output)).toBe(0);
		expect(JSON.parse(await readFile(join(directory, selectedPath), "utf8"))).toEqual(document);
	});

	it("exits nonzero for invalid contracts and stale output", async () => {
		const directory = await temporaryDirectory();
		const first = commandContext();
		first.dependencies.generateDocument = async () => {
			throw new Error("GET /api/broken: registered handler has no operation contract");
		};

		expect(await runOpenApiCommandMain([], directory, first.dependencies, first.output)).toBe(1);
		expect(first.output.error).toHaveBeenCalledWith(expect.stringContaining("GET /api/broken"));

		const second = commandContext();
		expect(await runOpenApiCommandMain(["--check"], directory, second.dependencies, second.output)).toBe(1);
		expect(second.output.error).toHaveBeenCalledWith(expect.stringContaining("OpenAPI output is stale"));
	});

	async function temporaryDirectory() {
		const directory = await mkdtemp(join(tmpdir(), "store-openapi-command-"));
		directories.push(directory);
		return directory;
	}
});

function commandContext() {
	const dependencies: OpenApiCommandDependencies = {
		apiInformation: {
			title: "Store API",
			version: "1.0.0",
			description: "A simple CRUD REST API",
			servers: ["http://localhost:3000"],
			outputPath: "openapi.json",
		},
		discoverRoutes: async () => [],
		generateDocument: async () => document,
		readOutput: (path) => readFile(path, "utf8"),
		writeOutput: async (path, bytes) => {
			await mkdir(dirname(path), { recursive: true });
			await writeFile(path, bytes, "utf8");
		},
	};
	return { dependencies, output: { log: vi.fn(), error: vi.fn() } };
}
