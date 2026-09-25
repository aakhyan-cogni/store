# OpenAPI 3.1 generator and validation

Status: ready-for-agent
Type: task
Blocked by: 01

## Goal

Generate a deterministic OpenAPI 3.1 document from the neutral route catalogue behind one small public interface.

## Acceptance criteria

- File-route parameters become OpenAPI path parameters.
- The generator emits success envelopes, error envelopes, components, bearer security, explicit public security, role metadata, tags, operation identifiers, response headers, and bodyless `204` responses.
- Validation aggregates missing or stale contracts, unmatched path parameters, duplicate operation identifiers, path conflicts, component-name conflicts, unsupported schemas, and missing success responses.
- A real OpenAPI 3.1 validator accepts the result.
- Tests use the generated document and public errors rather than private helper calls.

