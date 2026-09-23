# Spec: Checkout & storefront browsing

Status: resolved

Completes the store to a bare-minimum working shop: a user can browse/search
products, fill a cart, buy the cart, see their orders, and cancel a pending one.

## Context

Migrations `005_orders.sql` and `006_order_items.sql` already exist and define
the shape of the domain. Nothing in `src/` reads or writes those tables yet.
`CartRepository.clearCart()` exists but no route reaches it.

## Domain vocabulary

- **Cart item** — a `(user_id, product_id, quantity)` row. Mutable, no price.
- **Order** — an immutable purchase record for one user, with a `total_amount`
  and a status of `PENDING` / `PAID` / `CANCELLED`.
- **Order item** — a line on an order, carrying `price_at_purchase`: the
  product price _snapshotted at checkout_, so later price edits never rewrite
  purchase history.
- **Checkout** — the act of converting a user's whole cart into one order:
  validate stock, snapshot prices, decrement stock, clear the cart. All or
  nothing.

## Surface

| Method | Path                | Auth | Behaviour                                    |
| ------ | ------------------- | ---- | -------------------------------------------- |
| DELETE | `/api/cart`         | user | Clear the caller's whole cart. 204.          |
| POST   | `/api/orders`       | user | Checkout. 201 with the created order.        |
| GET    | `/api/orders`       | user | List the caller's orders (newest first).     |
| GET    | `/api/orders/[id]`  | user | One of the caller's orders, with its items.  |
| PATCH  | `/api/orders/[id]`  | user | `{"status":"CANCELLED"}` on a PENDING order. |
| GET    | `/api/products/all` | user | Now accepts search / filter / page params.   |

## Rules

1. **Checkout is atomic.** One `db.begin` transaction. Any failure leaves
   stock, cart and orders exactly as they were.
2. **Stock is enforced by the database, not by a prior read.** The decrement is
   `SET stock = stock - $q WHERE id = $id AND stock >= $q`; zero rows affected
   means someone else took the stock, and the whole transaction aborts with 409.
3. **Money is never floating point.** `price` is a Postgres `NUMERIC(10,2)`
   that arrives as a string. Totals are summed in integer minor units and
   rendered back to a 2-decimal string.
4. **Empty cart cannot check out.** 409.
5. **Orders are per-user.** Another user's order id reads as 404, never 403 —
   we do not leak the existence of other users' orders.
6. **Only PENDING orders cancel**, and cancelling restores the stock it took.
7. **Soft-deleted products** (`is_active = FALSE`) cannot be bought.

## Non-goals

Payment processing (no PAID transition, no gateway), admin-wide order listing,
shipping/addresses, guest checkout, coupons.

## Testing

Unit tests over the pure logic only (`checkout` totalling + `products` query
parsing). No Postgres test harness exists in this repo and this spec does not
add one; the SQL paths stay covered by the type system and by hand.

## Outcome

All five tickets are resolved. Three defects outside the original scope were
found while verifying this work against a live database, and fixed here because
the buying flow does not work without them:

1. **`Parser` rejected every bodyless POST.** A missing `content-type` was an
   error even when no body was sent, so `POST /api/orders` — which takes no
   body — could not be called at all. A missing content-type is now only an
   error when there is a body to interpret.
2. **A delisted product could not be removed from a cart.**
   `DELETE /api/cart/[productId]` required the product to still be listed, so
   once rule 7 started refusing delisted lines, a cart holding one was a dead
   end: it could neither check out nor be cleared line by line.
3. **`PATCH /api/products/[id]` silently wiped stock.** `updateProductSchema`
   was a `.partial()` of the DB schema, which still applies that schema's
   defaults, so a request editing only `price` also sent `stock: 0`. Any price
   edit zeroed the product's stock.

One deviation from the spec text: the cart view now reports delisted lines with
`listed: false` rather than hiding them, so a buyer can see and remove whatever
is blocking their checkout. This replaced a second checkout-only cart query.
