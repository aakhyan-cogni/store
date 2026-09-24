import type { IncomingMessage } from "node:http";

export interface RateLimitDecision {
	allowed: boolean;
	/** How long the caller must wait, in whole seconds. `0` when allowed. */
	retryAfterSeconds: number;
}

export interface RateLimiterOptions {
	/** Attempts permitted per key within one window. */
	limit: number;
	windowMs: number;
	/** Injectable clock, so tests do not have to wait out a window. */
	now?: () => number;
	/** Above this many tracked keys, expired ones are swept out. */
	maxKeys?: number;
}

/**
 * A sliding-window counter held in this process's memory.
 *
 * Deliberately not shared state: it throttles one Node process, which is what
 * protects this server's CPU from a flood of bcrypt comparisons. A cluster
 * behind a load balancer would need a shared counter (Postgres or Redis) to
 * enforce one limit across instances.
 */
export function createRateLimiter({ limit, windowMs, now = Date.now, maxKeys = 10_000 }: RateLimiterOptions) {
	const attempts = new Map<string, number[]>();

	function recent(key: string, at: number) {
		const cutoff = at - windowMs;
		const kept = (attempts.get(key) ?? []).filter((time) => time > cutoff);
		if (kept.length) attempts.set(key, kept);
		else attempts.delete(key);
		return kept;
	}

	function sweep(at: number) {
		for (const key of attempts.keys()) recent(key, at);
	}

	return {
		/**
		 * Weighs an attempt against every key it is charged to — a caller's
		 * address and the account they are aiming at, say — and records it only
		 * if all of them have room. A key already over its limit therefore does
		 * not spend anyone else's budget.
		 */
		check(...keys: string[]): RateLimitDecision {
			const at = now();
			if (attempts.size > maxKeys) sweep(at);

			for (const key of keys) {
				const times = recent(key, at);
				if (times.length < limit) continue;

				const oldest = times[0] ?? at;
				return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((oldest + windowMs - at) / 1000)) };
			}

			for (const key of keys) attempts.set(key, [...recent(key, at), at]);
			return { allowed: true, retryAfterSeconds: 0 };
		},

		reset() {
			attempts.clear();
		},
	};
}

/**
 * Guards the credential endpoints. Ten attempts per five minutes is generous
 * for a person and useless for a guessing script, and the check happens before
 * the bcrypt comparison so a flood cannot spend the CPU it was aimed at.
 */
export const authRateLimiter = createRateLimiter({ limit: 10, windowMs: 5 * 60 * 1000 });

/**
 * The caller's address, as the socket reports it. No proxy headers are trusted:
 * `X-Forwarded-For` is caller-supplied, so reading it without a known proxy in
 * front would let anyone rotate their own limit key.
 */
export function clientAddress(req: IncomingMessage) {
	return req.socket.remoteAddress ?? "unknown";
}
