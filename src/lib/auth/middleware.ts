import type { IncomingMessage } from "node:http";
import type { MethodAuth, RequestUser } from "../structures/Route.js";
import { JwtService } from "./jwt.js";

export type AuthResult = { authorized: true; user?: RequestUser } | { authorized: false; status: 401 | 403 };

export function authorizeRequest(req: IncomingMessage, auth: MethodAuth | undefined): AuthResult {
	if (!auth?.required) return { authorized: true };

	const token = extractBearerToken(req.headers.authorization);
	if (!token) return { authorized: false, status: 401 };

	const payload = new JwtService().verify(token);
	if (!payload) return { authorized: false, status: 401 };

	const id = Number(payload.sub);
	if (!Number.isSafeInteger(id) || id <= 0) return { authorized: false, status: 401 };

	if (auth.roles?.length && !auth.roles.includes(payload.role)) return { authorized: false, status: 403 };

	return { authorized: true, user: { id, role: payload.role } };
}

function extractBearerToken(header: string | undefined) {
	const [scheme, token] = header?.split(" ") ?? [];
	if (scheme?.toLowerCase() !== "bearer" || !token) return null;
	return token;
}
