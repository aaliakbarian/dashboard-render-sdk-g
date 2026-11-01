# Phase 2 native rendering support matrix

Status: Experimental Phase 2 evidence
Provider: private `@dashboard-render-sdk-g/provider-13` workspace
Validated target: Grafana OSS 13.2.3, V1 dashboard DTO, schema version 42
Last updated: 2026-11-01

This document describes the exact production-shaped test cell proven by the
Phase 2 native-rendering work. It is not a claim of general Grafana dashboard,
panel, datasource, transformation, browser, or deployment compatibility.

## Compatibility cell

| Component | Exact tested identity |
| --- | --- |
| Grafana server and packages | Grafana OSS 13.2.3 |
| Grafana application source | tag `v13.2.3`, commit `6193dc03311b631b9727b560d24369e683dc396e` |
| Dashboard API/schema | `dashboard.grafana.app/v1`, namespace `default`, DTO endpoint, schema 42 |
| React / ReactDOM | host-owned 19.2.8 / 19.2.8 |
| Scenes | 8.13.5 |
| Pie dependencies | individual Visx packages at 3.12.0 |
| Datasource | provisioned `grafana-testdata-datasource`, UID `grsdk-testdata` |
| Query | one target, ref ID `A`, exact Predictable Pulse 10/90 profile |
| Theme/time | light theme, browser timezone, dashboard-owned time range |

Authentication, credentials, allowed destinations, organization context,
redirects, and HTTP execution remain host responsibilities. The frontend-only
SDK receives a restricted host transport capability; it owns no backend,
credential manager, or authentication implementation.

## Native panel profiles

All rows below require `pluginVersion: 13.2.3`, the provisioned schema-42 grid,
and the exact material option/field configuration in
`dev/grafana/provisioning/dashboards/drsdk-g-phase2-visualizations.json`.
Changing an unlisted material field is rejected rather than silently ignored.

| Panel | Exact admitted profile | Native proof |
| --- | --- | --- |
| Text | Markdown view mode; fixture code settings; no datasource, target, or transformation | Grafana Text renderer and renderer-owned content DOM |
| Stat | `lastNotNull`; percent unit; background/area; thresholds green/orange/red at base/50/80 | Numeric 10/90 display, display processor, threshold gradient |
| Time series | One time field and one numeric field; percent, 0–100; line width 2, fill 15, linear/no stacking; list legend and single tooltip | Grafana uPlot canvas, axes/legend, resize, exact `renameByRegex` result |
| Table | One decoded time/numeric frame; small rows, header/type settings from fixture; percent AutoCell; no pagination/filter/inspect/actions/links | Grafana TableNG/`react-data-grid`, native cells, local header sorting and resize |
| Gauge | `lastNotNull`; percent, 0–100; base/50/80 thresholds; gauge/auto sizing and the fixture arc settings | Native radial SVG paths, value and threshold colors |
| Bar gauge | `lastNotNull`; percent, 0–100; gradient display, auto sizing, base/50/80 thresholds | Native gradient bar geometry, value and colors |
| Pie chart | Exactly one numeric series reduced with `lastNotNull`; pie (not donut); name/value labels; list legend; single tooltip | Native Grafana Pie SVG/Visx slice, label, legend, resize and controlled tooltip portal |
| Bar chart | One time x-field and one numeric series; non-stacked, auto orientation; fixture bar/fill/axis/legend/tooltip settings | Native Grafana/uPlot bars, canvas pixels, axes/legend, tooltip and resize |

Time series alone admits either an empty transformation pipeline or one exact
`renameByRegex` step from `/Raw/` to `Signal`. No other transformation ID,
options object, or chain length is supported. Pie and Bar chart evidence is the
one-series Predictable Pulse shape only; it does not establish categorical,
multi-series, grouping, or stacking compatibility.

## Rejection and fallback policy

Strict preflight rejects the complete dashboard when any panel falls outside
the closed profile. The React rendering path additionally provides bounded
partial preflight: a valid schema-42 dashboard retains every panel and grid
position, while an unsupported panel becomes a white `Not-Supported`
placeholder. The rejected item contains no target, datasource, options,
transformation, plugin model, query runner, or hidden executable scene state.
Supported siblings continue independently.

Examples that remain unsupported include HTML Text, different reductions,
unknown options/field overrides, extra targets or series, other datasource
UIDs/types/scenarios, Table pagination/filter/inspect/actions/links/advanced
cells, donut Pie, stacked/grouped Bar chart, unknown transformations, and the
legacy `table_static` target. Unsupported panels do not fetch their renderer
feature chunk or start datasource/query work. Invalid dashboard identity,
layout, schema, rows/tabs/repeat/library features, and other security-sensitive
input fail at dashboard scope instead of becoming a successful render.

## Lifecycle and containment

The verified browser matrix covers UID changes, stale dashboard and query
suppression, held-request cancellation, remounts, two compatible simultaneous
dashboards, responsive plots, renderer-load isolation, and provider-lifetime
cache reuse. Scene/query/observer/portal resources remain instance-owned.
After the final release, fetches, active Scene/query-runner activation
lifetimes, provider native style nodes, tooltip children, MutationObservers,
and ResizeObservers return to a measured dormant baseline; safe
provider/runtime/plugin/datasource caches remain bounded. The activation
counter is not a census of every internal RxJS subscription.

Rendering uses scoped light DOM with host-owned React. The built artifacts prove
one physical React/ReactDOM identity and no provider-bundled React, Grafana
application shell/router/chrome, `GrafanaApp.init`, iframe, SystemJS, editor,
Monaco, CodeMirror, or Codicon closure.

## Packaging considerations

- Table uses the pinned Grafana UI cohort's transitive
  `@grafana/react-data-grid@7.0.0-beta.57`. The admitted view-only façade and
  provenance guards exclude the Monaco inspector, nested/geo tables, advanced
  cell registry, filtering, pagination, actions, and editor paths. This beta
  dependency remains an exact-version maintenance risk.
- The data-grid stylesheet retains its upstream document-global CSS layer name,
  `@layer rdg`, while every emitted class selector is scoped below
  `[data-dashboard-render-sdk-g-surface]`. Tests prove bounded style ownership
  and no observed host collision in the tested cell; the layer name itself is
  not namespaced, so broader host layer-order compatibility is not claimed.
- Grafana 13.2.3 imports Visx through deep paths supplied by the five individual
  3.12.0 packages. Their declared React peer support predates React 19. The exact
  React 19.2.8/ReactDOM 19.2.8 browser-tested cohort passes, but that evidence
  does not broaden upstream Visx peer declarations or imply other React/Visx
  combinations are supported.
- Scenes 8.13.5 likewise declares React 18 peer support. React 19 compatibility
  is limited to this exact verified cohort.
- Native uPlot and data-grid CSS is injected lazily and scoped, but the current
  inline/Emotion style paths expose no CSP nonce API. Nonce-only strict-CSP
  compatibility is not claimed.

## Standalone authenticated reference

The four-service reference stack (reverse proxy, React host, Keycloak, and
Grafana) demonstrates Keycloak Authorization Code with S256 PKCE, an independent
Grafana Viewer OAuth cookie session, the eight-panel dashboard, host navigation,
missing-UID recovery, and dual logout. OIDC tokens remain host-authentication
state and are never passed to the SDK transport.

From the repository root:

```bash
docker compose -f demo/standalone/compose.yaml up --build --detach --wait
```

Open `http://localhost:8088/` and use the disposable credentials documented in
`demo/standalone/README.md`. For a clean realm and clean Grafana state, use the
scoped teardown/start sequence in that README. The demo is contributor evidence,
not a deployment template or production support promise.
