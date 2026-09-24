import { authRateLimiter, clientAddress, JwtService, loginSchema, Password, Route, UserRepository } from "#lib";

/**
 * A real bcrypt hash of a throwaway string, at the same cost as a stored
 * password. Verified against when the address is unknown, so a login for an
 * account that does not exist takes as long as one that does and cannot be
 * used to enumerate users. The cost must track `Password`'s, or the timings
 * diverge again.
 */
const DUMMY_PASSWORD_HASH = "$2b$12$ggm/92k/Im.3LKAGftv5deaEHgQQ6ctAfd.d29UsBxxoWGuLSCfkq";

export default new Route({
	description: "Log in an existing user",
	POST: async ({ req, res, body, db }) => {
		const loginBody = loginSchema.parse(body);

		// Charged to the caller and to the account they are aiming at, so one
		// address cannot be ground down from many sources, and one source
		// cannot work through many addresses. Checked before the bcrypt
		// comparison, which is ~100ms of CPU an attacker would otherwise get
		// to spend for free.
		const limit = authRateLimiter.check(`login:${clientAddress(req)}`, `login:${loginBody.email}`);
		if (!limit.allowed) {
			res.setHeader("retry-after", String(limit.retryAfterSeconds));
			res.writeHead(429);
			return res.end(JSON.stringify({ message: "Too many attempts, please try again later" }));
		}

		const userDb = new UserRepository(db);

		const user = await userDb.findByEmail(loginBody.email);
		const passwordMatches = await Password.verify(loginBody.password, user?.password_hash ?? DUMMY_PASSWORD_HASH);
		if (!user || !passwordMatches) {
			res.writeHead(401);
			return res.end(JSON.stringify({ message: "Invalid email or password" }));
		}

		const token = new JwtService().sign({ sub: String(user.id), email: user.email, role: user.role });

		res.writeHead(200);
		res.end(JSON.stringify({ token }));
	},
});
