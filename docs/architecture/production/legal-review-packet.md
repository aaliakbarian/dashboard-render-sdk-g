# Legal Review Packet for Grafana Source Distribution

## 1. Document metadata

| Field | Value |
| --- | --- |
| Owner | Dashboard Render SDK G maintainers |
| Phase | Phase 1 — Production Architecture and Distribution Strategy |
| Workstream | Legal review preparation |
| GitHub issue | `#21` — Obtain legal review for Grafana source distribution model |
| Status | **READY FOR COUNSEL** |
| Created | 2026-10-18 |
| Last Updated | 2026-10-18 |
| Source baseline | Grafana OSS `v13.2.3`, commit `6193dc03311b631b9727b560d24369e683dc396e` |

## 2. Purpose / not legal advice

This packet prepares technical and documentary evidence for qualified legal
counsel. It does not perform legal review, interpret a license for a specific
jurisdiction, authorize distribution, select a project license, decide a
trademark question, or close issue #21.

The labels below remain distinct throughout:

- **VERIFIED FACT** — directly supported by repository evidence or a cited
  primary upstream source.
- **PROJECT INTENT** — what the maintainers want the product to become; it is
  not a statement about present rights.
- **TECHNICAL ARCHITECTURE** — an engineering boundary or preferred design; it
  is not asserted to be a legal boundary.
- **LEGAL QUESTION** — a question reserved for qualified counsel.

Counsel should review the concrete artifacts and intended distribution
scenarios, not infer conclusions merely from engineering terms such as
“package,” “provider,” “adapter,” “dynamic import,” or “separate bridge.”

## 3. Product description

**PROJECT INTENT.** The intended product is an open-source React/TypeScript SDK
that renders existing Grafana OSS dashboards as native React/DOM content:

- no iframe;
- no Grafana application shell, routing, navigation, or product chrome;
- dashboards selected by the user-facing Grafana dashboard UID;
- browser-side renderer-provider architecture;
- host-owned authentication, request transport, navigation, and application
  shell; and
- provider-owned Grafana renderer compatibility, including dashboard APIs,
  conversion, panels, datasources, transformations, styles, and assets.

**VERIFIED FACT.** Phase 0 proved this architecture for one exact compatibility
cell: Grafana OSS 13.2.3, the Grafana package cohort at 13.2.3,
`@grafana/scenes@8.13.5`, React/ReactDOM 19.2.8, a constrained V1/schema-42
dashboard, Text, Stat, Time series, the TestData `predictable_pulse` query, and
one selected transformation. It did not prove general Grafana compatibility.

## 4. Current architecture

**TECHNICAL ARCHITECTURE.** The preferred production direction is:

```text
host application
  -> license-neutral SDK-facing core
     -> project-owned renderer-provider contract
        -> explicitly installed, separately versioned Grafana provider
           -> exact Grafana package/runtime cohort
           -> reviewed renderer, datasource, style, and asset closure
           -> host-owned transport to the target Grafana server
```

The core and provider contract are intended to contain no Grafana packages,
Scenes, Grafana application source, or concrete provider implementation. The
provider owns all Grafana-specific behavior. React and ReactDOM are host-owned;
the provider owns one compatible Grafana/Scenes/runtime cohort.

The package boundary exists for dependency direction, replaceability, exact
versioning, lazy loading, provenance, singleton ownership, and conformance
testing. It is not described as a legal firewall.

**LEGAL QUESTION.** Counsel must determine whether this technical separation
has legal significance for the core, provider, browser bundle, and host
application under each proposed distribution and execution model.

## 5. Current repository/distribution state

### 5.1 Current repository

**VERIFIED FACT.** At the time of this packet:

- the repository [`LICENSE`](../../../LICENSE) is a no-permission placeholder;
  no open-source license has been selected;
- the root, host, compatibility, and bridge workspaces are private
  `0.0.0-poc` packages;
- no public npm SDK or renderer provider has been published;
- no Grafana `public/app` source file is tracked in this repository;
- `.grafana-source/` and `grafana-v13.2.3/` are ignored local checkouts;
- generated `dist/`, `build/`, browser evidence, Playwright output, and
  experiment artifacts are ignored except for explicitly tracked project-owned
  build tooling;
- tracked `packages/poc-grafana-bridge` content consists of project-owned
  loaders, aliases, adapters, tests, declarations, and provenance identities;
  it resolves audited upstream source from the ignored checkout during local
  builds; and
- the POC and Phase 1 experiments are private research artifacts, not a
  supported distribution.

The Git history currently reports one named author identity, Amin Aliakbarian,
using two email addresses. No `Co-authored-by` or `Signed-off-by` trailer was
found. The repository has no CLA, DCO, copyright-assignment agreement, or
explicit inbound-license statement. Git metadata alone does not establish
copyright ownership or authority to relicense.

### 5.2 Generated local artifacts

**VERIFIED FACT.** Local POC and experiment builds mechanically compile and
bundle upstream Grafana application source and third-party dependencies. Those
generated artifacts are ignored and are not tracked or published by this
repository. Their source graphs remain relevant evidence for any future
distribution analysis.

### 5.3 Hypothetical future distribution

**PROJECT INTENT.** A future release may include a public core SDK and a
separately versioned provider. Depending on counsel and maintainer decisions,
the provider might be distributed by this project, generated locally by a
user, or supplied independently.

**LEGAL QUESTION.** If this project distributes generated provider or browser
artifacts containing Grafana-derived renderer code, counsel must determine the
applicable outbound license, source-availability, notice, modification,
attribution, host-application, and network-use requirements. The current
repository state does not authorize that future distribution.

## 6. Exact Grafana source inventory summary

### 6.1 Fixed provenance

| Item | Exact identity |
| --- | --- |
| Grafana release | OSS `v13.2.3` |
| Public source commit | `6193dc03311b631b9727b560d24369e683dc396e` |
| Grafana npm package cohort | `13.2.3` |
| Scenes | `@grafana/scenes@8.13.5` |
| React / ReactDOM | `19.2.8` |
| Successful Phase 0 inspector | 9,154 inspected imports; 3,818 bundled modules; 148 chunks; exactly 55 reviewed `public/app` files |

The Docker image digest and running binary `BuildCommit` are separate fixture
identities and are not the source-analysis baseline.

### 6.2 Exact successful Phase 0 application-source closure

**VERIFIED FACT.** The successful Gate A, Gate B, Gate C, and TestData paths
contained exactly the following 55 Grafana `public/app` files. All paths are
relative to the pinned Grafana source commit. They were consumed from the
ignored checkout and appeared in ignored local browser bundles; they are not
tracked copies in this repository.

#### Text and shared configuration — 6 files

```text
public/app/core/config.ts
public/app/plugins/panel/text/panelcfg.gen.ts
public/app/plugins/panel/text/v1/TextPanel.tsx
public/app/plugins/panel/text/v1/TextPanelEditor.tsx
public/app/plugins/panel/text/v1/module.tsx
public/app/plugins/panel/text/v1/textPanelMigrationHandler.ts
```

The actual view path used the real Text renderer; the editor and migration
files were statically included by the upstream module entrypoint.

#### Stat — 8 files

```text
public/app/features/panel/suggestions/utils.ts
public/app/plugins/panel/stat/StatMigrations.ts
public/app/plugins/panel/stat/StatPanel.tsx
public/app/plugins/panel/stat/common.ts
public/app/plugins/panel/stat/module.tsx
public/app/plugins/panel/stat/panelcfg.gen.ts
public/app/plugins/panel/stat/presets.ts
public/app/plugins/panel/stat/suggestions.ts
```

#### Time series / GraphNG — 8 files

```text
public/app/core/components/GraphNG/GraphNG.tsx
public/app/core/components/GraphNG/utils.ts
public/app/core/components/TimeSeries/TimeSeries.tsx
public/app/core/components/TimeSeries/utils.ts
public/app/plugins/panel/timeseries/TimeSeriesPanel.tsx
public/app/plugins/panel/timeseries/TimeSeriesTooltip.tsx
public/app/plugins/panel/timeseries/plugins/OutsideRangePlugin.tsx
public/app/plugins/panel/timeseries/utils.ts
```

The Time series experiment compiled the upstream renderer while redirecting a
fixed set of application integrations to project-owned adapters for features
outside the controlled fixture.

#### TestData datasource — 33 files

```text
public/app/plugins/datasource/grafana-testdata-datasource/ConfigEditor.tsx
public/app/plugins/datasource/grafana-testdata-datasource/LogIpsum.ts
public/app/plugins/datasource/grafana-testdata-datasource/MetaDataInspector.tsx
public/app/plugins/datasource/grafana-testdata-datasource/QueryEditor.tsx
public/app/plugins/datasource/grafana-testdata-datasource/TestInfoTab.tsx
public/app/plugins/datasource/grafana-testdata-datasource/components/CSVContentEditor.tsx
public/app/plugins/datasource/grafana-testdata-datasource/components/CSVFileEditor.tsx
public/app/plugins/datasource/grafana-testdata-datasource/components/CSVWaveEditor.tsx
public/app/plugins/datasource/grafana-testdata-datasource/components/ErrorEditor.tsx
public/app/plugins/datasource/grafana-testdata-datasource/components/ErrorWithSourceEditor.tsx
public/app/plugins/datasource/grafana-testdata-datasource/components/ExemplarLabelsEditor.tsx
public/app/plugins/datasource/grafana-testdata-datasource/components/ExemplarsEditor.tsx
public/app/plugins/datasource/grafana-testdata-datasource/components/FlakyQueryEditor.tsx
public/app/plugins/datasource/grafana-testdata-datasource/components/GrafanaLiveEditor.tsx
public/app/plugins/datasource/grafana-testdata-datasource/components/NodeGraphEditor.tsx
public/app/plugins/datasource/grafana-testdata-datasource/components/PredictablePulseEditor.tsx
public/app/plugins/datasource/grafana-testdata-datasource/components/RandomWalkEditor.tsx
public/app/plugins/datasource/grafana-testdata-datasource/components/RawFrameEditor.tsx
public/app/plugins/datasource/grafana-testdata-datasource/components/SimulationQueryEditor.tsx
public/app/plugins/datasource/grafana-testdata-datasource/components/SimulationSchemaForm.tsx
public/app/plugins/datasource/grafana-testdata-datasource/components/StreamingClientEditor.tsx
public/app/plugins/datasource/grafana-testdata-datasource/components/USAQueryEditor.tsx
public/app/plugins/datasource/grafana-testdata-datasource/constants.ts
public/app/plugins/datasource/grafana-testdata-datasource/dataquery.ts
public/app/plugins/datasource/grafana-testdata-datasource/datasource.ts
public/app/plugins/datasource/grafana-testdata-datasource/metricTree.ts
public/app/plugins/datasource/grafana-testdata-datasource/module.tsx
public/app/plugins/datasource/grafana-testdata-datasource/nodeGraphUtils.ts
public/app/plugins/datasource/grafana-testdata-datasource/runStreams.ts
public/app/plugins/datasource/grafana-testdata-datasource/testData/flameGraphResponse.ts
public/app/plugins/datasource/grafana-testdata-datasource/testData/serviceMapResponse.ts
public/app/plugins/datasource/grafana-testdata-datasource/testData/serviceMapResponseMedium.ts
public/app/plugins/datasource/grafana-testdata-datasource/variables.ts
```

The real Predictable Pulse query exercised the upstream datasource/backend
query class. Many editor and optional-scenario files were statically included
but not executed by that path.

### 6.3 Exact deep/source package adapters

**VERIFIED FACT.** The Phase 0 bridge also resolved these exact-version paths:

| Package/source | Exact path |
| --- | --- |
| `@grafana/data@13.2.3` | `dist/esm/transformations/transformers/convertFieldType.mjs` |
| `@grafana/data@13.2.3` | `dist/esm/transformations/transformers/joinDataFrames.mjs` |
| `@grafana/data@13.2.3` | `dist/esm/field/fieldOverrides.mjs` |
| Grafana source, named Apache package directory | `packages/grafana-data/src/transformations/transformers/nulls/nullToUndefThreshold.ts` |
| `@grafana/ui@13.2.3` | `dist/esm/components/uPlot/utils.mjs` |
| `@grafana/ui@13.2.3` | `dist/esm/components/uPlot/config/gradientFills.mjs` |
| `@grafana/ui@13.2.3` | `dist/esm/components/uPlot/PlotLegend.mjs` |
| `@grafana/ui@13.2.3` | `dist/esm/components/uPlot/plugins/TooltipPlugin2.mjs` |

These paths are exact-version implementation seams, not public stability
claims.

### 6.4 Later optimized view/runtime closure

**VERIFIED FACT.** Later non-distributed Phase 1 experiments proved that the
same controlled product behavior can be retained with a narrower 22-file
application-source closure:

- Text: 2 files (`TextPanel.tsx` and `panelcfg.gen.ts`);
- Stat: 1 file (`StatPanel.tsx`);
- Time series/GraphNG: the same 8 renderer files; and
- TestData: 11 runtime files rooted at `datasource.ts`, with configuration,
  query-editor, and metadata UI removed.

Those experiments also removed Monaco, React-Monaco, CodeMirror, Codicon, and
editor CSS from the view profile while retaining real Text, Stat, Time series,
and TestData behavior. They do not eliminate Grafana application source and do
not supersede the broader 55-file Phase 0 inventory for counsel's analysis.

## 7. Published package inventory

**VERIFIED FACT.** The verified cell directly uses the following published
Grafana packages:

| Package | Version | Manifest/package license evidence | Upstream path/repository | Grafana `LICENSING.md` named Apache exception? | Relevant qualification |
| --- | --- | --- | --- | --- | --- |
| `@grafana/data` | 13.2.3 | `Apache-2.0`; `LICENSE_APACHE2` included | `grafana/grafana`, `packages/grafana-data` | Yes | Three compiled deep paths and one source helper are exact-version seams. |
| `@grafana/ui` | 13.2.3 | `Apache-2.0`; `LICENSE_APACHE2` included | `grafana/grafana`, `packages/grafana-ui` | Yes | UI, Emotion, uPlot, overlays, styles, and path-based assets. |
| `@grafana/runtime` | 13.2.3 | `Apache-2.0`; `LICENSE_APACHE2` included | `grafana/grafana`, `packages/grafana-runtime` | Yes | Module-level singleton services; provider-private initialization. |
| `@grafana/schema` | 13.2.3 | `Apache-2.0`; `LICENSE_APACHE2` included | `grafana/grafana`, `packages/grafana-schema` | No, not by directory name | Package-local evidence and repository exception-list omission require counsel review. |
| `@grafana/i18n` | 13.2.3 | `Apache-2.0`; `LICENSE_APACHE2` included | `grafana/grafana`, `packages/grafana-i18n` | No, not by directory name | Same evidence tension as Schema. |
| `@grafana/e2e-selectors` | 13.2.3 | `Apache-2.0`; `LICENSE_APACHE2` included | `grafana/grafana`, `packages/grafana-e2e-selectors` | Yes | Used transitively by renderer/UI code. |
| `@grafana/scenes` | 8.13.5 | `Apache-2.0`; package `LICENSE` included | Separate `grafana/scenes` repository | Not applicable | Declares React/ReactDOM `^18`; the tested React 19.2.8 combination is an exact evidence cell. |

`@grafana/scenes-react` was not declared, installed, or bundled. Transitive
`@grafana/faro-core` and `@grafana/faro-web-sdk` 2.12.1 package manifests also
declare Apache-2.0; Phase 0 did not initialize Faro telemetry.

**VERIFIED FACT.** Grafana v13.2.3
[`LICENSING.md`](https://github.com/grafana/grafana/blob/v13.2.3/LICENSING.md)
states an AGPL-3.0-only repository default and names bounded Apache-2.0
directory exceptions. The 55 `public/app` files above are outside the listed
exceptions, and no narrower file header or nested license was found for them.
The published package manifests and package-local license files are separate
evidence. Scenes is licensed from its separate repository.

**LEGAL QUESTION.** Counsel should reconcile the `@grafana/schema` and
`@grafana/i18n` package-local Apache declarations with their omission from the
v13.2.3 repository exception list. This packet does not resolve that evidence
tension.

## 8. Third-party dependency/assets summary

This is a counsel-relevant inventory, not a complete release SBOM.

| Component | Exact observed version/source | Current technical state | Evidence or unresolved review |
| --- | --- | --- | --- |
| Monaco editor | `monaco-editor@0.34.1` | Phase 0 emitted editor JS/CSS; optimized view profile excludes it | Package declares MIT and includes `LICENSE` plus `ThirdPartyNotices.txt`; counsel should confirm any future authoring-profile requirements. |
| Codicon | TTF emitted through Phase 0 Monaco CSS | Excluded from optimized view profile | Trace the applicable Monaco third-party notice and attribution if ever distributed. |
| Inter fonts | Grafana `public/fonts/inter/Inter-Regular.woff2` and `Inter-Medium.woff2` | Later provider asset experiment packages both for the tested view profile; current artifacts remain ignored | No nested font license was found in the pinned tree; Grafana's repository-level evidence and upstream font provenance need explicit counsel review. |
| Grafana Unicons SVG | `public/img/icons/unicons/times.svg` | Later provider experiment packages it for Modal close behavior | Directory is a named Apache-2.0 exception and contains `LICENSE_APACHE2` and `NOTICE.txt`; artifact-specific notice treatment remains for counsel. |
| uPlot | `uplot@1.6.32` | Code and CSS required by Time series | Package declares MIT and includes `LICENSE`. |
| Emotion | `@emotion/react@11.14.0`, `@emotion/css@11.13.5` | Provider runtime styling; separate cache/singleton ownership was tested | Package manifests declare MIT. |
| RxJS | `rxjs@7.8.2` | Provider runtime/query/event dependency | Package declares Apache-2.0 and includes `LICENSE.txt`. |
| React / ReactDOM | `19.2.8` | Host-owned and externalized from the production-shaped provider | Package manifests declare MIT. |
| Slider CSS | `@rc-component/slider@1.2.1` | Small published-UI transitive preload in the asset experiment | Package manifest declares MIT; removal may be a later graph optimization. |
| Router, i18n, lodash, react-use | `react-router-dom@6.30.3`, `i18next@26.4.2`, `lodash@4.18.1`, `react-use@17.6.1` | Observed runtime dependencies | Manifests declare MIT except `react-use` (`Unlicense`); include in an artifact-specific SBOM. |
| Roboto Mono / other Grafana fonts | Pinned Grafana source and diagnostic/reference requests | Not emitted by Phase 0 selected bundle or later verified view profile | Reopen if a release bundles or fetches them deliberately. |
| Workers / WASM | None in the verified view closure | Not distributed by the tested provider | Reassess for every added capability. |

**LEGAL QUESTION.** Counsel should specify the license, notice, attribution,
modification, and source-provenance materials required for each component that
actually enters a release. The project must generate an artifact-specific SBOM
rather than rely on this summary.

## 9. Distribution models considered

| Model | Technical description and result | Question for counsel |
| --- | --- | --- |
| **A — permissive/core SDK with separately distributed Grafana provider** | Technically preferred provider boundary; provider license remains undecided. Preserves fidelity, version isolation, and lazy loading. | Can the core be permissively licensed, what may the provider use, and what obligations reach the host/browser bundle? |
| **B — complete project under AGPL-3.0-only** | Technically viable but does not solve bundle, version, singleton, React, style, or transformation issues. Product research found likely adoption friction. | What rights are needed to license all project-owned code this way, and what are the combined browser/host implications? |
| **C — permissive core plus AGPL renderer provider** | Leading hybrid candidate from technical/product research, but package separation alone is not treated as a legal conclusion. | Is the separation legally meaningful; what obligations apply to each package and proprietary hosts that bundle/load both? |
| **D — local/user-generated provider from the user's Grafana checkout** | Technically viable fallback with substantial toolchain, provenance, support, and reproducibility cost. Not presented as a legal workaround. | How do distributed tooling/recipes/adapters differ from distributing source or generated outputs, and who bears which obligations? |
| **E — server-hosted Grafana renderer modules** | **Failed for Grafana 13.2.3 built-ins.** Core panels are content-hashed webpack JSONP chunks coupled to the Grafana application runtime; TestData is AMD and expects Grafana's SystemJS/shared dependency environment. Installed third-party plugins remain a separate unproved experiment. | If a future bounded server-hosted provider succeeds, how does loading code from the user's Grafana deployment affect distribution, network-use, notices, and host obligations? |

No model is legally approved by this packet.

## 10. Preferred technical model

**TECHNICAL ARCHITECTURE.** Retain the hybrid provider boundary:

1. a small project-owned core and renderer contract with no Grafana
   dependencies;
2. a separately versioned, exact-cell Grafana renderer provider;
3. host-owned React/ReactDOM and transport/authentication;
4. provider-owned Grafana/Scenes/runtime cohort, panels, datasources,
   transformations, styles, and assets;
5. independently lazy view-only renderer/runtime entries;
6. exact source, package, asset, and adaptation provenance;
7. fail-closed compatibility validation before singleton initialization; and
8. conformance evidence for every supported compatibility cell.

The initial technical cell remains exactly Grafana OSS 13.2.3, package cohort
13.2.3, Scenes 8.13.5, React/ReactDOM 19.2.8, V1/schema 42, Text, Stat, Time
series, controlled TestData, and the admitted transformation profile.

**LEGAL QUESTION.** Counsel must select or approve the permissible
distribution and licensing implementation of this architecture. Engineering
preference does not authorize Model A or C.

## 11. AGPL questions

Counsel is asked to answer these for the concrete architecture and artifacts:

1. If the renderer provider distributes the identified Grafana application
   modules classified by upstream's repository default as AGPL-3.0-only, what
   licensing, source, notice, and other obligations apply?
2. Does placing those modules in a separate provider package change the
   analysis compared with distributing them in the main SDK package?
3. Can the SDK-facing core remain under a permissive license while a distinct
   renderer provider is AGPL-licensed?
4. What boundary, if any, between a permissive core, AGPL provider, and
   proprietary host application is legally meaningful?
5. What obligations arise when a browser build statically bundles, dynamically
   imports, code-splits, caches, or otherwise combines the provider and host?
6. What does AGPL Section 13 imply for this frontend architecture, where code
   is delivered to users' browsers and makes network requests to Grafana?
7. What changes if users generate the provider locally from their own Grafana
   checkout instead of receiving Grafana-derived source or compiled output
   from this project?
8. What changes if a future provider loads frontend code served by the user's
   Grafana installation?
9. What source—including project adapters, build scripts, exact upstream
   source, generated files, source maps, and dependency lock data—must be
   offered or provided with each distributed provider/browser artifact?
10. What modification notices are required for project-owned adapters,
    redirected imports, generated renderer entries, and bundled output around
    Grafana source?
11. Which Grafana `LICENSE`, `NOTICE.md`, copyright, source, and attribution
    materials must accompany source, npm, browser, CDN, or release-attachment
    distributions, and how must they be presented?

The maintainers are not asking this packet to answer those questions.

## 12. Package/license questions

1. How may the Apache-2.0 Grafana packages and separately licensed Scenes
   package be combined with a provider that contains Grafana application source
   classified under the repository's AGPL-3.0-only default?
2. How should `@grafana/schema` and `@grafana/i18n` package manifests and
   included `LICENSE_APACHE2` files be reconciled with their omission from the
   v13.2.3 `LICENSING.md` Apache exception list?
3. Which Apache license copies, NOTICE inputs, copyright notices, patent terms,
   and modification markings must accompany the exact npm/browser artifacts?
4. What outbound licenses may apply to project-owned core, contract, adapters,
   provider code, build tooling, and conformance tooling around the Apache and
   AGPL inputs?
5. Does importing unsupported deep compiled package paths or one package-source
   helper change any license/notice treatment compared with public package-root
   imports?
6. How should generated Grafana panel configuration files and their upstream
   CUE provenance be represented in source and notice materials?

## 13. Third-party-license questions

1. What materials must accompany Monaco 0.34.1, its
   `ThirdPartyNotices.txt`, and Codicon if an authoring artifact ever includes
   them?
2. What license and attribution evidence applies to the exact Inter WOFF2 files
   sourced from Grafana's tree and used by the optimized provider experiment?
3. What materials must accompany the Grafana Unicons `times.svg`, including
   its directory-level Apache license and NOTICE?
4. What notices are required for uPlot code/CSS, Emotion, RxJS, React,
   ReactDOM, slider CSS, Faro, Router, i18next, lodash, react-use, and the final
   transitive graph?
5. How should CSS produced from mixed project, Grafana package, Grafana
   application, and third-party inputs be attributed?
6. What must an artifact-specific SBOM and third-party notice report contain,
   and where must those materials be delivered for npm and browser artifacts?
7. Must source maps be distributed, omitted, or handled specially when they
   reveal or embed Grafana or third-party source?

## 14. Trademark questions

Trademark review is separate from software-license review.

**VERIFIED FACT.** The project and repository use the name “Grafana React
SDK.” The README states that Grafana is a trademark of Grafana Labs and that
the project is independent and not endorsed by or affiliated with Grafana
Labs. No documented permission from Grafana Labs was found in this repository.

**VERIFIED FACT.** Grafana Labs' current
[`Trademark Usage Policy`](https://grafana.com/trademark-policy/) addresses
open-source discussion, attribution, affiliation, use of marks in product or
service names, logos, websites, marketing, derivative software, screenshots,
and requests for written permission. The policy expressly contains provisions
relevant to the current project name and requires counsel review before public
package naming. The policy may change.

Counsel is asked:

1. Is “Grafana React SDK” acceptable as an open-source project and repository
   name under the current policy?
2. Would any npm package using “grafana” in its name require permission?
3. Should the project be renamed before Phase 2 or public npm publication?
4. What compatibility wording—such as “compatible with Grafana OSS” or “for
   Grafana OSS 13.2.3”—is permissible and least likely to imply affiliation?
5. What attribution and independence disclaimer wording is required or
   advisable, and does the policy's stated attribution language presuppose
   permission the project has not documented?
6. May project documentation include Grafana UI screenshots, comparison
   images, panel imagery, names, or logos, and under what conditions?
7. Should the maintainers request written permission before retaining the
   project/repository name or selecting package names?

No rename or trademark conclusion is made here.

## 15. Contributor/relicensing questions

**VERIFIED FACT.** The repository currently has one named Git author identity,
no CLA/DCO/copyright-assignment mechanism, no explicit inbound-license rule,
and a no-permission license placeholder. Grafana-derived and third-party
materials remain outside the project's ownership regardless of the outbound
license selected for project-owned code.

Counsel is asked:

1. What evidence is needed to confirm that existing project-owned code may be
   licensed or relicensed, including employment or contractor ownership?
2. Should future contributions use a DCO, CLA, copyright assignment,
   inbound-equals-outbound rule, or another mechanism?
3. What contributor rights are needed to preserve future commercial or
   dual-license flexibility for project-owned core/provider code?
4. Is dual licensing realistic for any project-owned component, and which
   components cannot be offered under alternate terms by this project?
5. How does inclusion or adaptation of Grafana-derived code constrain the
   project's ability to offer alternate licenses?
6. Should contribution governance differ between a permissive core and a
   separately licensed renderer provider?

No governance or license file is changed by this packet.

## 16. Desired counsel response format

Please return a written, decision-oriented response that clearly separates
conclusions, assumptions, jurisdictional limits, and required follow-up:

| Decision | Requested counsel output |
| --- | --- |
| A. Core SDK permissible license choices | Approved choices and conditions for project-owned core/contract code |
| B. Renderer/provider permissible license choices | Approved choices and conditions for the concrete Grafana provider |
| C. Grafana-derived renderer distribution | Whether source and compiled provider/browser artifacts may be distributed under each model |
| D. Source-distribution obligations | Exact source, scripts, offer, delivery mechanism, and duration requirements |
| E. LICENSE / NOTICE / attribution | Exact files, notices, modification statements, and placement per artifact |
| F. Third-party assets | Required treatment of fonts, icons, CSS, Monaco/Codicon, uPlot, and other dependencies |
| G. Host-application implications | Static/dynamic integration, proprietary-host, browser-delivery, and AGPL Section 13 analysis |
| H. Trademark/project name | Keep, rename, seek permission, and required wording |
| I. npm/package names | Permissible naming pattern and permission requirements |
| J. Contributor/governance | DCO/CLA/inbound-license/ownership and dual-license recommendations |
| K. Prohibited or high-risk models | Models or deployment combinations that should not be offered |
| L. Required pre-release changes | Concrete actions required before source, npm, browser, CDN, or release distribution |

Where the answer depends on an exact artifact, counsel should identify the
artifact definition or additional evidence needed rather than generalizing
from package names.

## 17. References/evidence index

### Primary upstream evidence

- Grafana OSS v13.2.3
  [`LICENSING.md`](https://github.com/grafana/grafana/blob/v13.2.3/LICENSING.md),
  [`LICENSE`](https://github.com/grafana/grafana/blob/v13.2.3/LICENSE), and
  [`NOTICE.md`](https://github.com/grafana/grafana/blob/v13.2.3/NOTICE.md).
- Grafana v13.2.3
  [release](https://github.com/grafana/grafana/releases/tag/v13.2.3) and
  [source commit](https://github.com/grafana/grafana/commit/6193dc03311b631b9727b560d24369e683dc396e).
- Grafana package manifests:
  [`data`](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-data/package.json),
  [`ui`](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-ui/package.json),
  [`runtime`](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-runtime/package.json),
  [`schema`](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-schema/package.json),
  [`i18n`](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-i18n/package.json), and
  [`e2e-selectors`](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-e2e-selectors/package.json).
- Scenes v8.13.5
  [`package.json`](https://github.com/grafana/scenes/blob/v8.13.5/package.json)
  and [`LICENSE`](https://github.com/grafana/scenes/blob/v8.13.5/LICENSE).
- Grafana Labs
  [`Trademark Usage Policy`](https://grafana.com/trademark-policy/).
- Monaco 0.34.1
  [`LICENSE`](https://github.com/microsoft/monaco-editor/blob/v0.34.1/LICENSE)
  and
  [`ThirdPartyNotices.txt`](https://github.com/microsoft/monaco-editor/blob/v0.34.1/ThirdPartyNotices.txt).
- uPlot 1.6.32
  [`LICENSE`](https://github.com/leeoniya/uPlot/blob/1.6.32/LICENSE).

### Project evidence

- [Licensing/distribution strategy](licensing-distribution-strategy.md)
- [Complete-project AGPL evaluation](agpl-project-license-evaluation.md)
- [Renderer-provider architecture](bridge-provider-architecture.md)
- [Grafana version policy](grafana-version-compatibility-policy.md)
- [Bundle/dependency strategy](bundle-dependency-strategy.md)
- [Server-hosted module experiment](server-hosted-module-experiment.md)
- [Phase 0 POC results](../research/poc-results.md)
- [Panel-rendering dependency analysis](../research/panel-rendering-dependencies.md)
- [Text renderer-only experiment](experiments/text-renderer-only.md)
- [TestData runtime-only experiment](experiments/testdata-runtime-only.md)
- [Shared Grafana cohort experiment](experiments/shared-grafana-cohort.md)
- [React-externalized provider experiment](experiments/react-externalized-provider.md)
- [Provider asset experiment](experiments/provider-assets.md)
- [`scripts/inspect-poc-bundle.mjs`](../../../scripts/inspect-poc-bundle.mjs)
- [`packages/poc-grafana-bridge`](../../../packages/poc-grafana-bridge/)

### Evidence counsel should receive with this packet

1. The pinned upstream `LICENSING.md`, `LICENSE`, and `NOTICE.md` files.
2. The seven exact published-package manifests and included license files.
3. The complete 55-file Phase 0 inventory and the eight deep/source adapter
   identities.
4. The 22-file optimized view/runtime inventory and project-owned adaptation
   map.
5. Generated source/chunk/asset provenance, checksums, and an artifact-specific
   SBOM for any candidate provider counsel is asked to approve.
6. Monaco/Codicon notices if an authoring artifact is considered.
7. Inter font and Unicons source/license/notice evidence for the optimized
   provider asset profile.
8. The current repository `LICENSE`, contribution policy, and Git authorship
   summary.
9. The current Grafana Trademark Usage Policy and proposed repository/npm
   names, descriptions, disclaimers, and any screenshots.
10. A concrete integration diagram for each host model counsel is asked to
    approve: static bundle, lazy provider chunks, CDN, local build, or remote
    server loading.

## 18. Open decisions blocked on counsel

Until qualified legal review is returned and recorded, the project must not:

- replace the repository license placeholder or set package license fields;
- publish or otherwise distribute a provider containing Grafana application
  source or compiled derivatives;
- choose Models A, B, or C as a release licensing policy;
- claim that a separate provider protects or isolates a proprietary host from
  any license obligation;
- publish local-build tooling as a presumed legal workaround;
- design source-offer, LICENSE, NOTICE, or attribution delivery as complete;
- offer dual/commercial licensing;
- finalize public project/npm names using Grafana marks;
- state that screenshots or Grafana visual assets may be used publicly; or
- close issue #21.

## 19. What engineering may continue regardless

The following private, non-distributed, license-neutral work may continue
without presuming counsel's answer:

- maintain the project-owned provider/core contract and exact compatibility
  manifest design;
- improve source, dependency, asset, checksum, SBOM, license, and notice
  provenance automation;
- keep provider builds local and ignored while measuring view-only closure;
- maintain closed allowlists and fail on unexplained source/asset drift;
- write provider conformance, version, lifecycle, security, and unsupported
  capability tests;
- preserve host-owned React/transport and provider-owned runtime boundaries;
- prepare candidate artifact inventories for counsel; and
- synthesize completed Phase 1 technical evidence without publishing packages.

Engineering must stop before public provider artifacts, release attachments,
npm publication, license selection, trademark-dependent naming decisions, or
claims about proprietary-host compatibility.

## 20. Final status

**READY FOR COUNSEL**

The technical architecture, exact Phase 0 source closure, narrower experimental
closure, published packages, third-party assets, current repository state, and
candidate distribution models are sufficiently documented for qualified
counsel to review. No legal conclusion or distribution permission follows from
this status.

Issue #21 is **NOT ready to close** until qualified human legal counsel returns
a written review and a maintainer records the resulting licensing,
distribution, attribution, trademark, and contributor-governance decisions.
