# Shared Grafana Runtime Cohort Deduplication Experiment

## 1. Metadata

| Field | Value |
| --- | --- |
| Owner | Grafana React SDK maintainers |
| Phase | Phase 1 — Production Architecture and Distribution Strategy |
| Workstream | Experiment: Shared Grafana runtime cohort deduplication |
| Status | Bounded technical experiment complete |
| Created | 2026-10-13 |
| Last Updated | 2026-10-13 |
| Grafana baseline | OSS 13.2.3, source commit `6193dc03311b631b9727b560d24369e683dc396e` |
| Host baseline | React/ReactDOM 19.2.8; `@grafana/scenes` 8.13.5 |
| Capabilities | Text, Stat, Time series, TestData runtime |
| Final status | **PASS** |

This document uses the phase semantics defined by the
[project roadmap](../../../project/roadmap.md). It records disposable experiment
evidence, not a production provider or package export. Generated evidence under
`artifacts/experiments/shared-grafana-cohort/` is ignored.

## 2. Hypothesis

A production-shaped provider can retain independently lazy Text, Stat, Time
series, and TestData capabilities while sharing one compatible provider-owned
Grafana/Data/UI/Runtime/Scenes/RxJS/Emotion cohort. React and ReactDOM remain
host-owned. No feature may carry an incompatible module identity or private
singleton registry.

The result is limited to the verified Grafana 13.2.3 version cell. It does not
prove arbitrary plugins, datasources, transformations, or future Grafana
versions.

## 3. Baseline

Experiment C established independent lazy application-source owners for Text,
Stat, and Time series, but its browser profile still carried a broad shared
published-package closure. Its controlled all-panel browser profile measured
5,136,917 B raw / 1,399,934 B gzip estimate across 52 static assets. It also
identified uPlot coupling and editor/Codicon material in the shared closure as
inputs to this experiment.

This experiment started from that merged graph without changing panel,
datasource, Grafana, React, or Scenes versions. It added a single shared
identity module, four fixed lazy feature wrappers, explicit core-cohort chunk
ownership, physical package resolution evidence, and browser cache/identity
probes. React is external in the provider artifact and supplied once by the
browser host build.

## 4. Predeclared criteria

All 23 criteria passed:

1. React has one physical resolution.
2. ReactDOM has one physical resolution.
3. Neither is bundled privately in a provider feature.
4. Applicable features share one `@grafana/data` identity.
5. They share one `@grafana/runtime` identity.
6. They share one Scenes identity.
7. RxJS has no incompatible feature copy.
8. Emotion has no incompatible feature copy.
9. required Grafana registries and service locators have one identity;
10. all four capabilities remain independently lazy;
11. Gate A remains green;
12. Gate B remains green;
13. Gate C remains green;
14. the runtime-only TestData query remains green;
15. two compatible dashboard instances remain green;
16. plugin caches are shared safely;
17. datasource/runtime cache behavior remains correct;
18. no iframe is introduced;
19. no Grafana application shell, router, navigation, or `GrafanaApp.init` is introduced;
20. no SystemJS is introduced;
21. no unaudited `public/app` source is admitted;
22. shared and feature provenance is enumerable; and
23. no shared dependency module is duplicated among emitted owners.

The **FAIL** and **INCONCLUSIVE** rules were not changed after observing the
result. Neither condition occurred.

## 5. Physical package resolution

The container walked the root and all three POC workspaces, resolved real
package directories, and compared their manifests with the pinned versions.

| Package | Version | Physical copies | Resolved location |
| --- | --- | ---: | --- |
| `react` | 19.2.8 | 1 | `<repo>/node_modules/react` |
| `react-dom` | 19.2.8 | 1 | `<repo>/node_modules/react-dom` |
| `@grafana/data` | 13.2.3 | 1 | `<repo>/node_modules/@grafana/data` |
| `@grafana/ui` | 13.2.3 | 1 | `<repo>/node_modules/@grafana/ui` |
| `@grafana/runtime` | 13.2.3 | 1 | `<repo>/node_modules/@grafana/runtime` |
| `@grafana/schema` | 13.2.3 | 1 | `<repo>/node_modules/@grafana/schema` |
| `@grafana/i18n` | 13.2.3 | 1 | `<repo>/node_modules/@grafana/i18n` |
| `@grafana/scenes` | 8.13.5 | 1 | `<repo>/node_modules/@grafana/scenes` |
| `rxjs` | 7.8.2 | 1 | `<repo>/node_modules/rxjs` |
| `@emotion/css` | 11.13.5 | 1 | `<repo>/node_modules/@emotion/css` |
| `@emotion/react` | 11.14.0 | 1 | `<repo>/node_modules/@emotion/react` |
| `uplot` | 1.6.32 | 1 | `<repo>/node_modules/uplot` |

This proves installation resolution only. Emitted ownership and browser object
identity were tested separately.

## 6. Runtime identity model

`sharedIdentity.ts` constructs one frozen object from identity-bearing exports:

- React and ReactDOM namespace objects;
- `PanelPlugin`, `Registry`, the standard field-config registry, and the
  standard transformation registry;
- Runtime `config`, BackendSrv/DataSourceSrv/plugin-import/run-request locators;
- `SceneObjectBase` and `SceneQueryRunner`;
- RxJS `Observable` and `Subject`;
- Emotion `CacheProvider` and `css`;
- UI `useStyles2`, schema `DashboardCursorSync`, and i18n initialization.

Every lazy feature must return the exact same object reference. A split graph
fails before its panel or datasource object is exposed. This is stronger than
comparing version strings.

In the isolated provider artifact, React/ReactDOM imports remain external. In
the executable browser build, all React implementation modules are owned by one
`host-react-*` chunk; no feature chunk owns them. Runtime inspection reports one
React 19.2.8 and one ReactDOM 19.2.8 identity.

## 7. Singleton registry evidence

The shared identity covers the exact singleton surfaces used by the controlled
gates: Runtime configuration and service locators, plugin import utilities,
run-request installation, DataSourceSrv, the standard field-config editor
registry, and the transformation registry. Each successful feature load passed
strict identity comparison against that shared object.

The all-capability browser probe recorded one cohort initialization. TestData
registered the query runtime once, subsequent datasource acquisition recorded
cache hits, and real `SceneQueryRunner` requests reached `Done`. Remount did not
replace the Runtime identity or provider caches.

## 8. Shared chunk architecture

```text
host
  -> one React/ReactDOM cohort
  -> provider bootstrap
       -> provider cohort identity
            -> @grafana/data/ui/runtime/schema/i18n
            -> @grafana/scenes
            -> RxJS
            -> Emotion
            -> uPlot when the admitted renderers require it
       -> fixed lazy wrapper: text
       -> fixed lazy wrapper: stat
       -> fixed lazy wrapper: timeseries
       -> fixed lazy wrapper: testdata
```

Core package families have explicit measurable owners. Feature wrappers remain
fixed dynamic imports; their renderer/datasource implementation closures are
left to normal dynamic-entry splitting. Forcing recursive feature closure into
manual chunks produced a top-level-await cycle in the Time series entry, so the
final rule names only the four wrapper boundaries. Forcing every unrelated
third-party module into one catch-all chunk also created a React initialization
cycle and was rejected. These failures are preserved as experiment evidence,
not hidden by aliases or a second React runtime.

## 9. React boundary

React and ReactDOM remain **HOST-OWNED**:

- the distributable-style provider artifact externalizes `react`,
  `react-dom`, and their subpaths;
- the browser harness supplies one host chunk because it must be executable;
- `resolve.dedupe` points all workspace and pinned-source imports at that host
  resolution; and
- feature owners contain no React implementation modules.

Full consumer/build-system externalization remains Experiment E's concern. This
experiment proves the current provider does not need provider-private React.

## 10. Grafana package cohort

The provider cohort is exactly:

| Package | Version | Emitted result |
| --- | --- | --- |
| `@grafana/data` | 13.2.3 | one `provider-grafana-*` owner |
| `@grafana/ui` | 13.2.3 | one `provider-grafana-*` owner |
| `@grafana/runtime` | 13.2.3 | one `provider-grafana-*` owner |
| `@grafana/schema` | 13.2.3 | one `provider-grafana-*` owner |
| `@grafana/i18n` | 13.2.3 | one `provider-grafana-*` owner |
| `@grafana/scenes` | 8.13.5 | one `provider-scenes-*` owner |

The bundle analyzer found no module ID with more than one emitted owner. Deep
imports used by audited adapters resolve into the same owner as package-root
imports.

## 11. Source/package convergence

Pinned Grafana application source enters only through the audited aliases at
commit `6193dc03311b631b9727b560d24369e683dc396e`. Its `@grafana/*` imports resolve
to the repository's installed provider cohort, not a second copy under the
ignored source checkout. The physical resolver found no nested Grafana package
installation, and emitted evidence found one owner for every applicable
published-package module.

The one pinned package-source adapter,
`packages/grafana-data/src/transformations/transformers/nulls/nullToUndefThreshold.ts`,
is explicitly aliased for the controlled Time series path; its published
dependencies still converge on the same cohort.

## 12. RxJS result

**PASS.** RxJS 7.8.2 has one physical installation and one emitted
`provider-rxjs-*` owner. `Observable` and `Subject` are members of the strict
shared identity used by every capability. SceneQueryRunner and TestData query
traffic completed through that identity; no feature-local RxJS module exists.

## 13. Emotion result

**PASS.** `@emotion/react` 11.14.0 and `@emotion/css` 11.13.5 each have one
physical installation. All emitted Emotion modules have one
`provider-emotion-*` owner. `CacheProvider` and `css` participate in strict
identity checks. Browser rendering and remount completed without a second cache
or provider runtime.

The final graph retains a benign bundler-generated Emotion/support-library ESM
cycle. React is not in that cycle, and all browser probes executed cleanly. A
production chunk implementation should avoid depending on this generated shape.

## 14. uPlot/Stat analysis

Classification: **STRUCTURAL for the real Stat renderer, plus shared-chunk
eagerness**.

`StatPanel.tsx` statically imports `BigValue`; `BigValueLayout.mjs` statically
imports `Sparkline`; and `Sparkline` imports Grafana's uPlot component/config
closure. This remains true when the controlled panel's graph mode does not draw
a sparkline. Replacing that chain would rewrite or fork Stat and was outside
this experiment.

uPlot 1.6.32 is nevertheless emitted exactly once in
`provider-visualization-*`. Because the current shared `@grafana/ui` cohort is
eager, even Text-only requests that shared visualization chunk. This is size
coupling, not an identity duplicate. Future leaf-import/facade work may reduce
eagerness, but uPlot cannot be removed from real Stat merely by renaming chunks.

## 15. Editor regression result

**PASS.** Artifact and browser evidence contain zero Monaco, React-Monaco,
CodeMirror, editor-only Codicon, query-editor stylesheet, or editor worker
module/asset. The exact view-only UI barrel transform removes only audited
authoring exports plus the unused full `GlobalStyles` export. Time series keeps
its required uPlot CSS; no full Grafana application stylesheet is imported.

## 16. Browser request evidence

Chromium ran six independent, authenticated probes through the host-owned
`/grafana` proxy. Hashes were resolved from source ownership evidence rather
than hard-coded.

| Probe | Text | Stat | Time series | TestData | Result |
| --- | --- | --- | --- | --- | --- |
| Text only | requested | absent | absent | absent | real Text rendered |
| Stat only | absent | requested | absent | requested | real Stat/query rendered |
| Time series only | absent | absent | requested | requested | real canvas/query rendered |
| All panels | requested | requested | requested | requested | all three rendered |
| TestData only | absent | absent | absent | requested | `PanelData` reached `Done` |
| Two instances | requested | requested | requested | requested | both dashboards rendered |

Shared cohort chunks were requested once per browser realm. No probe observed
an iframe, navigation takeover, Grafana shell, SystemJS module, console error,
or page error.

## 17. Cache/concurrency result

**PASS.** Unit probes prove that concurrent Text/Stat/Time series/TestData loads
initialize the cohort once, concurrent same-feature loads return the same
promise, and a failed feature promise is evicted for typed retry. In the
all-panel browser probe, the cohort recorded one start and three later hits.
Each feature recorded one start across unmount/remount. The TestData datasource
recorded one load miss followed by cache hits, while real queries continued to
execute.

## 18. Multi-instance result

**PASS.** Two compatible dashboards shared one Runtime/cohort and one set of
plugin/datasource caches while keeping separate scene graphs, queries,
observers, portals, and lifecycle ownership. Removing the secondary instance
left the primary active. Removing both returned all instance resource counters
and active dashboard scopes to zero.

## 19. Size evidence

Isolated provider artifact measurements:

| Ownership | Raw | Gzip |
| --- | ---: | ---: |
| Provider bootstrap | 4,401 B | 1,643 B |
| Grafana Data/UI/Runtime/Schema/i18n | 562,037 B | 171,859 B |
| Scenes | 178,567 B | 50,791 B |
| RxJS | 23,959 B | 7,161 B |
| Emotion | 19,409 B | 7,628 B |
| Shared uPlot runtime | 50,990 B | 22,007 B |
| Text wrapper + implementation | 3,123 B | 1,573 B |
| Stat wrapper + implementation | 2,416 B | 1,301 B |
| Time series wrapper + loader + source entry | 86,934 B | 30,615 B |
| TestData wrapper + implementation | 145,989 B | 38,002 B |
| Complete artifact, including other shared third-party chunks/assets | 2,768,801 B | 628,601 B |

The executable browser all-capability profile requested 50 emitted static
files totaling 4,634,533 B raw / 1,220,155 B gzip estimate. Text-only requested
42 files and 4,507,742 B / 1,185,399 B. The large common closure remains a
production optimization concern, but size was not a PASS criterion unless
caused by invalid duplication; no invalid duplication was found.

## 20. Duplication table

| Dependency | Version | Physical copies | Emitted owner/status | Feature ownership |
| --- | --- | ---: | --- | --- |
| React | 19.2.8 | 1 | artifact: `HOST_EXTERNAL`; browser: one `host-react-*` | none |
| ReactDOM | 19.2.8 | 1 | artifact: `HOST_EXTERNAL`; browser: one `host-react-*` | none |
| `@grafana/data` | 13.2.3 | 1 | `provider-grafana-*`; `SHARED_ONCE` | none |
| `@grafana/ui` | 13.2.3 | 1 | `provider-grafana-*`; `SHARED_ONCE` | none |
| `@grafana/runtime` | 13.2.3 | 1 | `provider-grafana-*`; `SHARED_ONCE` | none |
| `@grafana/schema` | 13.2.3 | 1 | `provider-grafana-*`; `SHARED_ONCE` | none |
| `@grafana/i18n` | 13.2.3 | 1 | `provider-grafana-*`; `SHARED_ONCE` | none |
| `@grafana/scenes` | 8.13.5 | 1 | `provider-scenes-*`; `SHARED_ONCE` | none |
| RxJS | 7.8.2 | 1 | `provider-rxjs-*`; `SHARED_ONCE` | none |
| Emotion | 11.13.5 / 11.14.0 | 1 each | `provider-emotion-*`; `SHARED_ONCE` | none |
| uPlot | 1.6.32 | 1 | `provider-visualization-*`; `SHARED_ONCE` | none |
| Text application source | 13.2.3 | n/a | `text-*`; `FEATURE_LOCAL` | Text only |
| Stat application source | 13.2.3 | n/a | `stat-*`; `FEATURE_LOCAL` | Stat only |
| Time series application source | 13.2.3 | n/a | `*TimeSeriesPanel*`; `FEATURE_LOCAL` | Time series only |
| TestData application source | 13.2.3 | n/a | `testdata-*`; `FEATURE_LOCAL` | TestData only |

Every emitted module ID has exactly one owner. No status is
`DUPLICATED_INVALID`; no important dependency is unexplained.

## 21. Provenance

Provider identity: `shared-grafana-cohort-v1`, Grafana OSS 13.2.3 source commit
`6193dc03311b631b9727b560d24369e683dc396e`, with package versions listed above.
The 22 emitted `public/app` files are:

- Text: `panelcfg.gen.ts`, `v1/TextPanel.tsx`;
- Stat: `StatPanel.tsx`;
- Time series: eight files covering `TimeSeriesPanel`, tooltip,
  outside-range plugin, panel utilities, GraphNG, and TimeSeries rendering; and
- TestData: eleven runtime files covering `datasource.ts`, data/query helpers,
  stream helpers, variables, and deterministic response helpers.

The pinned `nullToUndefThreshold.ts` package-source adapter and project-owned
Time series/internal adapters are separately enumerated by bundle evidence.
Every source maps to a content-hashed owning chunk. This is provenance evidence,
not a licensing conclusion.

## 22. Limitations

- only Grafana OSS 13.2.3, React 19.2.8, Scenes 8.13.5, and the four admitted
  capabilities were tested;
- the controlled TestData datasource and schema-42 fixtures are not general
  datasource/dashboard compatibility;
- the shared Grafana/UI and third-party closure remains large and eager;
- Stat structurally reaches uPlot through BigValue/Sparkline;
- generated feature facade and provider-support ESM cycles remain, although no
  React cycle remains and all browser probes pass;
- React is externally modeled in the artifact, but broad consumer/bundler proof
  remains Experiment E; and
- the known Scenes React `^18` peer declaration remains unsuppressed.

## 23. Decision

**PASS.** The exact Grafana 13.2.3 provider can share a coherent physical and
logical Grafana runtime cohort across independently lazy Text, Stat, Time
series, and TestData features. The experiment found no inherent need for
incompatible duplicated Grafana/runtime identities.

## 24. Architecture impact

The provider architecture should retain:

- host-owned React/ReactDOM;
- one version-cell-owned Grafana package/runtime cohort;
- one explicit shared identity and singleton registration boundary;
- fixed capability imports with provider-lifetime promise/identity caches;
- non-recursive feature wrapper chunking, allowing the bundler to preserve
  dynamic implementation boundaries; and
- machine-checked physical, emitted-owner, provenance, editor, and browser
  request evidence.

Production work must not force all third-party dependencies into one manual
chunk or recursively force top-level-await implementations into wrapper chunks.

## 25. Experiment E inputs

Experiment E may proceed. It must prove the host/provider externalization
contract across the selected production build/consumer shapes:

1. React/ReactDOM and all relevant subpaths resolve to host-owned identities;
2. the provider cohort remains single when installed rather than built in this
   workspace;
3. peer constraints and diagnostics reject incompatible hosts early;
4. package-manager, Vite, and at least one other supported bundler do not create
   hidden nested identities;
5. externalization does not reintroduce editor assets or break feature laziness;
   and
6. the known Scenes React peer mismatch is handled according to the approved
   compatibility policy.

## 26. Follow-up

1. Execute Experiment E: host externalization and peer resolution.
2. Carry the no-duplicate, no-editor, and independent-source-request checks into
   the Phase 2 provider conformance harness.
3. Investigate a production UI facade/leaf-import strategy to reduce the eager
   shared closure without replacing real renderers.
4. Treat generated ESM cycle shape as a bundler-specific risk to eliminate or
   constrain before production packaging.
5. Keep arbitrary panels, datasources, Grafana versions, and Table outside this
   result.

## 27. Final status

**PASS**

The shared-cohort hypothesis is supported for the exact verified version cell.
Experiment D is ready to close after human review, and Experiment E may proceed.
