import { z } from "zod";

const MIN_PASSWORD_LENGTH = 12;
/** bcrypt only reads the first 72 bytes; anything longer is silently ignored. */
const MAX_PASSWORD_LENGTH = 72;

/**
 * An email as the shop stores it: trimmed and lower-cased, so one address is
 * one account no matter how the shopper capitalised it.
 */
const emailSchema = z
	.string("'email' is required and should be a valid email")
	.trim()
	.toLowerCase()
	.pipe(z.email("'email' is required and should be a valid email"));

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
	email: emailSchema,
	password: z
		.string("'password' is required")
		.min(MIN_PASSWORD_LENGTH, `'password' must be at least ${MIN_PASSWORD_LENGTH} characters`)
		.max(MAX_PASSWORD_LENGTH, `'password' must be at most ${MAX_PASSWORD_LENGTH} characters`),
});

/**
 * Spelled out rather than derived from `registerSchema`: login must stay
 * permissive about password shape so accounts created under an older policy
 * can still sign in, and deriving it would drag the new minimum along.
 */
export const loginSchema = z.object({
	email: emailSchema,
	password: z.string("'password' is required").min(1),
});
