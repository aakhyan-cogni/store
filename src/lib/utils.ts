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
	return `/api${folder ? `/${folder}` : ""}/${name}`;
}
