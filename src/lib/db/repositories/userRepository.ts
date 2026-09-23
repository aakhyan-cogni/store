import type { Database } from "../types.js";
import { z } from "zod";
import { dbUserSchema } from "#lib";

type DBUser = z.infer<typeof dbUserSchema>;

export class UserRepository {
	public constructor(private readonly db: Database) {}

	public async getAll() {
		const rows = await this.db`SELECT * FROM users;`;
		return z.array(dbUserSchema).parse(rows);
	}

	public async create(data: Omit<DBUser, "id" | "role" | "created_at">) {
		const [user] = await this.db`
            INSERT INTO users (
                name,
                email,
                password_hash
            )
            VALUES (
                ${data.name},
                ${data.email},
                ${data.password_hash}
            )
            RETURNING *;
        `;
		return dbUserSchema.parse(user);
	}

	public async findByEmail(email: string) {
		const [user] = await this.db`
            SELECT *
            FROM users
            WHERE email = ${email}
        `;

		return user ? dbUserSchema.parse(user) : null;
	}
}
