import { describe, expect, it } from "vitest";
import { envSchema, parseDurationSeconds } from "../src/lib/env.js";

const VALID = {
	PORT: "5000",
	NODE_ENV: "development",
	DATABASE_URL: "postgres://user:pass@localhost:5432/store",
	JWT_SECRET: "x".repeat(32),
	JWT_EXPIRES_IN: "1h",
};

describe("envSchema", () => {
	it("accepts a complete environment and coerces what it must", () => {
		const env = envSchema.parse(VALID);
		expect(env.PORT).toBe(5000);
		expect(env.JWT_EXPIRES_IN).toBe(3600);
	});

	it("defaults the optional settings", () => {
		const { NODE_ENV, ...withoutOptional } = VALID;
		const env = envSchema.parse(withoutOptional);
		expect(env.NODE_ENV).toBe("development");
		expect(env.HOST).toBeUndefined();
	});

	it("refuses a JWT secret short enough to brute-force", () => {
		expect(() => envSchema.parse({ ...VALID, JWT_SECRET: "abc" })).toThrow();
		expect(() => envSchema.parse({ ...VALID, JWT_SECRET: "x".repeat(31) })).toThrow();
	});

	it("refuses a missing JWT secret", () => {
		const { JWT_SECRET, ...withoutSecret } = VALID;
		expect(() => envSchema.parse(withoutSecret)).toThrow();
	});

	it("refuses a missing or unusable port", () => {
		const { PORT, ...withoutPort } = VALID;
		expect(() => envSchema.parse(withoutPort)).toThrow();
		expect(() => envSchema.parse({ ...VALID, PORT: "not a port" })).toThrow();
		expect(() => envSchema.parse({ ...VALID, PORT: "0" })).toThrow();
		expect(() => envSchema.parse({ ...VALID, PORT: "70000" })).toThrow();
	});

	it("refuses a database URL that is not Postgres", () => {
		expect(() => envSchema.parse({ ...VALID, DATABASE_URL: "mysql://localhost/store" })).toThrow();
	});

	it("refuses a token lifetime it cannot read", () => {
		// The jsonwebtoken docs lead with duration strings, so "1h" has to work
		// rather than becoming NaN at the first sign().
		expect(envSchema.parse({ ...VALID, JWT_EXPIRES_IN: "30m" }).JWT_EXPIRES_IN).toBe(1800);
		expect(() => envSchema.parse({ ...VALID, JWT_EXPIRES_IN: "soon" })).toThrow();
		expect(() => envSchema.parse({ ...VALID, JWT_EXPIRES_IN: "0" })).toThrow();
		expect(() => envSchema.parse({ ...VALID, JWT_EXPIRES_IN: "400d" })).toThrow();
	});
});

describe("parseDurationSeconds", () => {
	it("reads a bare count as seconds", () => {
		expect(parseDurationSeconds("3600")).toBe(3600);
	});

	it("reads each unit suffix", () => {
		expect(parseDurationSeconds("45s")).toBe(45);
		expect(parseDurationSeconds("15m")).toBe(900);
		expect(parseDurationSeconds("2h")).toBe(7200);
		expect(parseDurationSeconds("7d")).toBe(604800);
		expect(parseDurationSeconds("1w")).toBe(604800);
	});

	it("is case- and space-insensitive", () => {
		expect(parseDurationSeconds(" 1H ")).toBe(3600);
	});

	it("returns null for anything it cannot read", () => {
		expect(parseDurationSeconds("")).toBeNull();
		expect(parseDurationSeconds("1 fortnight")).toBeNull();
		expect(parseDurationSeconds("-5m")).toBeNull();
		expect(parseDurationSeconds("1.5h")).toBeNull();
	});
});
