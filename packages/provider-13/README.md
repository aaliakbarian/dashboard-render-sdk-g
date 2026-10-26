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
