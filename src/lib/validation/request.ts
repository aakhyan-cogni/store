import { z } from "zod";

export class RequestValidationError extends Error {
	public constructor(public readonly issues: z.core.$ZodIssue[]) {
		super(issues.map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`).join(", "));
	}
}

export function parseRequest<T extends z.ZodType>(schema: T, input: unknown): z.output<T> {
	const result = schema.safeParse(input);
	if (!result.success) throw new RequestValidationError(result.error.issues);
	return result.data;
}
