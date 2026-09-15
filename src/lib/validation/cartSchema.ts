import { z } from "zod";

export const dbCartItemSchema = z.object({
	id: z.int(),
	user_id: z.int(),
	product_id: z.int(),
	quantity: z.int().min(1),
	created_at: z.date(),
});

export const addToCartSchema = dbCartItemSchema.omit({ id: true, created_at: true, user_id: true });
export const updateCartItemSchema = z.object({ quantity: z.int().min(1) });

export const publicCartItemSchema = z.object({
	product_id: z.int(),
	name: z.string(),
	price: z.string(),
	stock: z.int().min(0),
	quantity: z.int().min(1),
});
