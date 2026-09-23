import { describe, expect, it } from "vitest";
import { escapeLikePattern, parseProductQuery } from "../src/lib/products/index.js";

const query = (search: string) => new URLSearchParams(search);

describe("parseProductQuery", () => {
	it("pages from the start with no params", () => {
		expect(parseProductQuery(query(""))).toEqual({ limit: 20, offset: 0 });
	});

	it("reads a name search", () => {
		expect(parseProductQuery(query("q=widget"))).toMatchObject({ q: "widget" });
	});

	it("ignores a blank name search rather than matching nothing", () => {
		expect(parseProductQuery(query("q=%20"))).toEqual({ limit: 20, offset: 0 });
	});

	it("reads a category filter as a number", () => {
		expect(parseProductQuery(query("category_id=3"))).toMatchObject({ category_id: 3 });
	});

	it("reads both price bounds", () => {
		expect(parseProductQuery(query("min_price=5.50&max_price=20"))).toMatchObject({
			min_price: "5.50",
			max_price: "20",
		});
	});

	it("reads an explicit page window", () => {
		expect(parseProductQuery(query("limit=5&offset=10"))).toEqual({ limit: 5, offset: 10 });
	});

	it("caps the page size so one request cannot pull the whole catalogue", () => {
		expect(parseProductQuery(query("limit=5000"))).toMatchObject({ limit: 100 });
	});

	it("rejects a non-numeric category", () => {
		expect(() => parseProductQuery(query("category_id=shoes"))).toThrow();
	});

	it("rejects a negative offset", () => {
		expect(() => parseProductQuery(query("offset=-1"))).toThrow();
	});

	it("rejects a zero page size", () => {
		expect(() => parseProductQuery(query("limit=0"))).toThrow();
	});

	it("rejects a price bound that is not money", () => {
		expect(() => parseProductQuery(query("min_price=cheap"))).toThrow();
	});

	it("rejects a minimum price above the maximum", () => {
		expect(() => parseProductQuery(query("min_price=50&max_price=10"))).toThrow(/min_price/);
	});

	it("accepts equal price bounds", () => {
		expect(parseProductQuery(query("min_price=10&max_price=10"))).toMatchObject({
			min_price: "10",
			max_price: "10",
		});
	});
});

describe("escapeLikePattern", () => {
	it("leaves an ordinary search term alone", () => {
		expect(escapeLikePattern("widget")).toBe("widget");
	});

	it("escapes a percent so it is searched for literally", () => {
		expect(escapeLikePattern("50% off")).toBe("50\\% off");
	});

	it("escapes an underscore so it does not match any single character", () => {
		expect(escapeLikePattern("a_b")).toBe("a\\_b");
	});

	it("escapes the escape character itself", () => {
		expect(escapeLikePattern("back\\slash")).toBe("back\\\\slash");
	});

	it("escapes every wildcard in the term", () => {
		expect(escapeLikePattern("%_%")).toBe("\\%\\_\\%");
	});
});
