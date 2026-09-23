import { describe, expect, it } from "vitest";
import { buildApiRoute, compileRoute, isDynamicRoute, parseRouteId } from "../src/lib/utils.js";

describe("isDynamicRoute", () => {
	it("detects dynamic segments", () => {
		expect(isDynamicRoute("/api/products/[id]")).toBe(true);
	});

	it("returns false for static routes", () => {
		expect(isDynamicRoute("/api/ping")).toBe(false);
	});
});

describe("compileRoute", () => {
	it("extracts params and builds a matching regex", () => {
		const { regex, params } = compileRoute("/api/products/[id]");
		expect(params).toEqual(["id"]);
		const match = "/api/products/42".match(regex);
		expect(match?.[1]).toBe("42");
	});

	it("supports multiple dynamic segments", () => {
		const { regex, params } = compileRoute("/api/[category]/[id]");
		expect(params).toEqual(["category", "id"]);
		const match = "/api/shoes/42".match(regex);
		expect(match?.[1]).toBe("shoes");
		expect(match?.[2]).toBe("42");
	});

	it("does not match routes with extra path segments", () => {
		const { regex } = compileRoute("/api/products/[id]");
		expect(regex.test("/api/products/42/reviews")).toBe(false);
	});
});

describe("buildApiRoute", () => {
	it("builds a root-level route", () => {
		expect(buildApiRoute("", "ping.js")).toBe("/api/ping");
	});

	it("builds a nested static route", () => {
		expect(buildApiRoute("auth", "register.js")).toBe("/api/auth/register");
	});

	it("builds a dynamic route", () => {
		expect(buildApiRoute("products", "[id].js")).toBe("/api/products/[id]");
	});
});

describe("parseRouteId", () => {
	it("reads a positive integer id", () => {
		expect(parseRouteId("42")).toBe(42);
	});

	it("rejects a non-numeric id", () => {
		expect(parseRouteId("abc")).toBeNull();
	});

	it("rejects a missing id", () => {
		expect(parseRouteId(undefined)).toBeNull();
	});

	it("rejects a fractional id, which no SERIAL column can hold", () => {
		expect(parseRouteId("1.5")).toBeNull();
	});

	it("rejects a negative id", () => {
		expect(parseRouteId("-1")).toBeNull();
	});

	it("rejects zero", () => {
		expect(parseRouteId("0")).toBeNull();
	});

	it("rejects an id that is merely numeric-ish", () => {
		expect(parseRouteId("12abc")).toBeNull();
	});
});
