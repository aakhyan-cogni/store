import { authRateLimiter, clientAddress, Password, registerSchema, Route, UserRepository, userSchema } from "#lib";

export default new Route({
	description: "Register a new user",
	POST: async ({ req, res, body, db }) => {
		// Before the bcrypt hash below, which is the expensive part: otherwise
		// a flood of registrations is a cheap way to spend this server's CPU.
		const limit = authRateLimiter.check(`register:${clientAddress(req)}`);
		if (!limit.allowed) {
			res.setHeader("retry-after", String(limit.retryAfterSeconds));
			res.writeHead(429);
			return res.end(JSON.stringify({ message: "Too many attempts, please try again later" }));
		}

		const registerBody = registerSchema.parse(body);
		const userDb = new UserRepository(db);

		const password_hash = await Password.hash(registerBody.password);
		// A duplicate address surfaces as a 409 from the repository, which is
		// the unique index talking rather than a check that races it.
		const newUser = await userDb.create({ email: registerBody.email, name: registerBody.name, password_hash });

		res.writeHead(201);
		res.end(JSON.stringify({ message: "Registered successfully", user: userSchema.parse(newUser) }));
	},
});
