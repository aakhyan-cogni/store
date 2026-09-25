# Real-catalogue integration and CI gate

Status: ready-for-agent
Type: task
Blocked by: 07, 08, 09

## Goal

Verify the full real-route contract and make generation and validation part of the repository quality gate.

## Acceptance criteria

- One integration suite validates the complete real catalogue with an OpenAPI 3.1 validator.
- Focused assertions cover public, authenticated, administrator-only, body-bearing, query-bearing, dynamic-path, paginated, rate-limited, created, and bodyless operations.
- Every handler has one contract, every contract has one handler, and repeated generation is byte-identical.
- `npm run ci`, `npm run build`, and `git diff --check` pass.
- The spec and all tickets are marked resolved with concise implementation notes.

