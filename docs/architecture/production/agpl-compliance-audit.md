# AGPL-3.0 Compliance and Third-Party Distribution Audit

## 1. Document metadata

| Field | Value |
| --- | --- |
| Owner | Project maintainer |
| Phase | Phase 1 — Production Architecture and Distribution Strategy |
| Workstream | AGPL compliance audit |
| GitHub issue | `#21` — Verify AGPL-3.0 compliance and third-party distribution requirements |
| Status | Audit |
| Created | 2026-10-18 |
| Last Updated | 2026-10-18 |
| Grafana source baseline | OSS `v13.2.3`, commit `6193dc03311b631b9727b560d24369e683dc396e` |

## 2. Scope / not legal advice

This is an engineering compliance audit, not legal advice. It answers a
bounded practical question: if project-owned code is released under
`AGPL-3.0-only`, what license, notice, source, provenance, asset, package, and
naming work remains before public source or package distribution?

The following labels are intentionally distinct:

- **VERIFIED FACT** — directly supported by repository evidence, an exact
  artifact, or cited primary upstream material.
- **COMPLIANCE ACTION** — a conservative engineering or release-control step;
  it is not a legal conclusion.
- **LEGAL QUESTION** — a matter requiring the maintainer's rights confirmation
  or qualified legal advice.
- **TRADEMARK QUESTION** — a naming or mark-use matter separate from software
  copyright licensing.

Project-owned code may be licensed by its rights holder. Grafana-derived code
and every other third-party component retain their applicable upstream terms.
An AGPL project declaration does not relicense those components or replace
their license texts, copyright notices, or attributions.

Primary evidence used here includes Grafana v13.2.3
[`LICENSING.md`](https://github.com/grafana/grafana/blob/v13.2.3/LICENSING.md),
[`LICENSE`](https://github.com/grafana/grafana/blob/v13.2.3/LICENSE), and
[`NOTICE.md`](https://github.com/grafana/grafana/blob/v13.2.3/NOTICE.md);
package-local manifests and license files; the
[`@grafana/scenes` 8.13.5 license](https://github.com/grafana/scenes/blob/v8.13.5/LICENSE);
the official [Apache 2.0/GPL compatibility guidance](https://www.apache.org/licenses/GPL-compatibility.html);
the GNU project's [license list](https://www.gnu.org/licenses/license-list.html);
and Grafana Labs' [Trademark Usage Policy](https://grafana.com/trademark-policy/).

The repository evidence map is the
[Phase 0 result](../research/poc-results.md),
[licensing/distribution strategy](licensing-distribution-strategy.md),
[complete-project AGPL evaluation](agpl-project-license-evaluation.md),
[legal-review packet](legal-review-packet.md),
[provider architecture](bridge-provider-architecture.md),
[bundle strategy](bundle-dependency-strategy.md), and the
[React-externalized provider](experiments/react-externalized-provider.md),
[provider-assets](experiments/provider-assets.md), and
[transformation-conformance](experiments/transformation-conformance.md)
experiment reports.

## 3. Maintainer licensing direction

**VERIFIED FACT.** The maintainer is a solo open-source developer whose current
goals are personal use, open development, and allowing others to use, study,
modify, and contribute. Maximizing proprietary adoption is not a current goal.

**COMPLIANCE ACTION.** Use `AGPL-3.0-only` as the default direction for all
project-owned core, provider-contract, provider, tooling, and documentation
code unless a file is intentionally documented under another license. Retain
the provider boundary because it is technically necessary for versioning,
provenance, lazy capabilities, singleton ownership, and testing; do not portray
it as a legal firewall.

**LEGAL QUESTION.** Before applying the license, confirm that the maintainer
owns or is authorized to license all project-owned work, including work created
under any employment or contractor agreement. Git metadata is evidence of
authorship history, not proof of ownership.

## 4. Current repository state

**VERIFIED FACT.** At this audit date:

- [`LICENSE`](../../../LICENSE) is a no-permission placeholder. The repository
  is neither AGPL-licensed nor permissively licensed today.
- The root and all POC workspaces are private, versioned `0.0.0-poc`, and have
  not been published to npm.
- The repository contains 327 tracked TypeScript/JavaScript/CSS/HTML source
  files, 49 Markdown files, and 28 JSON/YAML files. No tracked file contains an
  `SPDX-License-Identifier` header.
- `.grafana-source/`, generated `dist/`, general `build/`, `artifacts/`, test
  evidence, and Playwright output are ignored. Only project-owned build tooling
  under `apps/poc-host/build/*.ts` is deliberately tracked.
- No Grafana `public/app` source file or generated provider/browser artifact is
  tracked. `packages/poc-grafana-bridge` contains project-owned loaders,
  adapters, aliases, declarations, and provenance identities that consume the
  ignored pinned checkout during local builds.
- The Git history reports one named author, Amin Aliakbarian, across two email
  addresses and 80 commits. It contains no `Co-authored-by` or `Signed-off-by`
  trailers.
- [`CONTRIBUTING.md`](../../../CONTRIBUTING.md), the Code of Conduct, and the
  development workflow contain no CLA, DCO, copyright-assignment, explicit
  inbound-license, or relicensing terms.

Repository source distribution, ignored local experimental bundles, and a
future npm/browser provider are three different distribution states. This
audit does not treat local ignored artifacts as a completed public release.

## 5. Project-owned code

### 5.1 Inventory

Project-owned tracked material currently comprises:

| Area | Contents | Present treatment |
| --- | --- | --- |
| Root governance/configuration | README, contribution/conduct documents, placeholder license, Yarn/TypeScript/Vite/Playwright/Docker configuration | No explicit outbound license |
| `apps/poc-host` | Experimental host, browser probes, and build/provenance guards | Private disposable POC |
| `packages/poc-compat` | Runtime, API, conversion, query, presentation, lifecycle, and instrumentation adapters | Private disposable POC |
| `packages/poc-grafana-bridge` | Source resolvers, closed loaders, exact adapters, and provenance identities | Project-owned bridge code; no copied tracked Grafana application files |
| `experiments/` | Phase 1 provider, bundle, transformation, and presentation experiments | Private research code; production-shaped evidence, not a release |
| `scripts/` and `tests/` | Verification, provenance, fixture, and conformance tooling | Project-owned build/test support |
| `docs/` | Project control, ADRs, Phase 0 evidence, and Phase 1 architecture | Project-owned documentation with upstream quotations/links where identified |
| `dev/` | Local Grafana fixture and provisioning | Project-owned test infrastructure plus referenced upstream image |

### 5.2 Readiness

**VERIFIED FACT.** Current Git metadata suggests sole named authorship and no
outside-authored commit. It does not establish ownership or eliminate possible
employer, contractor, or unrecorded-contributor rights.

**COMPLIANCE ACTION.** Adopting `AGPL-3.0-only` now is operationally
straightforward compared with doing so after outside contributions: confirm
rights, replace the placeholder in a dedicated reviewed change, add package
license metadata only when packages cease being private, and add explicit
inbound contribution wording before accepting contributions.

**LEGAL QUESTION.** Does the maintainer have authority to license every
project-owned file, and should any documentation, fixture data, generated file,
or employer-related work be excluded or separately attributed?

## 6. Grafana AGPL source inventory

### 6.1 Common evidence and treatment

The following facts apply to every `public/app` row in Sections 6.2–6.5:

| Attribute | Value |
| --- | --- |
| Upstream repository | `grafana/grafana` |
| Tag / public source commit | `v13.2.3` / `6193dc03311b631b9727b560d24369e683dc396e` |
| Repository license evidence | `LICENSING.md` says the repository default is `AGPL-3.0-only`; none of these paths is within a listed Apache-2.0 or vendored exception |
| Narrower evidence | No file-level license header or nested license file was found for these exact source paths |
| Source checkout | Exact files are unmodified in ignored `.grafana-source/grafana-v13.2.3/` |
| Repository tracking | Not tracked by this project |
| Build treatment | Source is compiled; selected imports are redirected to audited project adapters, so resulting provider output is an adapted/wrapped build even though checkout bytes remain unchanged |
| Phase 0 artifacts | Present only in ignored local browser bundles |

`D` means a direct experiment entry; `T` means a transitive dependency. The
last column distinguishes the current optimized provider candidate from the
larger historical Phase 0 proof. “Current” does not authorize distribution.

### 6.2 Text/shared and Stat — 14 files

| Exact path | Edge | Runtime/static role | Future candidate |
| --- | --- | --- | --- |
| `public/app/core/config.ts` | T | Phase 0 runtime configuration access | Phase-0-only |
| `public/app/plugins/panel/text/panelcfg.gen.ts` | T | Generated Text configuration | Current |
| `public/app/plugins/panel/text/v1/TextPanel.tsx` | T | Real Text renderer | Current |
| `public/app/plugins/panel/text/v1/TextPanelEditor.tsx` | T | Static editor closure | Phase-0-only |
| `public/app/plugins/panel/text/v1/module.tsx` | D | Phase 0 plugin entry | Phase-0-only |
| `public/app/plugins/panel/text/v1/textPanelMigrationHandler.ts` | T | Static migration closure | Phase-0-only |
| `public/app/features/panel/suggestions/utils.ts` | T | Static suggestion utilities | Phase-0-only |
| `public/app/plugins/panel/stat/StatMigrations.ts` | T | Static migration closure | Phase-0-only |
| `public/app/plugins/panel/stat/StatPanel.tsx` | T in Phase 0; D in optimized profile | Real Stat renderer | Current |
| `public/app/plugins/panel/stat/common.ts` | T | Plugin configuration | Phase-0-only |
| `public/app/plugins/panel/stat/module.tsx` | D | Phase 0 plugin entry | Phase-0-only |
| `public/app/plugins/panel/stat/panelcfg.gen.ts` | T | Generated Stat configuration; admitted by resolver but tree-shaken from current artifact | Not emitted currently |
| `public/app/plugins/panel/stat/presets.ts` | T | Static presets | Phase-0-only |
| `public/app/plugins/panel/stat/suggestions.ts` | T | Static suggestions | Phase-0-only |

### 6.3 Time series / GraphNG — 8 files

| Exact path | Edge | Runtime role | Future candidate |
| --- | --- | --- | --- |
| `public/app/core/components/GraphNG/GraphNG.tsx` | T | Real plot renderer | Current |
| `public/app/core/components/GraphNG/utils.ts` | T | Plot preparation | Current |
| `public/app/core/components/TimeSeries/TimeSeries.tsx` | T | Real Time series UI | Current |
| `public/app/core/components/TimeSeries/utils.ts` | T | Plot helper | Current |
| `public/app/plugins/panel/timeseries/TimeSeriesPanel.tsx` | D in winning P2 path | Real panel renderer | Current |
| `public/app/plugins/panel/timeseries/TimeSeriesTooltip.tsx` | T | Tooltip runtime | Current |
| `public/app/plugins/panel/timeseries/plugins/OutsideRangePlugin.tsx` | T | Plot plugin | Current |
| `public/app/plugins/panel/timeseries/utils.ts` | T | Panel helper | Current |

The optimized resolver also admits `GraphNG/types.ts` and Time series
`panelcfg.gen.ts`, but neither was emitted in the measured candidate artifact;
they are not counted among the 22 current emitted `public/app` files.

### 6.4 TestData — 33 files

| Exact path | Edge | Runtime/static role | Future candidate |
| --- | --- | --- | --- |
| `public/app/plugins/datasource/grafana-testdata-datasource/ConfigEditor.tsx` | T | Static editor closure | Phase-0-only |
| `public/app/plugins/datasource/grafana-testdata-datasource/LogIpsum.ts` | T | Runtime scenario dependency | Current |
| `public/app/plugins/datasource/grafana-testdata-datasource/MetaDataInspector.tsx` | T | Static inspector closure | Phase-0-only |
| `public/app/plugins/datasource/grafana-testdata-datasource/QueryEditor.tsx` | T | Static editor closure | Phase-0-only |
| `public/app/plugins/datasource/grafana-testdata-datasource/TestInfoTab.tsx` | T | Static configuration UI | Phase-0-only |
| `public/app/plugins/datasource/grafana-testdata-datasource/components/CSVContentEditor.tsx` | T | Static editor closure | Phase-0-only |
| `public/app/plugins/datasource/grafana-testdata-datasource/components/CSVFileEditor.tsx` | T | Static editor closure | Phase-0-only |
| `public/app/plugins/datasource/grafana-testdata-datasource/components/CSVWaveEditor.tsx` | T | Static editor closure | Phase-0-only |
| `public/app/plugins/datasource/grafana-testdata-datasource/components/ErrorEditor.tsx` | T | Static editor closure | Phase-0-only |
| `public/app/plugins/datasource/grafana-testdata-datasource/components/ErrorWithSourceEditor.tsx` | T | Static editor closure | Phase-0-only |
| `public/app/plugins/datasource/grafana-testdata-datasource/components/ExemplarLabelsEditor.tsx` | T | Static editor closure | Phase-0-only |
| `public/app/plugins/datasource/grafana-testdata-datasource/components/ExemplarsEditor.tsx` | T | Static editor closure | Phase-0-only |
| `public/app/plugins/datasource/grafana-testdata-datasource/components/FlakyQueryEditor.tsx` | T | Static editor closure | Phase-0-only |
| `public/app/plugins/datasource/grafana-testdata-datasource/components/GrafanaLiveEditor.tsx` | T | Static editor closure | Phase-0-only |
| `public/app/plugins/datasource/grafana-testdata-datasource/components/NodeGraphEditor.tsx` | T | Static editor closure | Phase-0-only |
| `public/app/plugins/datasource/grafana-testdata-datasource/components/PredictablePulseEditor.tsx` | T | Static editor closure | Phase-0-only |
| `public/app/plugins/datasource/grafana-testdata-datasource/components/RandomWalkEditor.tsx` | T | Static editor closure | Phase-0-only |
| `public/app/plugins/datasource/grafana-testdata-datasource/components/RawFrameEditor.tsx` | T | Static editor closure | Phase-0-only |
| `public/app/plugins/datasource/grafana-testdata-datasource/components/SimulationQueryEditor.tsx` | T | Static editor closure | Phase-0-only |
| `public/app/plugins/datasource/grafana-testdata-datasource/components/SimulationSchemaForm.tsx` | T | Static editor closure | Phase-0-only |
| `public/app/plugins/datasource/grafana-testdata-datasource/components/StreamingClientEditor.tsx` | T | Static editor closure | Phase-0-only |
| `public/app/plugins/datasource/grafana-testdata-datasource/components/USAQueryEditor.tsx` | T | Static editor closure | Phase-0-only |
| `public/app/plugins/datasource/grafana-testdata-datasource/constants.ts` | T | Runtime constants | Current |
| `public/app/plugins/datasource/grafana-testdata-datasource/dataquery.ts` | T | Runtime query contracts | Current |
| `public/app/plugins/datasource/grafana-testdata-datasource/datasource.ts` | T in Phase 0; D in optimized profile | Real datasource class | Current |
| `public/app/plugins/datasource/grafana-testdata-datasource/metricTree.ts` | T | Runtime helper | Current |
| `public/app/plugins/datasource/grafana-testdata-datasource/module.tsx` | D | Phase 0 plugin entry | Phase-0-only |
| `public/app/plugins/datasource/grafana-testdata-datasource/nodeGraphUtils.ts` | T | Runtime helper | Current |
| `public/app/plugins/datasource/grafana-testdata-datasource/runStreams.ts` | T | Runtime helper | Current |
| `public/app/plugins/datasource/grafana-testdata-datasource/testData/flameGraphResponse.ts` | T | Runtime helper | Current |
| `public/app/plugins/datasource/grafana-testdata-datasource/testData/serviceMapResponse.ts` | T | Runtime helper | Current |
| `public/app/plugins/datasource/grafana-testdata-datasource/testData/serviceMapResponseMedium.ts` | T | Runtime helper | Current |
| `public/app/plugins/datasource/grafana-testdata-datasource/variables.ts` | T | Runtime variable helper | Current |

### 6.5 Inventory reconciliation

| Closure | Text | Stat | Time series | TestData | Total `public/app` |
| --- | ---: | ---: | ---: | ---: | ---: |
| Phase 0 successful proof | 6 | 8 | 8 | 33 | **55** |
| Current optimized emitted candidate | 2 | 1 | 8 | 11 | **22** |

The current source resolver may admit 25 application paths; three admitted
option/type files are tree-shaken, leaving the measured 22-file artifact.
Additionally, the current provider contains the unmodified package-source
helper
`packages/grafana-data/src/transformations/transformers/nulls/nullToUndefThreshold.ts`.
That helper lies within the `packages/grafana-data/` Apache-2.0 exception, not
the repository-default application-source group.

**COMPLIANCE ACTION.** For every candidate release, regenerate the file-level
inventory from the actual artifact, fail on any unapproved source, retain the
Grafana tag and commit, record the exact project adapters and import rewrites,
and mark generated output as modified from upstream with a build date and
provenance digest.

**LEGAL QUESTION.** What source, modification notices, interactive notices,
and source-availability mechanisms are required for the compiled/adapted
22-file provider and for any host application that combines with it?

## 7. Grafana Apache package inventory

All six packages below are version `13.2.3`, are bundled into the current
provider experiment, declare `Apache-2.0` in `package.json`, and ship a
package-local `LICENSE_APACHE2`. Their manifests identify Grafana Labs as the
publisher/author. Grafana's root `NOTICE.md` states “Copyright 2014-2021
Grafana Labs” and records the Kibana basis and Elasticsearch BV copyright.
The installed artifacts expose `LICENSE_APACHE2` but no package-local `NOTICE`;
the root notice and any artifact-specific notices therefore remain separate
inputs to the release review.

| Package | Root `LICENSING.md` status | Use and adaptation | Required provenance/action |
| --- | --- | --- | --- |
| `@grafana/data` | Explicit Apache exception: `packages/grafana-data/` | Public API plus exact compiled deep imports for field conversion, joins, and overrides; one source helper; `renameByRegex` is a lazy deep operator in the verified transformation profile | Record package, source commit, deep paths, hashes, `LICENSE_APACHE2`, and applicable notices |
| `@grafana/ui` | Explicit Apache exception: `packages/grafana-ui/` | Public UI plus exact compiled deep imports for uPlot helpers, gradient fills, legend, and tooltip behavior | Record deep paths, emitted chunks/assets, license, and notices |
| `@grafana/runtime` | Explicit Apache exception: `packages/grafana-runtime/` | Public APIs plus unstable/internal singleton setters and services behind provider adapters | Record exact API/deep use and package identity |
| `@grafana/e2e-selectors` | Explicit Apache exception: `packages/grafana-e2e-selectors/` | Transitive selector constants | Retain package license/provenance even if tree-shaken in a future artifact |
| `@grafana/schema` | **Not named** in root Apache exception list; manifest and local file say Apache-2.0 | Generated schema/types bundled | Preserve both pieces of evidence; do not silently resolve discrepancy |
| `@grafana/i18n` | **Not named** in root Apache exception list; manifest and local file say Apache-2.0 | Published i18n runtime and singleton setup bundled | Preserve both pieces of evidence; do not silently resolve discrepancy |

The exact reviewed package deep/source boundary is:

| Package | Exact path | Current role |
| --- | --- | --- |
| `@grafana/data@13.2.3` | `dist/esm/transformations/transformers/convertFieldType.mjs` | Compiled field-type conversion deep import |
| `@grafana/data@13.2.3` | `dist/esm/transformations/transformers/joinDataFrames.mjs` | Compiled frame-join deep import |
| `@grafana/data@13.2.3` | `dist/esm/field/fieldOverrides.mjs` | Compiled field-override deep import |
| `@grafana/data@13.2.3` | `dist/esm/transformations/transformers/renameByRegex.mjs` | Lazy compiled operator in the verified transformation profile |
| Grafana v13.2.3 source | `packages/grafana-data/src/transformations/transformers/nulls/nullToUndefThreshold.ts` | Exact-version source fallback inside the named Apache package directory |
| `@grafana/ui@13.2.3` | `dist/esm/components/uPlot/utils.mjs` | Compiled uPlot helper deep import |
| `@grafana/ui@13.2.3` | `dist/esm/components/uPlot/config/gradientFills.mjs` | Compiled gradient-fill deep import |
| `@grafana/ui@13.2.3` | `dist/esm/components/uPlot/PlotLegend.mjs` | Compiled plot-legend deep import |
| `@grafana/ui@13.2.3` | `dist/esm/components/uPlot/plugins/TooltipPlugin2.mjs` | Compiled tooltip-plugin deep import |

These paths are exact-version implementation surfaces, not general public API
compatibility claims. Release provenance must distinguish npm-compiled deep
modules from the one file consumed from the pinned source checkout.

**COMPLIANCE ACTION.** Include the exact Apache 2.0 text, package identity,
copyright/notice material, and modification/provenance records in each
distributed provider. Do not replace package-local license evidence with a
single root project license.

**LEGAL QUESTION.** How should the `@grafana/schema` and `@grafana/i18n`
package manifests and `LICENSE_APACHE2` files be reconciled with their omission
from Grafana v13.2.3's repository-level Apache exception list?

## 8. Scenes inventory

| Field | Evidence |
| --- | --- |
| Package | `@grafana/scenes@8.13.5` |
| Repository | [`grafana/scenes`](https://github.com/grafana/scenes/tree/v8.13.5) |
| Package `gitHead` | `9c247076dbb9aa2c2ae96d4b0dffc3ecedea0ac2` |
| Manifest license | `Apache-2.0` |
| Package license | Full Apache 2.0 text in `node_modules/@grafana/scenes/LICENSE` |
| Author field | Grafana Labs |
| Copyright / NOTICE | No separate package `NOTICE` or package-specific copyright statement was found; retain the author field and license, and re-scan the release artifact |
| Source handling | Consumed as an npm dependency; no Scenes source is copied into this repository |
| Artifact status | Bundled into the provider-owned Grafana cohort |
| Relevant peers | React/ReactDOM `^18`, Grafana packages `>=11.6`, Router `^6.28.0`, RxJS `^7.8.1` |

**COMPLIANCE ACTION.** Preserve the Scenes package identity, license text,
author/copyright evidence, source URL, bundled relationship, and exact tested
peer mismatch in notices, SBOM, and provenance. Absence of a separate package
`NOTICE` does not remove the need to retain the shipped license and any notices
found during the final artifact scan.

## 9. Third-party runtime dependencies

### 9.1 Ownership categories

| Category | Exact items | Distribution treatment |
| --- | --- | --- |
| External runtime peers | `react@19.2.8`, `react-dom@19.2.8`, including `react/jsx-runtime` and `react/jsx-dev-runtime`; MIT license files in each installed package | Host-owned and explicitly externalized; record peer requirement and license, but do not claim their implementation is in the provider |
| Direct/bundled runtime | Grafana packages and Scenes above; `@emotion/react@11.14.0`, `@emotion/css@11.13.5`, `rxjs@7.8.2`, `uplot@1.6.32`, `zod@4.6.5`, Router, i18n, and bridge dependencies | Bundled provider inputs; license texts/notices must follow actual emitted closure |
| Generated runtime helper | Vite `8.2.0` `vite/preload-helper.js` | Emitted build helper under Vite's MIT terms; include build-tool provenance in artifact evidence |
| Build only | Node `22.23.3`, Yarn `4.17.1`, TypeScript `6.0.2` (Apache-2.0), Vite `8.2.0` (MIT), Rolldown `1.2.12` (MIT), plugin-react `6.1.1` (MIT) | Not distributed unless code/helpers or license material appear in output; scan generated output |
| Test only | Vitest `4.1.10` (MIT), Playwright/test and core `1.56.1` (Apache-2.0), `@axe-core/playwright@4.11.1` (MPL-2.0) | Do not include in runtime notices unless present in the released artifact; retain development SBOM separately |

### 9.2 Exact emitted provider package roots

The current provider asset evidence contains **172 distinct bundled package
roots** and **175 package-version components**. The difference is caused by
two emitted versions each of `history`, `memoize-one`, and `react-router`.
This list is artifact-derived, not merely the workspace's direct dependency
list. Unless stated otherwise, each item is **TRANSITIVE RUNTIME**, bundled,
and requires a release record containing its installed package-local
license/copyright/notice material. Versions come from the installed package or
`yarn.lock`.

| Declared/evidenced license | Exact bundled packages | Audit disposition |
| --- | --- | --- |
| Apache-2.0 (23) | `@grafana/data@13.2.3`, `@grafana/e2e-selectors@13.2.3`, `@grafana/faro-core@2.12.1`, `@grafana/faro-web-sdk@2.12.1`, `@grafana/i18n@13.2.3`, `@grafana/runtime@13.2.3`, `@grafana/scenes@8.13.5`, `@grafana/schema@13.2.3`, `@grafana/ui@13.2.3`, `@internationalized/string@3.2.10`, `@openfeature/core@1.12.0`, `@openfeature/localstorage-provider@0.1.2`, `@openfeature/ofrep-core@2.3.0`, `@openfeature/ofrep-web-provider@0.4.3`, `@openfeature/react-sdk@1.4.1`, `@openfeature/web-sdk@1.10.0`, `@react-aria/dialog@3.6.1`, `@react-aria/focus@3.22.1`, `@react-aria/overlays@3.32.1`, `react-aria@3.52.1`, `react-stately@3.50.0`, `rxjs@7.8.2`, `web-vitals@6.2.2` | Capture every package license and NOTICE; resolve Grafana schema/i18n discrepancy |
| MIT (132 package roots; 135 package-version components) | `@babel/runtime@7.29.7`, `@braintree/sanitize-url@7.1.2`, `@emotion/cache@11.14.0`, `@emotion/css@11.13.5`, `@emotion/hash@0.9.2`, `@emotion/memoize@0.9.0`, `@emotion/react@11.14.0`, `@emotion/serialize@1.3.3`, `@emotion/sheet@1.4.0`, `@emotion/unitless@0.10.0`, `@emotion/use-insertion-effect-with-fallbacks@1.2.0`, `@emotion/utils@1.4.2`, `@emotion/weak-memoize@0.4.0`, `@floating-ui/core@1.8.0`, `@floating-ui/dom@1.8.0`, `@floating-ui/react@0.27.20`, `@floating-ui/react-dom@2.1.9`, `@floating-ui/utils@0.2.12`, `@leeoniya/ufuzzy@1.0.19`, `@rc-component/cascader@1.25.0`, `@rc-component/drawer@1.4.2`, `@rc-component/motion@1.3.3`, `@rc-component/overflow@1.0.1`, `@rc-component/portal@2.2.1`, `@rc-component/resize-observer@1.1.2`, `@rc-component/select@1.11.0`, `@rc-component/slider@1.2.1`, `@rc-component/tooltip@1.5.2`, `@rc-component/tree@1.5.3`, `@rc-component/trigger@3.10.1`, `@rc-component/util@1.13.0`, `@rc-component/virtual-list@1.5.2`, `@react-hookz/web@25.3.0`, `@remix-run/router@1.23.2`, `@tanstack/react-virtual@3.14.13`, `@tanstack/virtual-core@3.17.11`, `@ver0/deep-equal@2.0.1`, `@wojtekmaj/date-utils@2.0.2`, `@xobotyi/scrollbar-width@1.9.5`, `add-px-to-style@1.0.0`, `attr-accept@2.2.5`, `calculate-size@1.1.1`, `clsx@2.1.1`, `compute-scroll-into-view@3.1.1`, `copy-to-clipboard@3.3.3`, `cssfilter@0.0.10`, `dangerously-set-html-content@1.1.1`, `date-fns@4.4.0`, `debug@3.2.7`, `direction@0.1.5`, `dom-css@2.1.0`, `dom-helpers@5.2.1`, `downshift@9.4.0`, `esrever@0.2.0`, `eventemitter3@5.0.4`, `fast-deep-equal@3.1.3`, `fast-equals@4.0.3`, `fast-json-patch@3.1.1`, `file-selector@2.1.2`, `get-user-locale@3.0.0`, `history@4.10.1`, `history@5.3.0`, `html-parse-stringify@4.0.1`, `i18next@26.4.2`, `i18next-browser-languagedetector@8.2.1`, `i18next-pseudo@2.2.1`, `immutable@5.1.9`, `is-hotkey@0.2.0`, `is-mobile@5.0.0`, `is-plain-object@2.0.4`, `isarray@0.0.1`, `isobject@3.0.1`, `js-cookie@3.0.8`, `lodash@4.18.1`, `marked@16.4.2`, `marked-mangle@1.1.14`, `memoize@10.2.0`, `memoize-one@5.2.1`, `memoize-one@6.0.0`, `micro-memoize@4.2.0`, `mimic-function@5.0.1`, `moment@2.31.0`, `moment-timezone@0.5.48`, `ms@2.1.3`, `papaparse@5.7.0`, `path-to-regexp@1.9.0`, `performance-now@2.1.0`, `prefix-style@2.0.1`, `prismjs@1.30.0`, `prop-types@15.8.1`, `raf@3.4.1`, `react-calendar@6.0.1`, `react-colorful@5.8.1`, `react-custom-scrollbars-2@4.5.0`, `react-draggable@4.7.2`, `react-dropzone@14.4.1`, `react-from-dom@0.7.5`, `react-grid-layout@1.5.4`, `react-highlight-words@0.21.0`, `react-hook-form@7.89.0`, `react-i18next@17.0.15`, `react-inlinesvg@4.5.0`, `react-is@16.13.1`, `react-loading-skeleton@3.5.0`, `react-resizable@3.2.0`, `react-router@6.30.3`, `react-router@6.30.6`, `react-router-dom@6.30.3`, `react-router-dom-v5-compat@6.30.6`, `react-select@5.10.2`, `react-table@7.8.0`, `react-window@1.8.11`, `resize-observer-polyfill@1.5.1`, `resolve-pathname@3.0.0`, `screenfull@5.2.0`, `slate@0.47.9`, `slate-plain-serializer@0.7.13`, `stylis@4.2.0`, `tabbable@6.5.0`, `throttle-debounce@3.0.1`, `tiny-invariant@1.3.3`, `tiny-warning@0.0.3`, `tinycolor2@1.6.0`, `to-camel-case@1.0.0`, `to-no-case@1.0.2`, `to-space-case@1.0.0`, `toggle-selection@1.0.6`, `ua-parser-js@1.0.41`, `uplot@1.6.32`, `use-isomorphic-layout-effect@1.2.1`, `use-sync-external-store@1.7.0`, `uuid@11.1.1`, `value-equal@1.0.1`, `xss@1.0.15`, `zod@4.6.5` | Preserve license/copyright text. `dangerously-set-html-content` and `isarray` declare MIT but the current materialization exposes no package-local license file; fetch and verify upstream license evidence before release |
| ISC (5) | `d3-color@3.1.0`, `d3-interpolate@3.0.1`, `d3-random@3.0.1`, `d3-scale-chromatic@3.1.0`, `semver@7.8.5` | Preserve ISC copyright/license text |
| BSD-3-Clause (2) | `hoist-non-react-statics@3.3.2`, `react-transition-group@4.4.5` | Preserve copyright, conditions, and disclaimer |
| 0BSD (1) | `tslib@2.8.1` | Preserve artifact evidence and license text conservatively |
| Unlicense/public-domain dedication (6) | `fast-shallow-equal@1.0.0`, `nano-css@5.6.2`, `react-universal-interface@0.6.2`, `react-use@17.6.1`, `set-harmonic-interval@1.0.1`, `ts-easing@0.2.0` | Two manifests omit a license field but package-local `LICENSE` files contain the Unlicense/public-domain dedication; preserve those files |
| `(MPL-2.0 OR Apache-2.0)` (1) | `dompurify@3.4.16` | Record the upstream dual expression and determine/document the license path used for distribution |
| BlueOak-1.0.0 (1) | `lru-cache@11.5.3` | Preserve license and attribution evidence; validate policy acceptance |
| CC0-1.0 (1) | `string-hash@1.1.3` | Preserve license/dedication evidence conservatively |

The installed license-file convention is
`node_modules/<package>/LICENSE*` or `NOTICE*`; exact filenames and copyright
text vary and must be copied from the immutable release install, not generated
from the SPDX identifier alone. The current audit resolves all 172 roots and
175 package-version components to a license evidence category, but it does
**not** yet contain a
reviewed copyright/notice record for every package. That missing generated
notice set blocks publication.

## 10. Asset license inventory

### 10.1 Current view profile

| Asset | Origin and exact identity | Evidence/classification | Emitted identity |
| --- | --- | --- | --- |
| Inter Medium | Grafana commit above, `public/fonts/inter/Inter-Medium.woff2` | Current view profile. No nested font license was found in the pinned tree; root Grafana license evidence alone does not establish the font's upstream grant. **LEGAL QUESTION / BLOCKED.** | `assets/assets/Inter-Medium-B0NFony0.woff2`; SHA-256 `8458f8afa67b5691c1fcbe51607a2dafb53a9839e48131c608a186b65415d96d`; 111,380 B |
| Inter Regular | Grafana commit above, `public/fonts/inter/Inter-Regular.woff2` | Same unresolved font-license chain | `assets/assets/Inter-Regular-B0QUfDW0.woff2`; SHA-256 `b6f9db9e45be20f3c1312c97fbee7ec36b7d8280f8caa4d53c9ba0408cc9997a`; 108,488 B |
| Unicons `times.svg` | Grafana commit above, `public/img/icons/unicons/times.svg`; IconScout origin | Current view profile. Grafana explicitly lists `public/img/icons/unicons/` as Apache-2.0 and ships `NOTICE.txt` plus `LICENSE_APACHE2` | `provider-assets/build/img/icons/unicons/times.svg`; SHA-256 `ef212fb287617446776c03debe22b02b784bfef44e45cf1cb40651c3e023a4da`; 261 B |
| uPlot CSS | `uplot@1.6.32`, `dist/uPlot.min.css` | Current view profile; MIT package `LICENSE` | `assets/provider-visualization-CnsZ1jie.css`; SHA-256 `0fd9465202f6dfceac29e67c17e5ac9fb1b7ba7615c1bb08782391b791d9f1e0`; 1,644 B |
| Slider CSS | `@rc-component/slider@1.2.1`, `assets/index.css` | Current view profile; MIT package `LICENSE` | `assets/lib-lN7-jXEs.css`; SHA-256 `8be4ce8136d45e744b445bedde3774e6aff8d17a1c3289467e1e177fe2c97cbb`; 5,083 B |
| Provider runtime CSS | Project-owned scoped provider/presentation CSS | Current view profile; intended project AGPL direction | `assets/providerRuntime-DeYWoyMT.css`; SHA-256 `c77441060aebbecf46eb63674a5cb36e5c8e09f10b6c51bf891d79846511c466`; 3,814 B |

Host experiment CSS is not a provider-distribution asset. Current browser
evidence found no worker, WASM, CDN, data-URL, blob-URL, or other emitted image,
font, or icon in the view profile.

### 10.2 Historical/removed assets

| Asset group | Classification | Required treatment |
| --- | --- | --- |
| Monaco editor `0.34.1`, React-Monaco, CodeMirror chunks/CSS | Phase-0-only / editor-only; removed from optimized provider | Do not include in initial Phase 2 notices as distributed content. Retain historical provenance and re-open Monaco `LICENSE` and `ThirdPartyNotices.txt` review if authoring features return |
| Codicon TTF/CSS | Phase-0-only / editor-only; removed from optimized provider | Do not ship accidentally; build guard must fail if reintroduced. Re-audit Codicon license/notice before deliberate inclusion |
| Text and TestData editor assets | Phase-0-only; removed | Keep forbidden-source/asset checks |
| Any newly emitted image/font/icon/worker/WASM | Unknown until artifact scan | Fail release inventory and require provenance/license review |

**COMPLIANCE ACTION.** Either establish and package authoritative Inter font
license/copyright evidence or replace the fonts with a verified distributable
source while documenting the fidelity change. Never infer asset licensing from
the parent directory without evidence.

## 11. License compatibility matrix

This matrix records primary-source evidence and conservative actions. It is not
a legal compatibility opinion.

| Component(s) | License evidence | Relationship to proposed project AGPL | Preserved material/action | Unresolved question |
| --- | --- | --- | --- | --- |
| Project-owned code | Proposed `AGPL-3.0-only` | Rights holder's intended outbound choice | Root license, SPDX metadata, copyright, source offer/process | Confirm ownership/authority |
| Grafana `public/app` closure | Grafana v13.2.3 default `AGPL-3.0-only` | Same identifier does not erase upstream ownership or terms | Grafana license, NOTICE, copyright, exact sources, modifications, corresponding-source path | Combined-work, UI notice, host, and Section 13 application |
| Grafana Apache packages, Scenes, RxJS, React Aria/OpenFeature/Faro | Apache-2.0 | Apache states Apache-2.0 code can be included in GPLv3 projects; GNU lists Apache-2.0 as GPLv3-compatible. AGPL Section 13 expressly addresses combination with GPLv3, but this audit does not extrapolate a final artifact conclusion | Apache text, NOTICE/copyright, source URL, modifications | Confirm treatment in this specific AGPL/browser artifact; resolve schema/i18n evidence |
| React/ReactDOM, Emotion, uPlot, Vite helper, and MIT group | MIT | Independently licensed inputs retained under their terms in a combined distribution | Copyright and MIT permission/warranty text for every component | Complete exact copyright inventory; missing local texts for two packages |
| D3/semver | ISC | Independently licensed inputs | Copyright and ISC text | None beyond artifact-specific notice generation |
| Hoist statics/transition group | BSD-3-Clause | Independently licensed inputs | Copyright, conditions, disclaimer | Confirm no extra NOTICE |
| `tslib` | 0BSD | Independently licensed input | Preserve package evidence/text conservatively | Project notice policy for zero-clause license |
| Unlicense/public-domain group | Unlicense text, including two packages without manifest license field | Independently licensed inputs | Preserve package-local dedication/disclaimer | Confirm jurisdictional handling if counsel considers it material |
| DOMPurify | `(MPL-2.0 OR Apache-2.0)` | Dual-license expression; do not silently choose by assumption | Preserve upstream evidence and document chosen distribution path | Which branch should the release notices apply? |
| `lru-cache` | BlueOak-1.0.0 | Independently licensed input | Preserve full license and source identity | Confirm project policy accepts this license |
| `string-hash` | CC0-1.0 | Independently licensed input | Preserve dedication/license evidence | Confirm project policy accepts this treatment |
| Inter WOFF2 files | No nested license found in pinned Grafana source | Unknown | Do not release until authoritative origin/license/attribution is recorded | Exact upstream license and required attribution |
| Unicons `times.svg` | Apache-2.0 plus IconScout notice | Independently licensed asset | Include Apache text and Unicons `NOTICE.txt` attribution | Confirm whether further IconScout material is needed |

The proposed relationship is therefore: project-owned work may use
`AGPL-3.0-only`; Grafana AGPL-covered source retains its terms; permissively or
otherwise independently licensed dependencies retain their own terms; and a
combined artifact may have an AGPL distribution context while still carrying
all third-party license and notice material. “AGPL makes everything AGPL” is
not an acceptable inventory or compliance rule.

## 12. LICENSE-file plan

Before any public Phase 2 release, the repository and each distributed package
should have an artifact-specific structure equivalent to:

```text
LICENSE                              # AGPL-3.0-only text for project-owned work
THIRD_PARTY_NOTICES.md               # generated, reviewed component index
SOURCE.md                            # corresponding-source and rebuild route
licenses/
  AGPL-3.0-only.txt                  # upstream Grafana/project license copy
  Apache-2.0.txt
  <component-specific license texts>
provenance/
  provider-source-provenance.json    # Grafana paths, commit, adapters, hashes
  provider-assets.json               # asset origins, hashes, license evidence
  provider-sbom.spdx.json            # format subject to tooling experiment
```

Package tarballs must include their applicable root/package `LICENSE`, notices,
source/provenance pointer, and third-party license directory. A package that
does not contain Grafana-derived output should still carry its own project
license and its actual third-party notices; it must not claim that separation
automatically changes the legal relationship with a consuming host.

**COMPLIANCE ACTION.** Decide exact file placement once the future package
layout exists, then test the packed files. Do not copy this conceptual tree
blindly into the POC.

## 13. Third-party notices plan

A generated and human-reviewed `THIRD_PARTY_NOTICES.md` should contain one
record for every component or asset actually distributed:

| Required field | Rule |
| --- | --- |
| Component and version | Exact installed/emitted identity, not a semver range |
| Copyright/author | Copy from package license/NOTICE/source; do not invent from package name |
| License identifier/expression | Preserve exact expression, including dual licenses |
| Source URL | Immutable tag/commit when available |
| License-file reference | Point to the corresponding packaged `licenses/` text |
| Required notice/attribution | Include verbatim only where upstream material requires or supplies it |
| Relationship | Bundled, generated helper, external peer, source-derived, CSS, font, or icon |
| Modifications | Point to the project provenance record and relevant date/build ID |

At minimum the provider notice set must include Grafana's root NOTICE and AGPL
text, each Apache package/Scenes license evidence, Unicons attribution, uPlot
and slider CSS licenses, the complete 172-root/175-component runtime closure, and the
resolved Inter evidence. External React peers should be listed as required host
dependencies without falsely saying their implementation is bundled.

**COMPLIANCE ACTION.** Generate notices from the emitted graph and immutable
install, compare them with the source/asset manifests, and review missing,
duplicate, dual, or unrecognized licenses. A lockfile-only notice generator is
insufficient because tree-shaking and generated helpers change the artifact.

## 14. Source-availability plan

Grafana's AGPL text defines Corresponding Source and, in Sections 6 and 13,
addresses non-source conveyance and modified software used over a network.
This audit does not decide how those clauses apply to every deployment.

The conservative engineering plan is to publish, for every released provider
build:

1. a public immutable project Git tag and source archive matching the artifact;
2. the exact Grafana tag and source commit plus a retrievable source archive or
   clear upstream retrieval instructions and checksums;
3. all project adapters, wrappers, configuration, fixtures required for the
   build, source transformations, and generated-source inputs;
4. exact Node, Yarn, TypeScript, Vite/Rolldown, OS/container, package manifests,
   and lockfile identities;
5. provider-generation, asset-copy, notice, provenance, and verification
   scripts;
6. the file-level Grafana allowlist, deep-import map, patch/import-redirection
   record, and build date;
7. asset sources, hashes, license files, and instructions to reproduce emitted
   names;
8. instructions that rebuild the package and browser chunks from source; and
9. a prominent, stable, no-charge source link alongside downloads and in any
   remotely served modified UI where the approved interpretation requires it.

**LEGAL QUESTION.** Does this mechanism constitute sufficient Corresponding
Source and source access for npm conveyance, CDN/browser delivery, and a host
application making the modified provider available over a network? What must
be included for dependencies normally acquired from registries, and for how
long must each source route remain available?

## 15. Build reproducibility

### 15.1 Present strengths

**VERIFIED FACT.** The repository pins Node 22.23.3, Yarn 4.17.1, an immutable
lockfile, Grafana 13.2.3 and its public source commit, Grafana package versions,
Scenes 8.13.5, React/DOM 19.2.8, TypeScript 6.0.2, Vite 8.2.0, Rolldown 1.2.12,
container images, exact source allowlists, and artifact hash/provenance checks.
Production-shaped experiments have rebuilt and exercised the real Text, Stat,
Time series, TestData, asset, transformation, and lifecycle paths.

### 15.2 Gaps before release

- The pinned Grafana checkout and generated artifacts are deliberately ignored;
  no release command currently fetches/verifies/packages their source
  automatically.
- There is no public production package, release manifest, SBOM generator,
  notice generator, or reproducible-build attestation.
- Current content hashes prove particular local outputs, not bit-for-bit
  reproducibility across clean machines and dates.
- License/copyright material for all 172 bundled roots and 175 versioned
  components is not yet assembled.
- Inter provenance is incomplete, and two MIT package materializations lack a
  package-local license file.
- Generated file, locale, source-map, minifier, chunk-order, and environment
  effects need a clean-container repeatability test.
- Source maps require a release decision: they may improve rebuild/debugging
  while also embedding third-party source content that must be inventoried.

**COMPLIANCE ACTION.** Require two clean container builds from the same tag,
compare normalized manifests and hashes, explain any nondeterminism, and prove
that a recipient can reproduce functional artifacts using only the published
source set and documented upstream downloads.

## 16. Modification/provenance notices

| Classification | Current examples | Mechanical record required |
| --- | --- | --- |
| UNMODIFIED SOURCE INPUT | All files in the clean pinned Grafana checkout; package dependencies | Path, repository, tag/commit/version, input hash, upstream license/header |
| COMPILED / GENERATED FROM | JavaScript chunks, extracted CSS, font/icon copies generated from source inputs | Every input, toolchain/build ID, output path/hash, build date |
| ADAPTED | Time series and TestData builds whose exact application integrations/imports are redirected; deep package adapters | Upstream path/hash, transformation or alias rule, project replacement, reason, date |
| WRAPPED | Project-owned loaders, runtime services, provider admission, capability catalogues, failure containment | Project source path, relationship to upstream API, project license |
| PATCHED | None in the clean source checkout today | If introduced, store a reviewable patch, base hash, author/date, and purpose |

The source files are unmodified on disk, but the generated browser artifact is
not simply a byte-for-byte copy: compilation, import redirection, tree-shaking,
wrapping, and CSS/asset extraction produce a modified distribution boundary.
Notices must describe that accurately.

**COMPLIANCE ACTION.** Generate a modification ledger from build aliases and
transforms. Fail if emitted Grafana source lacks either an `UNMODIFIED` record
or an `ADAPTED/PATCHED/GENERATED FROM` record.

**LEGAL QUESTION.** Which of these build transformations require prominent
AGPL Section 5 modification notices, where must they appear, and what date
granularity is sufficient?

## 17. SBOM plan

The future SBOM/provenance output must include:

- package name, exact version, source URL/commit, license expression, and
  package/archive checksum;
- dependency relationship and direct/transitive classification;
- bundled, tree-shaken, generated-helper, external-peer, build-only, or
  test-only status;
- every emitted JavaScript/CSS/font/icon/worker/WASM asset and its hash;
- all 22 candidate Grafana application paths, the package-source helper, and
  every project adapter/transform relationship;
- Grafana tag/commit, package `gitHead`, Scenes `gitHead`, provider build ID,
  and compatibility-manifest digest; and
- links to packaged license/notice and source-availability material.

**COMPLIANCE ACTION.** Evaluate SPDX 2.3 JSON first because it can represent
files, checksums, licenses, and relationships; compare CycloneDX if its
dependency/security ecosystem better fits the release pipeline. No format is
approved until a generated artifact is compared against bundle evidence and
the packed tarball. Do not add an SBOM tool merely because it produces a file;
the 22 source files and non-package assets must be representable.

## 18. Package-distribution audit

Every future public package must undergo an `npm pack --dry-run` equivalent and
an inspection of the actual tarball. Classify every packed path:

| Classification | Examples / rule |
| --- | --- |
| EXPECTED | Declared JS/types/CSS/assets, package manifest, README, source map only if approved |
| LICENSE REQUIRED | Project license and every applicable third-party license text |
| NOTICE REQUIRED | Root/package notices and artifact-generated third-party notice index |
| SOURCE/PROVENANCE REQUIRED | `SOURCE.md`, provider manifest, SBOM, source/asset/modification records or stable embedded references approved for that artifact |
| UNEXPECTED | Tests, snapshots, experiments, unrelated locales, editor chunks, duplicate cohorts, undeclared assets |
| FORBIDDEN SECRET/ARTIFACT | `.env`, credentials, cookies, tokens, private evidence, local paths, admin values, source checkout metadata, unreviewed source maps |

The audit must also verify package `license`, `files`, `exports`, peer
dependencies, one external React identity, no accidental full Grafana source
checkout, no unapproved `public/app` module, and exact agreement among tarball,
SBOM, notices, provenance, and browser bundle.

**COMPLIANCE ACTION.** Publication remains disabled until a candidate tarball
passes this review in CI and receives maintainer sign-off. The current private
POC packages are not release candidates.

## 19. Core/provider license model

| Model | What it simplifies | What remains |
| --- | --- | --- |
| **Model 1 — all project-owned core/provider code AGPL-3.0-only** | One project-owned outbound direction; no internal attempt to keep the core permissive while the provider incorporates AGPL Grafana application source; simple inbound-equals-outbound contribution policy | All Grafana/third-party licenses and notices; Corresponding Source design; provenance/modification records; package/host relationship questions; assets; name/trademark; exact-version provider boundary |
| **Model 2 — another core license plus AGPL provider** | Could permit independently reusable core contracts under different terms | Requires separate outbound decisions and clearer artifact boundaries; does not itself answer how a host and provider combine or remove provider obligations |

**COMPLIANCE ACTION.** Select Model 1 as the maintainer-preferred direction.
Do not collapse the core/provider packages: that boundary remains required for
technical ownership, lazy loading, version cells, and conformance. Do not
re-run commercial-adoption optimization when it is outside current goals.

**LEGAL QUESTION.** Under each supported integration mode, what work is covered
by the provider/project AGPL, what source must be offered, and what obligations
if any attach to host application code? The project must not answer that for
users without qualified advice.

## 20. Contributor policy

The simplest community model consistent with the maintainer's stated direction
is inbound-equals-outbound:

1. `CONTRIBUTING.md` should say contributions to project-owned files are
   submitted under `AGPL-3.0-only`, and contributors affirm they have the right
   to submit them.
2. The PR template should repeat that statement and require disclosure of
   copied/derived code, generated files, assets, and their provenance/licenses.
3. Project-owned source files should use `SPDX-License-Identifier:
   AGPL-3.0-only` where the file format supports comments. Documentation and
   generated/third-party files need an explicit policy rather than blindly
   inserting headers.
4. Keep third-party files, license texts, notices, generated output, and
   vendored assets clearly separated; never replace upstream headers with the
   project SPDX identifier.
5. A DCO is optional provenance discipline. It adds a lightweight
   `Signed-off-by` certification but requires documented enforcement.
6. Do not require a CLA or copyright assignment unless future dual licensing,
   relicensing, or a specific governance need becomes a real goal. Those
   mechanisms add contributor friction and are unnecessary for a simple
   AGPL-only community policy.

**COMPLIANCE ACTION.** Before accepting outside code, implement the explicit
inbound rule and decide whether to adopt the standard DCO. Record contributor
identity/provenance without claiming that a sign-off proves ownership.

**LEGAL QUESTION.** Is inbound-equals-outbound wording sufficient for the
maintainer's jurisdiction and future maintenance needs, and are any existing
unrecorded contributions present?

## 21. Trademark/project-name review

**VERIFIED FACT.** The project currently uses “Grafana React SDK,” the README
states that Grafana is a Grafana Labs trademark, and the project disclaims
affiliation or endorsement. No written permission from Grafana Labs is recorded.

**VERIFIED FACT.** Grafana Labs' current published Trademark Usage Policy
addresses use of Grafana marks in product/service names, derivative software,
websites/domains, package/marketing contexts, attribution and non-affiliation,
screenshots, logos, and written permission. Its restrictions directly reach
the proposed project and npm naming context; the policy can change and should
be captured again at release time.

**Classification: LIKELY RENAME REQUIRED.** This is a conservative product
classification, not a legal determination. It is directly justified by the
published policy's restriction on using Grafana marks as part of a
product/service name or derivative software name absent permission. A
disclaimer helps prevent implied affiliation but does not by itself grant
permission to use a mark in the name.

**COMPLIANCE ACTION.** Keep the working name temporarily during Phase 1. Before
public Phase 2/npm release, either choose a neutral project and package name
that describes Grafana OSS compatibility nominatively, or obtain written
Grafana Labs permission. Retain an independence disclaimer, do not use Grafana
logos, and review every screenshot and compatibility statement. Do not rename
the repository in this audit.

**TRADEMARK QUESTION.** Is the current repository/project name permissible,
what npm naming patterns and attribution are approved, may screenshots display
Grafana UI/marks, and should written permission be requested before retaining
the name?

## 22. Compliance release gate

A public Phase 2 source, npm, browser, CDN, or release-attachment distribution
must not occur until every item is satisfied or an explicit waiver and rationale
is recorded by the maintainer with appropriate advice:

- [ ] Rights to license all project-owned files are confirmed.
- [ ] Root and package `LICENSE`/license metadata are finalized.
- [ ] Exact tarball and emitted browser artifact inventories are captured.
- [ ] All bundled, external-peer, build-helper, and asset licenses are resolved.
- [ ] `THIRD_PARTY_NOTICES.md` is generated and human-reviewed.
- [ ] Applicable license/NOTICE/copyright texts are included in the package.
- [ ] The Grafana application/package source allowlist matches the artifact.
- [ ] Grafana tag/commit, package `gitHead`s, adapter map, and output hashes are recorded.
- [ ] Every source adaptation/patch/generated output has a modification record.
- [ ] Inter and every other font/icon/CSS asset has authoritative license evidence.
- [ ] Schema/i18n license-evidence discrepancy is resolved.
- [ ] DOMPurify's selected dual-license path and all nonstandard licenses are reviewed.
- [ ] Corresponding-source and network source-access mechanisms are documented and tested.
- [ ] A clean recipient-style rebuild succeeds from the published source set.
- [ ] An artifact-specific SBOM agrees with the tarball and bundle graph.
- [ ] `npm pack --dry-run` and actual tarball review show only approved files.
- [ ] No editor/Monaco/Codicon or other excluded closure has returned unnoticed.
- [ ] React remains external and one provider Grafana cohort is present.
- [ ] Project/package name, trademark wording, screenshots, and logo use are resolved.
- [ ] Secret scan finds no credentials, cookies, tokens, `.env`, or sensitive evidence.
- [ ] Public Git tag, source archive, artifact checksum, and source link are immutable and live.
- [ ] Required license/provenance/conformance checks pass in the release commit.
- [ ] Final maintainer sign-off records the artifact, evidence, waivers, and release decision.

## 23. Automatable compliance checks

Phase 2 should automate, without treating automation as legal review:

1. immutable dependency-license and package-local license/NOTICE collection;
2. allow/deny policy for unknown, disallowed, missing-text, or changed licenses;
3. bundle-derived package inventory compared with `yarn.lock` and package graph;
4. exact Grafana source/deep-import allowlist and clean-source commit checks;
5. modification-map generation from aliases, transforms, patches, and wrappers;
6. asset URL/source/hash/license validation and forbidden editor-asset checks;
7. SPDX-header checks limited to project-owned eligible file types;
8. deterministic `THIRD_PARTY_NOTICES.md` generation plus human-review diff;
9. SBOM generation and cross-check against bundle/tarball evidence;
10. `npm pack --dry-run`, unpacked tarball classification, size, and secret scans;
11. presence of required LICENSE, NOTICE, SOURCE, provenance, and SBOM files;
12. source-link availability and clean-container rebuild verification; and
13. release-name/disclaimer checklist and maintainer sign-off enforcement.

Any unknown source, package, license expression, asset, or packed file must fail
closed rather than be silently omitted.

## 24. Area-by-area readiness

| Area | Result | Basis / next action |
| --- | --- | --- |
| Project-owned AGPL direction | **READY WITH ACTIONS** | Operationally simple now; confirm ownership, replace placeholder, add policy/metadata |
| Grafana AGPL source provenance | **READY WITH ACTIONS** | Exact 55 historical and 22 candidate closures known; generate release modification/source records |
| Grafana Apache packages | **LEGAL REVIEW REQUIRED** | Four explicit exceptions are clear; schema/i18n discrepancy remains |
| Scenes | **READY WITH ACTIONS** | Exact Apache package/source identity known; include license/provenance |
| Runtime dependency inventory | **READY WITH ACTIONS** | Exact 172-root/175-component artifact list known; generate full copyright/license notice set |
| Assets | **BLOCKED** | Inter license chain unresolved; other current assets have exact identities/evidence |
| LICENSE/NOTICE packaging | **READY WITH ACTIONS** | Conceptual plan defined; files not yet created or tested in a tarball |
| Source availability | **LEGAL REVIEW REQUIRED** | Engineering mechanism defined; legal sufficiency for distribution/network use unresolved |
| Build reproducibility | **READY WITH ACTIONS** | Strong pins/guards exist; clean recipient rebuild and deterministic release proof absent |
| Contributor policy | **READY WITH ACTIONS** | Inbound-equals-outbound recommended; wording/DCO decision not implemented |
| Trademark/project name | **BLOCKED** | Likely rename required or written permission before public package release |
| Public package publication | **BLOCKED** | No approved package, notices, source process, SBOM, name, or release gate evidence |

## 25. Blocking issues

Public provider/package publication is blocked by all of the following:

1. no selected repository/package license or confirmed rights record;
2. no qualified answer for the concrete combined provider/host and AGPL source
   obligations, including remotely used modified software;
3. unresolved `@grafana/schema` and `@grafana/i18n` repository/package evidence;
4. unresolved authoritative Inter font license/copyright chain;
5. incomplete component-level copyright/license/notice output for the
   172-root/175-component runtime graph, including two MIT packages without
   local license text;
6. no reviewed choice for DOMPurify's dual license and no policy decision for
   BlueOak, CC0, or Unlicense inputs;
7. no implemented Corresponding Source/source-access and reproducible-release process;
8. no generated/reviewed notices, SBOM, modification ledger, or tarball audit;
9. unresolved “Grafana React SDK” project/package trademark status; and
10. no final candidate artifact or maintainer release sign-off.

None of these blockers invalidates the Phase 0/Phase 1 technical proof. They
prevent describing the current repository as release-compliant.

## 26. Recommended maintainer decisions

1. Approve `AGPL-3.0-only` as the direction for project-owned code, conditioned
   on a recorded rights/ownership check.
2. Retain the separately versioned provider architecture for technical reasons
   while using the same project-owned license direction across core/provider.
3. Treat the optimized 22-file provider as the maximum current application
   closure and fail any expansion pending a new provenance/license review.
4. Resolve the Inter asset or replace it before any public artifact.
5. Seek a targeted qualified review of the questions in Sections 6, 7, 14, 19,
   and 21 rather than requesting a generic open-source opinion.
6. Choose a neutral public name before Phase 2 publication unless written
   Grafana Labs permission is obtained.
7. Adopt inbound-equals-outbound contribution terms; add DCO only if the
   maintainer wants its lightweight provenance record.
8. Make the Section 22 checklist and artifact-derived notice/SBOM checks hard
   release gates, not advisory documentation.

### May `LICENSE` change next?

**Yes, after explicit maintainer approval and confirmation of authority over
the project-owned files, in a separate reviewed change.** That change should
license only project-owned work, preserve third-party terms, and be accompanied
or immediately followed by contribution and package-metadata alignment. It
must not be represented as approval to publish the Grafana-derived provider.

**LEGAL QUESTION.** A conservative maintainer may choose to obtain targeted
legal confirmation before that change, especially if employment ownership or
the intended combined-distribution scope is uncertain.

## 27. Phase 2 implications

Phase 2 — SDK Foundation and Experimental Package may use this audit as its
compliance specification, but public publication remains blocked. Work that may
proceed without distribution includes:

- production package/workspace design with packages kept private;
- project-owned provider contracts and exact compatibility manifests;
- artifact-derived provenance, notice, SBOM, tarball, and source-build tooling;
- replacement or provenance resolution for Inter;
- neutral-name selection and permission inquiry;
- clean-build/reproducibility experiments; and
- license/contribution-policy changes approved by the maintainer.

Phase 2 must not broaden panels, datasources, transformations, Grafana versions,
or asset categories without adding them to the same source/license/provenance
gate. The technical compatibility claim remains the exact Grafana 13.2.3,
Scenes 8.13.5, React/ReactDOM 19.2.8 cell with Text, Stat, Time series,
controlled TestData, and the verified transformation profile.

The issue `#21` audit work is ready to close after human review **only if** all
items in Section 25 are retained as separately tracked release blockers. Closing
the research issue must not be recorded as legal approval or release readiness.

## 28. Final status

**READY TO ADOPT AGPL WITH COMPLIANCE ACTIONS**

`AGPL-3.0-only` is a reasonable and coherent maintainer direction for the
stated open-source goals. The repository is operationally well positioned to
adopt it because the project-owned history currently shows one named author and
the Grafana-derived boundary is precisely inventoried.

This status does **not** mean all compliance work is complete. Public package
or browser-provider publication remains blocked by the license-evidence,
source-availability, notice/SBOM, reproducibility, asset, rights, and trademark
items above. Qualified review remains necessary for the explicitly labeled
legal and trademark questions.
