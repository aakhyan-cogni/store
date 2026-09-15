import { z } from "zod";

export const dbUserSchema = z.object({
	id: z.int(),
	name: z.string().min(1).max(100),
	email: z.email(),
	password_hash: z.string(),
	role: z.enum(["ADMIN", "USER"]).default("USER"),
	created_at: z.date(),
});

export const userSchema = dbUserSchema.omit({ password_hash: true });

export const registerSchema = z.object({
	name: z.string("'name' is required parameter").min(1).max(100),
	email: z.email("'email' is required and should be a valid email"),
	password: z.string("'password' is required"),
});

export const loginSchema = registerSchema.omit({ name: true });
