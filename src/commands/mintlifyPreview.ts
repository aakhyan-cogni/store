import { accessSync, constants } from "node:fs";
import { spawnSync } from "node:child_process";
import { extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

interface SpawnResult {
	status: number | null;
	error?: Error;
}

export interface MintlifyPreviewDependencies {
	findExecutable(command: string): string | null;
	spawnCommand(command: string, args: readonly string[], options: SpawnOptions): SpawnResult;
	useShell: boolean;
}

interface SpawnOptions {
	cwd: string;
	stdio: "inherit";
	shell: boolean;
}

export interface MintlifyPreviewOutput {
	error(message: string): void;
}

export const mintlifyConfigDirectory = fileURLToPath(new URL("../..", import.meta.url));

const defaultDependencies: MintlifyPreviewDependencies = {
	findExecutable: findExecutableOnPath,
	spawnCommand: (command, args, options) => spawnSync(command, args, options),
	useShell: process.platform === "win32",
};

export function runMintlifyPreview(
	configDirectory = mintlifyConfigDirectory,
	dependencies: MintlifyPreviewDependencies = defaultDependencies,
) {
	const executable = dependencies.findExecutable("mint");
	if (!executable) {
		throw new Error("Mintlify CLI not found. Install it with: npm i -g mint");
	}

	const result = dependencies.spawnCommand(executable, ["dev"], {
		cwd: configDirectory,
		stdio: "inherit",
		shell: dependencies.useShell,
	});
	if (result.error) throw result.error;
	return result.status ?? 1;
}

export function runMintlifyPreviewMain(
	configDirectory = mintlifyConfigDirectory,
	dependencies: MintlifyPreviewDependencies = defaultDependencies,
	output: MintlifyPreviewOutput = console,
) {
	try {
		return runMintlifyPreview(configDirectory, dependencies);
	} catch (error) {
		output.error(error instanceof Error ? error.message : String(error));
		return 1;
	}
}

function findExecutableOnPath(command: string): string | null {
	const path = environmentValue("PATH");
	if (!path) return null;

	const windows = process.platform === "win32";
	const extensions =
		windows && !extname(command) ? (environmentValue("PATHEXT") ?? ".COM;.EXE;.BAT;.CMD").split(";") : [""];

	for (const directory of path.split(windows ? ";" : ":")) {
		const unquotedDirectory = directory.replace(/^"(.*)"$/, "$1");
		for (const extension of extensions) {
			const candidate = resolve(unquotedDirectory || ".", `${command}${extension}`);
			try {
				accessSync(candidate, windows ? constants.F_OK : constants.X_OK);
				return candidate;
			} catch {
				// Continue searching the executable path.
			}
		}
	}

	return null;
}

function environmentValue(name: string) {
	const entry = Object.entries(process.env).find(([key]) => key.toUpperCase() === name);
	return entry?.[1];
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	process.exitCode = runMintlifyPreviewMain();
}
