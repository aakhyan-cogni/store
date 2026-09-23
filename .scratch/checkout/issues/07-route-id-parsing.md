# 07 — Use parseRouteId in the older routes

Status: needs-triage
Blocked by: —

`src/api/orders/[id].ts` and the `DELETE` in `src/api/cart/[productId].ts` now
parse ids with `parseRouteId` (`src/lib/utils.ts`), which rejects fractions,
negatives, zero and trailing junk. The routes written earlier still use
`Number(params?.x)` with an `isNaN` check, which accepts `1.5` and `1e3`:

- `src/api/products/[id].ts` (`GET`, `PATCH`, `DELETE`)
- `src/api/cart/[productId].ts` (`PATCH`)

Those ids reach an `INT` column and surface as a Postgres error mapped to 400,
where a 404 is the honest answer. Swap them to `parseRouteId`.
