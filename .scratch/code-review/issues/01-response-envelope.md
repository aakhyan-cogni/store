# 01 — One response envelope across every endpoint

Status: needs-triage
Blocked by: —

From M11 and L12. Collection endpoints return bare arrays while item endpoints
return wrapper objects, and the shapes of error bodies vary:

```
GET  /api/products/all   ->  [ {...} ]           bare array
GET  /api/products/:id   ->  { product: {...} }  wrapped
POST /api/products/new   ->  { message, product }
401 / 403 / 404 / 405    ->  content-type: json, zero-length body
```

No client can write one success path or one error handler. A top-level array
also leaves nowhere to put pagination metadata without breaking consumers.

Two smaller pieces belong with it: 204 responses carry
`content-type: application/json` because `Server.ts` sets the header before
dispatch, and the auth and routing rejections send that header with no body at
all, which makes well-behaved clients throw on parse.

This is a breaking change on every endpoint, so land it in one go and version
the API if anything already consumes it. `{ data, meta }` for success and
`{ error: { code, message, details? } }` for failure is a reasonable default;
`src/lib/errors.ts` is now the single place the error side would change.
