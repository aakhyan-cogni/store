import type { IncomingMessage } from "node:http";
import { getRequestUrl } from "../utils.js";

const MAX_BODY_BYTES = 1024 * 1024;

export class Parser {
	public static parseBody<T = unknown>(req: IncomingMessage) {
		return new Promise<T>((resolve, reject) => {
			let body = "";
			let bytes = 0;
			const contentType = req.headers["content-type"]?.split(";")[0]?.trim();
			req.on("data", (chunk) => {
				bytes += chunk.length;
				if (bytes > MAX_BODY_BYTES) {
					req.destroy();
					return void reject(new Error("Request body too large"));
				}
				body += chunk;
			});
			req.on("error", reject);
			req.on("end", () => {
				try {
					if (!contentType) return void reject(new Error("No Content Type defined"));
					if (contentType.endsWith("json")) {
						resolve(body ? JSON.parse(body) : (undefined as T));
					} else resolve(body as T); // TODO: parse other content
				} catch (err) {
					reject(err);
				}
			});
		});
	}

	public static parseURL(req: IncomingMessage) {
		return getRequestUrl(req).searchParams;
	}
}
