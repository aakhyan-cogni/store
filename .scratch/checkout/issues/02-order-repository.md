# 02 — Order repository + validation schemas

Status: resolved
Blocked by: 01

Add `src/lib/validation/orderSchema.ts` (`orderStatusSchema`, `dbOrderSchema`,
`dbOrderItemSchema`, `publicOrderSchema`, `updateOrderSchema`) and
`src/lib/db/repositories/orderRepository.ts` with:

- `checkout(userId)` — one `db.begin` transaction: read cart, `buildOrderDraft`,
  insert order + items, conditionally decrement stock (see spec rule 2),
  clear cart, return the order with items.
- `getByUserId(userId)` — newest first.
- `getById(userId, orderId)` — scoped to the user, with items; 404 otherwise.
- `cancel(userId, orderId)` — PENDING only, restores stock, in a transaction.

Export both from their barrels (`src/lib/validation/index.ts`,
`src/lib/db/repositories/index.ts`) and add `src/lib/orders` to `src/lib/index.ts`.

## Comments

Done. `dbOrderItemSchema` was dropped — nothing read it. `OrderRepository` takes
the connection pool rather than the new `Database` alias, because `checkout` and
`cancel` must open their own transactions and a transaction handle cannot.
The conditional-decrement reservation strategy is recorded as ADR-0002.

Verified against a live Postgres: a checkout whose stock vanishes mid-flight
returns 409 and rolls back completely (no order rows, cart and stock untouched),
and two buyers racing for one unit produce exactly one 201 and one 409 with no
oversell.
