import { JwtService, loginSchema, Password, Route, UserRepository } from "#lib";

const DUMMY_PASSWORD_HASH = "$2b$10$oEPtbDGuF2bHo3RtHUqiZu9bijtpHrSBHGlMlUuqDRdIwhOJS/DIa";

export default new Route({
	description: "Log in an existing user",
	POST: async ({ res, body, db }) => {
		const loginBody = loginSchema.parse(body);
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
