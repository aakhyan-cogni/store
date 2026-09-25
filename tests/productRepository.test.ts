import { describe, expect, it } from "vitest";
import { ProductRepository } from "../src/lib/db/repositories/productRepository.js";
import type { Database } from "../src/lib/db/types.js";

interface RecordedQuery {
	text: string;
	values: unknown[];
}

function fakeDatabase(products: unknown[], total: number) {
	const calls: RecordedQuery[] = [];
	const db = ((strings: TemplateStringsArray, ...values: unknown[]) => {
		const query = { text: strings.join("?"), values };
		calls.push(query);
		if (query.text.includes("COUNT(*)")) return Promise.resolve([{ total }]);
		if (query.text.includes("SELECT id")) return Promise.resolve(products);
		return query;
	}) as unknown as Database;
	return { db, calls };
}

const PRODUCT = {
	id: 3,
	category_id: 2,
	name: "Filtered product",
	description: null,
	price: "12.50",
	stock: 4,
	created_at: new Date("2026-01-01T00:00:00Z"),
};

describe("ProductRepository.getAll", () => {
	it("returns the filtered total separately from the current page", async () => {
		const { db } = fakeDatabase([PRODUCT], 7);

		await expect(new ProductRepository(db).getAll({ limit: 1, offset: 6 })).resolves.toEqual({
			products: [PRODUCT],
			total: 7,
		});
	});

	it("retains the total when the requested page is empty", async () => {
		const { db } = fakeDatabase([], 2);

		await expect(new ProductRepository(db).getAll({ limit: 20, offset: 40 })).resolves.toEqual({
			products: [],
			total: 2,
		});
	});

	it("uses the same filters for page rows and the total", async () => {
		const { db, calls } = fakeDatabase([], 0);
		await new ProductRepository(db).getAll({
			q: "50% off",
			category_id: 2,
			min_price: "10.00",
			max_price: "20.00",
			limit: 5,
			offset: 10,
		});

		const filter = calls.find((call) => call.text.includes("is_active = TRUE"));
		const rows = calls.find((call) => call.text.includes("SELECT id"));
		const count = calls.find((call) => call.text.includes("COUNT(*)"));
		const recordedSql = calls.map((call) => call.text).join("\n");
		expect(recordedSql).toContain("AND name ILIKE");
		expect(recordedSql).toContain("AND category_id");
		expect(recordedSql).toContain("AND price >=");
		expect(recordedSql).toContain("AND price <=");
		expect(rows?.values).toContain(filter);
		expect(count?.values).toContain(filter);
	});
});
