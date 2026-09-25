# 05 — Quality gate and GitHub Actions

Status: resolved
Blocked by: 01, 02, 03, 04

Turn the agreed client-ready behaviour into an enforceable repository gate.

## Required behaviour

- Add a linter with rules that catch unused locals, missing returns,
  fallthrough cases, and unbraced lexical declarations in `switch` cases.
- Keep application type checking and add a separate test-inclusive TypeScript
  configuration so test fixtures and casts are checked too.
- Add package scripts that run formatting checks, linting, both type checks,
  and tests non-interactively.
- Add a GitHub Actions workflow that installs dependencies reproducibly and
  runs those checks on pushes and pull requests.
- Do not add a coverage threshold in this ticket; the current baseline does
  not yet represent a meaningful floor.

## Tests and verification

Run every new quality command locally. Confirm the workflow uses repository
scripts rather than duplicating command logic, and that it can run from a
clean checkout.

## Done when

The repository has one documented CI command sequence that verifies formatting,
linting, source types, test types, and tests both locally and in GitHub Actions.

## Comments

Implemented `npm run ci`, type-aware Oxlint, test-inclusive type checking, and a
GitHub Actions quality workflow.
