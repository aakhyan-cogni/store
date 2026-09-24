# 07 — Use parseRouteId in the older routes

Status: resolved
Blocked by: —

`src/api/orders/[id].ts` and the `DELETE` in `src/api/cart/[productId].ts` now
parse ids with `parseRouteId` (`src/lib/utils.ts`), which rejects fractions,
negatives, zero and trailing junk. The routes written earlier still use
`Number(params?.x)` with an `isNaN` check, which accepts `1.5` and `1e3`:

- `src/api/products/[id].ts` (`GET`, `PATCH`, `DELETE`)
- `src/api/cart/[productId].ts` (`PATCH`)

Those ids reach an `INT` column and surface as a Postgres error mapped to 400,
where a 404 is the honest answer. Swap them to `parseRouteId`.

## Comments

Done. `src/api/products/[id].ts` (`GET`, `PATCH`, `DELETE`) and the `PATCH` in
`src/api/cart/[productId].ts` now go through `parseRouteId`. The products route
grew a local `productIdFrom` helper mirroring `orderIdFrom` in
`src/api/orders/[id].ts`, which also removed the three
`if (!params || !params.id) throw new Error(...)` guards that produced a 500 for
a condition the router makes impossible.

Verified against the live local database: `GET /api/products/1.5`,
`/api/products/1e3` and `PATCH /api/cart/1.5` all answer 404 with
`{"message":"product not found"}` and no driver detail.
