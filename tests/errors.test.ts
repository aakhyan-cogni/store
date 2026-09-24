import postgres from "postgres";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { toErrorResponse } from "../src/lib/errors.js";
import { CustomError } from "../src/lib/structures/CustomError.js";

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
		const err = z.object({ name: z.string() }).safeParse({}).error!;
		const response = toErrorResponse(err, REQUEST_ID);

		expect(response.status).toBe(400);
		expect(response.logLevel).toBe("warn");
		expect(response.body).toMatchObject({ properties: { name: { errors: expect.any(Array) } } });
	});

	it("maps a CustomError to its own status and message", () => {
		const response = toErrorResponse(new CustomError(404, "product not found"), REQUEST_ID);

		expect(response.status).toBe(404);
		expect(response.body).toEqual({ message: "product not found" });
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
		expect(response.body).toEqual({ message: "Internal Server Error", request_id: REQUEST_ID });
	});

	it("keeps the detail of an unmapped error in the log line only", () => {
		const response = toErrorResponse(postgresError("42601"), REQUEST_ID);

		expect(response.logMessage).toContain("constraint=idx_users_email_lower");
		expect(response.logMessage).toContain(REQUEST_ID);
	});

	it("maps anything else to a generic 500 carrying the request id", () => {
		const response = toErrorResponse(new Error("connect ECONNREFUSED"), REQUEST_ID);

		expect(response.status).toBe(500);
		expect(response.body).toEqual({ message: "Internal Server Error", request_id: REQUEST_ID });
		expect(response.logMessage).toContain("connect ECONNREFUSED");
	});

	it("handles a thrown non-error", () => {
		expect(toErrorResponse("just a string", REQUEST_ID).status).toBe(500);
	});
});
