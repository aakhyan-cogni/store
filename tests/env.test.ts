import { describe, expect, it } from "vitest";

describe(".env", () => {
	it("has port", () => {
		const port = process.env.PORT;
		expect(port).toBeDefined();
		expect(port).toBeTypeOf("string");
		expect(Number(port)).toBeTruthy();
	});

	it("has database url", () => {
		const databaseUrl = process.env.DATABASE_URL;
		expect(databaseUrl).toBeDefined();
		expect(databaseUrl!.startsWith("postgres://")).toBeTruthy();
	});

	it("has jwt secret", () => {
		const jwtSecret = process.env.JWT_SECRET;
		expect(jwtSecret).toBeDefined();
	});

	it("has jwt expires", () => {
		const jwtExpiresIn = process.env.JWT_EXPIRES_IN;
		expect(jwtExpiresIn).toBeDefined();
	});
});
