import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { OpenApiDocument } from "../src/lib/openapi.js";
import { Server } from "../src/lib/structures/Server.js";

process.env.PORT = "5000";
process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "postgres://localhost:5432/store";
process.env.JWT_SECRET = "test-secret-with-at-least-32-characters";
process.env.JWT_EXPIRES_IN = "1h";

const document: OpenApiDocument = {
	openapi: "3.1.0",
	jsonSchemaDialect: "https://json-schema.org/draft/2020-12/schema",
	info: { title: "Endpoint test", version: "1.0.0" },
	servers: [{ url: "http://localhost:3000" }],
	paths: {},
	components: { schemas: {}, securitySchemes: {} },
};

describe("OpenAPI endpoint", () => {
	const enabled = new Server({ openApi: { path: "/internal/openapi.json", document } });
	const disabled = new Server();
	let enabledUrl: string;
	let disabledUrl: string;

	beforeAll(async () => {
		enabled.dispatchRequests();
		disabled.dispatchRequests();
		await Promise.all([listen(enabled), listen(disabled)]);
		enabledUrl = address(enabled);
		disabledUrl = address(disabled);
	});

	afterAll(async () => {
		await Promise.all([close(enabled), close(disabled)]);
	});

	it("returns the configured generated document without registering an application route", async () => {
		const response = await fetch(`${enabledUrl}/internal/openapi.json`);
		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe("application/json");
		expect(await response.json()).toEqual(document);
		expect(enabled.staticRoutes.has("GET:/internal/openapi.json")).toBe(false);
	});

	it("does not expose a documentation path by default", async () => {
		const response = await fetch(`${disabledUrl}/internal/openapi.json`);
		expect(response.status).toBe(404);
	});
});

function listen(server: Server) {
	return new Promise<void>((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
}

function close(server: Server) {
	return new Promise<void>((resolveClose, reject) => server.close((error) => (error ? reject(error) : resolveClose())));
}

function address(server: Server) {
	return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}
