# 03 — Order routes

Status: resolved
Blocked by: 02

`src/api/orders/index.ts` — `GET` (list mine) and `POST` (checkout), both
`auth: { required: true }`.

`src/api/orders/[id].ts` — `GET` (one of mine) and `PATCH` (cancel), both
`auth: { required: true }`. `PATCH` parses `updateOrderSchema`; a status other
than `CANCELLED` is a 400 (no payment gateway exists, so nothing may set PAID).

Follow the existing route style: `Route` instance as default export, throw
`CustomError` rather than writing error bodies inline, `res.writeHead(201)` for
creates.

## Comments

Done. Route ids go through a new `parseRouteId` helper (`src/lib/utils.ts`), so a
fractional or junk id is a 404 from the route rather than a leaked Postgres error
from the `INT` column. `PAID` is refused with a 400; recorded as ADR-0003.
