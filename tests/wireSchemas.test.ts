import { describe, expect, it } from "vitest";
import { z } from "zod";
import { newProductSchema, productQuerySchema } from "../src/lib/validation/index.js";
import {
	cartMutationResultWireSchema,
	cartWireSchema,
	createdProductWireSchema,
	errorResponseWireSchema,
	healthWireSchema,
	orderListWireSchema,
	orderWireSchema,
	productWireSchema,
	serializedDateTimeSchema,
	userWireSchema,
	validationDetailsWireSchema,
	wireSchemas,
} from "../src/lib/validation/wireSchemas.js";

const CREATED_AT = "2026-01-01T00:00:00.000Z";

describe("named wire schemas", () => {
	it("provides stable unique component names", () => {
		const names = wireSchemas.map(({ componentName }) => componentName);

		expect(names).toEqual([...names].sort());
		expect(new Set(names).size).toBe(names.length);
		expect(names).toEqual(
			expect.arrayContaining([
				"Product",
				"Category",
				"Cart",
				"Order",
				"User",
				"Token",
				"Health",
				"Pagination",
				"ValidationDetail",
				"ErrorResponse",
			]),
		);
	});

	it("uses date-time strings for serialized dates", () => {
		expect(serializedDateTimeSchema.parse(CREATED_AT)).toBe(CREATED_AT);
		expect(() => serializedDateTimeSchema.parse(new Date(CREATED_AT))).toThrow();

		const productJsonSchema = z.toJSONSchema(productWireSchema.schema) as {
			properties?: Record<string, unknown>;
		};
		expect(productJsonSchema.properties?.created_at).toMatchObject({ type: "string", format: "date-time" });
	});

	it("describes public and creation Product responses separately", () => {
		const product = {
			id: 1,
			category_id: 2,
			name: "Tea",
			description: null,
			price: "12.50",
			stock: 4,
			created_at: CREATED_AT,
		};

		expect(productWireSchema.schema.parse(product)).toEqual(product);
		expect(createdProductWireSchema.schema.parse({ ...product, is_active: true })).toEqual({
			...product,
			is_active: true,
		});
	});

	it("documents the current public Cart and database-shaped mutation responses", () => {
		const cart = [{ product_id: 1, name: "Tea", price: "12.50", stock: 4, quantity: 2, listed: true }];
		const mutation = { id: 7, user_id: 3, product_id: 1, quantity: 2, created_at: CREATED_AT };

		expect(cartWireSchema.schema.parse(cart)).toEqual(cart);
		expect(cartMutationResultWireSchema.schema.parse(mutation)).toEqual(mutation);
	});

	it("describes Order summaries and Order details", () => {
		const summary = { id: 8, total_amount: "25.00", status: "PENDING", created_at: CREATED_AT };
		const detail = {
			...summary,
			items: [{ product_id: 1, name: "Tea", quantity: 2, price_at_purchase: "12.50" }],
		};

		expect(orderListWireSchema.schema.parse([summary])).toEqual([summary]);
		expect(orderWireSchema.schema.parse(detail)).toEqual(detail);
	});

	it("covers User, health, validation-detail, and error responses", () => {
		const user = {
			id: 3,
			name: "Ada",
			email: "ada@example.com",
			role: "USER",
			created_at: CREATED_AT,
		};

		expect(userWireSchema.schema.parse(user)).toEqual(user);
		expect(healthWireSchema.schema.parse({ status: "ok", timestamp: 1_799_000_000_000 })).toEqual({
			status: "ok",
			timestamp: 1_799_000_000_000,
		});
		expect(validationDetailsWireSchema.schema.parse([{ field: "email", message: "Invalid email" }])).toEqual([
			{ field: "email", message: "Invalid email" },
		]);
		expect(
			errorResponseWireSchema.schema.parse({
				error: {
					code: "VALIDATION_FAILED",
					message: "Request validation failed",
					details: [{ field: "email", message: "Invalid email" }],
				},
			}),
		).toEqual({
			error: {
				code: "VALIDATION_FAILED",
				message: "Request validation failed",
				details: [{ field: "email", message: "Invalid email" }],
			},
		});
	});

	it("keeps request and query schemas available in input mode", () => {
		expect(newProductSchema.parse({ category_id: 2, name: "Tea", price: "12.50" })).toMatchObject({ stock: 0 });
		expect(productQuerySchema.parse({ category_id: "2", limit: "10", offset: "0" })).toEqual({
			category_id: 2,
			limit: 10,
			offset: 0,
		});
	});
});
