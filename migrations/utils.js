export async function ensureMigrationsTable(sql) {
	await sql`
    CREATE TABLE IF NOT EXISTS migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

export function parseMigration(content) {
	const [, upPart, downPart] = content.match(/-- UP([\s\S]*)-- DOWN([\s\S]*)/) || [];

	if (!upPart || !downPart) {
		throw new Error("Invalid migration format");
	}

	return {
		up: upPart.trim(),
		down: downPart.trim(),
	};
}
