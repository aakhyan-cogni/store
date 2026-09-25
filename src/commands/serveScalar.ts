import { readFile } from "node:fs/promises";
import { createServer, type Server as NodeServer } from "node:http";
import type { AddressInfo } from "node:net";
import { dirname, resolve } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { apiInformation } from "../apiInfo.js";

const SCALAR_SCRIPT_PATH = "/scalar/standalone.js";
const SCALAR_CONFIG_PATH = "/scalar/config.js";
const require = createRequire(import.meta.url);
const scalarEntry = require.resolve("@scalar/api-reference");
const scalarStandalonePath = resolve(dirname(scalarEntry), "browser", "standalone.js");

export interface ScalarViewerOptions {
	host: string;
	port: number;
	apiServerUrl: string;
	openApiPath: string;
}

export interface ScalarViewer {
	server: NodeServer;
	url: string;
}

export const defaultScalarViewerOptions: ScalarViewerOptions = {
	host: "127.0.0.1",
	port: 8080,
	apiServerUrl: apiInformation.servers[0],
	openApiPath: "/openapi.json",
};

export function createScalarViewerServer(options: ScalarViewerOptions) {
	const apiUrl = validateLocalApiUrl(options.apiServerUrl);
	if (!options.openApiPath.startsWith("/") || options.openApiPath.includes("?") || options.openApiPath.includes("#")) {
		throw new TypeError("Scalar OpenAPI path must be an absolute path without a query or fragment");
	}
	const config = scalarConfiguration(apiUrl, options.openApiPath);
	const html = scalarHtml();
	const configScript = `Scalar.createApiReference("#app", ${safeJson(config)});\n`;
	let standaloneAsset: Promise<Buffer> | undefined;

	return createServer((req, res) => {
		const path = new URL(req.url ?? "/", "http://localhost").pathname;
		res.setHeader("content-security-policy", contentSecurityPolicy(apiUrl.origin));
		res.setHeader("x-content-type-options", "nosniff");
		res.setHeader("referrer-policy", "no-referrer");

		if (path === "/" || path === "/index.html") return send(res, "text/html; charset=utf-8", html);
		if (path === SCALAR_CONFIG_PATH) {
			return send(res, "text/javascript; charset=utf-8", configScript);
		}
		if (path === SCALAR_SCRIPT_PATH) {
			standaloneAsset ??= readFile(scalarStandalonePath);
			void standaloneAsset
				.then((asset) => send(res, "text/javascript; charset=utf-8", asset))
				.catch((error: unknown) => {
					res.statusCode = 500;
					res.end(error instanceof Error ? error.message : String(error));
				});
			return;
		}

		res.statusCode = 404;
		res.end("Not found");
	});
}

export async function startScalarViewer(options: ScalarViewerOptions): Promise<ScalarViewer> {
	if (!isLoopbackHost(options.host)) throw new TypeError("Scalar viewer host must be local");
	const server = createScalarViewerServer(options);
	await new Promise<void>((resolveListen, reject) => {
		server.once("error", reject);
		server.listen(options.port, options.host, resolveListen);
	});
	const address = server.address() as AddressInfo;
	return { server, url: `http://${formatHost(options.host)}:${address.port}` };
}

export function parseScalarViewerArguments(argv: readonly string[]): ScalarViewerOptions {
	const options = { ...defaultScalarViewerOptions };
	for (let index = 0; index < argv.length; index += 2) {
		const name = argv[index];
		const value = argv[index + 1];
		if (!value) throw new Error(`${name ?? "Option"} requires a value`);
		if (name === "--host") options.host = value;
		else if (name === "--port") options.port = parsePort(value);
		else if (name === "--api-url") options.apiServerUrl = value;
		else if (name === "--openapi-path") options.openApiPath = value;
		else throw new Error(`Unknown option: ${name}`);
	}
	return options;
}

function scalarConfiguration(apiUrl: URL, openApiPath: string) {
	return {
		url: new URL(openApiPath, apiUrl.origin).href,
		servers: [{ url: apiUrl.href.replace(/\/$/, "") }],
		proxyUrl: "",
		agent: { disabled: true },
		telemetry: false,
		withDefaultFonts: false,
		persistAuth: false,
		plugins: [],
		pluginUrls: [],
		externalUrls: { dashboardUrl: "", registryUrl: "", proxyUrl: "", apiBaseUrl: "" },
	};
}

function scalarHtml() {
	return `<!doctype html>
<html lang="en">
	<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Store API reference</title></head>
	<body><div id="app"></div><script src="${SCALAR_SCRIPT_PATH}"></script><script src="${SCALAR_CONFIG_PATH}"></script></body>
</html>\n`;
}

function contentSecurityPolicy(apiOrigin: string) {
	return [
		"default-src 'none'",
		"script-src 'self'",
		"style-src 'self' 'unsafe-inline'",
		"img-src 'self' data: blob:",
		"font-src 'none'",
		`connect-src 'self' ${apiOrigin}`,
		"worker-src 'self' blob:",
		"base-uri 'none'",
		"form-action 'none'",
		"frame-ancestors 'none'",
	].join("; ");
}

function validateLocalApiUrl(value: string) {
	const url = new URL(value);
	if (
		url.protocol !== "http:" ||
		!isLoopbackHost(url.hostname) ||
		url.username ||
		url.password ||
		url.search ||
		url.hash
	) {
		throw new TypeError("Scalar API URL must be an unauthenticated local HTTP URL");
	}
	return url;
}

function isLoopbackHost(host: string) {
	return host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]";
}

function parsePort(value: string) {
	const port = Number(value);
	if (!Number.isInteger(port) || port < 0 || port > 65_535) throw new TypeError("Scalar viewer port must be 0-65535");
	return port;
}

function formatHost(host: string) {
	return host.includes(":") && !host.startsWith("[") ? `[${host}]` : host;
}

function safeJson(value: unknown) {
	return JSON.stringify(value).replaceAll("<", "\\u003c");
}

function send(res: import("node:http").ServerResponse, contentType: string, body: string | Buffer) {
	res.statusCode = 200;
	res.setHeader("content-type", contentType);
	res.setHeader("content-length", Buffer.byteLength(body));
	res.end(body);
}

async function runMain() {
	try {
		const viewer = await startScalarViewer(parseScalarViewerArguments(process.argv.slice(2)));
		console.log(`Scalar API reference is available at ${viewer.url}`);
		const close = () => viewer.server.close();
		process.once("SIGINT", close);
		process.once("SIGTERM", close);
	} catch (error) {
		console.error(error instanceof Error ? error.message : String(error));
		process.exitCode = 1;
	}
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await runMain();
