# Optional Mintlify preview

Status: ready-for-agent
Type: task
Blocked by: 07

## Goal

Add checked-in Mintlify configuration and a local preview command that consume the same `openapi.json`.

## Acceptance criteria

- Navigation reads the generated OpenAPI document directly with no per-operation MDX generation.
- A missing Mintlify CLI returns a clear installation command and nonzero exit.
- Mintlify remains optional and does not affect generation, build, tests, or Scalar.
- A configuration test verifies the OpenAPI reference.

