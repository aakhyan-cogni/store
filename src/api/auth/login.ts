import {
	authRateLimiter,
	clientAddress,
	JwtService,
	loginSchema,
	parseRequest,
	Password,
	Route,
	sendData,
	sendError,
	tokenWireSchema,
	UserRepository,
	validationDetailsWireSchema,
} from "#lib";

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
	contracts: {
		POST: {
			summary: "Log in",
			description: "Authenticates a User with an email address and password and returns a bearer token.",
			tags: ["Authentication"],
			requestBody: {
				schema: loginSchema,
				componentName: "LoginRequest",
				description: "The User credentials to authenticate.",
				required: true,
				contentTypes: ["application/json"],
				examples: {
					credentials: {
						summary: "User credentials",
						value: { email: "user@example.com", password: "example-password" },
					},
				},
			},
			responses: {
				200: {
					description: "The User was authenticated",
					data: tokenWireSchema,
				},
				400: {
					description: "The request body is invalid",
					errors: [
						{
							code: "VALIDATION_FAILED",
							description: "The request body does not match the login schema.",
							details: validationDetailsWireSchema,
						},
					],
				},
				401: {
					description: "The email address or password is incorrect",
					errors: [{ code: "UNAUTHENTICATED", description: "The supplied credentials are invalid." }],
				},
				429: {
					description: "Too many login attempts",
					errors: [{ code: "RATE_LIMITED", description: "Retry after the duration in the retry-after header." }],
				},
			},
		},
	},
	POST: async ({ req, res, body, db }) => {
		const loginBody = parseRequest(loginSchema, body);

		// Charged to the caller and to the account they are aiming at, so one
		// address cannot be ground down from many sources, and one source
		// cannot work through many addresses. Checked before the bcrypt
		// comparison, which is ~100ms of CPU an attacker would otherwise get
		// to spend for free.
		const limit = authRateLimiter.check(`login:${clientAddress(req)}`, `login:${loginBody.email}`);
		if (!limit.allowed) {
			res.setHeader("retry-after", String(limit.retryAfterSeconds));
			return sendError(res, 429, "RATE_LIMITED", "Too many attempts, please try again later");
		}

		const userDb = new UserRepository(db);

		const user = await userDb.findByEmail(loginBody.email);
		const passwordMatches = await Password.verify(loginBody.password, user?.password_hash ?? DUMMY_PASSWORD_HASH);
		if (!user || !passwordMatches) {
			return sendError(res, 401, "UNAUTHENTICATED", "Invalid email or password");
		}

		const token = new JwtService().sign({ sub: String(user.id), email: user.email, role: user.role });

		sendData(res, { token });
	},
});
