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
particular proxy prefix. Retrieval/classification imports no React or Grafana
implementation. The separately lazy renderer uses the pinned Grafana/Scenes
cohort and host React; the provider owns no backend or authentication.

The profile is deliberately closed to the verified Text, Stat, Time series, Gauge and Bar gauge,
controlled TestData Predictable Pulse, and optional single Time series
`renameByRegex` shapes. Table and every unknown material feature are unsupported. JSON,
container, panel, transformation, and returned-diagnostic counts are bounded;
requests preserve the host signal and request IDs.

A `ready` result means only that retrieval, DTO validation, and static preflight
matched the validated manifest declarations. It is not runtime admission,
verified module compatibility, conversion, query execution, renderability, or
general Grafana compatibility. Rendering is a separate runtime boundary.

The separate issue #91 facade, `retrieveAndClassifyGrafana13DashboardV1`, first
checks `/api/health` for exact version `13.2.3`, then reuses the stable discovery
and bounded DTO stages. Health commit metadata is not compared with source
provenance. The shipped `grafana13Provider` manifest admits only the exact Text,
Stat, Time series, Gauge and Bar gauge fixture profiles, controlled TestData Predictable Pulse,
and at most one approved Time series `renameByRegex` transformation.

`partialPreflightGrafana13DashboardV1` returns a detached, deeply frozen model
for the complete ordered grid. Exact fixture Markdown Text, Stat, Time series, Gauge and Bar gauge
are supported; other panels preserve only identity, title, grid, and sanitized diagnostics. They retain
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

The renderer uses independent renderer-only Stat, Time series, Gauge and Bar gauge chunks,
actual Grafana DataFrames/display processing, native radial SVG, native gradient bars and uPlot canvas. Native panels own their
query runners and optional transform, with a scene-generation request prefix
and bounded dashboard/panel identity. Text and unsupported panels acquire no
query runtime. Table, Pie chart and Bar chart remain inert.

Gauge and Bar gauge support only the exact Predictable Pulse profile with
`lastNotNull`, percent units, a 0–100 range and green/orange/red thresholds at
the base/50/80. Gauge uses the pinned native GaugePanel and RadialGauge source with the
approved arc/default sizing options. Bar gauge uses native BarGaugePanel with
gradient display and automatic sizing. Links, actions, overrides, other options,
targets, datasources and transformations fall back without loading or querying.

Table remains blocked: the pinned TableNG graph statically imports Monaco cell
inspection, geo and non-basic cell renderers, and its headers default to sorting.
The basic profile requires a separately audited closure and scoped data-grid CSS.
Both Predictable Pulse Table and the original `table_static` remain visible,
inert fallback panels.

Pinned uPlot CSS is loaded only for native rendering and every selector is
scoped beneath `[data-dashboard-render-sdk-g-surface]`. Each dashboard owns and
removes its inline style node; it does not install an unscoped global stylesheet.
Like the existing SDK inline/Emotion styles, this node has no CSP nonce API.
This slice does not relax a host CSP or claim nonce-only strict-CSP compatibility.
