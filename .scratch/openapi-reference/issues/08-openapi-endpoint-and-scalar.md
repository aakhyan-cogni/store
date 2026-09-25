# Opt-in OpenAPI endpoint and local Scalar viewer

Status: ready-for-agent
Type: task
Blocked by: 07

## Goal

Expose the generated document through opt-in runtime configuration and add a dedicated local Scalar viewer using installed local assets.

## Acceptance criteria

- Documentation routes are disabled by default and use explicit configurable paths when enabled.
- The live JSON equals the document produced by the generator and startup does not write generated files.
- The Scalar command uses the local OpenAPI endpoint or file and targets a configurable local API server.
- Scalar HTML and assets contain no CDN, hosted proxy, registry, telemetry plugin, or enabled AI agent.
- Smoke tests cover disabled and enabled endpoints plus local viewer assets.

