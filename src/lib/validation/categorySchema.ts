import { z } from "zod";

export const dbCategorySchema = z.object({
	id: z.int(),
	name: z.string().min(1).max(100),
});

export const newCategorySchema = dbCategorySchema.omit({ id: true });
