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
	userWireSchema,
	validationDetailsWireSchema,
} from "#lib";

export default new Route({
	description: "Register a new user",
	contracts: {
		POST: {
			summary: "Register a User",
			description: "Creates a User with the default shopper role.",
			tags: ["Authentication"],
			requestBody: {
				schema: registerSchema,
				componentName: "RegistrationRequest",
				description: "The new User's name, email address, and password.",
				required: true,
				contentTypes: ["application/json"],
				examples: {
					user: {
						summary: "New User",
						value: { name: "Ada Lovelace", email: "ada@example.com", password: "example-password" },
					},
				},
			},
			responses: {
				201: {
					description: "The User was registered",
					data: userWireSchema,
				},
				400: {
					description: "The request body is invalid",
					errors: [
						{
							code: "VALIDATION_FAILED",
							description: "The request body does not match the registration schema.",
							details: validationDetailsWireSchema,
						},
					],
				},
				409: {
					description: "A User with the email address already exists",
					errors: [{ code: "CONFLICT", description: "The email address is already registered." }],
				},
				429: {
					description: "Too many registration attempts",
					errors: [{ code: "RATE_LIMITED", description: "Retry after the duration in the retry-after header." }],
				},
			},
		},
	},
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
