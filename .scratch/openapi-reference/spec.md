# Spec: OpenAPI contract and local API reference

Status: resolved

## Problem Statement

The framework discovers routes and knows their paths, HTTP methods, handlers,
and authentication rules, but a route carries little documentation beyond one
description shared by every method. A developer cannot discover the request
body, path and query parameters, success response, failure responses, status
codes, or role requirements without reading handlers and repository code or
calling the API repeatedly.

The missing contract also prevents the project from generating a trustworthy
OpenAPI document. Without that document, modern API reference tools cannot be
added as interchangeable local viewers. Documentation can therefore drift from
the application, and developers must rely on source inspection and trial and
error.

## Solution

Make each route operation carry a complete, typed API contract alongside its
handler. Build a neutral route catalogue during route discovery, then generate
one deterministic OpenAPI 3.1 JSON document from that catalogue without
starting the HTTP server or connecting to Postgres.

The document is the single contract consumed by every viewer. An explicit
command writes and validates `openapi.json`. When documentation is enabled, the
running application may expose the same generated document over HTTP. Local
viewer commands let the developer choose Scalar or Mintlify without changing
route metadata or maintaining a second API description.

Scalar is the fully local, self-hosted viewer. Its assets are installed with
the project and it must not load a CDN, hosted proxy, registry, analytics, or AI
agent by default. Mintlify is an optional local development preview driven by
its CLI and the same generated document. Publishing to Mintlify's hosted
platform is not part of this feature.

## User Stories

1. As an API developer, I want each HTTP method to have its own metadata, so that `GET`, `PATCH`, and `DELETE` on one route can describe different contracts.
2. As an API developer, I want a required operation summary, so that every endpoint has a useful name in an API reference.
3. As an API developer, I want an optional longer operation description, so that I can explain behavior and constraints that schemas cannot express.
4. As an API developer, I want to assign tags to operations, so that related Catalogue, Cart, Order, authentication, and health operations are grouped together.
5. As an API developer, I want stable operation identifiers, so that documentation and future tooling can refer to an operation without depending on display text.
6. As an API developer, I want path parameters documented with types, constraints, descriptions, and examples, so that callers know which values a dynamic route accepts.
7. As an API developer, I want query parameters documented from schemas, so that callers can see search, filter, and pagination rules.
8. As an API developer, I want request bodies documented from schemas, so that callers know the required fields, optional fields, formats, and constraints.
9. As an API developer, I want supported request content types documented, so that callers know whether an operation accepts JSON or another representation.
10. As an API developer, I want every success status documented, so that callers can distinguish ordinary success, resource creation, and bodyless success.
11. As an API developer, I want success response data and pagination metadata documented, so that clients can parse the existing response envelope without inspecting handlers.
12. As an API developer, I want bodyless responses represented without a content schema, so that a `204` is not shown as returning JSON.
13. As an API developer, I want known failure statuses and stable error codes documented, so that client code can handle validation, authentication, authorization, missing resources, conflicts, and rate limits deliberately.
14. As an API developer, I want response headers such as `x-request-id` and `retry-after` documented where applicable, so that callers can use correlation and backoff information.
15. As an API developer, I want bearer authentication derived from the route's existing authentication rules, so that authorization behavior has one source of truth.
16. As an API developer, I want role restrictions represented in the generated contract, so that an administrator-only operation is visibly different from an operation for any authenticated User.
17. As an API developer, I want public operations to remain explicitly unauthenticated in the contract, so that an API reference does not ask for a token unnecessarily.
18. As an API developer, I want examples to be optional metadata, so that important request and response shapes can be demonstrated without making examples mandatory for every operation.
19. As an API developer, I want reusable schemas emitted as OpenAPI components, so that repeated Product, Category, Cart, Order, User, and error shapes are defined once.
20. As an API developer, I want component names to be stable and collision checked, so that generated references remain valid as the API grows.
21. As an API developer, I want the generator to use the JSON shapes sent over HTTP rather than database row types, so that dates, hidden fields, and response envelopes are accurate.
22. As an API developer, I want the generator to reject unsupported or incomplete metadata with a route and method in the error, so that I can correct the responsible operation quickly.
23. As an API developer, I want a missing contract for a registered handler to fail generation, so that undocumented endpoints cannot silently enter the API.
24. As an API developer, I want metadata for a nonexistent handler to fail generation, so that stale documentation cannot survive after an endpoint is removed.
25. As an API developer, I want duplicate operation identifiers and conflicting paths to fail generation, so that the OpenAPI document is unambiguous.
26. As an API developer, I want dynamic file-route syntax converted to OpenAPI path syntax, so that a route such as a Product by identifier becomes a standard parameterized path.
27. As an API developer, I want generation to run without a database or application secrets, so that documentation can be built in development and CI without production infrastructure.
28. As an API developer, I want an explicit generation command, so that I can refresh the contract on demand.
29. As an API developer, I want the build and CI checks to validate the generated contract, so that invalid documentation cannot be merged or shipped unnoticed.
30. As an API developer, I want deterministic output ordering, so that repeated generation produces stable diffs.
31. As an API developer, I want the generated document to include configurable API title, version, description, and server URLs, so that a framework consumer can identify its application correctly.
32. As an API developer, I want the running server to expose the same OpenAPI document when I opt in, so that tools can read the live contract without a separate copy.
33. As an API developer, I want generated documentation routes disabled by default, so that adopting OpenAPI does not expose a reference in production accidentally.
34. As an API developer, I want a local Scalar command, so that I can browse and exercise the API without a hosted documentation account.
35. As an API developer, I want Scalar to use local assets and the local OpenAPI document, so that opening the reference does not depend on a CDN or upload the contract to a third party.
36. As an API developer, I want Scalar's hosted proxy and AI agent disabled by default, so that requests, credentials, and the API contract remain local.
37. As an API developer, I want a local Mintlify preview command, so that I can compare or use Mintlify's presentation with the same route contracts.
38. As an API developer, I want Mintlify navigation generated from the OpenAPI document, so that I do not maintain one page per operation by hand.
39. As an API developer, I want to switch viewers without regenerating different API descriptions, so that Scalar and Mintlify cannot disagree about the API.
40. As an API developer, I want the viewer to show request and response schemas, authentication, parameters, status codes, and examples, so that I can understand an endpoint without reading its implementation.
41. As an API developer, I want the viewer's request tool to target a configurable local server URL, so that I can exercise the application I am developing.
42. As a framework maintainer, I want route discovery, request dispatch, and documentation generation to share one route catalogue, so that adding a route updates runtime behavior and the contract together.
43. As a framework maintainer, I want third-party viewers kept behind thin adapters, so that replacing or upgrading a viewer does not change route contracts.
44. As a framework maintainer, I want generation errors to stop the documentation command with a nonzero exit code, so that automation can enforce the contract.
45. As a framework consumer, I want OpenAPI JSON to remain usable without either bundled viewer, so that I can connect other compatible tooling later.

## Implementation Decisions

- OpenAPI 3.1 is the canonical output format. It matches JSON Schema 2020-12 closely enough to use Zod 4's native JSON Schema conversion without an OpenAPI 3.0 compatibility translation layer.
- The route contract is operation-level and keyed by HTTP method. The existing route-level description cannot remain the authoritative description because one route can implement methods with unrelated behavior.
- A registered handler and its operation contract have a one-to-one relationship. Generation fails if either side is missing.
- Each operation contract supports a summary, description, tags, operation identifier, request parameters, request body, responses, and examples. The summary and at least one success response are required.
- Handler functions remain the runtime implementation. The generator does not parse source code, execute handlers, or infer behavior from calls made inside a handler.
- Existing route authentication metadata remains authoritative. Required bearer authentication is emitted as an OpenAPI security requirement. Public operations explicitly override security with no requirement.
- Role restrictions are emitted through a documented vendor extension because OpenAPI security requirements do not model application roles. The standard bearer scheme remains usable by any OpenAPI viewer.
- Dynamic parameter names continue to come from route discovery. An operation must provide a matching parameter schema and description for every dynamic segment. Missing and extra path parameters fail generation.
- Zod schemas describe request bodies, parameters, success data, response metadata, and any structured error details. The generator converts those schemas to OpenAPI-compatible JSON Schema.
- Response schemas describe the serialized wire format, not database rows or internal values. In particular, timestamps sent as JSON strings use date-time string schemas rather than Zod date objects.
- Successful JSON operations declare the data schema and, when present, the metadata schema. The generator applies the response envelope required by the uniform response-envelope ADR. Route authors do not redefine `{ data, meta? }` for every operation.
- Error responses use shared components for the standard `{ error: { code, message, details? } }` envelope. Operation metadata lists its known status codes, stable error codes, descriptions, and any structured details.
- The generator derives common authentication failures from authentication metadata. Operation-specific validation, not-found, conflict, and rate-limit responses remain explicit because they cannot be inferred reliably from handler code.
- Every documented response includes the request correlation header. A rate-limit response also includes the retry header. A `204` response has no media type or body schema.
- Implicit `HEAD` and `OPTIONS` behavior remains owned by the server. The initial API reference lists explicit route operations only, rather than duplicating every `GET` and path with protocol-generated operations.
- Shared schemas are emitted under stable component names supplied by the contract registration layer. Reusing one name for different schemas, unresolved references, or unnamed recursive schemas fails generation.
- Operation identifiers are derived deterministically from method and path unless the route supplies an explicit identifier. Any duplicate fails generation.
- Tags may be declared explicitly. A deterministic folder-based default is allowed so that a new operation has useful grouping before a custom tag is needed.
- API-level information is configuration, separate from individual routes. It includes title, semantic version, description, and one or more server URLs. Sensible defaults may come from package metadata, but server URLs must be overridable for local use.
- Route discovery produces a neutral catalogue before dispatch tables are built. Request dispatch and OpenAPI generation consume that same catalogue. The documentation generator must not instantiate the server, bind a port, initialize Postgres, or require runtime secrets.
- An explicit command generates and validates a deterministically ordered `openapi.json`. The command reports all useful contract errors in one run where possible and exits nonzero on failure.
- The normal build produces the OpenAPI artifact after compiling route modules. CI has a validation mode that proves generation succeeds and the result passes an OpenAPI validator.
- When enabled by application configuration, an HTTP endpoint returns the document produced by the same generator. Server startup does not write generated files.
- Documentation endpoints and viewers are opt-in. The framework consumer chooses whether to expose the OpenAPI endpoint or a reference UI and chooses their paths. No documentation route is added silently in production.
- Scalar is installed as a project dependency or development dependency and served from local assets. Its configuration points to the local OpenAPI document. Hosted proxying, the Scalar registry, telemetry plugins, and the Scalar AI agent are disabled unless a later feature explicitly enables them.
- The Scalar adapter may run as a dedicated local command and may also be mounted by an opted-in application. Both forms consume the same document and API server configuration.
- Mintlify support consists of checked-in local documentation configuration plus a command that launches its development preview. Its navigation reads the generated OpenAPI document directly instead of generated per-operation MDX files.
- Mintlify is optional. A missing Mintlify CLI produces an actionable installation message and does not affect OpenAPI generation, the application build, or Scalar.
- The viewer choice never changes route metadata or generated OpenAPI content. Viewer-specific settings stay in their adapters and configuration.
- Any interactive request tool targets a configured API server URL. Documentation examples and configuration must never contain real bearer tokens, passwords, connection strings, or other secrets.
- Existing routes migrate from their shared descriptions to complete per-operation contracts as part of this feature. Generation is not considered complete while any current handler lacks its request and response contract.

## Testing Decisions

- A good test observes the generated contract or a public adapter. It does not assert private helper calls, internal mapper structure, or third-party component markup.
- The primary seam is the complete OpenAPI document generated from the real route catalogue. One integration suite validates the document as a whole, then makes focused assertions for representative public, authenticated, administrator-only, body-bearing, query-bearing, dynamic-path, paginated, rate-limited, created, and bodyless operations.
- The integration suite validates the result with an OpenAPI 3.1 validator. It also checks that every registered handler has exactly one operation contract and that every contract maps to a handler.
- Contract tests verify the existing success and error envelopes, stable error-code enumeration, correlation header, retry header, bearer scheme, role extension, parameter locations, response codes, and absence of content for `204` responses.
- A determinism test generates the document twice from the same catalogue and requires byte-equivalent serialized JSON.
- Failure tests feed the generator missing metadata, unmatched path parameters, duplicate operation identifiers, conflicting component names, unsupported schemas, and an operation without a success response. Each failure must identify the route and method responsible.
- A command-level test proves that generation succeeds without binding a port or connecting to Postgres, writes valid JSON to the selected destination, and returns a nonzero exit code for an invalid contract.
- A server integration test proves that the opt-in OpenAPI endpoint returns the same document as the generator and that the endpoint does not exist when documentation is disabled.
- Scalar receives a smoke test that checks the locally served HTML and assets point to the configured local OpenAPI endpoint and do not reference a CDN, hosted proxy, registry, or enabled AI agent.
- Mintlify receives a configuration test that checks its navigation consumes the generated OpenAPI document. The project does not test Mintlify's renderer or CLI internals.
- Existing server integration tests are prior art for testing public HTTP behavior. Existing route behavior tests are prior art for response envelopes and access rules. Existing validation tests are prior art for Zod constraints. The new suite should reuse those styles rather than introduce a browser end-to-end framework solely for vendor UI rendering.
- CI runs contract generation and validation alongside the existing formatting, linting, type checking, and test commands.

## Out of Scope

- Hosting or publishing documentation through Scalar, Mintlify, or another external platform.
- Treating Mintlify as an embeddable, production self-hosted renderer. This feature supports its local development preview only.
- Swagger UI, Redoc, or additional API reference themes.
- Runtime response validation or serialization through the documented response schemas.
- Inferring schemas, status codes, or errors by parsing handler source code.
- Generating SDKs, command-line clients, mock servers, contract tests for external consumers, or Postman collections.
- AsyncAPI, WebSocket, event-stream, or webhook documentation.
- Changing the API's response envelopes, authentication mechanism, domain behavior, routes, or database schemas.
- Introducing API versioning or a compatibility layer for older contracts.
- Writing long-form guides, tutorials, changelogs, or hand-authored endpoint pages in Mintlify.
- Exposing documentation publicly by default or adding production access control for a public documentation site.
- Guaranteeing that Mintlify's CLI can run offline. The rendered preview is local, but installation and vendor-managed preview assets may require network access.
- Documenting implicit `HEAD` and `OPTIONS` behavior as separate operations in the initial OpenAPI document.

## Further Notes

- Scalar's API Reference is open source and accepts an OpenAPI document by local URL or content. The local integration should use the installed package rather than the CDN example: https://github.com/scalar/scalar
- Mintlify supports OpenAPI-driven API pages and a local `mint dev` preview. Its official workflow remains tied to the Mintlify documentation platform, so the two viewer options are intentionally not presented as equivalent deployment models: https://mintlify.com/docs/api-playground/openapi-setup
- Zod 4 provides native JSON Schema conversion. Some runtime schemas, especially date objects and transformations, may not describe their serialized output directly. Route authors must register wire-format schemas when the runtime and JSON representations differ: https://zod.dev/json-schema
- The OpenAPI document becomes a public contract even when viewed only locally. Review changes to it with the same care as request and response changes.
- The generated document is useful independently of the two viewers. Future work can add client generation or contract comparison without changing route metadata.

## Resolution

Implemented the typed operation contracts, shared compiled route catalogue, deterministic OpenAPI 3.1 generator,
real-route metadata, generation and validation commands, opt-in live endpoint, and local Scalar and Mintlify
adapters. A compiled-catalogue integration suite covers all 19 explicit handlers, and the repository CI gate checks
the generated contract. All 10 implementation tickets are resolved.
