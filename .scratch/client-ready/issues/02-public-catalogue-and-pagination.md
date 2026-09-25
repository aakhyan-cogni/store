# 02 — Public catalogue and pagination metadata

Status: resolved
Blocked by: 01

Make the public catalogue usable by a storefront while preserving private Cart
and Order boundaries.

## Required behaviour

- Unauthenticated callers may read listed Products through the collection and
  item endpoints, and may read Categories.
- Cart and Order endpoints remain authentication-required.
- `GET /api/products/all` wraps its list in the uniform success envelope and
  returns `meta: { limit, offset, total }`.
- `total` counts Products matching the current search/filter criteria before
  `LIMIT` and `OFFSET` apply.
- Results retain the existing stable ordering and filtering semantics.
- `/api/ping` is public and returns the success envelope.

## Tests

Add API/route tests demonstrating anonymous catalogue reads succeed, protected
Cart/Order reads still reject anonymous callers, and product-list metadata is
correct for unfiltered, filtered, empty, and final-page results.

## Done when

A browser can discover catalogue data and determine whether more product pages
exist without a token, while no User's Cart or Orders become public.

## Comments

Implemented public catalogue reads and filter-aware Product totals while Cart
and Order routes remain private.
