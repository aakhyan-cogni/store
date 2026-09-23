import type { Database } from "../types.js";
import { z } from "zod";
import { dbCartItemSchema, publicCartItemSchema } from "#src/lib/validation";

export class CartRepository {
	public constructor(private readonly db: Database) {}

	/**
	 * Every line in the user's cart, including any whose product has since
	 * been delisted: checkout has to refuse those rather than silently skip
	 * them, and the shopper has to be able to see them to remove them.
	 */
	public async getByUserId(userId: number) {
		const rows = await this.db`
            SELECT product_id, name, price, stock, quantity, COALESCE(is_active, FALSE) AS listed
            FROM cart_items
            INNER JOIN products
                ON cart_items.product_id = products.id
            WHERE user_id = ${userId};
        `;

		return z.array(publicCartItemSchema).parse(rows);
	}

	public async findItem(userId: number, productId: number) {
		const [item] = await this.db`
            SELECT *
            FROM cart_items
            WHERE user_id = ${userId}
                AND product_id = ${productId};
        `;

		return item ? dbCartItemSchema.parse(item) : null;
	}

	public async upsertItem(userId: number, productId: number, quantity: number) {
		const [item] = await this.db`
            INSERT INTO cart_items (
                user_id,
                product_id,
                quantity
            )
            VALUES (
                ${userId},
                ${productId},
                ${quantity}
            )
            ON CONFLICT (user_id, product_id)
            DO UPDATE
            SET quantity = cart_items.quantity + excluded.quantity
            RETURNING *;
        `;

		return dbCartItemSchema.parse(item);
	}

	public async updateQuantity(userId: number, productId: number, quantity: number) {
		const [item] = await this.db`
            UPDATE cart_items
            SET quantity = ${quantity}
            WHERE user_id = ${userId}
                AND product_id = ${productId}
            RETURNING *;
        `;

		return dbCartItemSchema.parse(item);
	}

	public async removeItem(userId: number, productId: number) {
		const [item] = await this.db`
            DELETE FROM cart_items
            WHERE user_id = ${userId}
                AND product_id = ${productId}
            RETURNING *;
        `;

		return item ? dbCartItemSchema.parse(item) : null;
	}

	public async clearCart(userId: number) {
		const clearedRows = await this.db`
            DELETE FROM cart_items
            WHERE user_id = ${userId}
            RETURNING *;
        `;

		return z.array(dbCartItemSchema).parse(clearedRows);
	}
}
