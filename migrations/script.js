import pg from "postgres";
import { ensureMigrationsTable, parseMigration } from "./utils.js";
import fs from "node:fs/promises";
import path from "node:path";
import { blueBright, cyanBright, gray, underline } from "colorette";
import { performance } from "node:perf_hooks";

const sql = pg(process.env.DATABASE_URL, {
	onnotice: () => {},
});
const migrationDir = "./migrations/files";

const command = process.argv[2];
if (!command) throw new Error("Missing command");
const commandStart = performance.now();

try {
	await ensureMigrationsTable(sql);

	const files = (await fs.readdir(migrationDir)).filter((f) => f.endsWith(".sql")).sort();
	const appliedMigrations = await sql`
            SELECT name
            FROM migrations
        `;
	const appliedSet = new Set(appliedMigrations.map((m) => m.name));

	switch (command) {
		case "up":
			let count = 0;
			for (const file of files) {
				if (appliedSet.has(file)) continue;
				const content = await fs.readFile(path.join(migrationDir, file), "utf-8");

				const { up } = parseMigration(content);

				const start = performance.now();

				await sql.begin(async (tx) => {
					await tx.unsafe(up);
					await tx`
                    INSERT INTO migrations (name)
                    VALUES (${file})
                `;
				});

				const duration = performance.now() - start;
				console.log(`Applied ${underline(file)} (${cyanBright(`${duration.toFixed(2)}ms`)})`);
				count++;
			}
			if (count === 0) console.log(`Nothing to apply.`);
			else console.log(`Applied ${count} migration${count === 1 ? "" : "s"}`);
			break;
		case "down":
			const [latest] = await sql`
            SELECT name
            FROM migrations
            ORDER BY name DESC
            LIMIT 1
        `;

			if (!latest) {
				console.log(blueBright("No migrations to rollback"));
				break;
			}

			try {
				await fs.access(path.join(migrationDir, latest.name));
			} catch {
				throw new Error(`Migration file not found: ${latest.name}`);
			}

			const content = await fs.readFile(path.join(migrationDir, latest.name), "utf-8");
			const { down } = parseMigration(content);

			const start = performance.now();

			await sql.begin(async (tx) => {
				await tx.unsafe(down);

				await tx`
                DELETE FROM migrations
                WHERE name = ${latest.name}
            `;
			});

			const duration = performance.now() - start;

			console.log(`Rolled back ${gray(underline(latest.name))} (${cyanBright(`${duration.toFixed(2)}ms`)})`);
			break;
		case "status":
			for (const file of files) {
				console.log(`${appliedSet.has(file) ? "✓" : "✗"} ${file}`);
			}
			break;
		default:
			throw new Error("Unknown command '" + command + "'");
	}
} finally {
	console.log(`Finished in ${(performance.now() - commandStart).toFixed(2)}ms`);
	await sql.end();
}
