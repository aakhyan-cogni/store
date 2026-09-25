# 04 — Request IDs and access logging

Status: resolved
Blocked by: 01

Give browser support and operators one correlation value for every request,
without logging secrets or customer data beyond an authenticated User ID.

## Required behaviour

- Mint one UUID at request arrival and return it as `x-request-id` on every
  response, including dispatcher rejections and internal failures.
- Reuse the same ID in errors and logs for that request.
- Write exactly one access-log entry after each completed request with method,
  path (without query values), status, duration, request ID, and authenticated
  User ID when present.
- Do not log `Authorization`, cookies, request bodies, passwords, JWTs, email
  addresses, or query values.
- Preserve existing error logging, but ensure it correlates with the request ID
  rather than minting a second ID.

## Tests

Test IDs on successful, rejected, and failed requests; assert a single log
entry per request; and assert redaction of credentials, bodies, and query
values.

## Done when

Any client-reported request ID can be found in one access record and its
related error record without exposing credentials or request content.

## Comments

Implemented one UUID and one redacted access record per request, with the same
ID used by related error logs.
