import postgres from "postgres";
import { z } from "zod";
import { CustomError } from "./structures/CustomError.js";

export interface ErrorResponse {
	status: number;
	/** Exactly what the client receives. Never a driver or framework object. */
	body: unknown;
	logLevel: "warn" | "error";
	logMessage: string;
}

/**
 * The Postgres failures this API has an opinion about. Everything else is a
 * bug or an outage, and answers 500.
 *
 * Only the status and the wording below ever reach the client: a driver error
 * carries the failing statement, the constraint, the table and the column, and
 * handing that to an unauthenticated caller maps the schema for them.
 */
const POSTGRES_RESPONSES: Record<string, { status: number; message: string }> = {
	// unique_violation
	"23505": { status: 409, message: "That value is already taken" },
	// foreign_key_violation
	"23503": { status: 400, message: "A referenced record does not exist" },
	// not_null_violation
	"23502": { status: 400, message: "A required value is missing" },
	// check_violation
	"23514": { status: 400, message: "A value is outside the range this resource allows" },
	// invalid_text_representation
	"22P02": { status: 400, message: "A value is not of the expected type" },
	// numeric_value_out_of_range
	"22003": { status: 400, message: "A numeric value is out of range" },
};

const GENERIC_500_MESSAGE = "Internal Server Error";

/**
 * Decides what a thrown error becomes on the wire, and what gets logged.
 *
 * Pure, and the only place that mapping lives: the dispatcher writes whatever
 * this returns. The split matters — `body` is what a stranger may see, while
 * `logMessage` is free to carry the detail needed to diagnose it, tied back to
 * the response by `requestId`.
 */
export function toErrorResponse(err: unknown, requestId: string): ErrorResponse {
	if (err instanceof z.ZodError) {
		const summary = err.issues.map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`).join(", ");
		return { status: 400, body: z.treeifyError(err), logLevel: "warn", logMessage: `Validation failed: ${summary}` };
	}

	if (err instanceof CustomError) {
		return {
			status: err.getCode(),
			body: { message: err.message },
			logLevel: "warn",
			logMessage: `Refused with ${err.getCode()}: ${err.message}`,
		};
	}

	if (err instanceof postgres.PostgresError) {
		const detail = [
			`code=${err.code}`,
			err.table_name && `table=${err.table_name}`,
			err.column_name && `column=${err.column_name}`,
			err.constraint_name && `constraint=${err.constraint_name}`,
		]
			.filter(Boolean)
			.join(" ");
		const known = POSTGRES_RESPONSES[err.code];

		// An unrecognised database failure is a 500, not a 400: a dropped
		// connection, a deadlock and a syntax error are not the client's doing,
		// and reporting them as bad requests hides real outages.
		if (!known) {
			return {
				status: 500,
				body: { message: GENERIC_500_MESSAGE, request_id: requestId },
				logLevel: "error",
				logMessage: `Unhandled Postgres error [${requestId}]: ${err.message} (${detail})`,
			};
		}

		return {
			status: known.status,
			body: { message: known.message },
			logLevel: "warn",
			logMessage: `Postgres error mapped to ${known.status}: ${err.message} (${detail})`,
		};
	}

	const message = err instanceof Error ? err.message : String(err);
	return {
		status: 500,
		body: { message: GENERIC_500_MESSAGE, request_id: requestId },
		logLevel: "error",
		logMessage: `Unhandled error [${requestId}]: ${message}`,
	};
}
