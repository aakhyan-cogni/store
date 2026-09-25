import type { IncomingMessage } from "node:http";
import { getRequestUrl } from "../utils.js";

const MAX_BODY_BYTES = 1024 * 1024;

export class Parser {
	public static parseBody<T = unknown>(req: IncomingMessage) {
		return new Promise<T>((resolve, reject) => {
			// Collected as bytes and decoded once at the end. Decoding chunk by
			// chunk would corrupt any multi-byte character that happens to land
			// across a packet boundary — a timing-dependent bug that only shows
			// up on non-ASCII input under real traffic.
			const chunks: Buffer[] = [];
			let bytes = 0;
			let tooLarge = false;
			const contentType = req.headers["content-type"]?.split(";")[0]?.trim();
			req.on("data", (chunk: Buffer) => {
				if (tooLarge) return;
				bytes += chunk.length;
				if (bytes > MAX_BODY_BYTES) {
					tooLarge = true;
					reject(new Error("Request body too large"));
					return;
				}
				chunks.push(chunk);
			});
			req.on("error", reject);
			req.on("end", () => {
				if (tooLarge) return;
				try {
					const body = Buffer.concat(chunks).toString("utf8");
					// Nothing was sent, so there is nothing to interpret: a
					// bodyless POST (checkout, for one) needs no content-type.
					if (!body) {
						resolve(undefined as T);
						return;
					}
					if (!contentType) {
						reject(new Error("No Content Type defined"));
						return;
					}
					if (contentType.endsWith("json")) {
						resolve(JSON.parse(body));
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
