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
