import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig(({ mode }) => ({
	test: {
		// mode defines what ".env.{mode}" file to choose if exists
		env: loadEnv(mode, process.cwd(), ""),
		coverage: {
			provider: "v8",
			enabled: true,
			// Counts every source file, not just the ones a test happens to
			// import. Without this the percentage describes the handful of
			// modules under test and reads as if it described the codebase.
			all: true,
			include: ["src/**/*.ts"],
		},
	},
}));
