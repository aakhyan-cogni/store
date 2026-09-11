import { z } from "zod";

export const dbCategorySchema = z.object({
	id: z.number().int(),
	name: z.string().min(1).max(100),
});

export const newCategorySchema = dbCategorySchema.omit({ id: true });
