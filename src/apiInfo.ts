import type { OpenApiOptions } from "./lib/openapi.js";

export interface ApiInformation extends Required<OpenApiOptions> {
	outputPath: string;
}

/** Project-level information shared by generated contracts and local API references. */
export const apiInformation = {
	title: "Store API",
	version: "1.0.0",
	description: "A simple CRUD REST API",
	servers: ["http://localhost:3000"],
	outputPath: "openapi.json",
} as const satisfies ApiInformation;
