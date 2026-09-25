# Cart and Order operation contracts

Status: resolved
Type: task
Blocked by: 02, 03

## Goal

Add complete contracts for authenticated Cart and Order operations.

## Acceptance criteria

- Contracts cover list, add, update, clear, remove, Checkout, Order listing, Order detail, and cancellation.
- Path parameters, bodies, created responses, bodyless responses, validation, missing-resource, and conflict cases are documented.
- Authentication remains derived from route metadata.
- Schemas describe the current serialized responses without changing domain behavior.

## Resolution

Added complete method-level contracts for all Cart and Order routes. The
contracts document bearer authentication, request bodies, dynamic identifiers,
current wire response components, created and bodyless success statuses, and
known validation, missing-resource, and conflict responses. Focused generation
tests cover every operation without changing runtime behavior.
