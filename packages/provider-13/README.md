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

The profile is deliberately closed to the verified Text, Stat, Time series, Table, Gauge, Bar gauge, Pie chart and Bar chart,
controlled TestData Predictable Pulse, and optional single Time series
`renameByRegex` shapes. Every unknown material feature is unsupported. JSON,
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
Stat, Time series, Table, Gauge, Bar gauge, Pie chart and Bar chart fixture profiles, controlled TestData Predictable Pulse,
and at most one approved Time series `renameByRegex` transformation.

`partialPreflightGrafana13DashboardV1` returns a detached, deeply frozen model
for the complete ordered grid. Exact fixture Markdown Text, Stat, Time series, Table, Gauge, Bar gauge, Pie chart and Bar chart
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

The renderer uses independent renderer-only Stat, Time series, Table, Gauge, Bar gauge, Pie chart and Bar chart chunks,
actual Grafana DataFrames/display processing, native radial and Pie SVG, native gradient bars and uPlot canvas. Native panels own their
query runners and optional transform, with a scene-generation request prefix
and bounded dashboard/panel identity. Text and unsupported panels acquire no
query runtime.

Gauge and Bar gauge support only the exact Predictable Pulse profile with
`lastNotNull`, percent units, a 0–100 range and green/orange/red thresholds at
the base/50/80. Gauge uses the pinned native GaugePanel and RadialGauge source with the
approved arc/default sizing options. Bar gauge uses native BarGaugePanel with
gradient display and automatic sizing. Links, actions, overrides, other options,
targets, datasources and transformations fall back without loading or querying.

Bar chart supports only the exact non-stacked Predictable Pulse profile: a time
x-field, one numeric series, automatic orientation, and the approved legend,
tooltip, fill, line, unit, minimum and maximum options. This does not claim
general categorical-data support. Other Bar chart shapes fall back without
loading or querying.

Pie chart supports only the exact one-series Predictable Pulse numeric/reduction
profile proven by the fixture. It uses Grafana's pinned PieChartPanel and exact
Visx 3.12.0 dependency cohort. Its tooltip is redirected from Visx's implicit
body target into the provider-owned portal root. Donut mode, additional series,
arbitrary targets and other unverified options remain inert and query-free; this
does not claim general categorical-data support.

Table supports only the exact Predictable Pulse, single-frame, view-only profile.
It uses the pinned native TablePanel, TableFlat, react-data-grid and AutoCell
closure with local sorting. Narrow provider facades exclude Monaco inspection,
nested/geo tables, advanced cell registries, actions, filtering, pagination and
editor behavior. The original `table_static` profile remains an inert fallback.

Pinned uPlot and react-data-grid CSS are loaded only for renderers that need
them, and every selector is scoped beneath `[data-dashboard-render-sdk-g-surface]`. Each dashboard owns and
removes its inline style node; it does not install an unscoped global stylesheet.
Like the existing SDK inline/Emotion styles, this node has no CSP nonce API.
This slice does not relax a host CSP or claim nonce-only strict-CSP compatibility.
