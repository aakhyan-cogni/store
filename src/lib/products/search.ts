/**
 * Neutralises LIKE wildcards in a shopper's search term, so searching for
 * "50%" looks for that text rather than matching every product. Postgres
 * treats a backslash as the escape character by default, so no ESCAPE clause
 * is needed alongside it.
 */
export function escapeLikePattern(term: string) {
	return term.replace(/[\\%_]/g, (char) => `\\${char}`);
}
