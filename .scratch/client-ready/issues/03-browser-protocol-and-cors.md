# 03 — Browser protocol support and CORS

Status: resolved
Blocked by: 01

Support a separately hosted browser storefront using bearer tokens, without
opening the API to arbitrary origins or credentialed cross-origin requests.

## Required behaviour

- Add an environment variable for a comma-separated CORS origin allowlist.
- Document `http://localhost:3000` as the development value in `.env.example`.
- For an allowed origin, send the appropriate CORS response headers for normal
  requests and preflight responses. Do not send `Access-Control-Allow-Credentials`.
- Reject or omit CORS headers for disallowed origins; never reflect an arbitrary
  `Origin` header.
- `OPTIONS` on a known resource returns the allowed methods and succeeds
  without invoking authentication or a route handler.
- `HEAD` mirrors the status and headers of its corresponding `GET`, but sends
  no body. A resource with no GET handler still receives the normal method
  response.
- Preflight includes the request headers needed for `Authorization` and JSON
  requests, and exposes `x-request-id` plus `retry-after` to browser clients.

## Tests

Test allowed and rejected origins, preflight for public and protected routes,
allow-method/header values, HEAD body suppression, and the absence of
credential support.

## Done when

A frontend at `http://localhost:3000` can browse and make bearer-authenticated
JSON requests through a browser, while an unconfigured origin cannot gain
cross-origin access.

## Comments

Implemented validated origin configuration, CORS response headers, preflight
handling, and HEAD dispatch through GET.
