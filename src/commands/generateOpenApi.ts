import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { apiInformation, type ApiInformation } from "../apiInfo.js";
import { generateOpenApiDocument, serializeOpenApiDocument, type OpenApiDocument } from "../lib/openapi.js";
import { discoverRouteCatalogue, type RouteCatalogueEntry } from "../lib/registry/routeCatalogue.js";

interface CommandArguments {
	check: boolean;
	outputPath?: string;
}

export interface OpenApiCommandDependencies {
	apiInformation: ApiInformation;
	discoverRoutes: () => Promise<readonly RouteCatalogueEntry[]>;
	generateDocument: (
		catalogue: readonly RouteCatalogueEntry[],
		information: ApiInformation,
	) => Promise<OpenApiDocument>;
	readOutput: (path: string) => Promise<string>;
	writeOutput: (path: string, bytes: string) => Promise<void>;
}

export interface OpenApiCommandOutput {
	log(message: string): void;
	error(message: string): void;
}

const defaultDependencies: OpenApiCommandDependencies = {
	apiInformation,
	discoverRoutes: discoverRouteCatalogue,
	generateDocument: generateOpenApiDocument,
	readOutput: (path) => readFile(path, "utf8"),
	writeOutput: async (path, bytes) => {
		await mkdir(dirname(path), { recursive: true });
		await writeFile(path, bytes, "utf8");
	},
};

export async function runOpenApiCommand(
	argv: readonly string[],
	cwd = process.cwd(),
	dependencies: OpenApiCommandDependencies = defaultDependencies,
) {
	const command = parseArguments(argv);
	const outputPath = resolve(cwd, command.outputPath ?? dependencies.apiInformation.outputPath);
	const catalogue = await dependencies.discoverRoutes();
	const document = await dependencies.generateDocument(catalogue, dependencies.apiInformation);
	const bytes = serializeOpenApiDocument(document);

	if (command.check) {
		const currentBytes = await readCurrentOutput(dependencies, outputPath);
		if (currentBytes !== bytes) {
			throw new Error(`OpenAPI output is stale: ${outputPath}\nRun npm run openapi:generate to update it.`);
		}
		return `OpenAPI output is current: ${outputPath}`;
	}

	await dependencies.writeOutput(outputPath, bytes);
	return `Wrote OpenAPI document to ${outputPath}`;
}

async function readCurrentOutput(dependencies: OpenApiCommandDependencies, outputPath: string) {
	try {
		return await dependencies.readOutput(outputPath);
	} catch (error) {
		if (isMissingFileError(error)) return null;
		throw error;
	}
}

function parseArguments(argv: readonly string[]): CommandArguments {
	let check = false;
	let outputPath: string | undefined;

	for (let index = 0; index < argv.length; index += 1) {
		const argument = argv[index]!;
		if (argument === "--check") {
			check = true;
			continue;
		}
		if (argument === "--output") {
			outputPath = argv[index + 1];
			if (!outputPath || outputPath.startsWith("--")) {
				throw new Error("--output requires a file path");
			}
			index += 1;
			continue;
		}
		throw new Error(`Unknown option: ${argument}`);
	}

	return { check, ...(outputPath === undefined ? {} : { outputPath }) };
}

function isMissingFileError(error: unknown): error is NodeJS.ErrnoException {
	return error instanceof Error && "code" in error && error.code === "ENOENT";
}

export async function runOpenApiCommandMain(
	argv: readonly string[],
	cwd = process.cwd(),
	dependencies: OpenApiCommandDependencies = defaultDependencies,
	output: OpenApiCommandOutput = console,
) {
	try {
		output.log(await runOpenApiCommand(argv, cwd, dependencies));
		return 0;
	} catch (error) {
		output.error(error instanceof Error ? error.message : String(error));
		return 1;
	}
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	process.exitCode = await runOpenApiCommandMain(process.argv.slice(2));
}
