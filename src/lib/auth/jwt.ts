import jwt from "jsonwebtoken";

export interface JWTPayload extends jwt.JwtPayload {
	sub: string;
	email: string;
	role: "ADMIN" | "USER";
}

export class JwtService {
	private readonly secret = process.env.JWT_SECRET;
	public sign(payload: JWTPayload) {
		return jwt.sign(payload, this.secret, {
			expiresIn: Number(process.env.JWT_EXPIRES_IN),
		});
	}

	public verify(token: string) {
		try {
			return jwt.verify(token, this.secret) as JWTPayload;
		} catch {
			return null;
		}
	}
}
