# TestData Runtime-Only Datasource Bundle Experiment

## 1. Metadata

| Field | Value |
| --- | --- |
| Owner | Dashboard Render SDK G maintainers |
| Phase | Phase 1 — Production Architecture and Distribution Strategy |
| Workstream | Experiment: TestData runtime-only datasource bundle |
| Status | Bounded technical experiment complete |
| Created | 2026-10-13 |
| Last Updated | 2026-10-13 |
| Grafana baseline | OSS 13.2.3, source commit `6193dc03311b631b9727b560d24369e683dc396e` |
| Host baseline | React/ReactDOM 19.2.8; `@grafana/scenes` 8.13.5 |
| Datasource | `grsdk-testdata`; `grafana-testdata-datasource` |
| Final status | **PASS** |

This document uses the phase semantics defined by the
[project roadmap](../../../project/roadmap.md). It reports a disposable,
datasource-specific engineering experiment. It is not a production package,
distribution approval, legal conclusion, or claim about arbitrary Grafana
datasources. Generated evidence under
`artifacts/experiments/testdata-runtime-only/` is intentionally ignored.

## 2. Hypothesis

The real Grafana OSS 13.2.3 TestData runtime required by the query-backed Stat
and Time series paths can be packaged as a view/query-only provider artifact
without datasource configuration UI, query/scenario editors, Monaco,
React-Monaco, CodeMirror, Codicon editor assets, or unrelated authoring
dependencies.

The admitted successful path remains:

```text
SceneQueryRunner
  -> provider DataSourceSrv
  -> exact TestDataDataSource
  -> DataSourceWithBackend / BackendSrv
  -> POST /grafana/api/ds/query
  -> real PanelData
```

## 3. Baseline

The fresh control build is rooted at Grafana's exact
[`module.tsx`](https://github.com/grafana/grafana/blob/6193dc03311b631b9727b560d24369e683dc396e/public/app/plugins/datasource/grafana-testdata-datasource/module.tsx),
not at the multi-entry POC application. That module constructs
`DataSourcePlugin(TestDataDataSource)` and statically registers
`ConfigEditor`, `QueryEditor`, `MetaDataInspector`, and `TestInfoTab`.

| Baseline measure | Fresh result |
| --- | ---: |
| Reachable JavaScript | 5,221,567 B raw / 1,279,403 B gzip |
| Reachable modules | 1,356 |
| Reachable JavaScript chunks | 88 |
| Grafana `public/app` sources | 33 |
| Editor identities | 23 |
| Monaco identities | 843 |
| CodeMirror identities | 1 |
| Non-evidence CSS/static assets | 3 |

The assets were Codicon TTF (72,504 B raw / 40,396 B gzip), Monaco editor CSS
(39,288 B / 6,953 B), and React-Monaco CSS (42,432 B / 7,557 B). The
baseline also emitted an approximately 1.85 MB Monaco API chunk, an 888 kB
React-Monaco chunk, and many language chunks. These are complete emitted-graph
measurements, not browser-request observations.

## 4. Predeclared pass/fail criteria

**PASS** requires the exact TestData runtime, a real Predictable Pulse request
and response, `SceneQueryRunner` Loading → Done, green Stat and Time series
gates, refresh/cancellation/stale-generation behavior, no editor closure,
Monaco, React-Monaco, CodeMirror, Codicon, second React, Grafana shell,
arbitrary SystemJS, or provenance gap, plus a material isolated size reduction.

**FAIL** means the real query runtime structurally requires its authoring
closure under the allowed architecture. **INCONCLUSIVE** means the build cannot
separate TestData from unrelated POC dependencies reliably. These criteria were
fixed before the runtime-only entry was implemented.

## 5. TestData dependency analysis

The exact runtime implementation is
[`datasource.ts`](https://github.com/grafana/grafana/blob/6193dc03311b631b9727b560d24369e683dc396e/public/app/plugins/datasource/grafana-testdata-datasource/datasource.ts),
which exports `TestDataDataSource extends DataSourceWithBackend`. Predictable
Pulse is not a frontend special case: it enters the default branch, calls
`super.query`, and reaches Grafana's datasource backend through `BackendSrv`.

| Dependency group | Exact identities | Result |
| --- | --- | --- |
| **RUNTIME / QUERY REQUIRED** | `datasource.ts`, `constants.ts`, `dataquery.ts`, `variables.ts` | Retained |
| **SHARED RUNTIME REQUIRED BY THE CLASS** | `LogIpsum.ts`, `metricTree.ts`, `nodeGraphUtils.ts`, `runStreams.ts`, three `testData/*Response.ts` files | Retained because `datasource.ts` statically imports branches for other scenarios |
| **CONFIGURATION EDITOR** | `ConfigEditor.tsx`, `TestInfoTab.tsx` | Removed |
| **QUERY / SCENARIO EDITOR** | `QueryEditor.tsx` and 17 files under `components/` | Removed |
| **METADATA UI** | `MetaDataInspector.tsx` | Removed |
| **PLUGIN REGISTRATION** | `module.tsx` | Removed; replaced by bounded provider metadata |
| **MONACO / CODE EDITOR** | Grafana UI Monaco, React-Monaco, CodeEditor, language modules | Removed |
| **ICON / CODICON** | Codicon TTF and editor CSS | Removed |

The result removes authoring code but does not reduce `TestDataDataSource` to
Predictable Pulse alone. The eleven-file runtime closure still contains dormant
branches for other upstream TestData scenarios because the single class imports
them statically. No branch was rewritten or deleted.

## 6. Experimental runtime-only architecture

```text
existing closed datasource catalogue
  -> dynamic `grafana-poc-testdata-datasource` boundary
  -> experiment providerMetadata.ts
     -> exact pinned datasource.ts
        -> exact 10 transitive TestData runtime files
        -> published DataSourceWithBackend
        -> existing Task 5 services and BackendSrv
  -> existing provider DataSourceSrv
  -> existing SceneQueryRunner path
```

All new entry, facade, analysis, and identity code lives under
`experiments/bundle/testdata-runtime-only/`. The host opts into it only through
`POC_TESTDATA_RUNTIME_ONLY_EXPERIMENT=1`; the normal POC path is unchanged. No
production export was added.

The isolated build resolves broad published-package imports to exact pinned ESM
leaves. The browser proof instead binds to the already loaded host package
cohort. An experiment-only resolver makes this distinction explicit rather
than creating a second runtime identity.

## 7. Datasource runtime identity

The constructor is the exact unmodified `TestDataDataSource` exported from the
pinned `datasource.ts`. The source-transform boundary verifies a clean checkout
at commit `6193dc03311b631b9727b560d24369e683dc396e` before loading it. No fake
datasource, fabricated `PanelData`, local Predictable Pulse calculation, or
`SceneQueryRunner` bypass is present.

The existing POC evidence label still says
`public/app/plugins/datasource/grafana-testdata-datasource/module.tsx` for
backward comparison with Task 10. That label is not the experiment's actual
source provenance. The emitted module inventory records `datasource.ts` and its
ten exact transitive application sources.

## 8. Provider metadata

The runtime-shaped provider does not need Grafana's whole `DataSourcePlugin`
registration object. Project-owned `providerMetadata.ts` exposes only the exact
`DataSourceClass` constructor consumed by the existing closed provider loader.

The artifact intentionally provides no:

- datasource configuration editor;
- query or scenario editor;
- annotations or variable editor registration;
- metadata inspector or Setup page;
- authoring suggestions; or
- general datasource/plugin discovery.

This is an explicit view/query capability profile. A future manifest must
declare those authoring capabilities absent and reject any workflow that asks
for them.

## 9. Bundle evidence

The isolated runtime-only graph contains four chunks and no non-evidence asset:

| Chunk | Raw | Gzip | Ownership |
| --- | ---: | ---: | --- |
| `testdata-runtime-provider-*.js` | 102,242 B | 24,357 B | Exact eleven-file application runtime plus bounded provider/facade |
| `shared-dependencies-*.js` | 1,274,391 B | 206,727 B | Published Grafana/runtime and third-party dependencies |
| `rolldown-runtime-*.js` | 1,291 B | 710 B | Bundler runtime |
| `testdataRuntimeOnly-*.js` | 101 B | 106 B | Experiment entry shim |

Module-level source-map attribution, which is pre-minification and therefore
not additive with chunk bytes, reports 166,917 rendered bytes from exact
Grafana application source, 314,138 from published Grafana packages, 1,489,589
from third-party dependencies, 153 from experiment adapters, zero from the POC
host/compat/bridge, and 2,240 other runtime bytes.

The source-identity test follows every emitted static and dynamic chunk edge
from the entry. It checks the complete 33-file application-source baseline and
exact eleven-file emitted result rather than inferring removal from network
silence.

## 10. Editor/Monaco evidence

The runtime-only reachable graph contains:

- datasource config/query/scenario/metadata editor identities: **0**;
- Monaco and React-Monaco identities: **0**;
- CodeMirror/CodeEditor identities: **0**;
- Codicon assets: **0**;
- CSS, font, image, worker, or WASM assets: **0**; and
- `module.tsx`: **0**.

The same assertions observe 23 editor identities, 843 Monaco identities, one
CodeMirror identity, and the three assets in the fresh baseline. This control
demonstrates that the guard detects the inherited closure before the bounded
entry removes it.

The evidence format also lists every module Vite transformed before final
tree-shaking. That broader candidate set is not the distributed artifact: it
contains Grafana Data's `monaco/languageRegistry.mjs`,
`standardFieldConfigEditorRegistry.mjs`, and two suggestion helpers. Dedicated
assertions pin those four transformed-only identities and independently prove
that none appears in any emitted reachable chunk. This distinction prevents a
tree-shaken transform candidate from being mislabeled as shipped code while
also preventing it from disappearing from the audit trail.

The full multi-entry POC production build can still emit Monaco/Codicon through
the separate legacy Text entry. That unrelated closure does not invalidate the
TestData-specific result and is why the experiment uses an isolated comparison.

## 11. Query-runtime result

**PASS.** Chromium exercised the real dashboard and Task 10 path through the
runtime-only provider. It resolved `grsdk-testdata` as
`grafana-testdata-datasource`, executed Predictable Pulse, observed
`SceneQueryRunner` transitions `Loading`, `Done`, `Loading`, `Done`, and
received non-empty series, fields, and points.

At least four real `POST /grafana/api/ds/query` requests were observed across
initial, refresh, generation, and cancellation work. Refresh produced a new
request ID. Browser evidence contained no Authorization header, cookie,
credential, or response body.

## 12. Gate B result

**PASS.** The real Stat plugin rendered its real TestData result in native DOM,
including the fixture's reduction, percent display processing, thresholds,
and field configuration. Refresh issued a distinct successful query. The
controlled HTTP-failure test kept the Text panel and host functional, and
teardown returned instance resources to baseline.

## 13. Gate C result

**PASS.** The real Time series renderer consumed real TestData `PanelData`, ran
the controlled `renameByRegex` transformation, rendered the uPlot/canvas and
legend, refreshed, changed dashboard time range, and resized through the
instrumented `ResizeObserver`. UID/lifecycle stress and two simultaneous
dashboard instances remained green. Transformation support was not broadened.

## 14. Failure/cancellation result

**PASS.** Existing deterministic cases remained intact:

- server HTTP failure was panel-local and did not destroy Text or the host;
- a slow query was cancelled on UID change;
- the stale generation did not publish `Done`;
- repeated UID/mount cycles retained no instance resources; and
- the closed datasource service continued to reject missing/unsupported
  datasource identities in its existing unit coverage.

The size reduction did not remove the runtime error, cancellation, or stale
generation paths.

## 15. React/runtime result

The browser cohort probe verified strict identity for:

- `@grafana/data` `DataSourceApi`;
- `@grafana/runtime` `DataSourceWithBackend` and `getBackendSrv`;
- RxJS `Observable`;
- React `createElement`;
- ReactDOM `createPortal`; and
- the datasource superclass prototype.

One physical React 19.2.8 and ReactDOM 19.2.8 remain. The provider reused the
existing Task 5 singleton services and added no initialization. The known
Scenes 8.13.5 React `^18` peer warning remains unsuppressed. No `GrafanaApp`,
application shell/router/chrome, iframe, or SystemJS loader was introduced.

## 16. Shared-cohort observations

The browser result supports, but does not finish, the shared-cohort strategy:
the runtime-only provider used the same data, Runtime, RxJS, React, and ReactDOM
objects as the existing host/provider runtime. The isolated build externalized
React/ReactDOM and contained no React implementation module.

The isolated shared-dependency chunk is still 1,274,391 B raw / 206,727 B gzip.
It is a per-artifact measurement, not proof that a production multi-feature
provider will download that closure only once. Bundle Experiment D remains
responsible for cross-feature shared-cohort deduplication.

## 17. Provenance

### Exact upstream application sources retained

1. `public/app/plugins/datasource/grafana-testdata-datasource/LogIpsum.ts`
2. `public/app/plugins/datasource/grafana-testdata-datasource/constants.ts`
3. `public/app/plugins/datasource/grafana-testdata-datasource/dataquery.ts`
4. `public/app/plugins/datasource/grafana-testdata-datasource/datasource.ts`
5. `public/app/plugins/datasource/grafana-testdata-datasource/metricTree.ts`
6. `public/app/plugins/datasource/grafana-testdata-datasource/nodeGraphUtils.ts`
7. `public/app/plugins/datasource/grafana-testdata-datasource/runStreams.ts`
8. `public/app/plugins/datasource/grafana-testdata-datasource/testData/flameGraphResponse.ts`
9. `public/app/plugins/datasource/grafana-testdata-datasource/testData/serviceMapResponse.ts`
10. `public/app/plugins/datasource/grafana-testdata-datasource/testData/serviceMapResponseMedium.ts`
11. `public/app/plugins/datasource/grafana-testdata-datasource/variables.ts`

All resolve from Grafana OSS commit
`6193dc03311b631b9727b560d24369e683dc396e`.

### Project-owned experiment boundary

`providerMetadata.ts` supplies the constructor contract. `runtimeOnlyEntry.ts`
is the isolated entry. The data/runtime/UI facades and
`testDataRuntimeOnlyImportsPlugin.ts` bind the exact published dependency
leaves for measurement and the host cohort for browser proof. Source identity,
analysis, build, comparison, and browser-cohort files are all marked
`POC / EXPERIMENT / NOT FOR PRODUCTION`.

### Removed baseline application identities

The runtime-only closure removes these exact 22 baseline identities (all paths
are relative to `public/app/plugins/datasource/grafana-testdata-datasource/`):

1. `module.tsx`
2. `ConfigEditor.tsx`
3. `MetaDataInspector.tsx`
4. `QueryEditor.tsx`
5. `TestInfoTab.tsx`
6. `components/CSVContentEditor.tsx`
7. `components/CSVFileEditor.tsx`
8. `components/CSVWaveEditor.tsx`
9. `components/ErrorEditor.tsx`
10. `components/ErrorWithSourceEditor.tsx`
11. `components/ExemplarLabelsEditor.tsx`
12. `components/ExemplarsEditor.tsx`
13. `components/FlakyQueryEditor.tsx`
14. `components/GrafanaLiveEditor.tsx`
15. `components/NodeGraphEditor.tsx`
16. `components/PredictablePulseEditor.tsx`
17. `components/RandomWalkEditor.tsx`
18. `components/RawFrameEditor.tsx`
19. `components/SimulationQueryEditor.tsx`
20. `components/SimulationSchemaForm.tsx`
21. `components/StreamingClientEditor.tsx`
22. `components/USAQueryEditor.tsx`

The retained eleven upstream sources coalesce into
`testdata-runtime-provider-*.js`; published and third-party dependencies are in
`shared-dependencies-*.js`. Exact lists are executable in `sourceIdentity.ts`
and tested against emitted evidence. This provenance record is technical
evidence only; it makes no licensing conclusion.

## 18. Size comparison

| Measure | Baseline module | Runtime-only | Reduction |
| --- | ---: | ---: | ---: |
| Raw JavaScript | 5,221,567 B | 1,378,025 B | 73.61% |
| Gzip JavaScript | 1,279,403 B | 231,900 B | 81.87% |
| Reachable modules | 1,356 | 259 | 80.90% |
| Reachable chunks | 88 | 4 | 95.45% |
| Grafana application sources | 33 | 11 | 66.67% |
| Editor identities | 23 | 0 | 100% |
| Monaco identities | 843 | 0 | 100% |
| CSS/static assets | 3 | 0 | 100% |

The runtime-only result is below the bundle strategy's provisional incremental
datasource target of 500 KiB raw / 150 KiB gzip for its source/provider chunk
(102,242 B / 24,357 B). The total isolated artifact is larger because it also
measures its complete published/third-party shared closure. These numbers must
not be subtracted from the whole POC build or treated as production transfer
sizes without Experiment C/D chunk-sharing evidence.

## 19. Limitations

- The result applies only to Grafana OSS 13.2.3 and the controlled TestData
  provider profile.
- The class still contains dormant runtime branches for non-Predictable-Pulse
  TestData scenarios; they are not declared supported.
- Exact `dist/esm` published-package leaves are version-coupled, non-export-map
  implementation paths and require regeneration/conformance for every provider
  build.
- The Runtime services facade assumes Task 5 installed the one compatible
  service cohort before provider loading; standalone provider boot was not
  tested.
- The experiment does not prove Prometheus, Loki, PostgreSQL, arbitrary plugin,
  datasource authoring, annotation, variable-query, or live-stream support.
- Development prewarming avoids one Vite optimizer invalidation; it is test
  plumbing, not a production loading design.
- Distribution and license approval remain governed by the separate Phase 1
  decisions.

## 20. Decision

**PASS.** The exact Grafana 13.2.3 TestData query runtime does not structurally
require its authoring/editor closure under the admitted provider architecture.
The bounded constructor entry preserves the real backend query path and Gates B
and C while removing the configuration/query/scenario editor graph, Monaco,
CodeMirror, Codicon, and editor CSS from the complete isolated graph.

This is a datasource-specific technical result. It is not permission to publish
the artifact or a general datasource compatibility claim.

## 21. Architecture impact

The result supports the provider-owned closed catalogue and separate
runtime/view capability profile selected by the Phase 1 bundle strategy. A
provider manifest should distinguish datasource query runtime from authoring
registration and declare at least:

- exact Grafana/source/provider build identity;
- datasource type `grafana-testdata-datasource`;
- admitted datasource UID policy and tested scenario `predictable_pulse`;
- exact source and published-leaf provenance;
- required Task 5 Runtime/BackendSrv/TemplateSrv cohort;
- absent config/query/metadata/setup editor capabilities;
- external React/RxJS/Grafana cohort compatibility; and
- explicit failure for undeclared scenario or authoring requests.

No current POC file should be promoted unchanged. The implementation is
evidence for production provider generation and conformance design.

## 22. Follow-up

Bundle Experiment C — per-panel lazy split — may proceed. It should verify that
a manifest-only bootstrap loads no panel or datasource implementation eagerly,
that Stat/Time series trigger only their declared renderer and TestData feature
chunks, and that the editor-free TestData graph remains closed under shared
chunking.

Subsequent work should also:

1. formalize datasource runtime-versus-authoring manifest fields;
2. decide how exact leaf facades are generated and reviewed per Grafana build;
3. test fail-closed behavior for undeclared TestData scenarios;
4. preserve the full module as a negative/control build in bundle CI;
5. complete Experiment D shared-cohort deduplication; and
6. obtain the required distribution/licensing approval before public artifacts.

## 23. Final status

**PASS**

The hypothesis is proven for the exact TestData Predictable Pulse query profile
on Grafana OSS 13.2.3. Experiment B is ready to close after human review;
Experiment C may begin. No commit, publication, or production architecture
promotion is implied.
