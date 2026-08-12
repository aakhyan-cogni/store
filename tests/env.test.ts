import { expect, test } from "vitest";

test("port is defined properly", () => {
	expect(process.env.PORT).toBeDefined();
	expect(process.env.PORT).toBeTypeOf("string");
	expect(process.env.PORT).toBe("5000");
});
