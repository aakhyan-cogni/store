# 04 — DELETE /api/cart

Status: resolved
Blocked by: —

Add a `DELETE` method to `src/api/cart/index.ts` calling the existing
`CartRepository.clearCart(user.id)`. Respond 204 with no body. Clearing an
already-empty cart is not an error (idempotent).

## Comments

Done, and idempotent as specified.
