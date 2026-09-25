# Serialized wire schemas and named components

Status: resolved
Type: task
Blocked by: 01

## Goal

Define reusable Zod schemas for the JSON values sent over HTTP and stable names for OpenAPI components.

## Acceptance criteria

- Product, Category, Cart, Order, User, token, health, pagination, validation-detail, and error shapes have wire-format schemas.
- Serialized timestamps use date-time strings rather than `z.date()`.
- Request and query schemas remain reusable in input mode where appropriate.
- Reusing a component name for a different schema is detectable.
- No route response or domain behavior changes.

## Resolution

Added stable `ContractSchema`-compatible components for every current JSON
response value, including distinct public and mutation shapes where the API
currently differs. Dated values use ISO date-time strings, while request and
query schemas remain unchanged. Focused tests cover component names, wire
formats, database-shaped Cart mutation results, and input-mode reuse.
