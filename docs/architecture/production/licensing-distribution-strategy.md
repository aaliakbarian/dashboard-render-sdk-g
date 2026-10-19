# Grafana Source Licensing and Distribution Strategy

## 1. Document metadata

| Field | Value |
| --- | --- |
| Owner | Dashboard Render SDK G maintainers |
| Phase | Phase 1 — Production Architecture and Distribution Strategy |
| Status | Proposed for maintainer and qualified legal review |
| Created | 2026-10-10 |
| Last Updated | 2026-10-10 |
| Related GitHub workstream | `[Phase 1] Define Grafana source licensing and distribution strategy` |

This document is an engineering and evidence record, not legal advice. It uses
the following labels deliberately:

- **VERIFIED FACT** — directly supported by the cited source, package artifact,
  or reproducible Phase 0 evidence.
- **INFERENCE** — an engineering interpretation of verified facts.
- **TECHNICAL RECOMMENDATION** — a proposed architecture or next action, made
  independently of legal approval.
- **LEGAL QUESTION** — a matter reserved for qualified legal counsel.

## 2. Executive summary

**VERIFIED FACT.** Phase 0 proved that a standalone React 19.2.8 host can render
real Grafana OSS 13.2.3 Text, Stat, and Time series panels, and can execute the
real TestData query path, without an iframe, `GrafanaApp.init`, or the Grafana
application shell. The successful browser build was not composed solely of
published Grafana packages: it contained exactly 55 reviewed files from
Grafana's `public/app` tree, two project-owned compatibility shims resolving
eight exact-version deep/source package paths, and a substantial editor/asset
closure.

**VERIFIED FACT.** Grafana v13.2.3
[`LICENSING.md`](https://github.com/grafana/grafana/blob/v13.2.3/LICENSING.md)
states that the repository default is AGPL-3.0-only and names specific
Apache-2.0 directory exceptions. The 55 successful-POC `public/app` files are
outside the named exceptions. No narrower license header or nested license file
was found in those files or their containing directories. This records the
upstream classification; it does not decide the obligations of a future SDK.

**VERIFIED FACT.** The directly declared published packages identify themselves
as Apache-2.0 in their package manifests and include license files. Four Grafana
monorepo package paths used here—`grafana-data`, `grafana-e2e-selectors`,
`grafana-runtime`, and `grafana-ui`—are also expressly named in the monorepo's
Apache-2.0 exception list. `grafana-schema` and `grafana-i18n` declare
Apache-2.0 and ship `LICENSE_APACHE2`, but their directories are not named in
that list; counsel should confirm how those two pieces of upstream evidence
should be read together. `@grafana/scenes` comes from the separate
`grafana/scenes` repository and its 8.13.5 package declares Apache-2.0.

**TECHNICAL RECOMMENDATION — MEDIUM confidence.** Design the production system
as a small public core SDK plus an explicit, version-matched renderer-provider
contract. Treat a separately versioned Grafana bridge as the preferred provider
implementation (Model B combined with Model F), because that boundary contains
source provenance, exact Grafana coupling, bundle cost, and runtime singleton
ownership without weakening native fidelity. Continue internal design and
testing, but do not publish or distribute a bridge containing the identified
Grafana application code until qualified legal review approves the chosen
model and its license/notice/source process.

**LEGAL QUESTION.** Whether and on what terms this project may distribute the
identified application-derived modules—inside the main package, in a separate
bridge, or as adapted code—remains unresolved. This document does not infer an
npm package license from the upstream AGPL facts.

**Final document status: PROCEED WITH LEGAL REVIEW.** License-neutral internal
architecture and a bounded server-hosted-module experiment may proceed. Public
bridge packaging, release licensing, and publication remain blocked.

## 3. Evidence baseline

### 3.1 Pinned identities

| Identity | Exact value | Role |
| --- | --- | --- |
| Grafana source tag | `v13.2.3` | Source and licensing analysis baseline |
| Grafana source commit | `6193dc03311b631b9727b560d24369e683dc396e` | Clean ignored checkout used by the POC |
| Grafana package cohort | `13.2.3` | Published Data/UI/Runtime/Schema/i18n/selectors artifacts |
| Scenes package | `@grafana/scenes@8.13.5` | Published scene runtime |
| Scenes source commit / package `gitHead` | `9c247076dbb9aa2c2ae96d4b0dffc3ecedea0ac2` | Scenes 8.13.5 identity |
| Grafana 13.2.3 package `gitHead` | `8ea0d7e31a25f84c2b5a1c173070d8cde8740924` | Published package-artifact provenance |
| React / ReactDOM | `19.2.8` | Successful POC browser runtime |

**VERIFIED FACT.** The Grafana package `gitHead` is the parent used by the
release pipeline; the tagged source commit is the release commit. The tag,
package version, lockfile checksum, and installed artifact contents are
therefore retained together rather than treating either commit alone as the
complete package provenance. The Docker image digest and its patched binary
`BuildCommit` are separate fixture identities and are not used to classify
source licensing.

### 3.2 Primary evidence

- Pinned Grafana [`LICENSING.md`](https://github.com/grafana/grafana/blob/v13.2.3/LICENSING.md),
  [`LICENSE`](https://github.com/grafana/grafana/blob/v13.2.3/LICENSE), and
  [`NOTICE.md`](https://github.com/grafana/grafana/blob/v13.2.3/NOTICE.md).
- Package manifests and package-local license files at the pinned source tag and
  in the locked installed artifacts.
- File-level headers and nested license/notice files in the exact source closure.
- [`poc-results.md`](../research/poc-results.md), the Phase 0 implementation
  record, bridge source identities, guarded Vite aliases, and
  `scripts/inspect-poc-bundle.mjs`.
- Ignored generated `bundle-evidence.json` and
  `forbidden-import-report.json`, which enumerate the actual successful build.
- Pinned Grafana loader/build sources, especially
  [`built_in_plugins.ts`](https://github.com/grafana/grafana/blob/v13.2.3/public/app/features/plugins/built_in_plugins.ts),
  [`importPluginModule.ts`](https://github.com/grafana/grafana/blob/v13.2.3/public/app/features/plugins/importer/importPluginModule.ts),
  [`pluginImporter.ts`](https://github.com/grafana/grafana/blob/v13.2.3/public/app/features/plugins/importer/pluginImporter.ts),
  and [`webpack.common.ts`](https://github.com/grafana/grafana/blob/v13.2.3/scripts/webpack/webpack.common.ts).

### 3.3 Evidence limits

**VERIFIED FACT.** Phase 0 established one controlled Grafana version, three
panel renderers, one datasource, one V1/schema-42 fixture family, and selected
transformations. It did not establish arbitrary Grafana-version, panel,
datasource, asset, V2-dashboard, or production-distribution compatibility.

**INFERENCE.** The final bundle graph is the strongest available technical
inventory for the successful path, but bundler inclusion does not prove that
every statically imported editor/helper executes in view mode.

## 4. Exact Phase 0 Grafana source/package inventory

### 4.1 Inventory conventions

All `public/app/...` paths below have the following common attributes unless a
row says otherwise:

| Attribute | Value |
| --- | --- |
| Repository | `grafana/grafana` |
| Tag / commit | `v13.2.3` / `6193dc03311b631b9727b560d24369e683dc396e` |
| Material type | TypeScript/TSX source compiled into browser JavaScript |
| Project tracking | Not tracked; consumed from ignored `.grafana-source/grafana-v13.2.3/` |
| Successful build | Present in ignored local POC browser bundles |
| License evidence | Repository default in `LICENSING.md`; no named exception, narrower file header, or nested license found |

“Runtime” means exercised or directly required by the successful view/query
path. “Static closure” means emitted because an entrypoint registers an editor,
migration, preset, or optional scenario, without evidence that the controlled
view/query path executes it.

### 4.2 Text and shared configuration closure — 6 files

| Exact upstream path | Entry relationship | Runtime relevance |
| --- | --- | --- |
| `public/app/core/config.ts` | Transitive from Text/config use | Runtime configuration access |
| `public/app/plugins/panel/text/panelcfg.gen.ts` | Transitive generated configuration | Plugin option registration |
| `public/app/plugins/panel/text/v1/TextPanel.tsx` | Transitive from v1 module | Real Text renderer |
| `public/app/plugins/panel/text/v1/TextPanelEditor.tsx` | Transitive from v1 module | Static editor closure; not needed for view rendering |
| `public/app/plugins/panel/text/v1/module.tsx` | Direct bridge entry | Plugin construction and registration |
| `public/app/plugins/panel/text/v1/textPanelMigrationHandler.ts` | Transitive from v1 module | Static migration registration; current fixture does not migrate |

The upstream `public/app/plugins/panel/text/module.tsx` identifies the full
application entrypoint, but the winning Phase 0 P1 experiment deliberately
loaded the v1 entrypoint above. The full entrypoint is not one of the 55 final
bundle files.

### 4.3 Stat closure — 8 files

| Exact upstream path | Entry relationship | Runtime relevance |
| --- | --- | --- |
| `public/app/features/panel/suggestions/utils.ts` | Transitive | Static suggestion/configuration closure |
| `public/app/plugins/panel/stat/StatMigrations.ts` | Transitive | Static migration registration |
| `public/app/plugins/panel/stat/StatPanel.tsx` | Transitive | Real Stat renderer |
| `public/app/plugins/panel/stat/common.ts` | Transitive | Plugin option/reducer registration |
| `public/app/plugins/panel/stat/module.tsx` | Direct bridge entry | Plugin construction and registration |
| `public/app/plugins/panel/stat/panelcfg.gen.ts` | Transitive generated configuration | Options used by plugin/renderer |
| `public/app/plugins/panel/stat/presets.ts` | Transitive | Static preset registration |
| `public/app/plugins/panel/stat/suggestions.ts` | Transitive | Static suggestion registration |

### 4.4 Time series / GraphNG closure — 8 files

| Exact upstream path | Entry relationship | Runtime relevance |
| --- | --- | --- |
| `public/app/core/components/GraphNG/GraphNG.tsx` | Transitive from `TimeSeries` | Real plot renderer |
| `public/app/core/components/GraphNG/utils.ts` | Transitive | Plot preparation/runtime helper |
| `public/app/core/components/TimeSeries/TimeSeries.tsx` | Transitive from panel | Real Time series UI |
| `public/app/core/components/TimeSeries/utils.ts` | Transitive | Runtime plot helper |
| `public/app/plugins/panel/timeseries/TimeSeriesPanel.tsx` | Direct P2 source-built entry | Real panel renderer |
| `public/app/plugins/panel/timeseries/TimeSeriesTooltip.tsx` | Transitive | Runtime tooltip path |
| `public/app/plugins/panel/timeseries/plugins/OutsideRangePlugin.tsx` | Transitive | Runtime plot plugin |
| `public/app/plugins/panel/timeseries/utils.ts` | Transitive | Runtime panel helper |

**VERIFIED FACT.** The root Time series `module.tsx` P1 experiment pulled in
dashboard/application dependencies and did not become the winning path. The
successful P2 artifact compiled `TimeSeriesPanel.tsx` and replaced exact
assistant, annotation, exemplar, ad-hoc, status-history, and suggestion
integrations with project-owned no-op adapters for features absent from the
controlled fixture. Those project adapters are tracked, but they are not copied
Grafana source.

### 4.5 TestData closure — 33 files

| Exact upstream path | Entry relationship | Runtime relevance |
| --- | --- | --- |
| `public/app/plugins/datasource/grafana-testdata-datasource/ConfigEditor.tsx` | Transitive from module | Static editor closure |
| `public/app/plugins/datasource/grafana-testdata-datasource/LogIpsum.ts` | Transitive | Optional scenario closure; not exercised |
| `public/app/plugins/datasource/grafana-testdata-datasource/MetaDataInspector.tsx` | Transitive from module | Static inspector closure |
| `public/app/plugins/datasource/grafana-testdata-datasource/QueryEditor.tsx` | Transitive from module | Static editor closure |
| `public/app/plugins/datasource/grafana-testdata-datasource/TestInfoTab.tsx` | Transitive from module | Static configuration UI closure |
| `public/app/plugins/datasource/grafana-testdata-datasource/components/CSVContentEditor.tsx` | Transitive from query editor | Static editor closure |
| `public/app/plugins/datasource/grafana-testdata-datasource/components/CSVFileEditor.tsx` | Transitive from query editor | Static editor closure |
| `public/app/plugins/datasource/grafana-testdata-datasource/components/CSVWaveEditor.tsx` | Transitive from query editor | Static editor closure |
| `public/app/plugins/datasource/grafana-testdata-datasource/components/ErrorEditor.tsx` | Transitive from query editor | Static editor closure |
| `public/app/plugins/datasource/grafana-testdata-datasource/components/ErrorWithSourceEditor.tsx` | Transitive from query editor | Static editor closure |
| `public/app/plugins/datasource/grafana-testdata-datasource/components/ExemplarLabelsEditor.tsx` | Transitive from query editor | Static editor closure |
| `public/app/plugins/datasource/grafana-testdata-datasource/components/ExemplarsEditor.tsx` | Transitive from query editor | Static editor closure |
| `public/app/plugins/datasource/grafana-testdata-datasource/components/FlakyQueryEditor.tsx` | Transitive from query editor | Static editor closure |
| `public/app/plugins/datasource/grafana-testdata-datasource/components/GrafanaLiveEditor.tsx` | Transitive from query editor | Static editor closure |
| `public/app/plugins/datasource/grafana-testdata-datasource/components/NodeGraphEditor.tsx` | Transitive from query editor | Static editor closure |
| `public/app/plugins/datasource/grafana-testdata-datasource/components/PredictablePulseEditor.tsx` | Transitive from query editor | Static editor closure; query itself runs on backend |
| `public/app/plugins/datasource/grafana-testdata-datasource/components/RandomWalkEditor.tsx` | Transitive from query editor | Static editor closure |
| `public/app/plugins/datasource/grafana-testdata-datasource/components/RawFrameEditor.tsx` | Transitive from query editor | Static editor closure |
| `public/app/plugins/datasource/grafana-testdata-datasource/components/SimulationQueryEditor.tsx` | Transitive from query editor | Static editor closure |
| `public/app/plugins/datasource/grafana-testdata-datasource/components/SimulationSchemaForm.tsx` | Transitive from query editor | Static editor closure |
| `public/app/plugins/datasource/grafana-testdata-datasource/components/StreamingClientEditor.tsx` | Transitive from query editor | Static editor closure |
| `public/app/plugins/datasource/grafana-testdata-datasource/components/USAQueryEditor.tsx` | Transitive from query editor | Static editor closure |
| `public/app/plugins/datasource/grafana-testdata-datasource/constants.ts` | Transitive | Runtime-capable shared constant |
| `public/app/plugins/datasource/grafana-testdata-datasource/dataquery.ts` | Transitive | Query types/defaults used by datasource |
| `public/app/plugins/datasource/grafana-testdata-datasource/datasource.ts` | Transitive from module | Real datasource class and backend query path |
| `public/app/plugins/datasource/grafana-testdata-datasource/metricTree.ts` | Transitive from datasource | Optional scenario closure; not exercised |
| `public/app/plugins/datasource/grafana-testdata-datasource/module.tsx` | Direct bridge entry | Datasource plugin construction and registration |
| `public/app/plugins/datasource/grafana-testdata-datasource/nodeGraphUtils.ts` | Transitive from datasource | Optional scenario closure; not exercised |
| `public/app/plugins/datasource/grafana-testdata-datasource/runStreams.ts` | Transitive from datasource | Optional streaming closure; not exercised |
| `public/app/plugins/datasource/grafana-testdata-datasource/testData/flameGraphResponse.ts` | Transitive from datasource | Optional fixture closure; not exercised |
| `public/app/plugins/datasource/grafana-testdata-datasource/testData/serviceMapResponse.ts` | Transitive | Optional fixture closure; not exercised |
| `public/app/plugins/datasource/grafana-testdata-datasource/testData/serviceMapResponseMedium.ts` | Transitive | Optional fixture closure; not exercised |
| `public/app/plugins/datasource/grafana-testdata-datasource/variables.ts` | Transitive from datasource | Runtime-capable variable support; controlled query does not use variables |

**VERIFIED FACT.** The source package is private, version 13.2.3, and does not
declare its own license field. Its build uses Grafana's plugin webpack
configuration, whose fallback copies the Grafana root `LICENSE` when a plugin
directory has no license. Phase 0 instead compiled this exact source through
the project POC build and did not use a server-distributed plugin bundle.

### 4.6 Exact compiled-package compatibility bridge

| Exact module | Package evidence | How it enters | Support/provenance classification |
| --- | --- | --- | --- |
| `@grafana/data/dist/esm/transformations/transformers/convertFieldType.mjs` | `@grafana/data@13.2.3`, Apache package evidence | Aliased through project bridge | Compiled deep module; exact-version, outside public export map |
| `@grafana/data/dist/esm/transformations/transformers/joinDataFrames.mjs` | Same | Aliased through project bridge | Compiled deep module; exact-version, outside public export map |
| `@grafana/data/dist/esm/field/fieldOverrides.mjs` | Same | Aliased through project bridge | Compiled deep module; exact-version, outside public export map |
| `packages/grafana-data/src/transformations/transformers/nulls/nullToUndefThreshold.ts` | Pinned Grafana source; path is in named Apache-2.0 directory | Source alias through bridge | Exact-version source fallback |
| `@grafana/ui/dist/esm/components/uPlot/utils.mjs` | `@grafana/ui@13.2.3`, Apache package evidence | Aliased through project bridge | Compiled deep module; exact-version, outside public export map |
| `@grafana/ui/dist/esm/components/uPlot/config/gradientFills.mjs` | Same | Aliased through project bridge | Compiled deep module; exact-version, outside public export map |
| `@grafana/ui/dist/esm/components/uPlot/PlotLegend.mjs` | Same | Aliased through project bridge | Compiled deep module; exact-version, outside public export map |
| `@grafana/ui/dist/esm/components/uPlot/plugins/TooltipPlugin2.mjs` | Same | Aliased through project bridge | Compiled deep module; exact-version, outside public export map |

**VERIFIED FACT.** Phase 0's final inspector reported zero unresolved
`@grafana/*/internal` imports because project-owned shims resolved the internal
contracts. That does not make the eight underlying deep modules public or
version-stable.

### 4.7 Inventory closure check

**VERIFIED FACT.** The final Phase 0 inspector evaluated 9,154 imports, 3,818
bundled modules, 148 chunks, and exactly 55 reviewed Grafana application-source
files. It found zero unauthorized application-source files, zero unresolved
Grafana internal-package modules, and zero SystemJS modules. This is the exact
successful source closure; it is not an estimate based on entrypoints.

## 5. Published package license table

The first seven rows are direct workspace dependencies. Faro is a transitive
runtime/UI dependency observed in the successful browser bundle.
`@grafana/scenes-react` is not declared, locked, installed, or bundled.

| Package | Exact version | Manifest / included license | Repository and source path | Named Grafana `LICENSING.md` exception? | POC browser bundle | Important peers and assets | Version/distribution implication | Evidence class |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `@grafana/data` | `13.2.3` | `Apache-2.0`; `LICENSE_APACHE2` | `grafana/grafana`, `packages/grafana-data` | Yes | Yes | React/DOM `>=19`; display/transform code | Exact cohort required; three compiled deep modules plus one source module are adapted | VERIFIED |
| `@grafana/ui` | `13.2.3` | `Apache-2.0`; `LICENSE_APACHE2` | `grafana/grafana`, `packages/grafana-ui` | Yes | Yes | React/DOM `>=19`; Emotion, uPlot, editor and overlay dependencies | Exact cohort required; four compiled deep uPlot modules are adapted; Monaco/Codicon closure emitted | VERIFIED |
| `@grafana/runtime` | `13.2.3` | `Apache-2.0`; `LICENSE_APACHE2` | `grafana/grafana`, `packages/grafana-runtime` | Yes | Yes | React/DOM `>=19`; Faro, RxJS | Module-level service singletons permit one compatible identity per realm in the POC | VERIFIED |
| `@grafana/schema` | `13.2.3` | `Apache-2.0`; `LICENSE_APACHE2` | `grafana/grafana`, `packages/grafana-schema` | No, not by directory name | Yes | No React peer; generated schema types | Package-local Apache evidence and repository list omission must be reconciled before release | VERIFIED facts; OPEN QUESTION interpretation |
| `@grafana/i18n` | `13.2.3` | `Apache-2.0`; `LICENSE_APACHE2` | `grafana/grafana`, `packages/grafana-i18n` | No, not by directory name | Yes | React `>=19`; i18next resources | Same evidence tension as Schema; exact resources/version coupled | VERIFIED facts; OPEN QUESTION interpretation |
| `@grafana/e2e-selectors` | `13.2.3` | `Apache-2.0`; `LICENSE_APACHE2` | `grafana/grafana`, `packages/grafana-e2e-selectors` | Yes | Yes | No React peer; selector modules appear transitively in bundle | Declared by both POC packages and bundled transitively | VERIFIED |
| `@grafana/scenes` | `8.13.5` | `Apache-2.0`; package `LICENSE` | Separate `grafana/scenes` repository, tag `v8.13.5` | Not applicable | Yes | Grafana packages `>=11.6`; React/DOM `^18`; Router `^6.28`; RxJS `^7.8.1` | Peer range conflicts with the proven React 19.2.8 combination; pin and test as a cohort | VERIFIED |
| `@grafana/faro-web-sdk` | `2.12.1` | `Apache-2.0`; package `LICENSE` | Separate `grafana/faro-web-sdk`, `packages/web-sdk` | Not applicable | Yes, transitive | Brings `@grafana/faro-core`; no POC telemetry initialization | Transitive modules appear in browser bundle through Runtime/UI | VERIFIED |
| `@grafana/faro-core` | `2.12.1` | `Apache-2.0`; package `LICENSE` | Separate `grafana/faro-web-sdk`, `packages/core` | Not applicable | Yes, transitive | OpenTelemetry-related dependencies | Transitive browser-bundle presence; not a project API | VERIFIED |

**VERIFIED FACT.** The six Grafana 13.2.3 npm artifacts record package
`gitHead` `8ea0d7e31a25f84c2b5a1c173070d8cde8740924`, while the release tag resolves
to `6193dc03311b631b9727b560d24369e683dc396e`. `@grafana/scenes@8.13.5`
records `gitHead` `9c247076dbb9aa2c2ae96d4b0dffc3ecedea0ac2`, matching its tag.

**VERIFIED FACT.** `@grafana/react-data-grid@7.0.0-beta.57` is installed as an
`@grafana/ui` dependency and declares MIT, but no module from it appears in the
final bundle evidence. It is therefore not part of the successful runtime
distribution closure. `@grafana/scenes-react` is absent entirely.

**INFERENCE.** Published packages with explicit package license files present a
substantially clearer distribution input than `public/app` source, but package
license and API stability are separate questions. Deep compiled paths,
`unstable` imports, global singletons, and exact cohort coupling still require a
bounded compatibility layer.

## 6. Grafana application-source license classification

### 6.1 Upstream facts

- **VERIFIED FACT.** Grafana v13.2.3 `LICENSING.md` says the repository default
  is AGPL-3.0-only and links the root AGPL license text.
- **VERIFIED FACT.** Its Apache-2.0 exception list does not include
  `public/app/core`, `public/app/features/panel`,
  `public/app/plugins/panel`, or
  `public/app/plugins/datasource/grafana-testdata-datasource`.
- **VERIFIED FACT.** None of the 55 exact files has a narrower SPDX/license
  header in its opening header, and no nested license/notice file was found in
  their relevant directories.
- **VERIFIED FACT.** `panelcfg.gen.ts` files state that they are generated from
  upstream CUE definitions but contain no separate license declaration.
- **VERIFIED FACT.** Grafana's root `NOTICE.md` contains Grafana Labs copyright
  and Kibana/Elasticsearch attribution.

Accordingly, this inventory records the 55 files as covered by the
repository's stated AGPL-3.0-only default. This is an upstream evidence
classification only.

### 6.2 Adaptation boundary

**VERIFIED FACT.** The POC does not patch the ignored Grafana checkout. Its
Time series P2 build redirects a fixed set of imports to project-owned adapters
and configures a new `PanelPlugin` around the upstream `TimeSeriesPanel`
component. Text, Stat, and TestData load exact source entrypoints. The emitted
browser JavaScript mechanically transforms and bundles those inputs.

**LEGAL QUESTION.** Counsel must determine whether each proposed artifact is a
copy, modification, derivative, aggregate, or other legally relevant form and
what obligations attach. Engineering terminology such as “adapter,” “bundle,”
or “separate package” does not decide that question.

### 6.3 Classification outcome

| Material | Upstream fact | Engineering consequence | Unresolved legal question |
| --- | --- | --- | --- |
| 55 `public/app` files | Repository default says AGPL-3.0-only; no exception found | Any distributing model must identify these exact inputs and outputs | Whether/how they may be combined and distributed with project code |
| P2 Time series artifact | Eight upstream application files plus project adapters | Modification/provenance ledger and reproducible source mapping are required | Obligations for adapted or linked output |
| Text/Stat/TestData source-built artifacts | Exact upstream entrypoints bundled with published packages | Bridge artifact is version-specific and contains upstream application code | Artifact license, corresponding source, notices, and distribution terms |
| Compiled Data/UI deep modules | Source paths are in named Apache-2.0 package directories | Track exact version and unsupported API use | Required notices and treatment of modifications/adapters |

No row states the license that the future SDK or bridge “must” use. That
decision is blocked on legal interpretation and on the project's own license
selection.

## 7. Asset and third-party inventory

### 7.1 Assets emitted by the successful POC

| Item | Exact evidence | Origin / version | Direct or transitive | Browser-build/runtime status | License evidence and review status |
| --- | --- | --- | --- | --- | --- |
| Codicon font | `assets/codicon-*.ttf`, 72,504 bytes raw | `monaco-editor@0.34.1` | Transitive through Text/TestData editor closure | Emitted; not requested in controlled view-only run | Monaco MIT license and `ThirdPartyNotices.txt`; Codicon-specific attribution review required |
| Monaco editor CSS | `editor-*.css`, 39,288 bytes | `monaco-editor@0.34.1` | Transitive/static editor closure | Emitted; editor not mounted in dashboard view | MIT package license plus third-party notices; inclusion process required if distributed |
| React Monaco CSS | `ReactMonacoEditor-*.css`, 42,432 bytes | Grafana UI editor closure | Transitive/static editor closure | Emitted; not required by view-only execution | Trace constituent modules and notices before distribution |
| Grafana/UI ESM CSS | `esm-*.css`, 6,738 bytes | Published UI closure | Transitive | Emitted and partly relevant to UI components | `@grafana/ui` Apache package evidence; provenance map required |
| Host/panel/uPlot CSS | `index-*.css`, 3,153 bytes; includes `uplot/dist/uPlot.min.css` and project scoped CSS | `uplot@1.6.32` plus project | Direct/transitive | Required for Time series plot and POC containment | uPlot MIT `LICENSE`; project CSS ownership separate |
| Monaco language chunks | Many language-specific JavaScript chunks | `monaco-editor@0.34.1` | Transitive/static editor closure | Emitted; not loaded for view-only rendering | MIT and third-party notices; major size-reduction target |

**VERIFIED FACT.** The final bundle evidence reports no emitted workers, WASM,
SVG, or raster-image assets. No separate `@vscode/codicons` package is installed;
the font and CSS enter through Monaco. `uplot@1.6.32` declares MIT and ships a
license file. `monaco-editor@0.34.1` declares MIT and ships both `LICENSE` and
`ThirdPartyNotices.txt`.

### 7.2 Assets observed only in a diagnostic mode

**VERIFIED FACT.** The full-reference-style diagnostic fetched Inter and Roboto
fonts from the Grafana server and altered host styling. The selected
`minimum-scoped` successful mode did not require those font requests. The fonts
are therefore not inputs to the selected POC distribution closure, but they
remain a review item if a future fidelity strategy chooses to ship or fetch
them.

### 7.3 Asset conclusions

**INFERENCE.** The Monaco/Codicon output is primarily a consequence of static
editor registration rather than dashboard viewing. Separating view renderers
from editor/configuration entrypoints is both a bundle-size and a notice-scope
priority.

**LEGAL QUESTION.** Counsel should confirm which package licenses,
third-party-notice entries, font attributions, and modification notices must
accompany each actual artifact. No asset is authorized for public distribution
by this inventory alone.

## 8. Current repository/distribution state

| Layer | Current state | Does this project redistribute Grafana application code? |
| --- | --- | --- |
| Tracked repository source | Project POC adapters, aliases, guards, tests, and provenance lists; no copied `public/app` source | No tracked copy was found |
| Ignored Grafana checkout | Clean v13.2.3 source under `.grafana-source/` | No; locally consumed and ignored |
| `packages/poc-grafana-bridge` | Private `0.0.0-poc`; project-owned loader/adaptation/provenance code; marked “never publish” | Source package itself does not contain copied Grafana application source |
| Generated local POC bundles | Ignored `apps/poc-host/dist/` output includes compiled `public/app` modules and assets | Locally generated, yes in the bundle; not tracked or published |
| Test/browser artifacts | Ignored evidence under `artifacts/`, `test-results/`, and Playwright output | Evidence is ignored and sanitized |
| Published npm artifacts | None; root and all POC workspaces are private | No |
| Project license | Placeholder explicitly grants no permission; an open-source license is not yet selected | Project licensing is unresolved; `LICENSE` is unchanged |

**VERIFIED FACT.** `.gitignore` excludes `.grafana-source/`, general `dist/`
output, artifacts, Playwright output, and dependency stores. `git ls-files`
contains no ignored Grafana checkout or generated browser bundle. The tracked
bridge compiles from a user/developer's local pinned checkout during the POC.

**INFERENCE.** Current repository-source distribution is materially different
from publishing an npm artifact that embeds compiled Grafana application
modules. It is also different from giving users tooling that creates such an
artifact. Each proposed state needs an explicit review rather than inheriting
the POC's local-only status.

## 9. Candidate distribution architectures

### Model A — application-derived renderers in the main SDK package

**Classification: DISTRIBUTION-RISKY / LEGAL REVIEW REQUIRED.**

The main npm package would include the core component API, compatibility
runtime, and compiled Text/Stat/Time series/TestData application closure.

- **Technical feasibility:** High for the proven version because Phase 0 built
  and ran this shape locally. It would preserve the closest proven visual and
  query fidelity.
- **Mechanics:** One install and one browser build, with normal npm delivery and
  host bundling. Static imports currently pull a large editor/Monaco closure.
- **Coupling/maintenance:** The whole SDK release becomes tied to Grafana
  13.2.3 application internals, eight deep package modules, Scenes 8.13.5, and
  React 19.2.8. Every Grafana upgrade requires source-diff, bundle, provenance,
  and compatibility testing.
- **Operations/security:** No new runtime CORS/CSP dependency beyond Grafana API
  access. Browser cache invalidation follows the SDK artifact.
- **Distribution concern:** The permissive/public core and the identified
  repository-default application code would be inseparable in one artifact.
- **LEGAL QUESTION:** What artifact license, source availability, notices, and
  other obligations would result?

### Model B — separate public SDK and versioned Grafana bridge artifact

**Classification: TECHNICALLY PREFERRED; LEGAL REVIEW REQUIRED BEFORE PUBLIC
DISTRIBUTION.**

The core SDK would define host-facing APIs and a renderer-provider contract.
A separate bridge artifact would contain the exact Grafana-version-specific
panel/datasource code, package adapters, assets, and provenance manifest.

- **Technical feasibility:** High for the internal architecture; Phase 0
  already isolates application-source interaction in `poc-grafana-bridge`.
- **Mechanics:** Core and bridge packages can version independently, while an
  explicit compatibility manifest rejects mismatched Grafana/Scenes/React
  cohorts. Dynamic import can keep bridge chunks out of applications that do
  not render dashboards.
- **Coupling/maintenance:** Exact coupling remains but is localized. Each bridge
  version still needs full source/asset review and compatibility tests.
- **Bundle/cache:** Separate chunks improve caching and make view-only
  entrypoints feasible, but do not automatically remove Monaco/editor code.
- **Host complexity:** Moderate; the host selects or receives a compatible
  provider, while the core API remains small.
- **Distribution concern:** Moving application-derived code to another package
  changes architecture and provenance visibility; it does not itself answer
  licensing obligations.
- **LEGAL QUESTION:** Does separation change any obligation or permissible
  licensing arrangement, and what must accompany the bridge?

### Model C — distribute tooling; users build the bridge locally

**Classification: VIABLE WITH SIGNIFICANT TRADE-OFFS.**

The project would publish only project-owned core/tooling. A user would supply
an exact Grafana source checkout and generate the bridge locally.

- **Technical feasibility:** Demonstrated in development: the POC verifies a
  clean pinned commit and compiles from the ignored checkout.
- **Mechanics:** Requires Git/source acquisition, Node/build tools, reproducible
  patch/alias rules, source-integrity checks, and local artifact hosting.
- **Fidelity/coupling:** Retains real renderers and exact version behavior.
- **Operations/security:** Considerable supply-chain and support complexity;
  users must verify source, build output, notices, and compatible server/API
  identity. Cache sharing is deployment-specific.
- **Product impact:** Poor “small host contract” ergonomics and difficult
  browser-app deployment, but useful as an internal/reference path.
- **LEGAL QUESTION:** What obligations apply to distributing the build tooling,
  recipes, patches/adapters, and any generated artifact, even when this project
  does not ship the upstream source or output?

### Model D — dynamically load compatible modules from the Grafana server

**Classification: EXPERIMENT REQUIRED.**

The core/bridge loader would discover and load the target server's own built-in
panel/datasource browser assets rather than redistributing them in npm.

- **Technical feasibility:** Unproven. The source shows a plausible asset path,
  but not a stable standalone contract. Built-in panels are application webpack
  chunks, while TestData is built as a plugin module with different loading
  mechanics.
- **Fidelity/versioning:** Potentially strongest alignment with the running
  server if exact asset identity can be discovered and shared dependencies can
  be satisfied without the shell.
- **Operations:** Requires same-origin or carefully configured CORS, credentials,
  CSP, cache/SRI handling, public-path resolution, error isolation, and an
  explicit supported-server protocol.
- **Security:** Loading executable code from the configured Grafana origin is a
  materially stronger trust relationship than making data/API requests.
- **LEGAL QUESTION:** What implications follow when this project does not
  redistribute the module but causes a browser to load and combine it at
  runtime?

### Model E — published packages plus independently implemented rendering boundary

**Classification: REJECTED BECAUSE IT BREAKS PRODUCT GOALS for the currently
proven panels; retain as a targeted source-reduction research direction.**

This model would avoid `public/app` distribution by rebuilding the missing
renderers/conversion/runtime behavior from published package APIs and
project-owned code.

- **Technical feasibility:** Published packages provide data, contracts,
  components, Scenes, and runtime APIs, but not the proven built-in Text, Stat,
  and Time series `PanelPlugin` implementations or the TestData frontend module.
- **Fidelity:** Reimplementing panels would no longer be reuse of the real
  Grafana visualization behavior proven in Phase 0. It risks persistent visual
  and behavioral drift.
- **Maintenance:** Large independent implementation and compatibility-test
  burden; fewer application-source distribution questions do not remove API,
  asset, or trademark review.
- **Narrow opportunity:** Replace static editor registration and individual
  internal helpers with published APIs when possible, without replacing the
  actual renderer. That is a source-reduction task, not full Model E.

### Model F — host-supplied version-matched renderer provider

**Classification: TECHNICALLY VIABLE.**

The core SDK would require the host to provide a renderer/datasource bridge
implementing a documented provider contract. This project could test compatible
providers without necessarily distributing one.

- **Technical feasibility:** The existing closed catalogue, runtime lease, and
  bridge boundary are a credible precursor to such a contract.
- **Fidelity:** Depends on the provider. A provider built from the Phase 0
  closure preserves fidelity; another implementation may not.
- **Mechanics:** Keeps the core independent but moves compatibility selection,
  loading, and possibly build/distribution work to the host or another party.
- **Versioning:** Provider metadata can declare exact Grafana, package, React,
  and feature compatibility. The SDK must fail closed on mismatches.
- **Operations:** Higher host integration burden and potential provider
  fragmentation; strong conformance tests are required.
- **LEGAL QUESTION:** Each provider's distributor must evaluate its own source
  and artifact. The core contract does not answer the provider's obligations.

## 10. Technical comparison matrix

| Model | Fidelity to real Grafana | Distribution mechanics | Version/upgrade burden | Bundle/cache | Host/operations | Source redistribution by this project | Security/CORS | Required testing | Overall classification |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A: one SDK artifact | Proven high for fixture | Simplest install; monolithic artifact | Highest coupling in core release | Current bundle very large; ordinary npm caching | Low host complexity | Yes, if published as proven | API access only | Full closure per release | DISTRIBUTION-RISKY / LEGAL REVIEW REQUIRED |
| B: core + bridge | Proven high for bridge | Separate packages/chunks and manifests | High but localized per bridge | Can split/cache and prune view entrypoints | Moderate | Yes for an official published bridge | API access only | Core contract + bridge matrix | TECHNICALLY PREFERRED; LEGAL REVIEW REQUIRED |
| C: local build | Proven high for generated result | Tooling and user source/build pipeline | Shared with each user/deployment | Deployment-specific | Very high | Not upstream source/output directly, assuming tooling-only distribution | API access only | Reproducibility and source-integrity tests | VIABLE WITH SIGNIFICANT TRADE-OFFS |
| D: server-hosted | Potentially exact; unproven standalone | Runtime discovery/import | Server-aligned but loader-sensitive | Server caching could be strong | High deployment/CSP/CORS complexity | No module bytes in npm; browser retrieves server copy | Executable cross-origin code risk | Concrete loader experiment and matrix | EXPERIMENT REQUIRED |
| E: independent renderer | Low/unknown versus real panels | Normal permissive package path | Independent reimplementation burden | Potentially smallest | Low-to-moderate | Avoids identified app source | API access only | Extensive visual/behavioral parity | REJECTED BECAUSE IT BREAKS PRODUCT GOALS |
| F: host provider | Provider-dependent | Core + host-selected provider | Localized but ecosystem-fragmented | Provider-dependent | High host responsibility | Core: no; official provider: depends | Provider-dependent | Provider conformance suite | TECHNICALLY VIABLE |

**INFERENCE.** Models B and F compose well: use F as the core architectural
contract and B as a possible first-party, separately versioned implementation
only after legal approval. Model C can keep internal research reproducible while
that approval is pending. Model D could become another F provider if its
experiment succeeds.

## 11. Server-hosted module feasibility analysis

### 11.1 What the pinned source proves

- **VERIFIED FACT.** `built_in_plugins.ts` maps paths such as
  `core:plugin/text`, `core:plugin/stat`, and `core:plugin/timeseries` to webpack
  dynamic imports of application source.
- **VERIFIED FACT.** Grafana's application webpack output uses
  `public/build/`, named entry chunks, and content-hashed dynamic chunk names.
  Production builds emit `assets-manifest.json` and a separate manifest.
- **VERIFIED FACT.** `importPluginModule` detects built-in paths and dispatches
  through the compile-time built-in map. Non-built-in modules are loaded by
  SystemJS after path resolution, optional SRI mapping, translation setup, and
  optional sandbox selection.
- **VERIFIED FACT.** `pluginImporter` adds metadata, error handling, cache
  behavior, datasource legacy-export adaptation, and app-extension registry
  integration. It imports unpublished application utilities.
- **VERIFIED FACT.** `GrafanaApp.init` calls `initSystemJSHooks`; Phase 0 neither
  called `GrafanaApp.init` nor included SystemJS modules.
- **VERIFIED FACT.** The TestData source is a private core datasource package
  built with Grafana's plugin webpack config. That config produces an AMD
  library at `public/plugins/grafana-testdata-datasource/`, externalizes Grafana,
  React, RxJS, and other shared packages, and resolves its public path from
  loader metadata. This differs from built-in panel chunks in `public/build/`.

### 11.2 What is not established

No pinned public contract was found that lets an independent host ask a Grafana
server for a stable Text/Stat/Time series module URL and import it without the
application webpack runtime, built-in map, shared dependency environment, or
application plugin importer. Content hashes make direct built-in chunk names
build-specific. Availability of a server-side asset manifest to an authenticated
browser SDK, and its suitability as a supported discovery API, is unproven.

The conventional `/public/plugins/{id}/module.js` shape is stronger evidence
for TestData and external plugins, but its AMD/SystemJS externals assume
Grafana's shared module environment. Phase 0 did not prove that environment can
be reproduced narrowly without importing shell-owned loader code.

Authentication cookies may accompany same-origin/subpath requests. Cross-origin
module/script loading additionally depends on Grafana CORS, cookie `SameSite`,
CSP `script-src`, SRI, and host CSP. API access permission does not by itself
prove permission or browser capability to execute module assets.

### 11.3 Required experiment

**TECHNICAL RECOMMENDATION — EXPERIMENT REQUIRED.** Run a separate bounded
Phase 1 experiment before selecting Model D:

1. Start the exact pinned server image and capture sanitized network/module
   metadata when its own UI loads Text, Stat, Time series, and TestData.
2. Map built-in panel requests to `assets-manifest.json`, webpack runtime
   chunks, content hashes, and `core:plugin/*` metadata; separately map
   TestData's `/public/plugins/grafana-testdata-datasource/module.js` flow.
3. Determine whether an authenticated browser can discover exact asset identity
   using a supported endpoint, not filesystem knowledge.
4. Inspect the delivered module format and required shared imports/import maps,
   translations, CSS, images/fonts, public paths, module hashes, and webpack
   runtime.
5. In an isolated host, attempt a single Text module load with the existing
   explicit Runtime foundation. Do not call `GrafanaApp.init`, install the route
   tree, or use an unrestricted SystemJS fallback.
6. Test same-origin/subpath and intentionally cross-origin deployments for
   cookies, CORS, CSP, SRI, redirects, cache invalidation, and error isolation.
7. Reject the model if supported discovery is absent, the shell/route tree is
   required, shared packages create a second React/runtime identity, or cleanup
   cannot be bounded.

### 11.4 Conclusion

**Server-hosted module feasibility: EXPERIMENT REQUIRED.** The server emits the
relevant JavaScript, but source evidence does not establish a stable,
standalone, supported loading contract. Built-in panels and TestData also use
different build/loading models. Model D must not be assumed feasible or used as
a licensing shortcut.

## 12. Network interaction versus source distribution distinction

| Scenario | Technical behavior | Grafana-derived code redistributed by this project? | Known evidence | Legal interpretation still required |
| --- | --- | --- | --- | --- |
| A. HTTP API requests | Browser calls dashboard, datasource, and query endpoints using host-owned auth | No application-module redistribution merely from the request path | Phase 0 proved UID retrieval and `/api/ds/query` through host proxy | Any service terms/deployment-specific obligations; not analyzed here |
| B. Distribute application-source code | npm/browser artifact contains compiled 55-file closure | Yes, under the contemplated proven bundle | Exact source and asset inventory above | Artifact licensing, source, notice, modification, and compatibility obligations |
| C. Dynamically load Grafana-served JS | Browser retrieves executable module/chunks from configured Grafana server | Module bytes are served by Grafana deployment, not npm artifact | Loader/build paths exist; standalone viability unproven | Whether runtime combination/loading changes obligations; deployment authority |
| D. Adapt/modify application source | Build redirects imports and composes upstream renderer with project adapters | A distributed output would contain transformed upstream application code | P2 Time series path proved technically | Status and obligations of adaptations/combined work |
| E. User-local bridge build | Tool consumes user's checkout and emits local bridge | Tooling may avoid shipping upstream input/output; user creates output | Phase 0 build pattern is reproducible locally | Tool/recipe/patch obligations and user's generated artifact responsibilities |

**LEGAL QUESTION.** These scenarios must not be treated as legally equivalent.
Counsel should analyze the actual distribution and execution flow selected by
architecture, not only the package names involved.

## 13. LICENSE, NOTICE, attribution, and source-provenance analysis

| Topic | Upstream/current evidence | Classification | Required decision/process |
| --- | --- | --- | --- |
| Grafana root license | v13.2.3 includes AGPL-3.0-only text and `LICENSING.md` assigns it as repository default | DIRECTLY STATED BY UPSTREAM | Counsel maps the text to each proposed artifact and service model |
| Apache package license copies | Named package directories and installed artifacts include `LICENSE_APACHE2` or `LICENSE` | DIRECTLY STATED BY UPSTREAM | Preserve artifact-level license inventory; counsel confirms accompanying materials |
| Grafana NOTICE | Root notice attributes Grafana Labs and Kibana/Elasticsearch basis | DIRECTLY STATED BY UPSTREAM | Determine whether/how it accompanies each bridge/source distribution |
| Package NOTICE files | Not every inspected published package supplies a separate NOTICE | UNKNOWN | Generate from actual artifact inputs, not assumption |
| Modification notices | P2 replaces exact application integrations with project adapters; builds transform TS/TSX | LIKELY RELEVANT — LEGAL REVIEW REQUIRED | Record every changed/replaced import and generated output |
| Source provenance | Clean commit check, exact 55-file allowlist, eight deep modules, bundle graph | LIKELY RELEVANT — LEGAL REVIEW REQUIRED | Make provenance manifest reproducible for every candidate bridge build |
| Corresponding/source availability | Pinned upstream source and project adapters are identifiable; npm delivery design absent | LIKELY RELEVANT — LEGAL REVIEW REQUIRED | Counsel defines source-delivery requirements before public artifact design |
| Third-party licenses | Monaco and uPlot ship license files; Monaco ships third-party notices | DIRECTLY STATED BY UPSTREAM PACKAGES | Build an artifact-specific third-party report and retain notice texts |
| Codicon font | Emitted from Monaco's CSS/package closure | LIKELY RELEVANT — LEGAL REVIEW REQUIRED | Trace the precise entry in Monaco notices and required attribution |
| Inter/Roboto fonts | Only diagnostic server requests; not in selected emitted closure | NOT APPLICABLE TO CURRENT DISTRIBUTION STATE | Reopen if fonts are bundled or deliberately fetched for production fidelity |
| Grafana SVG/icon directories | No SVG/image asset emitted by the successful build | NOT APPLICABLE TO CURRENT DISTRIBUTION STATE | Reopen per future panel/asset closure |
| Monaco workers | Bundle evidence reports no workers emitted | NOT APPLICABLE TO CURRENT DISTRIBUTION STATE | Reopen if editor functionality is supported |
| Generated panel config | Two emitted generated source files identify upstream CUE provenance | LIKELY RELEVANT — LEGAL REVIEW REQUIRED | Retain generated-source path and generator provenance |
| Project license | Current `LICENSE` is a no-permission placeholder, so no release-license compatibility decision exists yet | UNKNOWN | Select only after architecture/counsel decisions; unchanged by this workstream |

**VERIFIED FACT.** The Apache license files themselves state redistribution
conditions including providing the license, marking modified files, retaining
applicable notices, and handling a NOTICE file when one is part of the work.
The AGPL text itself contains provisions concerning conveying and network use.
This document does not decide when those provisions apply to this project.

**TECHNICAL RECOMMENDATION.** Before any releasable bridge exists, make its
build output a closed, reproducible software bill of materials containing:
upstream repository/tag/commit, npm versions and lock checksums, exact source
paths, adapters/replacements, emitted chunks/assets, license-file identities,
notice inputs, source maps, and an unexplained-module failure gate.

## 14. Trademark boundary

Trademark and software-license review are separate.

**VERIFIED FACT.** The project presently uses “Grafana React SDK” in its
repository/project name and describes compatibility with Grafana OSS. It has an
independence disclaimer in project documentation and does not use a Grafana
logo in the successful POC asset inventory.

**VERIFIED FACT.** Grafana Labs publishes a current
[`Trademark Usage Policy`](https://grafana.com/trademark-policy/) that addresses
use of its text marks, product/service names, logos, attribution, affiliation,
and compatibility contexts. The policy includes restrictions relevant to using
the mark as part of a product/service name and supplies requested attribution
language. The policy may change and is not interpreted here.

**INFERENCE.** Compatibility wording such as “for Grafana OSS 13.2.3” or
“Grafana-compatible” can describe the technical target more clearly than
wording that implies an official Grafana Labs product, but wording alone does
not resolve trademark permission.

**LEGAL QUESTIONS.** Counsel should review:

- whether “Grafana React SDK” is acceptable as repository, project, and future
  npm package naming;
- whether the present independence disclaimer and mark attribution are
  sufficient and correctly placed;
- whether package scopes, descriptions, screenshots, comparison images, and
  phrases such as “Grafana-compatible” require additional permission or
  qualification;
- whether any future use of Grafana logos, panel screenshots, icons, or other
  brand assets is permitted; and
- whether written permission should be requested before Phase 2 naming and
  publication decisions.

No branding change is made by this document.

## 15. Legal-review questions

Qualified counsel should receive the exact inventory and answer these
architecture-specific questions before any public distribution decision:

1. Can an otherwise permissively licensed SDK npm artifact embed the exact
   repository-default AGPL-covered Grafana application modules identified by
   this POC, and what distribution, licensing, source-availability, or other
   obligations would result?
2. Does distributing that Grafana-derived application code in a separate,
   versioned bridge artifact materially change applicable obligations or the
   permissible license relationship between core and bridge?
3. What obligations apply if users generate the bridge locally from their own
   clean Grafana checkout rather than receiving upstream application source or
   compiled renderer output from this project?
4. What are the implications of dynamically loading Grafana-served frontend
   modules at runtime rather than redistributing them in an npm artifact?
5. Which Grafana license, NOTICE, copyright, source, modification, and
   attribution materials must accompany a distributed bridge?
6. What obligations attach to the P2 Time series build, which compiles upstream
   renderer source while redirecting selected application integrations to
   project-owned adapters?
7. What obligations apply to Monaco editor CSS/chunks, the Codicon font,
   uPlot CSS/code, any future Inter/Roboto fonts, and other third-party assets
   in the actual artifact?
8. Is “Grafana React SDK” acceptable for the repository, project, and future
   package names under Grafana Labs' current trademark policy, and what
   disclaimer/attribution or permission is required?
9. How should the `@grafana/schema` and `@grafana/i18n` package manifests and
   package-local `LICENSE_APACHE2` files be reconciled with their omission from
   the v13.2.3 repository-wide Apache exception list?
10. What license may this project's own core SDK use, and what compatibility
    constraints would apply between it and each bridge model?
11. Does distributing only source-build recipes, alias maps, or patch/adaptation
    instructions create obligations different from distributing the generated
    bridge?
12. What review is required if a future bridge includes source maps or source
    text for the identified application modules?

This document intentionally does not answer those questions beyond the cited
upstream facts.

## 16. Technical recommendation

### 16.1 Technical recommendation

**TECHNICAL RECOMMENDATION — MEDIUM confidence.** Adopt a provider-oriented
architecture that combines Models B and F:

1. Keep the future public core SDK small and host-facing. It owns dashboard UID
   orchestration, typed errors/lifecycle, and a renderer-provider interface, not
   Grafana application source.
2. Define an explicit bridge manifest containing exact Grafana server/source
   version, package cohort, Scenes/React requirements, supported panels and
   datasources, transformations, singleton scope, assets, and provenance.
3. Implement the first compatible provider as a separately versioned bridge,
   internally at first, using the exact Phase 0 closure as the reference.
4. Split view-only panel/datasource runtime entrypoints from editor/configuration
   entrypoints to remove Monaco and optional TestData scenario closure wherever
   the real renderer contract permits.
5. Fail closed on version/feature mismatch. Do not allow a provider compiled for
   one exact Grafana baseline to claim broad server compatibility.
6. Maintain Model C as a reproducible internal/local-build path until public
   distribution is legally approved.
7. Run the Model D server-hosted-module experiment in parallel. If it succeeds,
   implement it as another provider, not as implicit behavior in the core SDK.

**Why confidence is MEDIUM:** the rendering/query architecture and current
bridge boundary are proven, so the separation is technically credible. Public
artifact composition, editor-tree reduction, multiple Grafana versions,
server-hosted module loading, and legal approval are not proven.

### 16.2 Second choice

**TECHNICAL RECOMMENDATION — MEDIUM confidence.** If this project cannot
publish a first-party bridge, retain Model F and require hosts or independent
providers to supply a conforming adapter. This protects the core API and product
direction but increases host complexity and makes conformance governance vital.

### 16.3 Rejected or conditional choices

- Model A is technically workable but should not be selected before counsel and
  bundle-size analysis; it unnecessarily couples the core package to every
  application-source and asset decision.
- Model C is suitable for internal/research continuity, not the preferred user
  experience.
- Model D requires the exact experiment in Section 11.
- Full Model E is rejected for the proven panels because replacing real Grafana
  renderers defeats the fidelity objective. Selective removal of editor or
  internal-helper dependencies remains encouraged.

### 16.4 Legal approval required

**LEGAL APPROVAL REQUIRED.** The technical recommendation does not authorize:

- publishing, sharing, or attaching a bridge bundle that contains the 55-file
  application closure;
- choosing a license for the core or bridge;
- claiming that separating packages changes AGPL obligations;
- distributing modified/adapted application outputs, source maps, or notices;
- relying on local-build or server-hosted loading as a legal workaround; or
- finalizing project/package branding.

## 17. Legal-approval dependencies

| Decision | Technical prerequisite | Legal/brand approval needed | Current state |
| --- | --- | --- | --- |
| Core SDK license | Provider boundary and dependency inventory | License compatibility for intended package | Blocked |
| Official bridge artifact | Exact source/asset SBOM and reproducible build | Application-source distribution, source, notices, modifications | Blocked |
| Separate bridge license | Artifact boundary | Whether separation changes obligations; acceptable license | Blocked |
| Public local-build tooling | Clean-room scope for tooling/recipes | Tooling and generated-output implications | Blocked before publication; internal work allowed |
| Server-hosted provider | Section 11 experiment | Runtime-loading implications and deployment authority | Technical experiment first, then counsel |
| Asset packaging | View-only closure reduction and asset manifest | Monaco/Codicon/uPlot/font notices and permissions | Blocked for release |
| Project/package name | Candidate package/repository descriptions | Trademark policy/permission review | Blocked for Phase 2 publication |
| Schema/i18n package reliance | Exact package artifacts recorded | Resolve repository list/package-local license evidence | Counsel confirmation required |

## 18. Unblocked, blocked, and experiment-required Phase 1 work

### 18.1 Unblocked engineering work

The following work does not require selecting a public distribution license or
shipping application-derived code:

- specify the project-owned renderer-provider and compatibility-manifest
  interfaces without copying upstream source;
- extract exact-version/runtime/singleton requirements from the POC into
  internal architecture documents and conformance tests;
- improve source, dependency, asset, license-file, notice, and bundle provenance
  automation against ignored local builds;
- split and measure view-only versus editor/configuration closures locally;
- define failure-closed compatibility negotiation and version-matrix tests;
- design runtime ownership/isolation and styling-containment experiments;
- evaluate published-API replacements for individual deep modules without
  replacing the real visualization; and
- prepare counsel's evidence packet from this document and generated SBOMs.

### 18.2 Blocked pending legal review

- choosing or changing the repository/core/bridge license;
- publishing, distributing, attaching to releases, or checking in a bridge
  bundle containing Grafana application modules;
- deciding that Model A or B has acceptable license/source/notice terms;
- advertising an official supported renderer package based on that closure;
- publishing local-build tooling whose legal boundary has not been reviewed;
- distributing Monaco/Codicon/font assets without an artifact-specific review;
  and
- final package naming/branding that uses Grafana marks.

### 18.3 Experiment required

- the server-hosted module experiment in Section 11;
- view-only entrypoint/tree-shaking experiments to remove Monaco/editor and
  unused TestData scenarios;
- replacement feasibility for each unsupported Data/UI deep import;
- runtime isolation beyond one compatible identity per JavaScript realm; and
- compatibility probes for every proposed Grafana/Scenes/React cohort beyond
  the exact Phase 0 baseline.

### 18.4 Do not change yet

Until the relevant Phase 1 decisions are approved:

- keep the Phase 0 POC private, disposable, and exact-version pinned;
- keep `.grafana-source/` and generated bundles ignored;
- keep the 55-file allowlist closed and fail on additions;
- keep public packages and deep-module adapters at their exact proven versions;
- do not broaden panels, datasources, transformations, V2, or Grafana versions;
- do not weaken the no-shell, no-iframe, one-React-runtime constraints; and
- do not recast the POC bridge as production SDK architecture.

### 18.5 Phase 1 issue routing

| Phase 1 work | Routing after this document |
| --- | --- |
| `[Phase 1] Define Grafana source licensing and distribution strategy` | Ready for maintainer review; may close after human acceptance if counsel follow-ups are tracked separately |
| `[Phase 1] Productize the bounded Grafana rendering bridge` | May start only with the boundary in Section 19 |
| Any issue that publishes or chooses the license for a bridge/core artifact | Blocked pending qualified legal review |
| Server-hosted panel/datasource loading | Requires the Section 11 technical experiment before an architecture decision |
| Provenance, bundle reduction, version contracts, runtime isolation, and style containment | May proceed as internal, non-distributed engineering/research |

## 19. Bridge-productization start decision

**Decision: YES, BUT ONLY FOR LICENSE-NEUTRAL INTERNAL ARCHITECTURE WORK.**

The Phase 1 issue `[Phase 1] Productize the bounded Grafana rendering bridge`
may begin only within this boundary:

- allowed: provider interfaces, compatibility metadata, internal module
  boundaries, reproducible local builds, closed provenance/SBOM automation,
  conformance tests, bundle reduction, and non-distributed experiments;
- not allowed: public bridge artifacts, release attachments, npm publication,
  final bridge licensing, or an architecture decision that presumes permission
  to redistribute the application-source closure.

The implementation should preserve replaceability among Model B, a host-supplied
Model F provider, and a possible future Model D provider. Human reviewers must
stop the workstream before its first distributable artifact until counsel has
answered the applicable questions in Section 15.

## 20. Final status

**PROCEED WITH LEGAL REVIEW**

The core technical direction is sufficiently defined to continue Phase 1
internal architecture work. The preferred production shape is a small core plus
an explicit versioned provider boundary, with a separate bridge as the leading
implementation candidate. The exact Phase 0 application-source closure is
known, controlled, and technically successful, but its public distribution is
not approved. Model D remains an experiment, not a fallback assumption.

### Decision record

| Question | Answer |
| --- | --- |
| Did native rendering fail? | No. Phase 0 Gate C passed; overall Phase 0 remained REVISE for production architecture |
| Is the successful app-source closure exact? | Yes: 55 files, eight deep/source package adapters, and enumerated assets |
| Preferred technical architecture | Models B + F: separate versioned bridge behind a provider contract |
| Recommendation confidence | MEDIUM |
| Can a public bridge be published now? | No; legal approval and artifact-specific compliance design are required |
| Can bridge productization begin? | YES, BUT ONLY FOR LICENSE-NEUTRAL INTERNAL ARCHITECTURE WORK |
| Is server-hosted loading selected? | No; EXPERIMENT REQUIRED |
| Is this a legal conclusion? | No |

### Upstream reference index

- Grafana v13.2.3
  [release](https://github.com/grafana/grafana/releases/tag/v13.2.3) and
  [source commit](https://github.com/grafana/grafana/commit/6193dc03311b631b9727b560d24369e683dc396e).
- Grafana
  [`LICENSING.md`](https://github.com/grafana/grafana/blob/v13.2.3/LICENSING.md),
  [`LICENSE`](https://github.com/grafana/grafana/blob/v13.2.3/LICENSE), and
  [`NOTICE.md`](https://github.com/grafana/grafana/blob/v13.2.3/NOTICE.md).
- Published package manifests:
  [`data`](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-data/package.json),
  [`ui`](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-ui/package.json),
  [`runtime`](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-runtime/package.json),
  [`schema`](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-schema/package.json),
  [`i18n`](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-i18n/package.json), and
  [`e2e-selectors`](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-e2e-selectors/package.json).
- Scenes v8.13.5
  [`package.json`](https://github.com/grafana/scenes/blob/v8.13.5/package.json)
  and [`LICENSE`](https://github.com/grafana/scenes/blob/v8.13.5/LICENSE).
- Grafana plugin loading:
  [`built_in_plugins.ts`](https://github.com/grafana/grafana/blob/v13.2.3/public/app/features/plugins/built_in_plugins.ts),
  [`importPluginModule.ts`](https://github.com/grafana/grafana/blob/v13.2.3/public/app/features/plugins/importer/importPluginModule.ts),
  [`pluginImporter.ts`](https://github.com/grafana/grafana/blob/v13.2.3/public/app/features/plugins/importer/pluginImporter.ts), and
  [`systemjsHooks.ts`](https://github.com/grafana/grafana/blob/v13.2.3/public/app/features/plugins/loader/systemjsHooks.ts).
- Build/public-path evidence:
  [`webpack.common.ts`](https://github.com/grafana/grafana/blob/v13.2.3/scripts/webpack/webpack.common.ts),
  [`webpack.prod.ts`](https://github.com/grafana/grafana/blob/v13.2.3/scripts/webpack/webpack.prod.ts),
  and [`@grafana/plugin-configs` webpack configuration](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-plugin-configs/webpack.config.ts).
- TestData source package:
  [`package.json`](https://github.com/grafana/grafana/blob/v13.2.3/public/app/plugins/datasource/grafana-testdata-datasource/package.json),
  [`plugin.json`](https://github.com/grafana/grafana/blob/v13.2.3/public/app/plugins/datasource/grafana-testdata-datasource/plugin.json), and
  [`webpack.config.ts`](https://github.com/grafana/grafana/blob/v13.2.3/public/app/plugins/datasource/grafana-testdata-datasource/webpack.config.ts).
- Grafana Labs
  [`Trademark Usage Policy`](https://grafana.com/trademark-policy/).
