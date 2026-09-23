# 01 — Pure money + order-draft logic

Status: resolved
Blocked by: —

Tracer bullet: the arithmetic of a checkout, with no database in sight.

Add `src/lib/orders/` exporting:

- `toMinorUnits(price: string)` / `toPriceString(minor: number)` — parse and
  render `NUMERIC(10,2)` values without floating point.
- `buildOrderDraft(cartItems)` — take the rows `CartRepository.getByUserId`
  returns and produce `{ items: [{ product_id, quantity, price_at_purchase }],
total_amount }`, or throw a `CustomError` for an empty cart (409) or a line
  whose quantity exceeds the stock read (409).

Tests in `tests/checkout.test.ts`: empty cart, single line, multiple lines,
rounding (e.g. `0.01` x 3), quantity over stock, stock exactly equal.

## Comments

Done. `toMinorUnits` / `toPriceString` / `buildOrderDraft` live in `src/lib/orders/`,
with 20 unit tests in `tests/checkout.test.ts`. The money pattern ended up shared
with the product query bounds as `moneyStringSchema` in
`src/lib/validation/moneySchema.ts`, rather than being duplicated. Recorded as
ADR-0001.
