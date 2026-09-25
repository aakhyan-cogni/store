import type { IncomingMessage, ServerResponse } from "node:http";

export const API_ERROR_CODES = [
	"VALIDATION_FAILED",
	"UNAUTHENTICATED",
	"FORBIDDEN",
	"NOT_FOUND",
	"CONFLICT",
	"RATE_LIMITED",
	"METHOD_NOT_ALLOWED",
	"NOT_IMPLEMENTED",
	"INTERNAL_ERROR",
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export interface ResponseMeta {
	[key: string]: unknown;
}

export function sendData(
	res: ServerResponse<IncomingMessage>,
	data: unknown,
	options: { status?: number; meta?: ResponseMeta } = {},
) {
	const body = options.meta ? { data, meta: options.meta } : { data };
	const payload = JSON.stringify(body);
	res.statusCode = options.status ?? 200;
	res.setHeader("content-type", "application/json");
	res.setHeader("content-length", Buffer.byteLength(payload));
	res.end(payload);
}

export function sendNoContent(res: ServerResponse<IncomingMessage>) {
	res.removeHeader("content-type");
	res.removeHeader("content-length");
	res.statusCode = 204;
	res.end();
}

export function sendError(
	res: ServerResponse<IncomingMessage>,
	status: number,
	code: ApiErrorCode,
	message: string,
	details?: unknown,
) {
	const payload = JSON.stringify({ error: { code, message, ...(details === undefined ? {} : { details }) } });
	res.statusCode = status;
	res.setHeader("content-type", "application/json");
	res.setHeader("content-length", Buffer.byteLength(payload));
	res.end(payload);
}
