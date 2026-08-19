import { expect, test } from "vitest";

test("port is defined", () => {
	const port = process.env.PORT;
	expect(port).toBeDefined();
	expect(port).toBeTypeOf("string");
	expect(Number(port)).toBeTruthy();
});

test("database url is defined", () => {
	const databaseUrl = process.env.DATABASE_URL;
	expect(databaseUrl).toBeDefined();
	expect(databaseUrl!.startsWith("postgres://")).toBeTruthy();
});
