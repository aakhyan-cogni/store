# Spec: Client-ready storefront API

Status: resolved

## Goal

Make the existing store backend practical for a browser storefront without
adding payments, sessions, shipping, or deployment automation. The public
catalogue remains read-only; every Cart and Order stays private to its owning
User.

## Decisions already made

- Listed Products and Categories are publicly readable.
- Authentication remains JSON Web Tokens: login returns a token and callers
  send `Authorization: Bearer <token>`.
- Every JSON success response is `{ "data": ..., "meta"?: ... }`.
- Every JSON error response is
  `{ "error": { "code": string, "message": string, "details"?: ... } }`.
- Product-list responses include `meta: { limit, offset, total }`, where
  `total` is the count after filters and before pagination.
- `/api/ping` is public and uses the success envelope.
- CORS uses an environment-configured allowlist. Local development permits
  `http://localhost:3000`; production must configure its own origin.
- A UUID request ID accompanies every response and one access-log entry is
  written for every request.
- GitHub Actions runs formatting, production type checking, test type
  checking, and tests on pushes and pull requests.

## Surface

| Area              | Required outcome                                                                                                                                                                                                                        |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Response contract | JSON success/error responses follow the chosen envelopes; 204 responses have no body and no JSON content type.                                                                                                                          |
| Error contract    | Client-safe, stable error codes cover validation, authentication, authorization, not-found, conflict, rate-limit, method, and internal failures. Validation details identify invalid fields without exposing internal database schemas. |
| Catalogue         | `GET /api/products/all`, `GET /api/products/:id`, and `GET /api/categories/all` are public. Product lists expose filter-aware pagination metadata.                                                                                      |
| Browser protocol  | Preflight `OPTIONS` and `HEAD` work for existing resources. CORS allows configured origins and does not enable credentials.                                                                                                             |
| Observability     | `x-request-id` is stable across a request's response and log entry. Logs include method, path, status, duration, and authenticated user ID when present; never credentials or request bodies.                                           |
| Quality gate      | CI catches formatting, TypeScript failures in source and tests, and test regressions.                                                                                                                                                   |

## Non-goals

- Cookie sessions, refresh tokens, token revocation, or CSRF protection.
- Payments, a PAID transition, shipping, addresses, coupons, or guest checkout.
- CORS wildcard origins or cross-origin credentials.
- Log rotation, a hosted telemetry service, dashboards, alerts, or tracing
  beyond request IDs.
- Migration-runner checksums, advisory locks, or targeted rollbacks.
- API versioning or a compatibility layer for the prior response shapes.

## Delivery order

1. Response envelope and error codes.
2. Public catalogue and product pagination metadata.
3. CORS plus OPTIONS and HEAD.
4. Request IDs and access logging.
5. Linting, complete type checking, and GitHub Actions.

## Verification

Add focused tests for dispatcher and API behaviour, including public versus
private routes, response shapes, validation errors, pagination totals,
preflight handling, HEAD body suppression, CORS rejection, request-ID reuse,
and logging redaction. The final CI commands must pass locally before the
feature is marked resolved.
