# 01 — Uniform response envelope and error codes

Status: resolved
Blocked by: —

Implement the API contract recorded in ADR-0004 before changing any individual
endpoint behaviour.

## Required behaviour

- JSON successes use `{ data, meta? }`.
- JSON failures use `{ error: { code, message, details? } }`.
- 204 responses have no body and no `content-type` header.
- Routing, authentication, parsing, validation, rate limiting, repository
  failures, and unexpected exceptions all emit parseable error JSON when a
  body is appropriate.
- Error codes are stable uppercase identifiers. Define and apply a small,
  documented set including `VALIDATION_FAILED`, `UNAUTHENTICATED`,
  `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `RATE_LIMITED`,
  `METHOD_NOT_ALLOWED`, `NOT_IMPLEMENTED`, and `INTERNAL_ERROR`.
- Validation `details` identify request fields and messages, but database row
  schema failures remain generic internal errors.

## Suggested seams

Centralize response writing and error translation at the server/dispatcher
boundary. Route handlers should provide domain data and appropriate HTTP
statuses rather than hand-assembling incompatible JSON bodies.

## Tests

Add dispatcher-level tests covering success, validation, unauthenticated,
not-found, conflict, rate-limit, 405, 501, and 500 responses. Assert both HTTP
status and exact envelope shape. Cover a 204 response explicitly.

## Done when

All current endpoints either use the new JSON contract or correctly return a
bodyless 204, with no remaining legacy `{ message: ... }`, bare-array, or
empty-JSON response paths.

## Comments

Implemented with centralized response helpers, stable error codes, separate
request validation errors, and dispatcher-level contract tests.
