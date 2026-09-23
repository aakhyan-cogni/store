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

/**
 * A cart line as both the shopper and checkout see it. Delisted products stay
 * visible — flagged rather than hidden — so a buyer can see what is blocking
 * their checkout and remove it.
 */
export const publicCartItemSchema = z.object({
	product_id: z.int(),
	name: z.string(),
	price: z.string(),
	stock: z.int().min(0),
	quantity: z.int().min(1),
	listed: z.boolean(),
});
