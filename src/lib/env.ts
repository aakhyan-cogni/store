import { z } from "zod";

const SECONDS_PER_UNIT = { s: 1, m: 60, h: 60 * 60, d: 24 * 60 * 60, w: 7 * 24 * 60 * 60 } as const;
type DurationUnit = keyof typeof SECONDS_PER_UNIT;

const DURATION_PATTERN = /^(\d+)\s*(s|m|h|d|w)?$/i;

/** A token lifetime longer than this is a configuration mistake, not a choice. */
const MAX_TOKEN_LIFETIME_SECONDS = 30 * SECONDS_PER_UNIT.d;

/** The shortest HS256 secret worth having: 256 bits of it, as text. */
const MIN_JWT_SECRET_LENGTH = 32;

/**
 * Reads a duration as whole seconds. Accepts either a bare count of seconds or
 * a unit suffix (`3600`, `1h`, `30m`), and returns `null` for anything else so
 * the caller decides what an unreadable duration means.
 */
export function parseDurationSeconds(value: string) {
	const match = DURATION_PATTERN.exec(value.trim());
	if (!match) return null;

	const [, amount, unit] = match;
	const seconds = SECONDS_PER_UNIT[(unit?.toLowerCase() ?? "s") as DurationUnit];
	return Number(amount) * seconds;
}

/**
 * Everything the process reads out of its environment, in one place.
 *
 * Checked once at startup rather than at the point of use, so a missing or
 * weak secret is a boot failure with a readable message instead of a 500 on
 * the first request that happens to need it.
 */
export const envSchema = z.object({
	PORT: z.coerce.number("PORT is required").int().positive().max(65535),
	HOST: z.string().min(1).optional(),
	NODE_ENV: z.enum(["production", "development", "testing", "test"]).default("development"),
	DATABASE_URL: z.string("DATABASE_URL is required").regex(/^postgres(ql)?:\/\//, "must be a postgres:// URL"),
	// HS256 is only as strong as the secret behind it: a short one is
	// brute-forcible, and every token the server ever issued is then forgeable.
	JWT_SECRET: z
		.string("JWT_SECRET is required")
		.min(MIN_JWT_SECRET_LENGTH, `must be at least ${MIN_JWT_SECRET_LENGTH} characters`),
	JWT_EXPIRES_IN: z
		.string()
		.default("1h")
		.transform((value, ctx) => {
			const seconds = parseDurationSeconds(value);
			if (seconds === null || seconds <= 0 || seconds > MAX_TOKEN_LIFETIME_SECONDS) {
				ctx.addIssue({
					code: "custom",
					message: `must be seconds or a duration like '1h', up to ${MAX_TOKEN_LIFETIME_SECONDS}s`,
				});
				return z.NEVER;
			}
			return seconds;
		}),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

/**
 * The validated environment. Throws on the first call if anything is missing or
 * out of range, which is why `Server.start` calls it before it binds a port.
 */
export function loadEnv(): Env {
	if (cached) return cached;

	const parsed = envSchema.safeParse(process.env);
	if (!parsed.success) {
		const details = parsed.error.issues.map((issue) => `${issue.path.join(".")} ${issue.message}`).join("; ");
		throw new Error(`Invalid environment: ${details}`);
	}

	return (cached = parsed.data);
}
