import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
	mintlifyConfigDirectory,
	runMintlifyPreview,
	runMintlifyPreviewMain,
	type MintlifyPreviewDependencies,
} from "../src/commands/mintlifyPreview.js";

describe("Mintlify preview", () => {
	it("uses the root OpenAPI document directly in tab navigation", async () => {
		const config = JSON.parse(await readFile(resolve("docs.json"), "utf8")) as {
			navigation?: { tabs?: { tab?: string; openapi?: string }[] };
		};

		expect(config.navigation?.tabs).toContainEqual({
			tab: "API Reference",
			openapi: "openapi.json",
		});
	});

	it("runs mint dev from the directory containing docs.json", () => {
		const spawnCommand = vi.fn<MintlifyPreviewDependencies["spawnCommand"]>(() => ({ status: 0 }));
		const dependencies = commandDependencies("C:\\tools\\mint.cmd", true, spawnCommand);

		expect(resolve(mintlifyConfigDirectory)).toBe(resolve("."));
		expect(runMintlifyPreview(mintlifyConfigDirectory, dependencies)).toBe(0);
		expect(spawnCommand).toHaveBeenCalledWith("C:\\tools\\mint.cmd", ["dev"], {
			cwd: mintlifyConfigDirectory,
			stdio: "inherit",
			shell: true,
		});
	});

	it("prints the installation command and exits nonzero when mint is missing", () => {
		const spawnCommand = vi.fn<MintlifyPreviewDependencies["spawnCommand"]>(() => ({ status: 0 }));
		const dependencies = commandDependencies(null, false, spawnCommand);
		const output = { error: vi.fn() };

		expect(runMintlifyPreviewMain(mintlifyConfigDirectory, dependencies, output)).toBe(1);
		expect(output.error).toHaveBeenCalledWith(expect.stringContaining("npm i -g mint"));
		expect(spawnCommand).not.toHaveBeenCalled();
	});
});

function commandDependencies(
	executable: string | null,
	useShell: boolean,
	spawnCommand: MintlifyPreviewDependencies["spawnCommand"],
): MintlifyPreviewDependencies {
	return {
		findExecutable: vi.fn(() => executable),
		spawnCommand,
		useShell,
	};
}
