# React-Externalized Provider Entrypoint Experiment

## 1. Metadata

| Field | Value |
| --- | --- |
| Owner | Grafana React SDK maintainers |
| Phase | Phase 1 — Production Architecture and Distribution Strategy |
| Workstream | Experiment: React-externalized production provider entrypoint |
| Status | Bounded technical experiment complete |
| Created | 2026-10-13 |
| Last Updated | 2026-10-13 |
| Grafana baseline | OSS 13.2.3, source commit `6193dc03311b631b9727b560d24369e683dc396e` |
| Host baseline | React/ReactDOM 19.2.8; `@grafana/scenes` 8.13.5 |
| Capabilities | Text, Stat, Time series, TestData runtime |
| Final status | **PASS** |

This document follows the canonical Phase 1 terminology in the
[project roadmap](../../../project/roadmap.md). It records experiment evidence,
not a production SDK, a published package, a license decision, or a broader
compatibility claim. Generated evidence under
`artifacts/experiments/react-externalized-provider/` is ignored.

## 2. Hypothesis

A production-shaped renderer provider can preserve the exact Grafana 13.2.3
runtime, independently lazy Text, Stat and Time series renderers, and TestData
query path while treating all of these as host-owned externals:

- `react`;
- `react-dom`;
- `react/jsx-runtime`; and
- `react/jsx-dev-runtime`.

The provider must reject an incompatible version or a different runtime object
identity before importing its Grafana implementation. **PASS** applies only to
Grafana 13.2.3, React/ReactDOM 19.2.8, and Scenes 8.13.5.

## 3. Baseline

[Experiment D](./shared-grafana-cohort.md) proved one provider-owned
Grafana/Scenes/RxJS/Emotion cohort across four independently lazy features. Its
isolated artifact already externalized React broadly, so this experiment did
not assume that externalization would reduce size. Experiment E added a
consumer-shaped entry, explicit host contract, pre-initialization admission,
real host bundling, runtime object-identity evidence, negative admission cases,
and full renderer behavior under `StrictMode`.

The workspace still resolves one physical `react@19.2.8` and one physical
`react-dom@19.2.8`. Yarn continues to report the known, unsuppressed Scenes
8.13.5 React/ReactDOM `^18.0.0` peer mismatch.

## 4. Predeclared criteria

All predeclared criteria passed. In particular, the provider contains no React,
ReactDOM, JSX-runtime, or JSX-dev-runtime implementation; host and provider
share the same runtime objects; hooks, context, portals and lazy components
work; incompatible identity and version cases fail before implementation load;
Text, Stat, Time series and TestData remain real; Gates A–C and two instances
pass; and no iframe, Grafana application shell, `GrafanaApp.init`, arbitrary
SystemJS loading, or duplicate Grafana cohort was introduced.

The **FAIL** and **INCONCLUSIVE** definitions were not changed after observing
the result. The provider did not require private React, and the tooling proved
identity across the artifact boundary.

## 5. Experiment package boundary

```text
host artifact
  -> host-owned React / ReactDOM / JSX runtimes
  -> provider.js
       -> compatibility.ts (eager admission boundary)
       -> runtimeProvider.tsx (dynamic only after admission)
            -> one shared provider-owned Grafana cohort
            -> lazy Text
            -> lazy Stat
            -> lazy Time series
            -> lazy TestData runtime
```

`provider.js` is a 2,085 B raw / 914 B gzip-estimate entry containing only
`entry.ts` and `compatibility.ts`. Its sole implementation dynamic import is
`runtimeProvider-*`. This makes the ordering machine-checkable: version and
object-identity validation run before Grafana singleton code can load.

This is an experiment-only Vite/Rolldown artifact. It is not exported from any
production package or published.

## 6. React externalization

The provider build uses Vite's `esmExternalRequirePlugin` as the sole owner of
the external rule, matching every `react` and `react-dom` package subpath. The
explicit contract lists the four required external entries, while the regex
also catches necessary subpaths such as `react-dom/client` and
`react-dom/server.browser`.

Provider bundle inspection found:

| Implementation category | Provider module count |
| --- | ---: |
| React | 0 |
| ReactDOM | 0 |
| `react/jsx-runtime` | 0 |
| `react/jsx-dev-runtime` | 0 |

External imports are present and expected. The provider entry refers to
`react`, `react-dom`, `react-dom/client`, `react/jsx-runtime`, and
`react/jsx-dev-runtime`; it does not replace them with hidden globals.

## 7. Host contract

The experiment host supplies:

- React, ReactDOM, ReactDOM/client, and both JSX runtime namespace objects;
- the reported React and ReactDOM versions;
- the root DOM container and React `createRoot` ownership;
- `StrictMode`;
- a host context and portal target;
- the normal host transport/proxy environment; and
- the selected provider artifact.

The host does not configure Grafana packages, Scenes, panel source modules, or
datasource internals. Those remain provider-owned.

## 8. Compatibility check

The experiment manifest cell is:

| Dimension | Required value |
| --- | --- |
| Grafana | 13.2.3 |
| React | 19.2.8 |
| ReactDOM | 19.2.8 |
| Scenes | 8.13.5 |
| StrictMode capable | `true` |

Admission first compares the exact React/ReactDOM versions, then compares the
actual host and provider namespace identities for React, ReactDOM,
ReactDOM/client, JSX runtime, and JSX-dev runtime. Only after both checks pass
does `loadReactExternalizedProvider` dynamically import `runtimeProvider.tsx`.

The experiment intentionally models only the minimum future compatibility
metadata; it does not freeze a production manifest schema.

## 9. Runtime identity

Runtime evidence recorded exact equality for the React, ReactDOM,
ReactDOM/client, JSX runtime and JSX-dev runtime objects. It also records the
identity of `React.createElement`, `React.useState`, `React.createContext`, and
`ReactDOMClient.createRoot` explicitly. Namespace equality is therefore not
being inferred from matching version strings.

The executable host bundle contains 7 React module records, 8 ReactDOM module
records, 1 JSX-runtime record, and 1 JSX-dev-runtime record. All are owned by
the same `host-react-*` chunk; those counts are source modules inside one host
implementation owner, not duplicate runtimes. Browser runtime inspection
reported one React 19.2.8 and one ReactDOM 19.2.8 identity.

## 10. React behavioral evidence

Object identity was supplemented with real behavior:

- a provider component used `useState` and updated from `state:0` to `state:1`;
- a host-created context crossed the artifact boundary and was consumed by the
  provider with the expected value;
- a provider-created portal rendered in the host-owned portal target;
- a `React.lazy`/`Suspense` boundary loaded once and rendered `lazy-ready`;
- the Grafana/Scenes contexts supported real panel rendering; and
- Chromium emitted no invalid-hook, console, or page errors.

## 11. Duplicate-React negative test

Both a unit probe and the built provider host supplied a distinct React object
while preserving the same version string. The provider returned the typed
`duplicate-react-runtime` error with `implementationLoads: 0`. No Grafana API
request or render occurred. Detection therefore precedes and replaces an
eventual invalid-hook crash as the primary failure mechanism.

The same validator also rejects a split ReactDOM/client identity.

## 12. Unsupported-version test

Both unit and built-artifact probes supplied a modeled React 19.2.7 host. The
provider returned `unsupported-react-version` with `implementationLoads: 0`.
No broader React range is implied by the successful 19.2.8 cell.

## 13. Lazy panels

Experiment C's fixed feature boundaries remain intact. Text, Stat, and Time
series have distinct dynamic source owners. The provider did not merge the
features merely to make React externalization easier. Text-only Chromium
traffic did not request Stat, Time series, or TestData feature code; query
panels loaded only the applicable renderer plus TestData runtime.

## 14. Shared Grafana cohort

Experiment D's shared cohort remains provider-owned. Emitted evidence found
one owner each for the Grafana package cohort, Scenes, RxJS, Emotion, and uPlot,
with no module ID emitted into multiple owners. The first feature initialized
the cohort; subsequent features recorded cache hits. Panel and datasource
caches remained shared and safe.

## 15. TestData runtime

Chromium executed the real controlled path:

```text
SceneQueryRunner
  -> provider DataSourceSrv/query runtime
  -> exact TestData datasource source
  -> host BackendSrv transport
  -> /grafana/api/ds/query
  -> PanelData Done
```

The diagnostic no-panel probe reached `Done`; Stat and Time series each issued
real query requests. No fabricated `PanelData` was used.

## 16. Gate A

**PASS.** The real dashboard UID was retrieved and converted, the exact Text
renderer loaded through its lazy provider feature, and native Text content
rendered under host-owned React. No query, iframe, shell, or navigation was
introduced.

## 17. Gate B

**PASS.** The exact Stat renderer consumed real TestData `PanelData` and
rendered its controlled percentage result. The dedicated Gate B/TestData
regression suite passed 10/10, including refresh, cancellation, and failure
isolation inherited from the verified path.

## 18. Gate C

**PASS.** The exact Time series renderer consumed real TestData data, the
controlled transformation and time range, and rendered a real canvas. The full
34-test POC Chromium regression passed, including time-range update, refresh,
responsive resize, UID lifecycle, failures, observers, and cleanup.

## 19. Multi-instance

**PASS.** Two compatible dashboards in one realm shared host React, provider
Runtime, Grafana cohort, and caches while retaining independent scene and query
lifecycles. Removing one left the other active. The prior Gate C resource
regression and this experiment's two-instance probe both passed.

## 20. StrictMode

`StrictMode` remained enabled. Hooks and effects survived React's rehearsal;
there was no duplicate Runtime initialization or invalid hook call. Full root
unmount returned instance resources and the provider portal to zero/empty, and
remount rendered the real Text path again.

To make this full-root remount compatible with the existing process-wide
Runtime identity guard, the shared-cohort browser harness now creates its
transport function, panel catalogue, and TestData class loader once per realm.
They represent stable provider capabilities rather than new identities per
React mount.

## 21. Provider bundle inspection

Machine checks establish all of the following:

- zero provider-bundled React/ReactDOM/JSX implementations;
- expected external import references remain;
- the eager entry contains only admission code;
- all four features have independent owners;
- the shared Grafana/Scenes/RxJS/Emotion cohort has one owner per family;
- no invalid duplicate module owner exists;
- no SystemJS module exists; and
- the exact reviewed Grafana application-source provenance remains enumerable.

The implementation relies on Vite 8.2.0/Rolldown's documented ESM external
require handling. Other consumer bundlers remain unverified.

## 22. Physical resolution

Immutable Yarn installation resolves one physical React 19.2.8 and one
physical ReactDOM 19.2.8 in the workspace. Runtime and emitted-graph checks are
separate: a single installation alone would not have been sufficient evidence.
The existing Scenes peer warnings were observed and not suppressed.

## 23. Size evidence

| Artifact/profile | Raw | Gzip estimate |
| --- | ---: | ---: |
| Experiment E provider entry | 2,085 B | 914 B |
| Experiment E complete provider artifact, excluding host React implementation | 4,545,310 B | 1,146,427 B |
| Experiment E host-owned React chunk | 381,601 B | 116,289 B |
| Experiment E executable host build total | 4,645,638 B | 1,221,772 B |
| Experiment D isolated provider artifact | 2,768,801 B | 628,601 B |
| Current Experiment D executable browser build total | 4,956,525 B | 1,264,919 B |
| Current Experiment D browser build without its host React chunk | 4,575,608 B | 1,148,854 B |

No React externalization size win is claimed: Experiment D's isolated provider
already excluded React. Experiment E is 1,776,509 B raw / 517,826 B gzip larger
than D's isolated bootstrap artifact because E deliberately packages the full
consumer-shaped runtime application boundary, so that comparison is not a
React delta. Against D's executable non-React closure, E is about 30.3 kB raw /
2.4 kB gzip smaller, but the profiles differ and the difference is not treated
as an optimization result.

The host's React chunk includes the host-required implementation and related
ReactDOM browser entry modules. Production bundle budgets remain unresolved.

## 24. Compatibility metadata

The provider needs, at minimum:

- exact React and ReactDOM versions admitted;
- exact Grafana provider and Scenes versions;
- `strictMode: true` capability;
- the rule that React/ReactDOM/JSX are host-owned;
- required object-identity validation before provider initialization; and
- exact provider capability/provenance metadata from the other Phase 1
  architecture documents.

The exact versions remain the only admitted cell. A future schema may express
these fields differently without changing this evidence.

## 25. Provenance

Provider experiment identity: `react-externalized-provider-v1`.

Published cohort: `@grafana/data`, `ui`, `runtime`, `schema`, `i18n`, and
`e2e-selectors` 13.2.3; `@grafana/scenes` 8.13.5; RxJS 7.8.2; Emotion
11.13.5/11.14.0; and uPlot 1.6.32. React/ReactDOM 19.2.8 are host-owned.

Pinned source provenance at commit
`6193dc03311b631b9727b560d24369e683dc396e` remains exactly the Experiment D
closure:

- Text: `public/app/plugins/panel/text/panelcfg.gen.ts` and
  `v1/TextPanel.tsx`;
- Stat: `public/app/plugins/panel/stat/StatPanel.tsx`;
- Time series: `GraphNG.tsx`, GraphNG `utils.ts`, `TimeSeries.tsx`, TimeSeries
  `utils.ts`, `TimeSeriesPanel.tsx`, `TimeSeriesTooltip.tsx`,
  `OutsideRangePlugin.tsx`, and panel `utils.ts`;
- TestData: `datasource.ts`, `constants.ts`, `dataquery.ts`, `LogIpsum.ts`,
  `metricTree.ts`, `nodeGraphUtils.ts`, `runStreams.ts`, `variables.ts`, and the
  three controlled `testData/*Response*.ts` helpers; and
- the pinned package-source `nullToUndefThreshold.ts` adapter plus the already
  audited project-owned bridge adapters.

Every source maps to an emitted owner in ignored evidence. No licensing
conclusion follows from this experiment.

## 26. Limitations

- Only the exact Grafana 13.2.3 / React 19.2.8 / ReactDOM 19.2.8 / Scenes
  8.13.5 combination was tested.
- The Scenes React `^18` peer mismatch remains outside declared peer support.
- Only Vite 8.2.0/Rolldown built the consumer-shaped artifact; alternate
  bundlers, package-manager installation layouts, Module Federation, and
  published-package consumption remain unverified.
- The provider is large, and the host React namespace contract pulls the full
  ReactDOM browser namespace into the host owner; production facade design may
  reduce this without weakening identity checks.
- The controlled panels, TestData datasource, schema-42 dashboard, and selected
  transformation do not prove general Grafana compatibility.
- Licensing/distribution, package names, public API, and publication remain
  separate approval gates.

## 27. Decision

**PASS.** A production-shaped provider for the exact verified version cell can
consume explicit host-owned React/ReactDOM/JSX runtimes without bundling its
own React implementation, while preserving the real renderer, query,
lifecycle, lazy-loading, and multi-instance behavior established by Phase 0
and Experiments A–D.

## 28. Architecture impact

The evidence supports these architecture rules:

1. Keep React, ReactDOM, and both JSX runtimes host-owned required peers.
2. Keep Grafana, Scenes, Runtime, registries, renderers, datasources, and their
   caches in one provider-owned cohort.
3. Put a renderer-free compatibility entry before the dynamic implementation.
4. Validate exact versions and object identities before singleton
   initialization.
5. Preserve independently lazy feature imports and one shared cohort.
6. Fail closed with typed errors for split or unsupported React hosts.
7. Keep `StrictMode` enabled in conformance.

This does not approve a final package layout or distribution model.

## 29. Phase 2 implications

The reference Phase 2 provider/package architecture is now evidence-backed for
one Vite-built experimental version cell: a small contract/admission entry,
host-owned React peers, and a dynamically loaded provider-owned Grafana cohort
with fixed lazy capabilities. Experiments A–E are technically complete.

Phase 2 is not yet authorized. Legal/distribution approval, final Phase 1
architecture synthesis, package/API decisions, and any required cross-bundler
or install-layout conformance remain open. An experimental release must not
claim broader versions, panels, datasources, transformations, or deployment
topologies.

## 30. Follow-up

1. Perform the final Phase 1 production-architecture approval synthesis across
   licensing/distribution, provider boundary, runtime isolation, versioning,
   React/Scenes, bundle, styling, transformation, server-hosted-module, and
   Experiments A–E evidence.
2. Track legal approval and artifact-specific compliance before distributing
   Grafana-derived provider code.
3. Define the Phase 2 conformance matrix and repeat the externalization probe
   for every supported consumer bundler/package layout before claiming support.
4. Preserve the exact admission, provenance, no-duplicate, lazy-feature, and
   lifecycle checks in the future provider harness.
5. Address provider size and host ReactDOM namespace overhead without weakening
   the host-owned identity rule.

## 31. Final status

**PASS**

Experiment E is ready to close after human review. Experiments A–E may be
considered complete for the exact verified cell. The recommended next Phase 1
workstream is the final production-architecture approval synthesis; Phase 2
implementation/publication remains gated as described above.
