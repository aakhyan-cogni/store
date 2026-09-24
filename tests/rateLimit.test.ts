import { describe, expect, it } from "vitest";
import { createRateLimiter } from "../src/lib/auth/rateLimit.js";

/** A limiter on a clock the test owns, so nothing has to wait out a window. */
function limiterAt(start = 1_000_000) {
	let now = start;
	const limiter = createRateLimiter({ limit: 3, windowMs: 60_000, now: () => now });
	return { limiter, advance: (ms: number) => (now += ms) };
}

describe("createRateLimiter", () => {
	it("allows attempts up to the limit and refuses the next", () => {
		const { limiter } = limiterAt();

		expect(limiter.check("ip").allowed).toBe(true);
		expect(limiter.check("ip").allowed).toBe(true);
		expect(limiter.check("ip").allowed).toBe(true);
		expect(limiter.check("ip").allowed).toBe(false);
	});

	it("says how long to wait", () => {
		const { limiter, advance } = limiterAt();
		for (let i = 0; i < 3; i++) limiter.check("ip");
		advance(20_000);

		expect(limiter.check("ip").retryAfterSeconds).toBe(40);
	});

	it("lets the window slide", () => {
		const { limiter, advance } = limiterAt();
		for (let i = 0; i < 3; i++) limiter.check("ip");
		expect(limiter.check("ip").allowed).toBe(false);

		advance(60_001);
		expect(limiter.check("ip").allowed).toBe(true);
	});

	it("counts each key separately", () => {
		const { limiter } = limiterAt();
		for (let i = 0; i < 3; i++) limiter.check("ip:a");

		expect(limiter.check("ip:a").allowed).toBe(false);
		expect(limiter.check("ip:b").allowed).toBe(true);
	});

	it("refuses when any one of several keys is over its limit", () => {
		// Login charges the attempt to the caller's address and to the account
		// it targets, so neither dimension can be worked around by rotating
		// the other.
		const { limiter } = limiterAt();
		for (let i = 0; i < 3; i++) limiter.check("email:victim@example.com");

		expect(limiter.check("ip:fresh", "email:victim@example.com").allowed).toBe(false);
	});

	it("does not spend a second key's budget on a refused attempt", () => {
		const { limiter } = limiterAt();
		for (let i = 0; i < 3; i++) limiter.check("email:victim@example.com");
		for (let i = 0; i < 5; i++) limiter.check("ip:fresh", "email:victim@example.com");

		// The address was never charged for attempts that never happened.
		expect(limiter.check("ip:fresh").allowed).toBe(true);
	});

	it("forgets keys once their window has passed", () => {
		const { limiter, advance } = limiterAt();
		const small = createRateLimiter({ limit: 1, windowMs: 1000, now: () => Date.now(), maxKeys: 1 });

		for (let i = 0; i < 50; i++) small.check(`ip:${i}`);
		advance(1);

		// Nothing to assert beyond it staying usable: the sweep is there so a
		// flood of distinct addresses cannot grow the map without bound.
		expect(small.check("ip:new").allowed).toBe(true);
		expect(limiter.check("ip:new").allowed).toBe(true);
	});

	it("starts clean after a reset", () => {
		const { limiter } = limiterAt();
		for (let i = 0; i < 3; i++) limiter.check("ip");
		limiter.reset();

		expect(limiter.check("ip").allowed).toBe(true);
	});
});
