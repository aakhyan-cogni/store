import type { IncomingMessage } from "node:http";

export function isDynamicRoute(path: string) {
	return /\[[^\]]+\]/.test(path);
}

export function compileRoute(path: string) {
	const params: string[] = [];

	const pattern = path.replace(/\[([^[\]]+)\]/g, (_, param: string) => {
		params.push(param);
		return "([^/]+)";
	});

	return {
		regex: new RegExp(`^${pattern}$`),
		params,
	};
}

export function getRequestUrl(req: IncomingMessage) {
	return new URL(`http://${process.env.HOST ?? "localhost"}${req.url}`);
}

export function buildApiRoute(folder: string, file: string) {
	const name = file.replace(/\.js$/, "");
	return `/api${folder ? `/${folder}` : ""}${file === "index.js" ? "" : `/${name}`}`;
}

/**
 * Reads an id out of a dynamic route segment. Anything a `SERIAL` column
 * cannot hold — a fraction, a negative, trailing junk — is not a usable id and
 * comes back as `null` for the caller to turn into a 404.
 */
export function parseRouteId(segment: string | undefined) {
	if (!segment || !/^\d+$/.test(segment)) return null;

	const id = Number(segment);
	return Number.isSafeInteger(id) && id > 0 ? id : null;
}
