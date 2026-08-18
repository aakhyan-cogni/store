import type { IncomingMessage } from "node:http";

export class Parser {
	public static parseBody(req: IncomingMessage) {
		return new Promise((resolve, reject) => {
			let body = "";
			const contentType = req.headers["content-type"];
			req.on("data", (chunk) => {
				body += chunk;
			});
			req.on("end", () => {
				try {
					if (!contentType) return void reject(new Error("No Content Type defined"));
					if (contentType.endsWith("json")) {
						resolve(JSON.parse(body));
					} else resolve(body); // TODO: parse other content
				} catch (err) {
					reject(err);
				}
			});
		});
	}

	public static parseURL(req: IncomingMessage) {
		return new URL(`http://${process.env.HOST ?? "localhost"}${req.url}`).searchParams;
	}
}
