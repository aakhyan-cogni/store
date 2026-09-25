import { CustomError } from "#src/lib/structures";
import { escapeLikePattern } from "#src/lib/products";
import { dbProductSchema, publicProductSchema, type ProductQuery, updateProductSchema } from "#src/lib/validation";
import type { Database } from "../types.js";
import { z } from "zod";

type DBProduct = z.infer<typeof dbProductSchema>;

export class ProductRepository {
	public constructor(private readonly db: Database) {}

	public async getAll(query: ProductQuery) {
		const db = this.db;
		const filters = db`
			is_active = TRUE
			${query.q ? db`AND name ILIKE ${`%${escapeLikePattern(query.q)}%`}` : db``}
			${query.category_id ? db`AND category_id = ${query.category_id}` : db``}
			${query.min_price ? db`AND price >= ${query.min_price}` : db``}
			${query.max_price ? db`AND price <= ${query.max_price}` : db``}
		`;
		const [rows, countRows] = await Promise.all([
			db`
            SELECT id,
                category_id,
                name,
                description,
                price,
                stock,
                created_at
            FROM products
			WHERE ${filters}
            ORDER BY id
            LIMIT ${query.limit}
			OFFSET ${query.offset};`,
			db`SELECT COUNT(*)::integer AS total FROM products WHERE ${filters};`,
		]);
		const count = z
			.array(z.object({ total: z.int().min(0) }))
			.length(1)
			.parse(countRows)[0]!;
		return { products: z.array(publicProductSchema).parse(rows), total: count.total };
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

	/** `is_active` is not settable here: a new product is listed, full stop. */
	public async create(data: Omit<DBProduct, "id" | "created_at" | "is_active">) {
		const [product] = await this.db`
            INSERT INTO products (
                category_id,
                name,
                description,
                price,
                stock
            )
            VALUES (
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
