import { productQuerySchema } from "../validation/productSchema.js";
import { parseRequest } from "../validation/request.js";

/**
 * Reads storefront browse params off a request URL. Absent and blank params
 * are the same thing — `?q=` filters nothing rather than matching nothing —
 * so empty values are dropped before validation.
 */
export function parseProductQuery(params: URLSearchParams) {
	const provided: Record<string, string> = {};
	for (const [key, value] of params) {
		if (value.trim()) provided[key] = value;
	}

	return parseRequest(productQuerySchema, provided);
}
