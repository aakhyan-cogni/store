import { z } from "zod";
import { moneyStringSchema } from "./moneySchema.js";

/** Mirrors the `order_status` enum in migration 005. */
export const orderStatusSchema = z.enum(["PENDING", "PAID", "CANCELLED"]);

export const dbOrderSchema = z.object({
	id: z.int(),
	user_id: z.int(),
	total_amount: moneyStringSchema,
	status: orderStatusSchema,
	created_at: z.date(),
});

export const publicOrderSchema = dbOrderSchema.omit({ user_id: true });

export const publicOrderItemSchema = z.object({
	product_id: z.int(),
	name: z.string(),
	quantity: z.int().min(1),
	price_at_purchase: moneyStringSchema,
});

export const publicOrderWithItemsSchema = publicOrderSchema.extend({
	items: z.array(publicOrderItemSchema),
});

/**
 * The only transition a user may ask for. `PAID` is deliberately absent: no
 * payment gateway exists, so nothing may claim an order was paid.
 */
export const updateOrderSchema = z.object({
	status: z.literal("CANCELLED"),
});
