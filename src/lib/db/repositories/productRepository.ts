import { CustomError } from "#src/lib/structures";
import { dbProductSchema, publicProductSchema, updateProductSchema } from "#src/lib/validation";
import type postgres from "postgres";
import { z } from "zod";

type DBProduct = z.infer<typeof dbProductSchema>;

export class ProductRepository {
	public constructor(private readonly db: postgres.Sql) {}

	public async getAll() {
		const rows = await this.db`
            SELECT id,
                category_id,
                name,
                description,
                price,
                stock,
                created_at
            FROM products
            WHERE is_active = TRUE;`;
		return z.array(publicProductSchema).parse(rows);
	}

	public async exists(id: number) {
		const [product] = await this.db`
            SELECT stock
            FROM products
            WHERE is_active = TRUE
                AND id = ${id};
        `;

		return product as { stock: number } | undefined;
	}

	public async create(data: Omit<DBProduct, "id" | "created_at" | "is_active"> & { is_active?: boolean }) {
		const [product] = await this.db`
            INSERT INTO products (
                is_active,
                category_id,
                name,
                description,
                price,
                stock
            )
            VALUES (
                ${data.is_active ?? true},
                ${data.category_id},
                ${data.name},
                ${data.description || null},
                ${data.price},
                ${data.stock}
            )
            RETURNING *;
        `;

		return dbProductSchema.parse(product);
	}

	public async get(id: number) {
		const [product] = await this.db`
            SELECT id,
                category_id,
                name,
                description,
                price,
                stock,
                created_at
            FROM products
            WHERE id = ${id}
                AND is_active = TRUE
            LIMIT 1;
        `;

		if (!product) throw new CustomError(404, "product not found");
		return publicProductSchema.parse(product);
	}

	public async delete(id: number) {
		const [product] = await this.db`
            UPDATE products
            SET is_active = FALSE
            WHERE id = ${id}
            RETURNING *;
        `;

		if (!product) throw new CustomError(404, "product not found");
		return;
	}

	public async update(id: number, data: z.infer<typeof updateProductSchema>) {
		const [product] = await this.db`
            UPDATE products
            SET ${this.db(data)}
            WHERE id = ${id}
                AND is_active = TRUE
            RETURNING id,
                category_id,
                name,
                description,
                price,
                stock,
                created_at;
        `;

		if (!product) throw new CustomError(404, "product not found");
		return publicProductSchema.parse(product);
	}
}
