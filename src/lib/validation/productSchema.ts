import { z } from "zod";

export const dbProductSchema = z.object({
	id: z.number().int(),
	is_active: z.boolean().default(true),
	category_id: z.number().int(),
	name: z.string().min(1).max(100),
	description: z.string().nullable().optional(),
	price: z.string(),
	stock: z.number().int().default(0),
	created_at: z.date(),
});

export const newProductSchema = dbProductSchema.omit({ id: true, created_at: true });
export const publicProductSchema = dbProductSchema.omit({ is_active: true });
export const updateProductSchema = dbProductSchema.omit({ is_active: true, created_at: true, id: true }).partial();
