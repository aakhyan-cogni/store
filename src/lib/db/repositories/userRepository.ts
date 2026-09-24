import type { Database } from "../types.js";
import { z } from "zod";
import type { PostgresError } from "postgres";
import { CustomError, dbUserSchema } from "#lib";

type DBUser = z.infer<typeof dbUserSchema>;

export class UserRepository {
	public constructor(private readonly db: Database) {}

	/**
	 * Lets the unique index decide whether an address is taken, rather than a
	 * SELECT beforehand: two concurrent registrations both pass any check made
	 * before the INSERT, and only one of them can win this one.
	 */
	public async create(data: Omit<DBUser, "id" | "role" | "created_at">) {
		try {
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
		} catch (e) {
			if ((e as PostgresError).code === "23505") throw new CustomError(409, "User already exists");
			throw e;
		}
	}

	/**
	 * Matched on `lower(email)`, against the unique index from migration 007:
	 * one address is one account however the shopper capitalised it.
	 */
	public async findByEmail(email: string) {
		const [user] = await this.db`
            SELECT *
            FROM users
            WHERE lower(email) = ${email.toLowerCase()}
        `;

		return user ? dbUserSchema.parse(user) : null;
	}
}
