import { CustomError } from "#src/lib/structures";
import {
	dbOrderSchema,
	orderStatusSchema,
	publicOrderItemSchema,
	publicOrderSchema,
	publicOrderWithItemsSchema,
} from "#src/lib/validation";
import type postgres from "postgres";
import { z } from "zod";
import { buildOrderDraft } from "../../orders/index.js";
import type { Database } from "../types.js";
import { CartRepository } from "./cartRepository.js";

export class OrderRepository {
	// Takes the pool, not a `Database`: checkout and cancel must open their own
	// transactions, which a transaction handle cannot do.
	public constructor(private readonly db: postgres.Sql) {}

	/**
	 * Buys the user's whole cart in one transaction: price every line at what
	 * it costs now, reserve the stock, then empty the cart. Any refusal along
	 * the way rolls the whole thing back, so a failed checkout leaves the cart
	 * and the stock untouched.
	 */
	public async checkout(userId: number) {
		return this.db.begin(async (tx) => {
			const cartRepo = new CartRepository(tx);
			const draft = buildOrderDraft(await cartRepo.getByUserId(userId));

			const [order] = await tx`
                INSERT INTO orders (
                    user_id,
                    total_amount
                )
                VALUES (
                    ${userId},
                    ${draft.total_amount}
                )
                RETURNING *;
            `;
			const { id: orderId } = dbOrderSchema.parse(order);

			for (const item of draft.items) {
				// The authoritative stock check: whoever decrements first wins,
				// and a buyer who lost the race for the last unit loses this row.
				const reserved = await tx`
                    UPDATE products
                    SET stock = stock - ${item.quantity}
                    WHERE id = ${item.product_id}
                        AND is_active = TRUE
                        AND stock >= ${item.quantity}
                    RETURNING id;
                `;
				if (!reserved.length) {
					throw new CustomError(409, `Product ${item.product_id} is no longer available in the quantity requested`);
				}

				await tx`
                    INSERT INTO order_items (
                        order_id,
                        product_id,
                        quantity,
                        price_at_purchase
                    )
                    VALUES (
                        ${orderId},
                        ${item.product_id},
                        ${item.quantity},
                        ${item.price_at_purchase}
                    );
                `;
			}

			await cartRepo.clearCart(userId);

			return this.findWithItems(tx, userId, orderId);
		});
	}

	public async getByUserId(userId: number) {
		const rows = await this.db`
            SELECT id,
                total_amount,
                status,
                created_at
            FROM orders
            WHERE user_id = ${userId}
            ORDER BY created_at DESC,
                id DESC;
        `;

		return z.array(publicOrderSchema).parse(rows);
	}

	public async getById(userId: number, orderId: number) {
		return this.findWithItems(this.db, userId, orderId);
	}

	/**
	 * Cancels a pending order and hands its stock back. Paid and already
	 * cancelled orders are refused rather than silently ignored.
	 */
	public async cancel(userId: number, orderId: number) {
		return this.db.begin(async (tx) => {
			const [cancelled] = await tx`
                UPDATE orders
                SET status = 'CANCELLED'
                WHERE id = ${orderId}
                    AND user_id = ${userId}
                    AND status = 'PENDING'
                RETURNING id;
            `;

			if (!cancelled) {
				const [existing] = await tx`
                    SELECT status
                    FROM orders
                    WHERE id = ${orderId}
                        AND user_id = ${userId};
                `;
				if (!existing) throw new CustomError(404, "order not found");

				const status = orderStatusSchema.parse(existing.status);
				throw new CustomError(409, `Cannot cancel an order that is ${status}`);
			}

			await tx`
                UPDATE products
                SET stock = stock + order_items.quantity
                FROM order_items
                WHERE order_items.order_id = ${orderId}
                    AND products.id = order_items.product_id;
            `;

			return this.findWithItems(tx, userId, orderId);
		});
	}

	private async findWithItems(db: Database, userId: number, orderId: number) {
		const [order] = await db`
            SELECT id,
                total_amount,
                status,
                created_at
            FROM orders
            WHERE id = ${orderId}
                AND user_id = ${userId};
        `;

		// Scoped by user_id, so another user's order reads as missing rather
		// than forbidden: we do not confirm that it exists at all.
		if (!order) throw new CustomError(404, "order not found");

		const items = await db`
            SELECT order_items.product_id,
                products.name,
                order_items.quantity,
                order_items.price_at_purchase
            FROM order_items
            INNER JOIN products
                ON products.id = order_items.product_id
            WHERE order_items.order_id = ${orderId}
            ORDER BY order_items.id;
        `;

		return publicOrderWithItemsSchema.parse({
			...order,
			items: z.array(publicOrderItemSchema).parse(items),
		});
	}
}
