import type { Database } from "../types.js";
import { z } from "zod";
import { CustomError, dbCategorySchema } from "#src/lib";
import type { PostgresError } from "postgres";
type DBCategory = z.infer<typeof dbCategorySchema>;

export class CategoryRepository {
	public constructor(private readonly db: Database) {}

	public async getAll() {
		const rows = await this.db`SELECT * FROM categories;`;
		return z.array(dbCategorySchema).parse(rows);
	}

	public async create(data: Omit<DBCategory, "id">) {
		try {
			const [category] = await this.db`
                INSERT INTO categories (
                    name
                )
                VALUES (
                    ${data.name}
                )
                RETURNING *;
            `;

			return dbCategorySchema.parse(category);
		} catch (e) {
			if ((e as PostgresError).code && (e as PostgresError).code === "23505") {
				throw new CustomError(409, "Duplicate category entry is not allowed");
			} else throw e;
		}
	}

	public async exists(possibleId: number) {
		const [category] = await this.db`
			SELECT * 
			FROM categories
			WHERE id = ${possibleId}
		`;
		return Boolean(category);
	}
}
