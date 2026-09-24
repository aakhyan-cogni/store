# 02 — OPTIONS, HEAD and CORS

Status: needs-triage
Blocked by: —

The remainder of M6. Unrecognised methods now answer 501 and 405s carry an
`Allow` header built from the route tables, but:

- `OPTIONS` gets a 501, so no browser preflight can succeed and there is no
  CORS handling anywhere.
- `HEAD` is unsupported, so health checkers and proxies that probe with HEAD
  see 501 rather than the 200 a GET would give.

`Server.allowedMethods(path)` already computes what a path supports, which is
what an `OPTIONS` response needs. `HEAD` can dispatch to the `GET` handler with
the body suppressed.

Held back from the review pass because both add request surface rather than
close a hole, and CORS needs a decision about which origins are allowed.
