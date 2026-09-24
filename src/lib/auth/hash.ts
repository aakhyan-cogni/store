import bcrypt from "bcrypt";

/**
 * bcrypt's work factor. The cost is stored inside each hash, so raising this
 * keeps existing passwords verifiable — they simply stay at the cost they were
 * written with until the password is next changed.
 */
const COST = 12;

export const Password = {
	hash(password: string) {
		return bcrypt.hash(password, COST);
	},

	verify(password: string, hash: string) {
		return bcrypt.compare(password, hash);
	},
};
