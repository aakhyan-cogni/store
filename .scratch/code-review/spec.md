# Code review follow-up (external review, 15 September 2026)

The review in `code-review.pdf` was written against `06ccfb5`. Two commits
landed after it (`3891506`, `173fa02`), so several findings were already closed
before this pass began. Every finding below was re-checked against the code as
it actually stands rather than taken from the report.

This pass took the security findings and the High/Medium band. It deliberately
added no features.

## Fixed and verified

| ID  | Finding                                                    | What changed                                                                                                   |
| --- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| H1  | Raw Postgres errors serialised to clients                  | `src/lib/errors.ts` maps the six codes we have an opinion about; everything else is a generic 500 + request id |
| H2  | Empty password accepted                                    | `registerSchema` requires 12–72 characters; `loginSchema` split off and left permissive                        |
| H4  | JWT config unvalidated, `verify` accepted any algorithm    | `src/lib/env.ts` validates the environment at boot; `algorithms: ['HS256']` pinned on sign and verify          |
| H5  | Case-sensitive email, check-then-insert race               | Email normalised in the schema, migration 007 adds a unique index on `lower(email)`, 23505 translated to 409   |
| H6  | `products.is_active` / `stock` nullable                    | Migration 008 backfills and sets `NOT NULL`; row schema no longer defaults over a null                         |
| H7  | No throttle on the auth endpoints                          | `src/lib/auth/rateLimit.ts`, checked before bcrypt; `headersTimeout` / `requestTimeout` set                    |
| M2  | Cart writes returned 400 where 404 was meant               | `updateQuantity` returns `null`; the route answers 404                                                         |
| M3  | `isNaN` id parsing admitted `1.5`, `1e3`                   | `parseRouteId` in the remaining routes — see `checkout/issues/07`                                              |
| M5  | Shutdown closed the pool before the server                 | Order reversed, drain bounded at 10s with an idle sweep, re-entrant                                            |
| M6  | Unsound method cast, no `Allow` on 405                     | `req.method` narrowed at runtime (501 for the rest); `Allow` built from the route tables                       |
| M7  | Multi-byte bodies corrupted at chunk boundaries            | Parser buffers bytes and decodes once                                                                          |
| M8  | `is_active` settable when creating a product               | Omitted from `newProductSchema`, dropped from `ProductRepository.create`                                       |
| M9  | Coverage described four files, not the codebase            | `coverage.all` with an `src/**/*.ts` include                                                                   |
| M16 | Missing indexes on the FK and the hot read path            | Migration 009                                                                                                  |
| L5  | `UserRepository.getAll` unused, selected `password_hash`   | Deleted                                                                                                        |
| L6  | Unused `ProductRepository` import                          | Deleted                                                                                                        |
| L9  | bcrypt cost 10                                             | Cost 12; the login dummy hash regenerated to match, so the timing defence still holds                          |
| L14 | Deprecated `flatten()` alongside `treeifyError`            | Gone with the error mapper                                                                                     |
| L15 | `env.test.ts` asserted against the developer's real `.env` | Rewritten against `envSchema` with literal inputs                                                              |

Partly: `npm test` now exits (`vitest run`, watcher at `test:watch`) — the rest
of M10 is issue 05.

## Already closed before this pass

`M1` (empty PATCH body), `M4` (price validated as money), `M12` (product
pagination and filtering), `M15` (orders and checkout) were fixed in
`3891506` / `173fa02`.

`H3` — cart stock checks are not atomic — is resolved by design rather than by
code: `docs/adr/0002-stock-reserved-by-conditional-decrement.md` makes the
cart's check advisory and the conditional decrement inside the checkout
transaction authoritative. A cart can still hold more units than exist; nobody
can buy them. Left as is, deliberately.

## Left open

One ticket each under `issues/`. Nothing here is a security hole; they are
breaking API changes, product decisions, or infrastructure.

| ID  | Ticket                                      | From            |
| --- | ------------------------------------------- | --------------- |
| 01  | One response envelope across every endpoint | M11, L12        |
| 02  | OPTIONS, HEAD and CORS                      | M6 remainder    |
| 03  | Anonymous catalogue browsing — decision     | M13             |
| 04  | Access logging and request ids              | M14             |
| 05  | CI, linter, tests in typecheck              | M10 remainder   |
| 06  | Migration runner hardening                  | L8, section 6   |
| 07  | Row-schema failures answer 400              | M2's wider case |

Not ticketed, recorded here so they are not lost: `L1` non-RESTful paths and no
`PUT`; `L2` barrel-import cycle; `L3` `Server` passing itself to every handler;
`L4` `DB.initialize` taking the whole server; `L7` registry depending on
`process.cwd()`; `L10` no README or OpenAPI; `L11` `jsx: react-jsx` in a
Node-only project and coverage forced on every run; `L13` money as a string but
stock as a number; no `updated_at` on `products`; no token revocation; no
security headers.

## Operational consequence of the H4 fix

The server now refuses to boot on an invalid environment. The `JWT_SECRET` in
the local `.env` is 3 characters, so it must be rotated before `npm start`
works again — see `.env.example`. That is the fix behaving as intended: a
3-character HS256 secret is brute-forcible, which makes every token the server
has ever issued forgeable.
