import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { JwtService } from "../src/lib/auth/jwt.js";
import { parseRequest } from "../src/lib/validation/request.js";
import { Route } from "../src/lib/structures/Route.js";
import { Server } from "../src/lib/structures/Server.js";
import { sendData, sendNoContent } from "../src/lib/responses.js";
import { CustomError } from "../src/lib/structures/CustomError.js";

process.env.PORT = "5000";
process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "postgres://localhost:5432/store";
process.env.JWT_SECRET = "test-secret-with-at-least-32-characters";
process.env.JWT_EXPIRES_IN = "1h";
process.env.CORS_ORIGINS = "http://localhost:3000";

describe("Server request contract", () => {
	const server = new Server();
	const accessSpy = vi.spyOn(server.logger, "http");
	const errorSpy = vi.spyOn(server.logger, "error");
	let baseUrl: string;

	beforeAll(async () => {
		server.staticRoutes.set("GET:/api/public", new Route({ GET: ({ res }) => sendData(res, { visible: true }) }));
		server.staticRoutes.set(
			"GET:/api/protected",
			new Route({
				auth: { GET: { required: true } },
				GET: ({ res }) => sendData(res, { private: true }),
			}),
		);
		server.staticRoutes.set(
			"GET:/api/failure",
			new Route({
				GET: () => {
					throw new Error("database password must stay in the log");
				},
			}),
		);
		server.staticRoutes.set(
			"POST:/api/conflict",
			new Route({
				POST: () => {
					throw new CustomError(409, "Resource already exists");
				},
			}),
		);
		server.staticRoutes.set(
			"POST:/api/rate-limited",
			new Route({
				POST: ({ res }) => {
					res.setHeader("retry-after", "60");
					throw new CustomError(429, "Too many attempts");
				},
			}),
		);
		server.staticRoutes.set(
			"POST:/api/validate",
			new Route({
				POST: ({ res, body }) => {
					parseRequest(z.object({ email: z.email(), password: z.string().min(12) }), body);
					sendData(res, null);
				},
			}),
		);
		server.staticRoutes.set("DELETE:/api/empty", new Route({ DELETE: ({ res }) => sendNoContent(res) }));

		server.dispatchRequests();
		await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
		baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
	});

	afterAll(async () => {
		await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
	});

	beforeEach(() => {
		accessSpy.mockClear();
		errorSpy.mockClear();
	});

	it("wraps successful data and returns one request ID", async () => {
		const response = await fetch(`${baseUrl}/api/public`);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ data: { visible: true } });
		expect(response.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/);
		expect(accessSpy).toHaveBeenCalledTimes(1);
		expect(accessSpy.mock.calls[0]?.[0]).toMatchObject({
			method: "GET",
			path: "/api/public",
			status: 200,
			request_id: response.headers.get("x-request-id"),
		});
	});

	it("returns parseable errors for routing and authentication failures", async () => {
		const missing = await fetch(`${baseUrl}/api/missing`);
		expect(missing.status).toBe(404);
		expect(await missing.json()).toEqual({ error: { code: "NOT_FOUND", message: "Resource not found" } });

		const wrongMethod = await fetch(`${baseUrl}/api/public`, { method: "POST" });
		expect(wrongMethod.status).toBe(405);
		expect(wrongMethod.headers.get("allow")).toBe("GET, HEAD, OPTIONS");
		expect(await wrongMethod.json()).toEqual({
			error: { code: "METHOD_NOT_ALLOWED", message: "Method not allowed" },
		});

		const unknownMethod = await fetch(`${baseUrl}/api/public`, { method: "PROPFIND" });
		expect(unknownMethod.status).toBe(501);
		expect(await unknownMethod.json()).toEqual({
			error: { code: "NOT_IMPLEMENTED", message: "Method not implemented" },
		});

		const protectedResponse = await fetch(`${baseUrl}/api/protected`);
		expect(protectedResponse.status).toBe(401);
		expect(protectedResponse.headers.get("www-authenticate")).toBe("Bearer");
		expect(await protectedResponse.json()).toEqual({
			error: { code: "UNAUTHENTICATED", message: "Authentication required" },
		});
	});

	it("keeps internal failures generic and correlated", async () => {
		const response = await fetch(`${baseUrl}/api/failure`);

		expect(response.status).toBe(500);
		expect(await response.json()).toEqual({
			error: { code: "INTERNAL_ERROR", message: "Internal Server Error" },
		});
		const requestId = response.headers.get("x-request-id");
		expect(accessSpy.mock.calls[0]?.[0]).toMatchObject({ request_id: requestId, status: 500 });
		expect(errorSpy).toHaveBeenCalledTimes(1);
		const errorRecord = JSON.stringify(errorSpy.mock.calls);
		expect(errorRecord).toContain(requestId);
		expect(errorRecord).not.toContain("database password must stay in the log");
	});

	it("returns stable conflict and rate-limit errors", async () => {
		const conflict = await fetch(`${baseUrl}/api/conflict`, { method: "POST" });
		expect(conflict.status).toBe(409);
		expect(await conflict.json()).toEqual({
			error: { code: "CONFLICT", message: "Resource already exists" },
		});

		const limited = await fetch(`${baseUrl}/api/rate-limited`, { method: "POST" });
		expect(limited.status).toBe(429);
		expect(limited.headers.get("retry-after")).toBe("60");
		expect(await limited.json()).toEqual({
			error: { code: "RATE_LIMITED", message: "Too many attempts" },
		});
	});

	it("returns client-safe validation details", async () => {
		const response = await fetch(`${baseUrl}/api/validate`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ email: "not-an-email", password: "short" }),
		});

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({
			error: {
				code: "VALIDATION_FAILED",
				message: "Request validation failed",
				details: [
					{ field: "email", message: expect.any(String) },
					{ field: "password", message: expect.any(String) },
				],
			},
		});
	});

	it("does not echo a malformed request body", async () => {
		const response = await fetch(`${baseUrl}/api/validate`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: '{"password":"body-secret",',
		});

		expect(response.status).toBe(400);
		const body = await response.json();
		expect(body).toEqual({
			error: { code: "VALIDATION_FAILED", message: "Request body could not be parsed" },
		});
		expect(JSON.stringify(accessSpy.mock.calls)).not.toContain("body-secret");
	});

	it("returns a correlated 400 for an oversized request body", async () => {
		const response = await fetch(`${baseUrl}/api/validate`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ value: "x".repeat(1024 * 1024 + 1) }),
		});

		expect(response.status).toBe(400);
		expect(response.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/);
		expect(await response.json()).toEqual({
			error: { code: "VALIDATION_FAILED", message: "Request body could not be parsed" },
		});
		expect(accessSpy).toHaveBeenCalledTimes(1);
		expect(accessSpy.mock.calls[0]?.[0]).toMatchObject({
			status: 400,
			request_id: response.headers.get("x-request-id"),
		});
	});

	it("keeps 204 responses bodyless and without a JSON content type", async () => {
		const response = await fetch(`${baseUrl}/api/empty`, { method: "DELETE" });

		expect(response.status).toBe(204);
		expect(response.headers.get("content-type")).toBeNull();
		expect(response.headers.get("content-length")).toBeNull();
		expect(await response.text()).toBe("");
	});

	it("handles HEAD through GET while suppressing the body", async () => {
		const get = await fetch(`${baseUrl}/api/public`);
		const head = await fetch(`${baseUrl}/api/public`, { method: "HEAD" });

		expect(head.status).toBe(get.status);
		expect(head.headers.get("content-type")).toBe(get.headers.get("content-type"));
		expect(head.headers.get("content-length")).toBe(get.headers.get("content-length"));
		expect(await head.text()).toBe("");
	});

	it("answers preflight without invoking authentication", async () => {
		const response = await fetch(`${baseUrl}/api/protected`, {
			method: "OPTIONS",
			headers: { origin: "http://localhost:3000" },
		});

		expect(response.status).toBe(204);
		expect(response.headers.get("allow")).toBe("GET, HEAD, OPTIONS");
		expect(response.headers.get("access-control-allow-origin")).toBe("http://localhost:3000");
		expect(response.headers.get("access-control-allow-methods")).toBe("GET, HEAD, OPTIONS");
		expect(response.headers.get("access-control-allow-headers")).toBe("Authorization, Content-Type");
		expect(response.headers.get("access-control-expose-headers")).toBe("x-request-id, retry-after");
		expect(response.headers.get("access-control-allow-credentials")).toBeNull();
	});

	it("omits cross-origin permission for a disallowed origin", async () => {
		const response = await fetch(`${baseUrl}/api/public`, {
			headers: { origin: "https://attacker.example" },
		});

		expect(response.status).toBe(200);
		expect(response.headers.get("access-control-allow-origin")).toBeNull();
		expect(response.headers.get("access-control-expose-headers")).toBeNull();
	});

	it("adds cross-origin permission to a normal request from an allowed origin", async () => {
		const response = await fetch(`${baseUrl}/api/public`, {
			headers: { origin: "http://localhost:3000" },
		});

		expect(response.headers.get("access-control-allow-origin")).toBe("http://localhost:3000");
		expect(response.headers.get("access-control-expose-headers")).toBe("x-request-id, retry-after");
		expect(response.headers.get("access-control-allow-credentials")).toBeNull();
	});

	it("omits CORS headers from a disallowed preflight", async () => {
		const response = await fetch(`${baseUrl}/api/public`, {
			method: "OPTIONS",
			headers: { origin: "https://attacker.example" },
		});

		expect(response.status).toBe(204);
		expect(response.headers.get("allow")).toBe("GET, HEAD, OPTIONS");
		expect(response.headers.get("access-control-allow-origin")).toBeNull();
		expect(response.headers.get("access-control-allow-methods")).toBeNull();
		expect(response.headers.get("access-control-allow-headers")).toBeNull();
	});

	it("logs only the request path and authenticated user ID", async () => {
		const token = new JwtService().sign({ sub: "7", email: "private@example.com", role: "USER" });
		const response = await fetch(`${baseUrl}/api/protected?token=query-secret`, {
			headers: {
				authorization: `Bearer ${token}`,
				cookie: "session=cookie-secret",
			},
		});

		expect(response.status).toBe(200);
		expect(accessSpy).toHaveBeenCalledTimes(1);
		const accessRecord = JSON.stringify(accessSpy.mock.calls[0]);
		expect(accessSpy.mock.calls[0]?.[0]).toMatchObject({ path: "/api/protected", user_id: 7 });
		expect(accessRecord).not.toContain("query-secret");
		expect(accessRecord).not.toContain("cookie-secret");
		expect(accessRecord).not.toContain(token);
		expect(accessRecord).not.toContain("private@example.com");
	});
});
