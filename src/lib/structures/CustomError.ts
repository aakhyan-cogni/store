import type { ApiErrorCode } from "../responses.js";

export class CustomError extends Error {
	private code: number;
	public readonly errorCode: ApiErrorCode;
	public constructor(code: number, message: string, errorCode = errorCodeForStatus(code)) {
		super(message);
		this.code = code;
		this.errorCode = errorCode;
		this.message = message;
	}
	public getCode() {
		return this.code;
	}
	public toJSON() {
		return {
			message: this.message,
		};
	}
}

function errorCodeForStatus(status: number): ApiErrorCode {
	switch (status) {
		case 400:
			return "VALIDATION_FAILED";
		case 401:
			return "UNAUTHENTICATED";
		case 403:
			return "FORBIDDEN";
		case 404:
			return "NOT_FOUND";
		case 409:
			return "CONFLICT";
		case 429:
			return "RATE_LIMITED";
		default:
			return status >= 500 ? "INTERNAL_ERROR" : "VALIDATION_FAILED";
	}
}
