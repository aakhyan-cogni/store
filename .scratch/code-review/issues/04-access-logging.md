# 04 — Access logging and request ids

Status: needs-triage
Blocked by: —

From M14. Only route registration and errors are logged, so there is no audit
trail of who called what. `LogLevel.Http` is defined and never used, and the
file transports have no rotation, so `logs/` grows without bound.

A start already exists: `toErrorResponse` takes a request id and puts it in both
the 500 body and the log line, but the id is minted per error rather than per
request, so a successful request has no id at all. Mint it once when the request
arrives, log one line per request with method, path, status, duration and user
id, and thread the same id through the error path.

Add rotation to the winston file transports while in there.
