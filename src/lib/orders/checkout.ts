import type { z } from "zod";
import { CustomError } from "../structures/CustomError.js";
import type { publicCartItemSchema } from "../validation/cartSchema.js";
import { toMinorUnits, toPriceString } from "./money.js";

export type CartLine = z.infer<typeof publicCartItemSchema>;

export interface OrderDraftLine {
	product_id: number;
	quantity: number;
	price_at_purchase: string;
}

export interface OrderDraft {
	items: OrderDraftLine[];
	total_amount: string;
}

/**
 * Turns a user's cart into the order that would be written for it: every line
 * priced at what the product costs right now, and a total summed in minor
 * units. Pure — the caller owns reading the cart and writing the order.
 *
 * Refuses the whole cart rather than quietly dropping a line it cannot buy,
 * so the buyer is never charged for the remainder of a cart they did not
 * agree to. The stock check is advisory: it fails fast on a cart that is
 * already over-stocked, while the authoritative check is the conditional
 * stock decrement inside the checkout transaction.
 */
export function buildOrderDraft(cartItems: CartLine[]): OrderDraft {
	if (!cartItems.length) throw new CustomError(409, "Cannot check out an empty cart");

	let totalMinorUnits = 0;
	const items: OrderDraftLine[] = [];

	for (const item of cartItems) {
		if (!item.listed) throw new CustomError(409, `'${item.name}' is no longer for sale`);
		if (item.quantity > item.stock) {
			throw new CustomError(409, `Only ${item.stock} left of '${item.name}', cart asks for ${item.quantity}`);
		}

		totalMinorUnits += toMinorUnits(item.price) * item.quantity;
		items.push({
			product_id: item.product_id,
			quantity: item.quantity,
			price_at_purchase: item.price,
		});
	}

	return { items, total_amount: toPriceString(totalMinorUnits) };
}
