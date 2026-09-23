import { describe, expect, it } from "vitest";
import { newProductSchema, updateProductSchema } from "../src/lib/validation/productSchema.js";

describe("updateProductSchema", () => {
	it("updates only the field that was sent", () => {
		// A price edit must not silently carry a default stock along with it.
		expect(updateProductSchema.parse({ price: "9.99" })).toEqual({ price: "9.99" });
	});

	it("keeps an explicit zero stock", () => {
		expect(updateProductSchema.parse({ stock: 0 })).toEqual({ stock: 0 });
	});

	it("refuses an update that changes nothing", () => {
		expect(() => updateProductSchema.parse({})).toThrow();
	});

	it("refuses a price that is not money", () => {
		expect(() => updateProductSchema.parse({ price: "cheap" })).toThrow();
	});

	it("refuses negative stock", () => {
		expect(() => updateProductSchema.parse({ stock: -1 })).toThrow();
	});
});

describe("newProductSchema", () => {
	const product = { category_id: 1, name: "Widget", price: "19.99", stock: 5 };

	it("accepts a well-formed product", () => {
		expect(newProductSchema.parse(product)).toMatchObject(product);
	});

	it("refuses a price that is not money", () => {
		expect(() => newProductSchema.parse({ ...product, price: "19.999" })).toThrow();
	});
});
