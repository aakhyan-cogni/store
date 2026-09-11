import { Password, registerSchema, Route, UserRepository, userSchema } from "#lib";

export default new Route({
	description: "Register a new user",
	POST: async ({ res, body, db }) => {
		const registerBody = registerSchema.parse(body);
		const userDb = new UserRepository(db);

		const existingUser = await userDb.findByEmail(registerBody.email);
		if (existingUser) {
			res.writeHead(409);
			return res.end(JSON.stringify({ message: "User already exists" }));
		}

		const password_hash = await Password.hash(registerBody.password);
		const newUser = await userDb.create({ email: registerBody.email, name: registerBody.name, password_hash });

		res.writeHead(201);
		res.end(JSON.stringify({ message: "Registered successfully", user: userSchema.parse(newUser) }));
	},
});
