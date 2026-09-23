import { z } from "zod";
import { moneyStringSchema } from "./moneySchema.js";

export const dbProductSchema = z.object({
	id: z.int(),
	is_active: z.boolean().default(true),
	category_id: z.int(),
	name: z.string().min(1).max(100),
	description: z.string().nullable().optional(),
	price: moneyStringSchema,
	stock: z.int().min(0).default(0),
	created_at: z.date(),
});

export const newProductSchema = dbProductSchema.omit({ id: true, created_at: true });
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
