import postgres from "postgres";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { toErrorResponse } from "../src/lib/errors.js";
import { CustomError } from "../src/lib/structures/CustomError.js";
import { parseRequest } from "../src/lib/validation/request.js";

const REQUEST_ID = "11111111-2222-3333-4444-555555555555";

/** A driver error as postgres.js raises it, with the detail it really carries. */
function postgresError(code: string) {
	const err = Object.create(postgres.PostgresError.prototype) as postgres.PostgresError;
	return Object.assign(err, {
		message: 'duplicate key value violates unique constraint "idx_users_email_lower"',
		code,
		table_name: "users",
		column_name: "email",
		constraint_name: "idx_users_email_lower",
		query: "INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3)",
	});
}

describe("toErrorResponse", () => {
	it("maps a validation failure to 400 with the field detail", () => {
		let err: unknown;
		try {
			parseRequest(z.object({ name: z.string() }), {});
		} catch (caught) {
			err = caught;
		}
		const response = toErrorResponse(err, REQUEST_ID);

		expect(response.status).toBe(400);
		expect(response.logLevel).toBe("warn");
		expect(response.body).toEqual({
			error: {
				code: "VALIDATION_FAILED",
				message: "Request validation failed",
				details: [{ field: "name", message: expect.any(String) }],
			},
		});
	});

	it("maps a CustomError to its own status and message", () => {
		const response = toErrorResponse(new CustomError(404, "product not found"), REQUEST_ID);

		expect(response.status).toBe(404);
		expect(response.body).toEqual({ error: { code: "NOT_FOUND", message: "product not found" } });
	});

	it("does not copy a CustomError's client message into the log", () => {
		const response = toErrorResponse(new CustomError(409, "Conflict for private@example.com"), REQUEST_ID);

		expect(response.body).toEqual({
			error: { code: "CONFLICT", message: "Conflict for private@example.com" },
		});
		expect(response.logMessage).not.toContain("private@example.com");
		expect(response.logMessage).toContain(REQUEST_ID);
	});

	it("maps the Postgres codes it recognises", () => {
		expect(toErrorResponse(postgresError("23505"), REQUEST_ID).status).toBe(409);
		expect(toErrorResponse(postgresError("23503"), REQUEST_ID).status).toBe(400);
		expect(toErrorResponse(postgresError("23502"), REQUEST_ID).status).toBe(400);
		expect(toErrorResponse(postgresError("23514"), REQUEST_ID).status).toBe(400);
		expect(toErrorResponse(postgresError("22P02"), REQUEST_ID).status).toBe(400);
	});

	it("never puts driver internals in the response body", () => {
		// The whole point of H1: the statement, table, column and constraint
		// belong in the log, not in a reply to whoever asked.
		for (const code of ["23505", "23503", "42601", "57P01"]) {
			const body = JSON.stringify(toErrorResponse(postgresError(code), REQUEST_ID).body);

			expect(body).not.toContain("INSERT INTO");
			expect(body).not.toContain("idx_users_email_lower");
			expect(body).not.toContain("users");
			expect(body).not.toContain("duplicate key");
		}
	});

	it("reports an unrecognised database failure as 500, not 400", () => {
		// A syntax error or a dropped connection is not the caller's fault, and
		// calling it a bad request hides real outages from client metrics.
		const response = toErrorResponse(postgresError("42601"), REQUEST_ID);

		expect(response.status).toBe(500);
		expect(response.logLevel).toBe("error");
		expect(response.body).toEqual({ error: { code: "INTERNAL_ERROR", message: "Internal Server Error" } });
	});

	it("keeps the detail of an unmapped error in the log line only", () => {
		const response = toErrorResponse(postgresError("42601"), REQUEST_ID);

		expect(response.logMessage).toContain("constraint=idx_users_email_lower");
		expect(response.logMessage).toContain(REQUEST_ID);
	});

	it("maps anything else to a generic 500 correlated through a redacted log", () => {
		const response = toErrorResponse(new Error("connect ECONNREFUSED"), REQUEST_ID);

		expect(response.status).toBe(500);
		expect(response.body).toEqual({ error: { code: "INTERNAL_ERROR", message: "Internal Server Error" } });
		expect(response.logMessage).not.toContain("connect ECONNREFUSED");
		expect(response.logMessage).toContain("Error");
		expect(response.logMessage).toContain(REQUEST_ID);
	});

	it("keeps database row schema details out of the client response", () => {
		const rowError = z.object({ id: z.int() }).safeParse({ id: "secret database value" }).error!;
		const response = toErrorResponse(rowError, REQUEST_ID);

		expect(response.status).toBe(500);
		expect(response.body).toEqual({ error: { code: "INTERNAL_ERROR", message: "Internal Server Error" } });
		expect(JSON.stringify(response.body)).not.toContain("secret database value");
		expect(response.logMessage).not.toContain("secret database value");
	});

	it("handles a thrown non-error", () => {
		expect(toErrorResponse("just a string", REQUEST_ID).status).toBe(500);
	});
});
