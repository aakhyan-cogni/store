import jwt from "jsonwebtoken";
import { loadEnv } from "../env.js";

/** The only algorithm this service issues, and the only one it will accept. */
const ALGORITHM = "HS256" as const;

export interface JWTPayload extends jwt.JwtPayload {
	sub: string;
	email: string;
	role: "ADMIN" | "USER";
}

export class JwtService {
	private readonly env = loadEnv();

	public sign(payload: JWTPayload) {
		return jwt.sign(payload, this.env.JWT_SECRET, {
			expiresIn: this.env.JWT_EXPIRES_IN,
			algorithm: ALGORITHM,
		});
	}

	/**
	 * Pins the algorithm rather than letting the token name it: an unpinned
	 * `verify` trusts whatever the token's own header claims, which is how key
	 * material meant for one algorithm gets accepted under another.
	 */
	public verify(token: string) {
		try {
			return jwt.verify(token, this.env.JWT_SECRET, { algorithms: [ALGORITHM] }) as JWTPayload;
		} catch {
			return null;
		}
	}
}
