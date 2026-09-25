import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createScalarViewerServer } from "../src/commands/serveScalar.js";

describe("local Scalar viewer", () => {
	const server = createScalarViewerServer({
		host: "127.0.0.1",
		port: 0,
		apiServerUrl: "http://127.0.0.1:3000",
		openApiPath: "/internal/openapi.json",
	});
	let baseUrl: string;

	beforeAll(async () => {
		await new Promise<void>((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
		baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
	});

	afterAll(async () => {
		await new Promise<void>((resolveClose, reject) =>
			server.close((error) => (error ? reject(error) : resolveClose())),
		);
	});

	it("serves local HTML, configuration, and the installed browser asset", async () => {
		const htmlResponse = await fetch(baseUrl);
		const html = await htmlResponse.text();
		expect(html).toContain('src="/scalar/standalone.js"');
		expect(html).toContain('src="/scalar/config.js"');
		expect(html).not.toMatch(/https?:\/\//);
		expect(htmlResponse.headers.get("content-security-policy")).toContain("connect-src 'self' http://127.0.0.1:3000");

		const configResponse = await fetch(`${baseUrl}/scalar/config.js`);
		const config = await configResponse.text();
		expect(config).toContain('"url":"http://127.0.0.1:3000/internal/openapi.json"');
		expect(config).toContain('"proxyUrl":""');
		expect(config).toContain('"agent":{"disabled":true}');
		expect(config).toContain('"telemetry":false');
		expect(config).toContain('"withDefaultFonts":false');
		expect(config).toContain('"persistAuth":false');
		expect(config).toContain('"plugins":[]');
		expect(config).toContain('"pluginUrls":[]');
		expect(config).toContain('"registryUrl":""');

		const assetResponse = await fetch(`${baseUrl}/scalar/standalone.js`);
		expect(assetResponse.status).toBe(200);
		expect(assetResponse.headers.get("content-type")).toBe("text/javascript; charset=utf-8");
		expect(Number(assetResponse.headers.get("content-length"))).toBeGreaterThan(0);
	});

	it("rejects non-local API targets", () => {
		expect(() =>
			createScalarViewerServer({
				host: "127.0.0.1",
				port: 8080,
				apiServerUrl: "https://api.example.com",
				openApiPath: "/openapi.json",
			}),
		).toThrow("local HTTP URL");
	});
});
