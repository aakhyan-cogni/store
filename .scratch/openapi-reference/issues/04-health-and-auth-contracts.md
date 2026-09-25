# Health and authentication operation contracts

Status: resolved
Type: task
Blocked by: 02, 03

## Goal

Add complete operation contracts for health, login, and registration routes.

## Acceptance criteria

- Contracts cover summaries, descriptions where useful, tags, bodies, success responses, validation failures, authentication failures, conflicts, and rate limits.
- Login and registration document JSON content, examples where useful, retry headers, and current response envelopes.
- Public operations explicitly emit no security requirement.

## Resolution

Added complete public operation contracts for health checks, login, and User
registration. The authentication contracts reuse the runtime request schemas,
stable named wire components, current error codes, validation details, and
rate-limit headers.
