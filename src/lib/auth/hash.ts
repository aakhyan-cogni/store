import bcrypt from "bcrypt";

export const Password = {
	hash(password: string) {
		return bcrypt.hash(password, 10);
	},

	verify(password: string, hash: string) {
		return bcrypt.compare(password, hash);
	},
};
