# 06 — Give money its own type

Status: needs-triage
Blocked by: 01

Money travels as a `string` everywhere — `price`, `total_amount`,
`price_at_purchase` — while `src/lib/orders/money.ts` already knows how to read
and render it. Nothing stops a plain product `name` being passed where a price
belongs, and every caller has to remember which strings are money.

A small `Money` type (or a branded string) parsed at the repository boundary
would carry that knowledge in the type system. Deliberately left out of the
checkout work: it touches every price path in the codebase, including the
existing product and category code, so it wants its own change.

See ADR-0001 for why money is held the way it is.
