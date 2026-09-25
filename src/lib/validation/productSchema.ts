import { z } from "zod";
import { moneyStringSchema } from "./moneySchema.js";

/**
 * A product row as the database holds it. `is_active` and `stock` are required
 * rather than defaulted: the columns are `NOT NULL` (migration 008), and a
 * default here would paper over a row that had drifted from that instead of
 * failing where the drift can be seen.
 */
export const dbProductSchema = z.object({
	id: z.int(),
	is_active: z.boolean(),
	category_id: z.int(),
	name: z.string().min(1).max(100),
	description: z.string().nullable().optional(),
	price: moneyStringSchema,
	stock: z.int().min(0),
	created_at: z.date(),
});

/**
 * `is_active` is deliberately absent: whether a product is listed is a
 * lifecycle decision the DELETE route owns, not something a creation request
 * may set. Accepting it would let a caller create a product invisible to every
 * read path, since all of them filter on `is_active = TRUE`.
 */
export const newProductSchema = dbProductSchema
	.omit({ id: true, created_at: true, is_active: true })
	.extend({ stock: z.int().min(0).default(0) });

export const publicProductSchema = dbProductSchema.omit({ is_active: true });

/**
 * Spelled out rather than derived from `dbProductSchema`, because a partial of
 * that schema still applies its defaults: a request editing only the price
 * would carry `stock: 0` along with it and silently wipe the stock.
 */
export const updateProductSchema = z
	.object({
		category_id: z.int(),
		name: z.string().min(1).max(100),
		description: z.string().nullable(),
		price: moneyStringSchema,
		stock: z.int().min(0),
	})
	.partial()
	.refine((data) => Object.keys(data).length > 0, { message: "at least one field must be updated" });

export const MAX_PRODUCT_PAGE_SIZE = 100;
export const DEFAULT_PRODUCT_PAGE_SIZE = 20;

/**
 * The query values accepted at the HTTP boundary. This schema omits the
 * runtime page-size transform so OpenAPI can represent it.
 */
export const productQueryContractSchema = z
	.object({
		q: z.string().optional().describe("Case-insensitive Product name search; blank values are ignored"),
		category_id: z.coerce.number().int().positive().optional().describe("Only Products in this Category"),
		min_price: moneyStringSchema.optional().describe("Minimum Product Price, inclusive"),
		max_price: moneyStringSchema.optional().describe("Maximum Product Price, inclusive and not below min_price"),
		limit: z.coerce
			.number()
			.int()
			.positive()
			.default(DEFAULT_PRODUCT_PAGE_SIZE)
			.describe(`Page size; values above ${MAX_PRODUCT_PAGE_SIZE} are capped`),
		offset: z.coerce.number().int().min(0).default(0).describe("Number of matching Products to skip"),
	})
	.refine((query) => !(query.min_price && query.max_price) || Number(query.min_price) <= Number(query.max_price), {
		message: "min_price cannot be greater than max_price",
		path: ["min_price"],
	});

/** The storefront browse window: what to look for, and which page of it. */
export const productQuerySchema = z
	.object({
		q: z.string().trim().min(1).optional(),
		category_id: z.coerce.number().int().positive().optional(),
		min_price: moneyStringSchema.optional(),
		max_price: moneyStringSchema.optional(),
		limit: z.coerce
			.number()
			.int()
			.positive()
			.default(DEFAULT_PRODUCT_PAGE_SIZE)
			.transform((value) => Math.min(value, MAX_PRODUCT_PAGE_SIZE)),
		offset: z.coerce.number().int().min(0).default(0),
	})
	.refine((query) => !(query.min_price && query.max_price) || Number(query.min_price) <= Number(query.max_price), {
		message: "min_price cannot be greater than max_price",
		path: ["min_price"],
	});

export type ProductQuery = z.infer<typeof productQuerySchema>;
