import { describe, expect, it } from "vitest";
import { buildOrderDraft, toMinorUnits, toPriceString } from "../src/lib/orders/index.js";
import type { CartLine } from "../src/lib/orders/index.js";
import { CustomError } from "../src/lib/structures/CustomError.js";

describe("toMinorUnits", () => {
	it("reads a two-decimal NUMERIC string as whole minor units", () => {
		expect(toMinorUnits("19.99")).toBe(1999);
	});

	it("reads the smallest representable price", () => {
		expect(toMinorUnits("0.01")).toBe(1);
	});

	it("reads a whole-number price with no decimal point", () => {
		expect(toMinorUnits("40")).toBe(4000);
	});

	it("reads a single-decimal price", () => {
		expect(toMinorUnits("40.5")).toBe(4050);
	});

	it("reads the largest price NUMERIC(10,2) allows", () => {
		expect(toMinorUnits("99999999.99")).toBe(9999999999);
	});

	it("rejects a price that is not a number", () => {
		expect(() => toMinorUnits("free")).toThrow();
	});
});

describe("toPriceString", () => {
	it("renders minor units back to two decimals", () => {
		expect(toPriceString(1999)).toBe("19.99");
	});

	it("pads a sub-unit amount", () => {
		expect(toPriceString(3)).toBe("0.03");
	});

	it("renders zero", () => {
		expect(toPriceString(0)).toBe("0.00");
	});

	it("round-trips every price it is given", () => {
		expect(toPriceString(toMinorUnits("1234567.89"))).toBe("1234567.89");
	});
});

const cartItem = (overrides: Partial<CartLine> = {}): CartLine => ({
	product_id: 1,
	name: "Widget",
	price: "19.99",
	stock: 10,
	quantity: 1,
	listed: true,
	...overrides,
});

describe("buildOrderDraft", () => {
	it("snapshots the current price onto each line", () => {
		const draft = buildOrderDraft([cartItem({ product_id: 7, price: "19.99", quantity: 2 })]);

		expect(draft.items).toEqual([{ product_id: 7, quantity: 2, price_at_purchase: "19.99" }]);
	});

	it("totals one line by quantity", () => {
		const draft = buildOrderDraft([cartItem({ price: "19.99", quantity: 2 })]);

		expect(draft.total_amount).toBe("39.98");
	});

	it("totals across lines without floating-point drift", () => {
		const draft = buildOrderDraft([
			cartItem({ product_id: 1, price: "19.99", quantity: 2 }),
			cartItem({ product_id: 2, price: "0.01", quantity: 3 }),
		]);

		expect(draft.total_amount).toBe("40.01");
	});

	it("accepts a line taking the last of the stock", () => {
		const draft = buildOrderDraft([cartItem({ price: "5.00", quantity: 4, stock: 4 })]);

		expect(draft.total_amount).toBe("20.00");
	});
});

describe("buildOrderDraft refusals", () => {
	it("refuses an empty cart as a conflict", () => {
		expect(() => buildOrderDraft([])).toThrow(CustomError);
		expect(() => buildOrderDraft([])).toThrow(/empty/i);
	});

	it("refuses a line whose quantity outruns the stock", () => {
		const overStocked = [cartItem({ name: "Widget", quantity: 5, stock: 4 })];

		expect(() => buildOrderDraft(overStocked)).toThrow(CustomError);
		expect(() => buildOrderDraft(overStocked)).toThrow(/Widget/);
	});

	it("reports the refusal as 409 so the caller can retry with less", () => {
		try {
			buildOrderDraft([cartItem({ quantity: 5, stock: 4 })]);
			expect.unreachable("expected buildOrderDraft to throw");
		} catch (err) {
			expect((err as CustomError).getCode()).toBe(409);
		}
	});
});

describe("buildOrderDraft and delisted products", () => {
	it("refuses a cart holding a product that is no longer for sale", () => {
		const delisted = [cartItem({ name: "Gone", listed: false })];

		expect(() => buildOrderDraft(delisted)).toThrow(CustomError);
		expect(() => buildOrderDraft(delisted)).toThrow(/Gone/);
	});

	it("refuses rather than quietly dropping the delisted line", () => {
		const mixed = [cartItem({ product_id: 1 }), cartItem({ product_id: 2, name: "Gone", listed: false })];

		// The buyer must be told, not charged for the remainder.
		expect(() => buildOrderDraft(mixed)).toThrow(/no longer for sale/i);
	});

	it("reports the refusal as 409", () => {
		try {
			buildOrderDraft([cartItem({ listed: false })]);
			expect.unreachable("expected buildOrderDraft to throw");
		} catch (err) {
			expect((err as CustomError).getCode()).toBe(409);
		}
	});
});
