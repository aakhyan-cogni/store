# 05 — Product search / filter / pagination

Status: resolved
Blocked by: —

Add `src/lib/products/query.ts` with a pure `parseProductQuery(params:
URLSearchParams)` returning `{ q?, category_id?, min_price?, max_price?,
limit, offset }`. Invalid values are a 400 via a zod schema; `limit` defaults
to 20 and caps at 100; `offset` defaults to 0.

Teach `ProductRepository.getAll(filters)` to apply them — case-insensitive
`ILIKE` on name, `category_id` equality, inclusive price bounds, `LIMIT`/
`OFFSET`, stable `ORDER BY id`. Wire it into `src/api/products/all.ts` via the
`query` already on `MethodOptions`.

Tests in `tests/productQuery.test.ts`: defaults, every filter parsed, limit
cap, negative offset rejected, garbage `category_id` rejected, min > max
rejected.

## Comments

Done. `escapeLikePattern` moved out of the repository into `src/lib/products/` so
it sits at a testable seam — it was silently broken when it had no test, emitting
the literal text `${char}` instead of an escape.
