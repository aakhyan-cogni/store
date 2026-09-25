import type { IncomingMessage, ServerResponse } from "node:http";
import type postgres from "postgres";
import { describe, expect, it } from "vitest";
import cartRoute from "../src/api/cart/index.js";
import categoriesRoute from "../src/api/categories/all.js";
import ordersRoute from "../src/api/orders/index.js";
import pingRoute from "../src/api/ping.js";
import productRoute from "../src/api/products/[id].js";
import productsRoute from "../src/api/products/all.js";
import type { MethodOptions } from "../src/lib/structures/Route.js";
import type { Server } from "../src/lib/structures/Server.js";

function responseRecorder() {
	let body = "";
	const headers = new Map<string, string | number | readonly string[]>();
	const response = {
		statusCode: 200,
		setHeader(name: string, value: string | number | readonly string[]) {
			headers.set(name.toLowerCase(), value);
			return this;
		},
		removeHeader(name: string) {
			headers.delete(name.toLowerCase());
		},
		end(chunk?: string) {
			body = chunk ?? "";
			return this;
		},
	} as unknown as ServerResponse<IncomingMessage>;

	return { response, json: () => JSON.parse(body) as unknown };
}

function options(res: ServerResponse<IncomingMessage>, db: postgres.Sql, query = new URLSearchParams()): MethodOptions {
	return {
		req: {} as IncomingMessage,
		res,
		query,
		db,
		server: {} as Server,
	};
}

function fakeProductDatabase(products: unknown[], total: number) {
	return ((strings: TemplateStringsArray, ...values: unknown[]) => {
		const query = { text: strings.join("?"), values };
		if (query.text.includes("COUNT(*)")) return Promise.resolve([{ total }]);
		if (query.text.includes("SELECT id")) return Promise.resolve(products);
		return query;
	}) as unknown as postgres.Sql;
}

const PRODUCT = {
	id: 7,
	category_id: 2,
	name: "Filtered product",
	description: null,
	price: "12.50",
	stock: 4,
	created_at: new Date("2026-01-01T00:00:00Z"),
};

describe("catalogue route access", () => {
	it("keeps catalogue reads public", () => {
		expect(productsRoute.auth?.GET?.required).not.toBe(true);
		expect(productRoute.auth?.GET?.required).not.toBe(true);
		expect(categoriesRoute.auth?.GET?.required).not.toBe(true);
	});

	it("keeps cart and order reads private", () => {
		expect(cartRoute.auth?.GET).toEqual({ required: true });
		expect(ordersRoute.auth?.GET).toEqual({ required: true });
	});

	it.each([
		{
			name: "the unfiltered first page",
			search: "",
			products: [PRODUCT],
			total: 1,
			meta: { limit: 20, offset: 0, total: 1 },
		},
		{
			name: "a filtered page",
			search: "q=Filtered",
			products: [PRODUCT],
			total: 1,
			meta: { limit: 20, offset: 0, total: 1 },
		},
		{
			name: "an empty filtered page",
			search: "q=missing",
			products: [],
			total: 0,
			meta: { limit: 20, offset: 0, total: 0 },
		},
		{
			name: "the final page",
			search: "limit=3&offset=6",
			products: [PRODUCT],
			total: 7,
			meta: { limit: 3, offset: 6, total: 7 },
		},
	])("returns data and pagination metadata for $name", async ({ search, products, total, meta }) => {
		const recorder = responseRecorder();
		await productsRoute.GET?.(
			options(recorder.response, fakeProductDatabase(products, total), new URLSearchParams(search)),
		);

		expect(recorder.json()).toEqual({
			data: products.map((product) => ({ ...product, created_at: product.created_at.toISOString() })),
			meta,
		});
	});

	it("returns public Categories through the success envelope", async () => {
		const categories = [
			{ id: 1, name: "Books" },
			{ id: 2, name: "Games" },
		];
		const db = ((strings: TemplateStringsArray) => {
			if (strings.join("?").includes("SELECT * FROM categories")) return Promise.resolve(categories);
			return Promise.resolve([]);
		}) as unknown as postgres.Sql;
		const recorder = responseRecorder();

		await categoriesRoute.GET?.(options(recorder.response, db));

		expect(recorder.json()).toEqual({ data: categories });
	});

	it("returns a public Product through the success envelope", async () => {
		const recorder = responseRecorder();
		await productRoute.GET?.({
			...options(recorder.response, fakeProductDatabase([PRODUCT], 1)),
			params: { id: "7" },
		});

		expect(recorder.json()).toEqual({
			data: { ...PRODUCT, created_at: PRODUCT.created_at.toISOString() },
		});
	});

	it("returns ping through the success envelope", async () => {
		const recorder = responseRecorder();
		await pingRoute.GET?.(options(recorder.response, fakeProductDatabase([], 0)));

		expect(recorder.json()).toEqual({
			data: { status: "ok", timestamp: expect.any(Number) },
		});
	});
});
