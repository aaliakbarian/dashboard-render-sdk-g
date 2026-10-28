# Expanded Native Grafana Visualization Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> `superpowers:subagent-driven-development` (recommended) or
> `superpowers:executing-plans` to execute this plan task-by-task. Use
> `superpowers:test-driven-development` for every behavior change and
> `superpowers:requesting-code-review` before handoff. Do not commit; leave the
> complete working tree for human review.

**Goal:** Expand the production-shaped Grafana OSS 13.2.3 provider from native
Text rendering to a closed eight-panel catalogue—Text, Stat, Time series,
Table, Gauge, Bar gauge, Pie chart, and Bar chart—using real Grafana renderers
and one controlled TestData Predictable Pulse query path while preserving safe
per-panel fallback.

**Architecture:** Preserve the current Core React API and provider-neutral
contracts. Provider-13 remains the sole owner of Grafana-specific DTO profiles,
the shared Grafana/Scenes cohort, runtime-only TestData integration, closed lazy
panel catalogue, exact transformation support, DTO-to-Scenes conversion, and
renderer source provenance. The host continues to own React, authentication,
authorized transport, destination policy, and the `/grafana` development proxy.
Unsupported panel configurations remain visible `Not-Supported` grid items and
never receive a query runner.

**Tech stack:** Node.js 22.23.3, Yarn 4.17.1, TypeScript 6.0.2,
React/ReactDOM 19.2.8, Grafana packages 13.2.3, `@grafana/scenes` 8.13.5,
Vite 8.2.0, Vitest 4.1.10, Playwright 1.56.1, Docker Compose, Grafana OSS
13.2.3 source revision `6193dc03311b631b9727b560d24369e683dc396e`.

**Spec:** Phase 2 request “Expanded Native Grafana Visualization Support,”
[Phase 1 production architecture](../../architecture/production/phase1-production-architecture-decision.md),
[bundle/dependency strategy](../../architecture/production/bundle-dependency-strategy.md),
[runtime isolation model](../../architecture/production/runtime-isolation-model.md),
[transformation strategy](../../architecture/production/transformation-compatibility-strategy.md),
[styling strategy](../../architecture/production/styling-containment-strategy.md),
[TestData runtime-only experiment](../../architecture/production/experiments/testdata-runtime-only.md),
[lazy panel experiment](../../architecture/production/experiments/lazy-panel-chunks.md),
[provider asset experiment](../../architecture/production/experiments/provider-assets.md),
[Phase 0 results](../../architecture/research/poc-results.md), and the completed
[first native render plan](2026-10-26-first-native-dashboard-render.md).

## 1. Project-control state

- Planning baseline: clean `main` at
  `f16e17c4e4a885ea5c10ce87dfd919b5876aae85`.
- Phase: Phase 2 — SDK Foundation and Experimental Package.
- This plan is implementation-focused but creates no implementation, branch,
  issue, commit, PR, merge, package publication, or dependency change.
- Execution must begin from a dedicated Phase 2 branch created by the human
  maintainer after the issue split in Section 14 is approved.
- All Node, Yarn, TypeScript, Vitest, Vite, build, and Playwright commands run
  through Docker Compose. Do not install tooling on WSL.

## 2. Non-negotiable boundaries

- Keep `GrafanaDashboard`, `createDashboardRenderSdk`, and their existing public
  behavior backward compatible. No imperative mount API or Jalali calendar.
- Frontend only. No SDK backend, proxy service, credential manager, embedded
  token, authentication implementation, or generic datasource discovery.
- Host owns React/ReactDOM, credentials, authentication, authorized transport,
  redirects, and destination policy. Provider requests cannot set host-owned
  credential, organization, tenant, identity-forwarding, or routing headers.
- Provider-13 owns one exact Grafana/Scenes/runtime cohort and may depend only on
  provider-contract—not Core. Core remains free of Grafana, Scenes, provider-13,
  and `public/app` imports.
- Preserve one physical/logical host React and ReactDOM 19.2.8 identity. The
  provider artifact continues to externalize React, ReactDOM, ReactDOM/client,
  JSX runtime, and JSX development runtime.
- No iframe, Grafana application shell, route tree, navigation/chrome,
  `GrafanaApp.init`, SystemJS, arbitrary dashboard-supplied URLs, or dynamic
  plugin discovery.
- Use only the clean pinned Grafana OSS v13.2.3 checkout at the source revision
  above. Do not confuse it with the Docker image digest or running binary
  `BuildCommit`.
- Preserve the fixed page-lifetime provider runtime cohort, compatible lease
  sharing, incompatible identity rejection, dormant last-release behavior, and
  instance-owned scene/query cleanup.
- Preserve strict whole-dashboard preflight semantics: it either matches the
  complete exact profile or reports typed unsupported diagnostics. Extend its
  allowlist additively for the exact new profiles; never turn strict preflight
  into partial fallback.
- Preserve partial preflight semantics: invalid/security-sensitive dashboard
  structures fail at dashboard level; individually unsupported but structurally
  safe panels retain their grid positions as `Not-Supported` placeholders.
- Unsupported panels never instantiate `VizPanel`, `SceneQueryRunner`,
  `SceneDataTransformer`, a datasource, or a plugin loader.
- Use actual pinned Grafana renderer components. Project-owned markup may be
  used only for the existing host-safe fallback/error boundaries.
- Admit only the controlled TestData UID `grsdk-testdata`, type
  `grafana-testdata-datasource`, and the exact Predictable Pulse target profile.
  Do not add a generic datasource plugin system.
- Admit only an empty transformation pipeline or the already-proven one-step
  `renameByRegex` profile. Do not initialize Grafana's complete transformation
  catalogue.
- Do not import a full Grafana application stylesheet or global reset. Continue
  scoped light-DOM ownership, bounded Emotion/style lifetimes, controlled portal
  ownership, and feature-owned uPlot CSS.
- Do not add or update third-party dependencies or pinned versions during this
  workstream. If an audited renderer cannot resolve its exact runtime closure
  using the installed cohort, stop that panel child issue and request explicit
  dependency approval.

## 3. Current-versus-target support matrix

| Capability | Baseline at `f16e17c` | Target after this plan | Initial exact profile |
| --- | --- | --- | --- |
| Dashboard API/schema | `dashboard.grafana.app/v1`, schema 42 | unchanged | UID lookup, namespace `default`, flat 24-column grid |
| Text | native | native, regression protected | Markdown, plaintext code settings, empty field config, no query |
| Stat | fallback | native | Predictable Pulse; `lastNotNull`; percent unit; exact threshold/background profile |
| Time series | fallback | native | Predictable Pulse; exact line/fill/axis/legend/tooltip profile; one `renameByRegex` |
| Table | fallback | native only for new profile | Predictable Pulse time/value frame; small rows; header; no links/actions/pagination/sort |
| Gauge | fallback | native | Predictable Pulse reduced by `lastNotNull`; exact percent/threshold/default-gauge profile |
| Bar gauge | fallback | native | Predictable Pulse reduced by `lastNotNull`; exact gradient/auto-size profile |
| Pie chart | fallback | native | Predictable Pulse reduced to numeric display item(s); exact legend/tooltip/pie profile |
| Bar chart | fallback | native | Predictable Pulse time field as x-axis plus numeric value field; exact non-stacked profile |
| Datasource | none in provider-13 render path | controlled TestData runtime only | UID `grsdk-testdata`; Predictable Pulse target only |
| Transformations | manifest empty; no runtime transformer | empty or exact `renameByRegex` | one exact operator, max chain length 1 |
| Mixed dashboards | Text + fallback | all admitted panels + per-panel fallback | unsupported type/options/datasource/target/transform stays inert |

The existing `grsdk-phase0-poc` remains a backward-compatibility fixture. Its
`table_static` Table is deliberately **not** admitted merely to make an old
fixture fully native. It remains a useful mixed-profile assertion while a new
all-eight fixture uses Predictable Pulse for every query-backed panel.

## 4. Source-verified panel assessment

The table distinguishes **VERIFIED SOURCE FACTS** from implementation choices
that the execution tasks must prove. Paths are relative to the pinned Grafana
checkout.

| Panel | Actual renderer / plugin source facts | Required runtime/data shape | Initial profile and implementation risk |
| --- | --- | --- | --- |
| Text | Existing audited renderer-only entry: `public/app/plugins/panel/text/v1/TextPanel.tsx` plus `panelcfg.gen.ts`; wrapped by provider `PanelPlugin` | no data provider | Existing Markdown profile. No new source, bundle, query, or registry risk. |
| Stat | `stat/module.tsx` constructs `PanelPlugin(StatPanel).useFieldConfig().setNoPadding()`; renderer is `stat/StatPanel.tsx`; imports Data display/reduction APIs, `@grafana/data/internal`, Schema BigValue enums, UI `BigValue`/`VizRepeater` | time + numeric frame; standard display processor; `lastNotNull`; unit, mappings, color, thresholds; optional sparkline | Reuse Phase 0/Experiment C renderer-only `StatPanel.tsx`, excluding migrations, editors, presets, suggestions. High confidence; exact field registry is required. |
| Time series | `timeseries/TimeSeriesPanel.tsx`; uses Runtime error view, UI/uPlot plugins, internal tooltip types, application TimeSeries/GraphNG, tooltip, annotations/exemplars/outside-range helpers, and field preparation | time field + numeric field; Scene time range; optional transform; GraphNG/uPlot; legend/tooltip/axis custom config | Reuse Phase 0/Experiment C renderer-only closure and lazy uPlot CSS. High confidence but largest lifecycle/resize surface. Keep annotations/exemplars inert for the initial profile. |
| Table | `table/TablePanel.tsx`; uses `@grafana/ui/unstable` `TableNG`, application table hooks/utilities, and migration helpers | one or more DataFrames; initial profile uses one time + numeric frame | Do not load broad `module.tsx` or option editors. Renderer-only closure must audit `app/features/table/hooks`, utilities, `TableNG`, and migrations. Disable links/actions, sorting, pagination, crosshair, nested frames, and deprecated row migration in the admitted profile. Medium risk due unstable UI and application hooks. |
| Gauge | `gauge/GaugePanel.tsx`; uses Data display/reduction APIs, Runtime error view, UI repeater, and internal `RadialGauge`; generated `panelcfg.gen.ts` defaults | numeric reduced value; percent range/threshold processors | Wrap exact renderer with `PanelPlugin(...).useFieldConfig({})`; admit default gauge shape/sizing plus controlled threshold settings. High-to-medium confidence; shares Stat processors. |
| Bar gauge | `bargauge/BarGaugePanel.tsx`; uses Data display/reduction APIs, Schema enum, UI `BarGauge`/layout/repeater, internal menu type, `BarGaugeLegend`, generated config | numeric reduced value(s) | Renderer-only closure includes `BarGaugeLegend.tsx` and generated config; default gradient, auto sizing, no interactive links. High-to-medium confidence; shares Stat/Gauge processors. |
| Pie chart | `piechart/PieChartPanel.tsx` plus `PieChart.tsx` and `utils.ts`; uses Data reductions/events, Runtime error view, UI legend/layout, Emotion, RxJS, `@visx/*`, tinycolor, selectors, portal tooltip helpers | numeric display values reduced from a frame | Admit one numeric series, simple pie, exact list legend/tooltip, no links or visibility persistence. Lazy closure and portal/Emotion ownership must be measured. Medium risk due Visx, tooltip portal, and broader third-party closure. |
| Bar chart | `barchart/BarChartPanel.tsx`, `BarChartLegend.tsx`, `utils.ts`, and bars/distribution/quadtree helpers; uses UI `UPlotChart`, Time series tooltip, internal filter/tooltip types, and assistant-tooltip helper | categorical or time x field plus numeric field(s); Predictable Pulse supplies time + numeric | Admit time field as x-axis, one numeric series, non-stacked auto orientation, basic legend/tooltip. Exclude actions/ad-hoc filtering and assistant behavior through bounded facades where Phase 0 patterns allow. Medium-high risk because it crosses Time series/uPlot and app-helper closures. |

### 4.1 Renderer-entry policy

For every new panel, execution must compare the full upstream `module.tsx`
closure with the narrow renderer-only closure before selecting an entry. The
winning entry must:

1. instantiate the real upstream renderer, not reimplement its chart;
2. attach exact built-in plugin metadata and view-required field config;
3. omit migrations because the provider accepts only schema 42;
4. omit option/field editors, suggestions, presets, authoring UI, Monaco,
   CodeMirror, and dashboard application shell code;
5. record every pinned application source and emitted asset; and
6. fail its child issue if an unreviewed source or asset enters the reachable
   bundle.

`@grafana/ui/internal`, `@grafana/ui/unstable`, and pinned `public/app` files are
provider-private exact-version dependencies. They never cross provider-contract
or Core. Their use is not a broad stability claim.

### 4.2 Data and field-processing policy

- Predictable Pulse provides the common normalized frame shape: one time field
  and one numeric field. This is sufficient for the initial Stat, Time series,
  Table, Gauge, Bar gauge, Pie chart, and Bar chart profiles.
- Stat, Gauge, Bar gauge, and Pie chart use Grafana's real display/reduction
  pipeline with `lastNotNull`; no project-owned precomputed display values.
- Time series and Bar chart receive the time and numeric fields without
  replacing them with fabricated data.
- Table displays the same real frame directly; `table_static` is intentionally
  outside the initial production profile.
- The one-series Predictable Pulse evidence establishes only the exact initial
  Pie chart profile (one reduced numeric series) and Bar chart profile (one time
  x field plus one numeric field). It does **not** establish general categorical
  data, multiple value fields, mixed field types, grouping, stacking, arbitrary
  x-field selection, or multi-series Pie/Bar chart compatibility.
- The provider installs only the exact standard field processors needed by
  admitted configs: unit, color, mappings, thresholds, min, max, and the
  renderer-specific custom field paths proved by focused tests. Editor
  components remain inert `null` placeholders and are never rendered.
- Field overrides remain unsupported initially. A non-empty overrides array
  becomes a per-panel fallback until a separately verified matcher/override
  profile exists.

## 5. Shared query execution architecture

```text
GrafanaDashboard UID/generation
  -> provider-13 partial preflight
  -> supported query panel model
  -> SceneQueryRunner (session/scene owned)
  -> closed provider DataSourceSrv
  -> cached exact TestDataDataSource instance
  -> provider runRequest adapter
  -> DataSourceWithBackend / provider BackendSrv
  -> HostTransportCapability
  -> host-authorized POST /api/ds/query
  -> Grafana 13.2.3 TestData response
  -> PanelData Loading -> Done/Error
  -> optional exact SceneDataTransformer(renameByRegex)
  -> real VizPanel
```

### 5.1 Ownership and initialization order

Provider-13 extends the existing runtime initialization, after the boot prelude
and cohort import but before scene activation, in this fixed order:

1. install the existing host transport-backed `BackendSrv`;
2. initialize the bounded logger support required by Grafana Data;
3. install the minimal TemplateSrv used by Predictable Pulse variable
   replacement, without host routing or authoring APIs;
4. fetch frontend datasource settings for `grsdk-testdata` through the same
   host-owned transport and validate UID/type identity;
5. load the runtime-only exact TestData `datasource.ts` closure through a fixed
   provider-controlled lazy entry;
6. construct/cache one datasource instance per compatible provider runtime,
   server/security scope, and UID;
7. install the closed `DataSourceSrv` and exact runtime datasource registration;
8. install the bounded `runRequest` adapter;
9. install the closed field and transformation registries; and
10. install the expanded closed panel catalogue.

All registrations are provider page-lifetime state. Query subscriptions,
request IDs, abort controllers, scene data providers, and stale-generation
publication guards are dashboard/session owned.

### 5.2 Query contract

Each admitted panel model carries a detached, frozen provider-private query
profile:

```ts
interface Grafana13PredictablePulseQueryProfile {
  readonly datasource: {
    readonly type: 'grafana-testdata-datasource';
    readonly uid: 'grsdk-testdata';
  };
  readonly targets: readonly [{
    readonly refId: 'A';
    readonly scenarioId: 'predictable_pulse';
    readonly alias: string;
    readonly pulseWave: {
      readonly offCount: 5;
      readonly offValue: 10;
      readonly onCount: 5;
      readonly onValue: 90;
      readonly timeStep: 1;
    };
  }];
}
```

The provider maps that profile to a `SceneQueryRunner` with the dashboard's
`SceneTimeRange`, bounded `maxDataPoints`/interval values derived by Scenes, a
generation-specific request prefix, and the panel ID/dashboard UID. No query
JSON is exposed through the public Core API.

### 5.3 Cancellation, failure, and concurrency

- UID change/unmount deactivates the old scene, unsubscribes every query runner,
  releases the scene scope, and suppresses stale `PanelData` publication.
- Cancellation is logical and subscription-based; host transport receives the
  exact runtime AbortSignal where Grafana's BackendSrv supplies one. A late
  non-cooperative response is consumed but cannot update an inactive scene.
- Query HTTP 401/403/network/policy/malformed failures remain typed sanitized
  render errors or panel-local query errors according to the existing SDK
  boundary. Raw bodies, headers, causes, credentials, and target payloads are
  never emitted as diagnostics.
- Empty successful responses render Grafana's native no-data state and do not
  become a fake value.
- Multiple panels may share the same datasource instance, but each owns an
  independent runner/subscription/request ID. Two dashboards share only the
  compatible page-lifetime datasource/plugin caches.
- Unsupported panel profiles receive no `$data`, so they cannot accidentally
  execute a target merely because their JSON contains one.

### 5.4 Exact host transport allowlist

Before implementing the host change, a focused test must verify the exact URLs
produced by pinned Grafana Runtime 13.2.3. The approved datasource additions to
the existing dashboard-read allowlist are only:

| Method | Capability-relative path | Allowed query | Body |
| --- | --- | --- | --- |
| `GET` | `/api/frontend/settings` | none | none |
| `POST` | `/api/ds/query` | exactly `ds_type=grafana-testdata-datasource`, plus at most one bounded provider-generated `requestId`; no `expression` or other parameter | bounded JSON object containing the controlled query array and `from`/`to` |

The development host maps these capability-relative paths through its existing
`/grafana` proxy. `/grafana` is a host deployment choice, not a path exposed by
provider contracts. The provider continues to request `/api/...` only.

The POST request may carry only the exact non-secret Grafana routing/diagnostic
headers emitted by the pinned `DataSourceWithBackend` for this profile:
`X-Plugin-Id: grafana-testdata-datasource`,
`X-Datasource-Uid: grsdk-testdata`, bounded dashboard/panel identity headers,
and `Content-Type` where the executor supplies it. It must reject expression,
query-group, query-cache, alternate datasource, organization/tenant, identity-
forwarding, credential, forwarding, host/origin, and arbitrary extra headers.
The host independently validates method, path, query cardinality/values,
headers, content type, and the bounded request-body shape before calling
`fetch`; provider-side validation is not treated as host authorization.

Negative tests must reject `GET /api/ds/query`, `POST /api/frontend/settings`,
another `/api/datasources...` endpoint, another datasource type/UID, extra or
duplicate query parameters, `expression=true`, absolute/protocol-relative URLs,
fragments/traversal/ambiguous encoding, oversized bodies, malformed JSON,
unsupported targets, and every host-owned security header. No wildcard
`/api/*`, `/api/ds/*`, or method-agnostic rule is permitted.

## 6. Exact planned package and file changes

Paths marked **new** are proposed; names may change only if an existing
repository convention requires it, and that deviation must be documented.

### 6.1 Provider-13 contracts and preflight

- Modify `packages/provider-13/src/provider.ts`
  - declare exactly eight panel IDs, TestData, empty/`renameByRegex`, and max
    chain length 1;
  - update immutable build ID without changing provider ID/version cell.
- Modify `packages/provider-13/src/partialContracts.ts`
  - replace the Text-only supported union with exact discriminated models for
    the seven query-backed panels;
  - keep unsupported identity/grid diagnostics unchanged.
- Modify `packages/provider-13/src/partialContracts.type-test.ts`.
- Modify `packages/provider-13/src/partialPreflight.ts` and `.test.ts`.
- Refactor shared exact validators out of
  `packages/provider-13/src/staticPreflight.ts` into
  `packages/provider-13/src/preflightProfiles.ts` **new**, with a corresponding
  `.test.ts`, so strict and partial preflight cannot drift.
- Modify `packages/provider-13/src/staticPreflight.ts` and `.test.ts` only to
  consume the shared profiles; preserve strict all-or-nothing results.

### 6.2 Query and datasource runtime

- Add `packages/provider-13/src/datasource/contracts.ts` **new**.
- Add `packages/provider-13/src/datasource/loadFrontendSettings.ts` and
  `.test.ts` **new**.
- Add `packages/provider-13/src/datasource/testDataCatalog.ts` and `.test.ts`
  **new** for the one closed type/UID and provider-lifetime cache.
- Add `packages/provider-13/src/datasource/testDataPlugin.ts` **new** as the
  runtime-only pinned source bridge.
- Add `packages/provider-13/src/query/runRequest.ts` and `.test.ts` **new**.
- Add `packages/provider-13/src/runtime/installQueryRuntime.ts` and `.test.ts`
  **new**.
- Add `packages/provider-13/src/runtime/templateSrv.ts` and `.test.ts` **new**.
- Modify `packages/provider-13/src/runtime/backendSrv.ts` and `.test.ts` only as
  needed to prove POST `/api/ds/query`, JSON response decoding, exact AbortSignal,
  sanitized errors, and no privileged headers. Do not weaken path/header policy.
- Modify `packages/provider-13/src/runtime/cohort.ts` to expose only the exact
  runtime/data/Scenes setters and constructors required by the query path.
- Modify `packages/provider-13/src/runtime/initializeRuntime.ts` and `.test.ts`
  to install the runtime in the fixed order above.

### 6.3 Closed registries and panel catalogue

- Add `packages/provider-13/src/registries/fieldConfig.ts` and `.test.ts` **new**.
- Add `packages/provider-13/src/registries/transformations.ts` and `.test.ts`
  **new** for only `renameByRegex`.
- Refactor `packages/provider-13/src/panels/catalog.ts` and `.test.ts` into one
  closed fixed loader map with provider-lifetime in-flight/resolved caching,
  rejection eviction, sanitized evidence, and unknown-ID rejection.
- Keep `packages/provider-13/src/panels/textPlugin.ts` unchanged except for any
  common metadata helper extraction.
- Add renderer-only adapters and focused tests:
  - `packages/provider-13/src/panels/statPlugin.ts`
  - `packages/provider-13/src/panels/timeSeriesPlugin.ts`
  - `packages/provider-13/src/panels/tablePlugin.ts`
  - `packages/provider-13/src/panels/gaugePlugin.ts`
  - `packages/provider-13/src/panels/barGaugePlugin.ts`
  - `packages/provider-13/src/panels/pieChartPlugin.ts`
  - `packages/provider-13/src/panels/barChartPlugin.ts`
- Modify `packages/provider-13/src/panels/grafana-source-modules.d.ts` with
  fixed aliases only; no wildcard or ID-to-path interpolation.

### 6.4 Scene conversion and lifecycle

- Modify `packages/provider-13/src/scenes/sceneConversion.ts` and `.test.ts`
  - supported Text remains query-free;
  - query-backed models receive `SceneQueryRunner`;
  - exact Time series transform receives `SceneDataTransformer`;
  - unsupported models remain `SceneReactObject` fallback;
  - inspection reports plugin/data/transform strategy without exposing Grafana
    objects publicly.
- Replace Text-specific wrapper naming in
  `packages/provider-13/src/scenes/TextPanelScene.tsx` with
  `packages/provider-13/src/scenes/NativePanelScene.tsx` **new**, preserving the
  existing panel-local error boundary and failure callback.
- Modify `packages/provider-13/src/runtime/implementation.tsx` and `.test.ts`
  - preload only supported panel IDs inventoried by preflight;
  - acquire the query runtime only when a supported query panel exists;
  - preserve load failure isolation and release order.
- Modify `packages/provider-13/src/react/Grafana13DashboardRenderer*.test.*`
  only for expanded ready counts/query error behavior; no public prop change.

### 6.5 Build, source, and bundle boundaries

- Modify `packages/provider-13/tooling/sourceIdentity.ts` and `.test.ts` to pin
  every reviewed application source by owning feature.
- Generalize `packages/provider-13/tooling/pinnedGrafanaSourcePlugin.ts` and its
  tests only enough to support multiple fixed aliases/source roots. It must
  retain clean-revision checks and reject imports outside reviewed roots.
- Add one narrow import-policy plugin per materially distinct closure, or one
  data-driven exact policy if it remains readable:
  `packages/provider-13/tooling/rendererOnlyImportsPlugin.ts` **new** with tests.
- Modify `packages/provider-13/tooling/runtimeViewOnlyBarrelsPlugin.ts` and tests
  only for exact runtime-only Data/UI leaves demonstrated by the source audit.
- Modify `packages/provider-13/tooling/bundleEvidencePlugin.ts`,
  `inspectProviderBundle.mjs`, and tests to report feature ownership, initial and
  lazy closures, application sources, assets, React absence, and forbidden
  editor/shell dependencies.
- Modify `packages/provider-13/vite.config.ts` to create fixed independent lazy
  feature edges and feature-owned style chunks. Do not force a monolithic merge.
- Modify `packages/provider-13/package.json` scripts only to include new tests;
  do not add dependencies or change versions.
- Modify `scripts/check-provider-13-boundary.mjs` and its regression test only if
  the new directories require explicit production-graph coverage. Do not weaken
  provider-contract or Core guards.

### 6.6 Fixture, host, integration, and browser acceptance

- Add `dev/grafana/provisioning/dashboards/drsdk-g-phase2-visualizations.json`
  **new** with all eight exact profiles and UID
  `drsdk-g-phase2-visualizations`.
- Keep `grsdk-phase0-poc.json` and `grsdk-phase0-poc-alt.json` unchanged.
- Add `packages/provider-13/src/expandedFixtureContract.test.ts` **new** to pin
  the all-eight JSON profile and the existing mixed fallback fixture.
- Modify `apps/sdk-host/src/transport.ts` and `.test.ts` to allow only the
  exact `GET /api/frontend/settings` and controlled TestData
  `POST /api/ds/query` profiles in Section 5.4 in addition to current dashboard
  read endpoints. The host still rejects every unrelated path, method, query,
  header, datasource identity, target profile, and body shape.
- Modify `apps/sdk-host/src/App.tsx` only to add deterministic test controls for
  the all-eight UID and lifecycle probes. Do not change Core API.
- Modify `integration/provider13PartialDashboard.test.ts` and add
  `integration/provider13ExpandedDashboard.test.ts` **new** for real fixture
  retrieval/preflight and real query execution through the host transport.
- Add `tests/sdk-e2e/expanded-native-visualizations.spec.ts` **new**.
- Add `tests/sdk-e2e/expanded-native-lifecycle.spec.ts` **new**, or extend the
  existing lifecycle suite if doing so keeps individual tests bounded.
- Preserve all current SDK E2E tests as regressions, including the old fallback
  counts where the tested fixture profile remains unsupported.
- Update `packages/provider-13/README.md` with the exact experimental support
  cell, limits, and source/query profiles. Do not claim general Grafana support.

No changes are planned for provider-contract public types, Core public API,
Core dependencies, root dependency versions, lockfile, LICENSE, or published
package state.

## 7. TDD stage 1 — Shared TestData query infrastructure

### Task 1: Lock the new fixture/profile contracts before runtime code

**Files:** provider manifest, partial/static contracts and tests, shared profile
validators, new fixture contract test, new all-eight fixture.

- [ ] Write failing type tests for seven provider-private supported panel model
  variants and ensure type tests are in the effective typecheck file list but
  absent from declaration output.
- [ ] Write failing unit tests for exact panel option, field config, datasource,
  target, transformation, plugin version, and grid acceptance.
- [ ] Write negative tests for unknown options/fields, non-empty overrides,
  non-Predictable-Pulse scenarios, wrong UID/type, extra targets, hidden target,
  transform on disallowed panels, unknown transform, malformed arrays/accessors,
  and resource-limit overflow.
- [ ] Prove strict preflight remains all-or-nothing while partial preflight turns
  only the offending safe panel into fallback.
- [ ] Add the all-eight fixture with deterministic grid positions and the same
  bounded Predictable Pulse target cloned per query panel.
- [ ] Keep the old `table_static` fixture unsupported to prove fallback remains.
- [ ] Put an admitted Predictable Pulse Table and the existing `table_static`
  Table through the same classifier and assert the first is supported and the
  second is fallback. Add equivalent same-panel-type negative cases for wrong
  options, datasource UID/type, target count/profile, and transformation. This
  proves support is derived from the complete verified profile, never from the
  panel type string alone.
- [ ] Implement only enough shared profile validation/model cloning to turn the
  focused tests green. Results must be detached, deeply frozen, bounded, and
  deterministic.

**Focused commands:**

```bash
docker compose --env-file dev/grafana/.env run --rm --no-deps dev \
  yarn vitest run packages/provider-13/src/partialPreflight.test.ts \
    packages/provider-13/src/staticPreflight.test.ts \
    packages/provider-13/src/preflightProfiles.test.ts \
    packages/provider-13/src/expandedFixtureContract.test.ts --environment node
docker compose --env-file dev/grafana/.env run --rm --no-deps dev \
  yarn workspace @dashboard-render-sdk-g/provider-13 typecheck
```

### Task 2: Install one real runtime-only TestData pipeline

**Files:** datasource/query/template/runtime files in Sections 6.2 and 6.3,
cohort/initializer/backend tests, pinned datasource source/build policy.

- [ ] RED: closed datasource service rejects missing UID, wrong UID/type,
  runtime registration, unsupported scenario, malformed settings, and loader
  failure; concurrent loads coalesce and rejected loads can retry.
- [ ] RED: `runRequest` emits Loading then Done/Error, preserves real frames,
  handles empty data, hidden targets, streaming packets, unsubscribe
  cancellation, and never publishes after close.
- [ ] RED: decode a bounded Grafana `/api/ds/query` frame JSON payload through
  the actual pinned Grafana response decoder and assert `refId`, frame name,
  field order, exact `time`/`number` field types, value-array lengths and
  values, field labels (including intentional absence/empty labels), and the
  relevant frame/field metadata. Include a labelled synthetic Grafana frame to
  prove labels and metadata survive decoding; do not replace the decoder with a
  project-owned DataFrame parser.
- [ ] RED: initialization order verifies BackendSrv, logger, TemplateSrv,
  frontend settings, DataSourceSrv, instance registration, runRequest, field
  registry, transformer registry, and panel catalogue identities.
- [ ] RED: BackendSrv POST carries no host-owned security headers, preserves the
  exact AbortSignal/request ID, sanitizes 401/403/500/network/malformed failures,
  and exposes no raw body/cause in SDK errors.
- [ ] RED: host executor accepts only the two datasource endpoint/method
  profiles in Section 5.4 and rejects every broad-path, wrong-method,
  wrong-query, wrong-datasource, wrong-target, extra-header, and malformed-body
  bypass before `fetch` is invoked.
- [ ] Implement the exact TestData `datasource.ts` runtime-only bridge proved by
  Phase 1 Experiment B; exclude `module.tsx`, config/query editors, Monaco,
  CodeMirror, Codicons, and unsupported runtime registration.
- [ ] Install only the controlled datasource settings and Predictable Pulse
  execution path. Other upstream scenario branches may remain dormant in the
  audited exact datasource closure but are rejected by preflight.
- [ ] Run a real container integration test through Grafana `/api/ds/query` and
  assert decoded `DataFrame` identity and content—not HTTP 200 alone. Pin the
  real Predictable Pulse `refId`, time and numeric field types/order, equal
  non-zero value lengths, finite monotonic time values, expected 10/90 pulse
  values, labels (including exact absence/emptiness), and relevant metadata
  observed from Grafana 13.2.3. Do not use static dashboard parsing or mocked
  `PanelData` as the success proof.

**Gate:** Do not begin native query-backed panels until the real fixture path
reaches Done, cancellation is clean, editor identities are absent, and the
existing Text-only E2E remains green.

## 8. TDD stage 2 — Native Stat and Time series

### Task 3: Reuse the two Phase 0-proven renderer paths

**Files:** Stat/Time series adapters, catalogue, field/transform registries,
scene conversion, runtime mounter, source/build tooling and tests.

- [ ] RED: catalogue fixed IDs, independent lazy imports, miss/hit/coalescing,
  same resolved identity, retry after load failure, and unknown-ID rejection.
- [ ] RED: source identity tests require only the audited renderer-only Stat and
  Time series closures and reject their full `module.tsx`, editors, migrations,
  presets, suggestions, shell/router, and SystemJS.
- [ ] RED: scene conversion attaches `SceneQueryRunner` to Stat, wraps Time
  series in `SceneDataTransformer(renameByRegex)`, preserves options/field
  config/time range/grid/title, and gives fallback panels no `$data`.
- [ ] Install exact field processors used by the Stat and Time series profiles;
  install only `renameByRegex` with max chain length one.
- [ ] Build renderer-only Stat and Time series plugins using the exact patterns
  already proved in Phase 1 Experiment C.
- [ ] Browser RED/GREEN: real Stat value is visible with percent formatting and
  threshold behavior; real Time series canvas/uPlot, legend, transformed name,
  and responsive resize are observable after actual `/api/ds/query` requests.
- [ ] Verify refresh/time-range rerun only where existing SDK test controls
  expose those operations; do not invent a new public Core API in this child.

**Gate:** Stat and Time series must pass real query-backed Chromium tests,
feature-chunk isolation, ResizeObserver cleanup, and all issue #91 regressions
before the catalogue expands further.

## 9. TDD stage 3 — Table, Gauge, and Bar gauge

### Task 4: Add the shared single-value family and bounded Table

**Files:** Table/Gauge/Bar gauge adapters and tests, exact profile validators,
catalogue, conversion, build/provenance tooling, browser suite.

- [ ] Audit and pin the Table renderer-only transitive closure before allowing
  it into the build. Classify `TableNG`, application hooks/utilities, migrations,
  keyboard/cell actions, shared crosshair, and assets as required or excluded.
- [ ] RED: the admitted Table profile accepts only one Predictable Pulse frame,
  header/small row height, no sort/pagination/links/actions/filtering/nested
  frames; current `table_static` remains fallback.
- [ ] RED: Gauge and Bar gauge accept only exact default-like view options,
  `lastNotNull`, the existing percent/threshold field profile, and no links.
- [ ] Build exact renderer-only plugins; reuse the common field processors and
  datasource/query runner rather than introducing panel-specific query code.
- [ ] Browser: Table must display actual time/value cells; Gauge must display a
  real radial gauge/value; Bar gauge must display a real Grafana bar/value.
  Assertions must target renderer-owned DOM/canvas/SVG semantics and real data,
  not merely titles or absence of fallback.
- [ ] Prove Table, Gauge, and Bar gauge load independently and do not request
  Pie/Bar chart feature chunks.

**Gate:** If Table requires an uncontrolled application/editor closure or a new
dependency, keep only Table as fallback, record the child issue as blocked, and
allow the independently passing Gauge/Bar gauge child to continue. Do not copy
broad Grafana source to force a pass.

## 10. TDD stage 4 — Pie chart and Bar chart

### Task 5: Add the graph/portal/uPlot family

**Files:** Pie/Bar chart adapters and tests, exact profile validators,
catalogue/conversion, asset/provenance tooling, browser interaction tests.

- [ ] Audit the Pie closure (`PieChartPanel`, `PieChart`, utils, generated config,
  Visx, Emotion, tinycolor, tooltip portal) and the Bar chart closure
  (`BarChartPanel`, legend, utils, bars/distribution/quadtree, Time series
  tooltip, uPlot). Pin every source and asset.
- [ ] RED: Pie profile accepts one numeric reduced series, simple pie, bounded
  legend/tooltip, and no data links or persisted visibility mutation.
- [ ] RED: Bar chart profile accepts one time x field plus one numeric field,
  non-stacked auto orientation, exact fill/line/legend/tooltip options, and no
  actions/ad-hoc filters.
- [ ] RED: additional numeric series, categorical/string x fields, grouping,
  stacking, and arbitrary x-field selection are fallback for the initial Pie
  and Bar chart profiles. These tests prevent the one-series Predictable Pulse
  result from becoming a claim of general categorical-data support.
- [ ] Build exact renderer-only plugins and use existing controlled provider
  portal/Emotion ownership. Do not add a new overlay manager or cache model.
- [ ] Browser: Pie has real arc/SVG output and legend values from Predictable
  Pulse; Bar chart has real uPlot canvas/series/axis output from the same data.
- [ ] Exercise one bounded tooltip/hover interaction for each renderer without
  expanding accessibility or dashboard interaction claims.
- [ ] Prove provider portal children, Emotion/style counts, uPlot CSS, and
  observers return to the compatible dormant baseline after teardown.

**Gate:** Any renderer that fundamentally requires Grafana shell/navigation,
uncontrolled source imports, a second React runtime, fake data, or uncleanable
global state remains unsupported and reports its child issue blocker. The other
panel must not be held back if its independent closure passes.

## 11. TDD stage 5 — Full integration, browser, bundle, and lifecycle regression

### Task 6: Prove the complete all-eight vertical slice

- [ ] Real all-eight fixture retrieval by UID through the existing health,
  discovery, and V1 DTO endpoints.
- [ ] Strict preflight matches only the exact all-eight fixture; partial
  preflight reports eight supported panels and zero fallback.
- [ ] Chromium proves actual native output for all eight panels and observes at
  least one real `/grafana/api/ds/query` response per independently owned query
  runner. Deduplication may share frontend datasource/plugin instances, not
  query subscriptions.
- [ ] Browser/integration evidence inspects the resulting real Grafana
  `DataFrame` objects and records sanitized schema facts: `refId`, frame/field
  names, field types/order, value counts and bounded representative values,
  labels, and relevant metadata. Evidence excludes full response bodies and
  credentials; HTTP status alone is never query-success evidence.
- [ ] Verify data assertions for each panel: Text sentinel, Stat numeric display,
  Time series transformed legend/canvas, Table cells, Gauge value/arc, Bar gauge
  bar/value, Pie slices/legend, and Bar chart bars/axes.
- [ ] Mixed fixture keeps its unsupported Table profile as a white
  `Not-Supported` placeholder while supported Text/Stat/Time series still render;
  no request is issued for the unsupported target.
- [ ] UID switch all-eight → alternate → all-eight cannot publish stale content
  or stale query data.
- [ ] Cancellation during held dashboard and query requests releases the old
  generation without console/page errors or unhandled rejections.
- [ ] Two compatible all-eight dashboards have independent scene/query/
  observer lifecycles, share the same provider/runtime/plugin/datasource caches,
  and unmount independently.
- [ ] Last release returns query subscriptions, fetches, AbortControllers,
  ResizeObservers, MutationObservers, timers, portal children, and instance
  resources to the established dormant baseline. Provider-lifetime caches and
  style nodes remain bounded rather than falsely reset.
- [ ] Host CSS sentinels remain unchanged; provider styles stay scoped; no
  duplicate Emotion ownership or unbounded style growth occurs.
- [ ] Zero iframe, shell/navigation, route takeover, `GrafanaApp.init`, SystemJS,
  unexpected requests, credential-bearing evidence, or raw response logging.

### Task 7: Prove artifact and source boundaries

- [ ] Provider bootstrap static closure contains no panel renderer source.
- [ ] Each of the eight panel IDs maps to one fixed logical lazy loader; loading
  one panel does not fetch unrelated panel-owned source chunks.
- [ ] Shared Grafana/Data/UI/Runtime/Scenes/RxJS/Emotion/uPlot modules are owned
  by one coherent provider cohort and are not duplicated per panel.
- [ ] Zero bundled React, ReactDOM, ReactDOM/client, JSX runtime, or JSX
  development runtime implementation modules.
- [ ] Zero editor, Monaco, React-Monaco, CodeMirror, Codicon, dashboard-shell,
  router/chrome, or arbitrary plugin-loader identities/assets.
- [ ] Every application source and static asset is attributed to exactly one
  reviewed feature/shared owner and exact source revision.
- [ ] Report per-feature raw/gzip size, shared cohort size, initial static
  closure, all-eight loaded closure, and the delta from the Text-only baseline.
  Do not claim an optimization merely because code moved into a shared chunk.
- [ ] Fail the build if provenance, forbidden imports, source identity, React
  externalization, asset policy, or editor-exclusion checks cannot prove their
  invariants.

### Task 8: Documentation, regression, and independent review

- [ ] Update provider README with the exact eight-panel experimental cell and
  explicit unsupported features.
- [ ] Run immutable install, all focused/unit/integration/browser/typecheck/build
  checks, provider-contract/Core/provider-13 boundary suites and live guards,
  POC regressions, bundle/provenance inspection, secret/evidence sanitation,
  repository ownership, and `git diff --check`.
- [ ] Inspect tracked and untracked files; verify no dependency/version drift,
  lockfile change, generated build artifact, or unapproved documentation change.
- [ ] Request a fresh-context whole-branch Superpowers review. Resolve justified
  Critical/Important findings with focused TDD, then request scoped re-review.
- [ ] Stop uncommitted for human review. Do not push, open a PR, merge, publish,
  or create GitHub issues automatically.

## 12. Browser and integration acceptance matrix

| Area | Required proof |
| --- | --- |
| Retrieval | real Grafana 13.2.3 health/discovery/V1 DTO through host transport |
| Rendering | all eight actual Grafana renderers; renderer-specific DOM/SVG/canvas/data assertions |
| Query | real TestData Predictable Pulse POSTs; Loading → Done; real time/numeric frames |
| DataFrame decoding | pinned Grafana decoder preserves `refId`, field types/order, values, labels, and relevant metadata; real fixture shape is asserted |
| Transform | exact Time series `renameByRegex`; empty pipelines elsewhere |
| Fallback | supported panels survive one unsupported Table profile; unsupported query never executes |
| Errors | 401, 403, 404, HTTP 500, malformed DTO/query response, plugin/datasource/transform failure are typed and sanitized |
| Cancellation | held dashboard/query requests, UID switch, unmount, stale-generation suppression |
| Concurrency | two compatible dashboards, independent query/scene ownership, shared safe caches |
| Resize | Time series and Bar chart responsive resize; observer callback and cleanup |
| Styling | scoped light DOM, host sentinels unchanged, bounded Emotion/uPlot/style growth |
| Runtime | one React/ReactDOM; one Grafana cohort; compatible reuse; conflict rejection; dormant last release |
| Security | no credentials in SDK/evidence; no forbidden request headers; host endpoint/method policy enforced |
| Architecture | no iframe, shell, navigation, `GrafanaApp.init`, arbitrary loader, SDK backend, or unsupported execution |

Browser tests must not use panel titles alone as proof. Each panel requires one
renderer-owned visual/data assertion, one real query trace where applicable,
and one source-chunk/provenance assertion.

Pie and Bar chart acceptance is limited to the declared one-series Predictable
Pulse profiles. A passing arc or bar render must not be documented as support
for arbitrary categorical fields, multiple series, grouping, or stacking.

## 13. Verification commands

Exact focused commands appear in each task. The final execution branch runs at
least:

```bash
docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn install --immutable
docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn typecheck
docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn test:unit
docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn test:integration
docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn build:sdk-slice
docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn check:provider-contract-boundary
docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn check:core-boundary
docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn check:provider-13-boundary
```

Run credentialed fixture tests only through the repository's documented local
env-file workflow, without printing or persisting credentials:

```bash
set -a
. dev/grafana/.env
set +a
POC_GRAFANA_VERIFY_USER="$GRAFANA_ADMIN_USER" \
POC_GRAFANA_VERIFY_PASSWORD="$GRAFANA_ADMIN_PASSWORD" \
docker compose --env-file dev/grafana/.env run --rm --no-deps \
  -e POC_GRAFANA_VERIFY_USER -e POC_GRAFANA_VERIFY_PASSWORD \
  dev yarn test:sdk-e2e
```

Also run the real integration test, fixture contract, provider build/bundle
inspection, current issue #91 Chromium suites, applicable Phase 0 Gate A/B/C and
observer regressions, `git diff --check`, file-ownership inspection, and tracked
plus untracked inventory. Use existing scripts and `grep`/`find`; do not install
`rg` or `jq`.

## 14. Issue split recommendation

**Recommendation: split the implementation under one Phase 2 parent.** Seven
new panels in one issue would combine three independently risky source closures,
query-runtime singleton work, transformation/field registries, fixture changes,
and a large browser/bundle matrix. That would make review, rollback, provenance,
and blocker isolation unnecessarily difficult.

Create the issues manually after plan approval in this dependency order:

1. **Parent — Expanded native Grafana visualization support**
   - owns the all-eight outcome, compatibility cell, final matrix, and cross-
     child acceptance gate.
2. **Child A — Controlled TestData query runtime and expanded preflight models**
   - Tasks 1–2; blocks every query-backed panel.
3. **Child B — Native Stat and Time series**
   - Task 3; starts after A; reuses the strongest existing evidence.
4. **Child C — Native Table, Gauge, and Bar gauge**
   - Task 4; starts after A and preferably after B's common field-registry
     result. Table may be split again if its unstable/application closure blocks.
5. **Child D — Native Pie chart and Bar chart**
   - Task 5; starts after A and B's uPlot/portal/field infrastructure. Pie and
     Bar chart may proceed independently within the child.
6. **Child E — All-eight conformance, lifecycle, and bundle/provenance gate**
   - Tasks 6–8; starts after B–D have passing panel-local gates.

Children C and D are partially parallel after A. Gauge/Bar gauge can reuse B's
single-value field path while Table audits independently. Pie can audit its Visx
closure while Bar chart reuses the Time series uPlot/tooltip path. No child may
weaken the shared runtime or merge independent feature chunks for convenience.

## 15. Risks, blockers, and stop conditions

### 15.1 Known risks

- **Table closure:** `@grafana/ui/unstable` plus application table hooks and
  migration helpers may retain authoring or broad UI dependencies.
- **Pie closure:** Visx/Emotion/tooltip portal dependencies may add substantial
  shared code and portal/style ownership cases.
- **Bar chart closure:** reuses Time series tooltip/uPlot plus application
  assistant/filter helpers; a renderer-only facade must not alter visual logic.
- **Registry coupling:** field processors and transformers are mutable
  page-lifetime singletons. Initialization must be exact, one-shot, identity-
  checked, and compatible with dormant runtime reuse.
- **Bundle growth:** seven lazy renderers still share a large Grafana cohort;
  feature chunking improves incremental delivery but does not erase shared cost.
- **Peer support:** Scenes 8.13.5 still declares React `^18`; React 19.2.8 is
  supported only by the exact verified test cell, not by upstream declaration.
- **Pinned internals:** internal/unstable UI and application source are exact-
  version provider details requiring new review for every Grafana patch.
- **Query fan-out:** seven independent runners against one fixture can amplify
  traffic. Initial tests must measure and bound expected request counts rather
  than silently deduplicate semantically independent panel queries.

### 15.2 Genuine approval/blocker conditions

Stop the affected child and return evidence if success requires:

- a new or changed dependency/version;
- Grafana shell, route tree, navigation/chrome, or `GrafanaApp.init`;
- iframe, arbitrary SystemJS/plugin URLs, server-hosted built-in modules, or a
  second React/Grafana runtime cohort;
- fabricated query/PanelData or a project-owned replacement renderer;
- broad unreviewed Grafana source copying, editor/Monaco closure, or an asset
  that cannot be attributed/licensed under existing project controls;
- host credentials/security headers inside provider code;
- runtime registry replacement incompatible with already-active instances;
- stale query publication or resources that do not return to the established
  dormant baseline; or
- a required public Core/provider-contract API break.

No read-only source evidence currently demonstrates a fundamental blocker.
Table, Pie chart, and Bar chart remain **implementation experiments within their
bounded child issues** until their renderer-only closures, browser behavior,
and bundle evidence pass. Failure of one must leave it as `Not-Supported`; it
must not block already independent passing panels or weaken fallback safety.

## 16. Definition of done

The parent outcome is complete only when:

- the exact all-eight fixture renders all eight real Grafana panels by UID in
  Chromium through the public `GrafanaDashboard` API;
- all seven query-backed panels consume real controlled TestData data;
- strict and partial preflight retain their distinct semantics;
- unsupported panels/configurations stay visible and inert;
- query cancellation, UID changes, two-instance lifecycle, runtime reuse,
  styling containment, React identity, and dormant cleanup pass;
- every renderer is a closed lazy feature with reviewed source/assets and no
  editor/shell/duplicate-React closure;
- current issue #91 Text/fallback behavior and all relevant provider-contract,
  Core, provider-13, host, POC, fixture, boundary, and bundle tests remain green;
  and
- a fresh-context whole-branch review reports no unresolved Critical or
  Important findings.

This plan does not claim arbitrary Grafana panels, arbitrary TestData scenarios,
other datasources, general transformations, V2 dashboards, other Grafana
versions, pixel-perfect parity, production support, or publication readiness.
