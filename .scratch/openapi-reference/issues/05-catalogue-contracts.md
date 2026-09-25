# Catalogue and administrator operation contracts

Status: resolved
Type: task
Blocked by: 02, 03

## Goal

Add complete contracts for Product and Category operations.

## Acceptance criteria

- Public catalogue reads, administrator writes, dynamic identifiers, request bodies, filters, pagination metadata, creation, update, and bodyless deletion are documented.
- Administrator role restrictions and bearer authentication come from existing route authentication metadata.
- Known validation, missing-resource, and conflict responses are present.
- Current runtime behavior and response envelopes remain unchanged.

## Resolution

Added complete operation contracts to every Product and Category route. The
generated contract now describes public catalogue reads, administrator-only
writes, filters, pagination, dynamic identifiers, request bodies, successful
responses, and the known validation, missing-resource, and conflict errors.
Focused generation tests cover the real catalogue routes without changing
runtime behavior.
