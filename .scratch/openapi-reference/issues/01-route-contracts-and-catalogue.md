# Typed operation contracts and route catalogue

Status: resolved
Type: task
Blocked by:

## Goal

Add method-specific, typed operation contracts to `Route` and make route discovery return one deterministic neutral catalogue consumed by runtime dispatch and documentation generation.

## Acceptance criteria

- Every catalogue entry identifies its path, method, handler, dynamic parameters, authentication rule, and optional contract.
- Discovery imports route modules without constructing `Server`, connecting to Postgres, or loading application secrets.
- Runtime route registration consumes the catalogue instead of maintaining separate discovery logic.
- Discovery order is deterministic.
- The model can represent missing contracts and stale contracts so validation reports both failures with a route and method.
- Tests cover static and dynamic routes, deterministic ordering, and handler/contract parity inputs.

## Resolution

Added typed per-method operation contracts and deterministic route discovery. Runtime registration now consumes the neutral catalogue, whose explicit handler and contract fields preserve missing and stale contract cases for validation. Focused tests cover discovery order, static and dynamic routes, registration, authentication metadata, and handler/contract parity.
