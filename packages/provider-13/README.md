# Provider 13

Private, experimental Grafana OSS 13.2.3 provider workspace for Dashboard Render SDK G.

This package is not published. It implements a bounded, stateless Grafana OSS
13.2.3 dashboard provider slice for issue #89:

- discovery of exact stable `dashboard.grafana.app/v1`;
- retrieval by UID from the V1 `/dto` endpoint;
- detached schema-42 DTO validation; and
- the named `grafana-13.2.3-v1-schema-42-static-v1` preflight profile.

The host owns authenticated connectivity and supplies a provider-neutral
transport capability. Provider requests contain no credentials and assume no
particular proxy prefix. The provider depends on neither Grafana/Scenes nor
React and owns no backend, authentication, cache, or mutable request generation.

The profile is deliberately closed to the verified Text, Stat, Time series,
controlled TestData Predictable Pulse, and optional single Time series
`renameByRegex` shapes. Table and every unknown material feature are unsupported. JSON,
container, panel, transformation, and returned-diagnostic counts are bounded;
requests preserve the host signal and request IDs.

A `ready` result means only that retrieval, DTO validation, and static preflight
matched the validated manifest declarations. It is not runtime admission,
verified module compatibility, conversion, query execution, renderability, or
general Grafana compatibility. Those executable responsibilities remain
deferred.

The separate issue #91 facade, `retrieveAndClassifyGrafana13DashboardV1`, first
checks `/api/health` for exact version `13.2.3`, then reuses the stable discovery
and bounded DTO stages. Health commit metadata is not compared with source
provenance. The inert `grafana13Provider` manifest declares only Text panels,
no datasource types, and an empty transformation pipeline.

`partialPreflightGrafana13DashboardV1` returns a detached, deeply frozen model
for the complete ordered grid. Exact fixture Markdown Text is supported; other
panels preserve only identity, title, grid, and sanitized diagnostics. They retain
no targets, datasource, options, transformations, or executable model. Invalid
layout/identity, rows, tabs, repeat/library panels, unsupported dashboard features,
and unsupported schema prevent dashboard rendering. The load facade keeps
malformed/bounded DTO, authentication, and transport outcomes as typed failures.
Partial health failures use their own extended failure type, so the original
strict stage/result vocabulary stays unchanged.

Each partial request stage owns and removes its abort listener. Cancellation
settles even when the host transport ignores the signal; late settlement is
consumed and cannot publish a renderable result. This classification slice
imports no React, Grafana, or Scenes implementation and performs no rendering.
