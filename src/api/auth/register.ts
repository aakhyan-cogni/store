import {
	authRateLimiter,
	clientAddress,
	parseRequest,
	Password,
	registerSchema,
	Route,
	sendData,
	sendError,
	UserRepository,
	userSchema,
} from "#lib";

export default new Route({
	description: "Register a new user",
	POST: async ({ req, res, body, db }) => {
		// Before the bcrypt hash below, which is the expensive part: otherwise
		// a flood of registrations is a cheap way to spend this server's CPU.
		const limit = authRateLimiter.check(`register:${clientAddress(req)}`);
		if (!limit.allowed) {
			res.setHeader("retry-after", String(limit.retryAfterSeconds));
			return sendError(res, 429, "RATE_LIMITED", "Too many attempts, please try again later");
		}

		const registerBody = parseRequest(registerSchema, body);
		const userDb = new UserRepository(db);

		const password_hash = await Password.hash(registerBody.password);
		// A duplicate address surfaces as a 409 from the repository, which is
		// the unique index talking rather than a check that races it.
		const newUser = await userDb.create({ email: registerBody.email, name: registerBody.name, password_hash });

		sendData(res, userSchema.parse(newUser), { status: 201 });
	},
});
