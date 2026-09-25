# Optional Mintlify preview

Status: resolved
Type: task
Blocked by: 07

## Goal

Add checked-in Mintlify configuration and a local preview command that consume the same `openapi.json`.

## Acceptance criteria

- Navigation reads the generated OpenAPI document directly with no per-operation MDX generation.
- A missing Mintlify CLI returns a clear installation command and nonzero exit.
- Mintlify remains optional and does not affect generation, build, tests, or Scalar.
- A configuration test verifies the OpenAPI reference.

## Resolution

Added a root `docs.json` that gives Mintlify an API Reference tab backed directly by the canonical
`openapi.json`. The compiled `docs:mintlify` launcher runs `mint dev` from that config directory on
Windows and Unix-like systems, and reports `npm i -g mint` when the optional CLI is unavailable.
Focused tests cover the navigation and launcher behavior without adding Mintlify as a dependency.
