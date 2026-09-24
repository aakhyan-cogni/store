import jwt from "jsonwebtoken";
import type { IncomingMessage } from "node:http";
import { describe, expect, it } from "vitest";
import { authorizeRequest } from "../src/lib/auth/middleware.js";
import type { MethodAuth } from "../src/lib/structures/Route.js";

// The suite's own secret, not the developer's: the middleware now reads a
// validated environment, and a machine whose .env holds a weak secret should
// fail to boot rather than fail these tests.
const SECRET = "test-secret-with-at-least-32-characters";
process.env.JWT_SECRET = SECRET;
process.env.PORT ??= "5000";
process.env.DATABASE_URL ??= "postgres://localhost:5432/store";

const ADMIN_ONLY: MethodAuth = { required: true, roles: ["ADMIN"] };
const ANY_ROLE: MethodAuth = { required: true };

function fakeRequest(authorization?: string) {
	return { headers: authorization ? { authorization } : {} } as IncomingMessage;
}

function token(overrides: Record<string, unknown> = {}, options: jwt.SignOptions = {}, secret = SECRET) {
	return jwt.sign({ sub: "1", email: "user@example.com", role: "USER", ...overrides }, secret, {
		expiresIn: 3600,
		...options,
	});
}

describe("authorizeRequest", () => {
	it("passes through when the route declares no auth", () => {
		expect(authorizeRequest(fakeRequest(), undefined)).toEqual({ authorized: true });
	});

	it("passes through when auth is not required", () => {
		expect(authorizeRequest(fakeRequest(), { required: false })).toEqual({ authorized: true });
	});

	it("authorizes an ADMIN token on an ADMIN-only route", () => {
		const req = fakeRequest(`Bearer ${token({ sub: "7", role: "ADMIN" })}`);
		expect(authorizeRequest(req, ADMIN_ONLY)).toEqual({ authorized: true, user: { id: 7, role: "ADMIN" } });
	});

	it("authorizes any role when the route lists no roles", () => {
		const req = fakeRequest(`Bearer ${token({ sub: "3", role: "USER" })}`);
		expect(authorizeRequest(req, ANY_ROLE)).toEqual({ authorized: true, user: { id: 3, role: "USER" } });
	});

	it("accepts a lowercase bearer scheme", () => {
		const req = fakeRequest(`bearer ${token({ role: "ADMIN" })}`);
		expect(authorizeRequest(req, ADMIN_ONLY)).toEqual({ authorized: true, user: { id: 1, role: "ADMIN" } });
	});

	it("rejects a missing Authorization header with 401", () => {
		expect(authorizeRequest(fakeRequest(), ADMIN_ONLY)).toEqual({ authorized: false, status: 401 });
	});

	it("rejects a non-Bearer scheme with 401", () => {
		expect(authorizeRequest(fakeRequest("Basic abc"), ADMIN_ONLY)).toEqual({ authorized: false, status: 401 });
	});

	it("rejects a Bearer scheme carrying no token with 401", () => {
		expect(authorizeRequest(fakeRequest("Bearer"), ADMIN_ONLY)).toEqual({ authorized: false, status: 401 });
	});

	it("rejects a token signed with the wrong secret with 401", () => {
		const req = fakeRequest(`Bearer ${token({ role: "ADMIN" }, {}, "not-the-secret")}`);
		expect(authorizeRequest(req, ADMIN_ONLY)).toEqual({ authorized: false, status: 401 });
	});

	it("rejects a malformed token with 401", () => {
		const req = fakeRequest("Bearer not.a.jwt");
		expect(authorizeRequest(req, ADMIN_ONLY)).toEqual({ authorized: false, status: 401 });
	});

	it("rejects an expired token with 401", () => {
		const req = fakeRequest(`Bearer ${token({ role: "ADMIN" }, { expiresIn: -1 })}`);
		expect(authorizeRequest(req, ADMIN_ONLY)).toEqual({ authorized: false, status: 401 });
	});

	it("rejects a token whose sub is not a positive integer with 401", () => {
		const req = fakeRequest(`Bearer ${token({ sub: "abc", role: "ADMIN" })}`);
		expect(authorizeRequest(req, ADMIN_ONLY)).toEqual({ authorized: false, status: 401 });
	});

	it("rejects a USER token on an ADMIN-only route with 403", () => {
		const req = fakeRequest(`Bearer ${token({ role: "USER" })}`);
		expect(authorizeRequest(req, ADMIN_ONLY)).toEqual({ authorized: false, status: 403 });
	});
});
