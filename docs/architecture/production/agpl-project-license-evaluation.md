# AGPL-3.0 Licensing Evaluation for the Complete SDK

## 1. Document metadata

| Field | Value |
| --- | --- |
| Owner | Dashboard Render SDK G maintainers |
| Phase | Phase 1 — Production Architecture and Distribution Strategy |
| Workstream | Evaluate AGPL-3.0 licensing for the complete SDK |
| Status | research |
| Created | 2026-10-10 |
| Last Updated | 2026-10-10 |

This document is an engineering and product-policy evaluation, not legal
advice. It uses these labels deliberately:

- **VERIFIED FACT** — directly supported by repository history, a cited
  upstream source, a package artifact, or reproducible Phase 0 evidence.
- **INFERENCE** — an engineering interpretation of verified facts.
- **PRODUCT CONSIDERATION** — a likely adoption, ecosystem, or commercial
  consequence that is not a statement of law.
- **TECHNICAL RECOMMENDATION** — a proposed architecture or engineering action
  independent of final legal approval.
- **LEGAL QUESTION** — a question reserved for qualified legal counsel.

## 2. Executive summary

**VERIFIED FACT.** Phase 0 proved the core native-rendering architecture with
Grafana OSS 13.2.3: a React 19.2.8 host retrieved a dashboard by UID, converted
the constrained V1/schema-42 DTO to Scenes, rendered real Text, Stat, and Time
series panels, and executed the real TestData query path without an iframe,
`GrafanaApp.init`, or the Grafana application shell. The successful bundle
contained exactly 55 reviewed Grafana `public/app` files, eight exact-version
deep/source package adapters, and a measured CSS/editor/asset closure.

**VERIFIED FACT.** Grafana v13.2.3
[`LICENSING.md`](https://github.com/grafana/grafana/blob/v13.2.3/LICENSING.md)
states that its repository default is AGPL-3.0-only and lists bounded
Apache-2.0 exceptions. The 55 reviewed `public/app` files are outside those
exceptions. The current Grafana React SDK [`LICENSE`](../../../LICENSE) is a
no-permission placeholder; no project open-source license has been selected.

**INFERENCE.** Applying AGPL-3.0-only to all project-owned SDK and bridge code
would simplify one part of the distribution story: the project would no longer
be attempting to keep its own renderer artifact permissively licensed while
that artifact incorporates Grafana application files covered by the same
AGPL-3.0-only upstream default. It could also make source-integration decisions
less dominated by an effort to avoid those files.

It would not, however, remove the need for an explicit bridge/provider
boundary. Exact Grafana coupling, optional renderer chunks, source and asset
provenance, Runtime singleton ownership, React/Scenes compatibility, style
containment, transformations, testing, and renderer replaceability all remain
technical requirements. AGPL also does not replace Apache, MIT, notice,
attribution, or trademark requirements.

**PRODUCT CONSIDERATION.** The intended product is a frontend library bundled
into host React applications. Making the entire SDK AGPL would predictably
increase legal-review friction for proprietary SaaS and commercial adopters,
especially while the scope of a combined browser bundle and proprietary
adapters remains a counsel question. That cost may materially conflict with
the project's intended embedding audience.

**TECHNICAL RECOMMENDATION — HIGH confidence.** Retain a small SDK-facing core
and an explicit, version-matched renderer-provider boundary regardless of the
outbound license ultimately selected. Full-project AGPL provides no technical
reason to collapse that boundary.

**PRODUCT RECOMMENDATION — MEDIUM confidence.** Do not adopt full-project AGPL
solely to simplify the bridge. Prefer a hybrid direction: keep the core/provider
contract license-neutral while qualified counsel evaluates whether a separate
AGPL renderer bridge is permissible, operationally useful, and acceptable to
target users. Preserve local-build and future server-hosted providers as
alternatives until that review is complete.

**LEGAL APPROVAL REQUIRED.** This research does not authorize an AGPL license
change, an AGPL bridge publication, combination with proprietary host code,
dual licensing, or redistribution of Grafana application source. Those
decisions depend on the questions in Section 16.

**Final status: PREFER HYBRID STRATEGY.** This is an architecture and product
recommendation, not a licensing approval.

## 3. Decision being evaluated

The workstream compares two serious directions:

### Option A — separated distribution model

A small SDK-facing package owns host integration, dashboard lifecycle, typed
errors, and a renderer-provider contract. An exact-version Grafana bridge owns
application-source renderers, datasource modules, package adapters, styles,
assets, and compatibility metadata. The core attempts to remain under a
permissive-compatible license; the bridge's distribution and license require a
separate decision.

### Option B — full AGPL model

All project-owned SDK, compatibility, and bridge code would be licensed
AGPL-3.0-only. The project would intentionally accept strong copyleft and
would not organize the implementation primarily to avoid incorporating the
reviewed Grafana application source.

The core decision is not whether AGPL can make one repository easier to label.
It is whether full-project AGPL materially improves the production architecture
enough to outweigh its consumer, governance, and flexibility costs.

**Decision rule.** Full-project AGPL should be preferred only if it improves
source integration and maintenance without discarding provider boundaries that
remain technically valuable, and if its downstream product posture is accepted
after qualified legal and user-market review.

## 4. Current licensing/distribution baseline

### 4.1 Pinned evidence

| Evidence | Exact identity | Relevance |
| --- | --- | --- |
| Grafana source | `v13.2.3`, commit `6193dc03311b631b9727b560d24369e683dc396e` | Source and license baseline |
| Grafana packages | `13.2.3` | Published Data/UI/Runtime/Schema/i18n/selectors cohort |
| Scenes | `@grafana/scenes@8.13.5` | Published scene runtime from the separate `grafana/scenes` repository |
| Host runtime | React/ReactDOM `19.2.8` | Proven Phase 0 browser runtime |
| Exact POC inventory | [Grafana source licensing and distribution strategy](licensing-distribution-strategy.md) | Complete path, package, asset, and provenance inventory |
| Rendering evidence | [Phase 0 POC results](../research/poc-results.md) | Successful runtime and final bundle evidence |

The Docker fixture digest and patched binary `BuildCommit` are separate runtime
artifact identities. They are not the source-analysis or licensing baseline.

### 4.2 Exact successful Phase 0 closure

**VERIFIED FACT.** The final bundle inspector evaluated 9,154 imports, 3,818
modules, and 148 chunks. It admitted exactly 55 reviewed Grafana application
files and reported no unauthorized `public/app` source, unresolved Grafana
internal package, or SystemJS module.

| Source group | Count | Exact entry/closure identity | Runtime role |
| --- | ---: | --- | --- |
| Text and shared config | 6 | `public/app/core/config.ts` plus `public/app/plugins/panel/text/v1/*` and `panelcfg.gen.ts` | Real Text renderer; editor and migration statically included |
| Stat | 8 | `public/app/plugins/panel/stat/*` plus `public/app/features/panel/suggestions/utils.ts` | Real Stat renderer, migrations, presets, and suggestions |
| Time series / GraphNG | 8 | `TimeSeriesPanel.tsx`, Time series/GraphNG components, tooltip, plot plugin, and utilities | Real Time series renderer and uPlot path |
| TestData | 33 | `public/app/plugins/datasource/grafana-testdata-datasource/**` | Real datasource/backend-query class; many editors and optional scenarios statically included |
| **Total** | **55** | Enforced by [`scripts/inspect-poc-bundle.mjs`](../../../scripts/inspect-poc-bundle.mjs) | Exact final POC closure, not an estimate |

The complete 55-path table is retained in Sections 4.2–4.5 of the
[distribution strategy](licensing-distribution-strategy.md#4-exact-phase-0-grafana-sourcepackage-inventory).
The bridge imports those files only from the ignored pinned source checkout; it
does not contain tracked copies.

The POC additionally adapts these exact-version package paths:

- three compiled `@grafana/data@13.2.3` transformation/field-override modules;
- one `packages/grafana-data` source helper under the named Apache exception;
- four compiled `@grafana/ui@13.2.3` uPlot modules; and
- project-owned no-op adapters for Time series application integrations that
  the controlled fixture does not exercise.

### 4.3 Published packages and assets

| Dependency group | Exact evidence | Current classification |
| --- | --- | --- |
| `@grafana/data`, `@grafana/ui`, `@grafana/runtime`, `@grafana/e2e-selectors` | Version `13.2.3`; manifests and package license files say Apache-2.0; directories named in Grafana `LICENSING.md` exceptions | Apache-2.0 evidence is internally consistent |
| `@grafana/schema`, `@grafana/i18n` | Version `13.2.3`; manifests and `LICENSE_APACHE2` say Apache-2.0; directories are not named in repository exception list | Evidence tension remains a legal question |
| `@grafana/scenes` | Version `8.13.5`; separate repository manifest and `LICENSE` say Apache-2.0 | Apache-2.0; declares React/DOM `^18` peers |
| Faro packages | `@grafana/faro-core` and `@grafana/faro-web-sdk` `2.12.1`, transitively bundled, Apache-2.0 | Retain package license evidence even though POC telemetry is not initialized |
| Monaco/Codicon | `monaco-editor@0.34.1`, package MIT license and `ThirdPartyNotices.txt`; emitted Codicon font and editor CSS | Independent license/notice inventory required |
| uPlot | `uplot@1.6.32`, MIT, code and CSS used by Time series | Independent copyright/license notice required |
| Other inspected runtime packages | React/DOM `19.2.8` MIT; Emotion CSS `11.13.5` and React `11.14.0` MIT; RxJS `7.8.2` Apache-2.0; React Router DOM `6.30.3`, i18next `26.4.2`, and lodash `4.18.1` MIT; react-use `17.6.1` Unlicense | Independently licensed inputs; this is not a complete transitive SBOM |
| Inter/Roboto | Observed only as diagnostic Grafana-server requests; not emitted in the selected POC bundle | Reopen only if production artifacts bundle or deliberately fetch them |

`@grafana/scenes-react` is not declared, locked, installed, or bundled.

### 4.4 Current repository distribution state

**VERIFIED FACT.** The root and all three POC workspaces are private
`0.0.0-poc` packages. No npm SDK has been published.

**VERIFIED FACT.** The tracked `packages/poc-grafana-bridge` files are
project-owned aliases, loader code, adapters, and provenance definitions. The
Grafana `public/app` source is consumed from ignored
`.grafana-source/grafana-v13.2.3/`; generated `dist/`, POC browser builds,
evidence, Playwright output, and test results are ignored. No such generated
bundle is tracked.

**VERIFIED FACT.** The current [`LICENSE`](../../../LICENSE) grants no
permission and explicitly defers selecting an open-source license. Therefore,
this repository is not presently a permissively licensed SDK and is not
presently AGPL-licensed.

Repository source distribution, ignored local POC bundles, and a future npm
artifact are materially different distribution states. Selecting AGPL for
project-owned files would not retroactively turn third-party components into
project-owned AGPL code or remove their notices.

## 5. Relicensing feasibility evidence

### 5.1 Git and contribution evidence

**VERIFIED FACT.** `git shortlog -sne --all` reports one named author, Amin
Aliakbarian, under two email addresses, across the complete current history.
No `Co-authored-by` or `Signed-off-by` trailer was found. No commit in current
history has a different named author.

**VERIFIED FACT.** The repository contains no CLA, DCO, copyright-assignment
file, or inbound-license statement. [`CONTRIBUTING.md`](../../../CONTRIBUTING.md)
describes process but does not state contribution licensing terms. The current
license placeholder grants no permission.

**INFERENCE.** With no externally authored commit visible in Git, changing the
project-owned code's license is operationally simpler now than it would be
after accepting contributions from multiple copyright holders.

**LEGAL QUESTION.** Git author metadata does not prove copyright ownership,
employer ownership, authorization to relicense, or the absence of unrecorded
contributors. Counsel must confirm ownership of every project-owned file and
any employment or contractor terms before a license change.

### 5.2 Limits on what the project could license

**VERIFIED FACT.** The project can only apply an outbound license to rights it
holds or is authorized to sublicense. Grafana application source, published
Grafana packages, Scenes, Monaco, Codicons, uPlot, fonts, React, and all other
dependencies remain governed by their upstream licenses.

**INFERENCE.** A root AGPL declaration could describe project-owned code and a
combined distribution, but it cannot erase upstream copyright, notices, or
license conditions. A source/asset bill of materials remains necessary.

**LEGAL QUESTION.** Counsel must determine whether all tracked project code is
available for relicensing, how the root license should describe independently
licensed dependencies, and what notices a combined npm/browser distribution
must carry.

## 6. Dependency license compatibility

This section records upstream evidence and questions; it does not issue a
legal compatibility opinion.

| Category | Upstream evidence | Relevance to AGPL-3.0-only outbound project | Remaining question |
| --- | --- | --- | --- |
| 55 Grafana `public/app` files | Grafana v13.2.3 repository default is AGPL-3.0-only; no named exception or narrower file/directory license found | Using the same license identifier removes a project/application-source license mismatch at the top level | Scope of covered/combined work, source offer, notices, modification marking, and browser distribution |
| Named-exception Grafana packages | Apache-2.0 manifests/license files and explicit monorepo exceptions | GNU's [license compatibility guide](https://www.gnu.org/licenses/license-compatibility.en.html) says GNU licenses version 3 subsume Apache-2.0; Apache terms still require license/notice handling | Counsel confirms exact combined artifact and patent/NOTICE handling |
| Schema and i18n packages | Apache-2.0 manifests and included license files, but not named in Grafana's exception list | Package artifacts present Apache evidence; repository evidence is not fully aligned | Counsel reconciles those two upstream signals before release |
| `@grafana/scenes@8.13.5` | Separate repository/package under Apache-2.0 | Same compatibility evidence as other Apache packages; React peer mismatch is unrelated | Exact notice process and supported peer cohort |
| Project-owned SDK/runtime/bridge code | Current no-permission placeholder; one Git author identity | May be licensed AGPL only by the relevant rightsholder(s) | Ownership/authorization and chosen outbound scope |
| Monaco `0.34.1` | MIT package license plus `ThirdPartyNotices.txt` | MIT grant permits distribution subject to its notice; embedded third-party notices remain | Artifact-specific notice content, including Codicon provenance |
| uPlot `1.6.32` | MIT package license | MIT code/CSS retain copyright and license notice | Exact distribution placement |
| React/ReactDOM and other runtime packages | Each retains its package license; React `19.2.8` is MIT | Full-project AGPL does not replace dependency licenses | Generate a complete release SBOM/license report |
| Fonts/icons/CSS | Mixed provenance; Inter/Roboto not selected in the final emitted closure, Codicon and CSS were emitted | Each asset must be traced independently | Font/icon-specific permission and attribution if shipped |

**VERIFIED FACT.** The Apache License 2.0
[Section 4](https://www.apache.org/licenses/LICENSE-2.0)
requires a license copy, change notices for modified files, retention of
applicable source notices, and handling of a supplied NOTICE file for
redistributed derivative works. The GNU compatibility guidance also says a
subsumed license copy still accompanies distribution.

**INFERENCE.** Full-project AGPL likely makes the application-source license
story more coherent than describing a permissive monolith containing the same
55 files. It does not turn every dependency into AGPL, resolve the Schema/i18n
evidence tension, or define the compliant npm/browser delivery process.

**LEGAL QUESTION.** Counsel must confirm whether the exact Apache/MIT/other
inputs may be combined and distributed in the intended AGPL artifacts and how
each license and notice should be presented. This document does not elevate
GNU or ASF guidance into a jurisdiction-specific legal opinion.

## 7. AGPL network-use implications

### 7.1 Direct license and GNU guidance

**VERIFIED FACT.** AGPLv3 distinguishes conveying a copy from mere remote
interaction without transfer. Its Sections 4–6 govern source and object-code
conveyance. Its Section 13 says that if the Program is modified, a modified
version supporting remote network interaction must prominently offer its
Corresponding Source to all remote users.

**VERIFIED FACT.** The GNU FAQ distinguishes a program run only on a server
from JavaScript delivered to a visitor's browser. It says the latter involves
programs distributed to the user and separately says modified AGPL software
used over a network must offer source. See
[`UnreleasedMods`](https://www.gnu.org/licenses/gpl-faq.en.html#UnreleasedMods),
[`UnreleasedModsAGPL`](https://www.gnu.org/licenses/gpl-faq.en.html#UnreleasedModsAGPL),
and
[`AGPLv3InteractingRemotely`](https://www.gnu.org/licenses/gpl-faq.en.html#AGPLv3InteractingRemotely).

**VERIFIED FACT.** GNU guidance says calling a program a client rather than a
server is not decisive; the relevant question for its network-interaction
analysis is whether a person is reasonably expected to interact with the
program remotely. See
[`AGPLv3ServerAsUser`](https://www.gnu.org/licenses/gpl-faq.en.html#AGPLv3ServerAsUser).

**INFERENCE.** Because this SDK is compiled into JavaScript sent to a browser,
conveyance/distribution analysis is at least as important as Section 13's
network-use provision. A single-page application both delivers code to the
browser and uses networks to communicate with Grafana. Those acts must not be
treated as legally equivalent without counsel.

### 7.2 Consumer scenarios

| Scenario | Potentially relevant evidence | Product implication | Legal question |
| --- | --- | --- | --- |
| 1. Open-source application embeds SDK | AGPL Sections 4–6; Section 5 whole-work language if a combined work exists; licenses of host code | Manageable for projects already willing and able to adopt compatible strong copyleft | Is the host bundle one combined work, and is the host's license compatible? |
| 2. Proprietary SaaS frontend embeds SDK | Browser receives a JS copy; GNU FAQ treats browser-delivered JS as distributed; Section 13 may also matter for modified network-interactive versions | High review friction; some vendors may decline before fact-specific analysis | What is the boundary of the covered/combined work and what source must be offered? |
| 3. Company modifies SDK and serves it | Sections 4–6 for browser delivery; Section 13 text for modified network-interactive Program | Requires a deliberate source-offer and compliance design if counsel finds the provisions applicable | Who are the relevant users, what is Corresponding Source, and where must the offer appear? |
| 4. Company uses SDK unmodified | AGPL Section 13 is phrased around modification; browser conveyance remains separate | Less Section 13-specific complexity does not imply no obligations | What obligations arise from bundling/conveying an unmodified SDK with host code? |
| 5. Proprietary adapter/plugin surrounds SDK | GNU FAQ treats linking/importing and intimate data/control flow as relevant to combined-program analysis; this is guidance, not adjudication | Adapter ecosystem may be chilled if boundaries are not clearly approved | Does the provider API create a separate work, aggregate, or combined work in the proposed packaging/loading modes? |
| 6. Customer self-hosts Grafana and host app | Customer receives deployment/browser artifacts; local modifications and remote users vary by deployment | Self-hosting does not remove source, notice, or compatibility planning | Which party conveys each artifact and who must make which offer? |
| 7. Commercial product redistributes browser bundle | Sections 4–6; source and notice obligations; possible Section 13 for modified network-interactive software | Adds release-compliance and customer-contract review | What complete corresponding source and notices accompany each shipped build? |

**LEGAL QUESTION.** Nothing in this table decides whether a proprietary host,
adapter, or whole SaaS application must be licensed under AGPL. That depends on
copyright ownership, how the works are combined, the exact runtime boundary,
the form of conveyance, modifications, and applicable law.

**TECHNICAL RECOMMENDATION.** Any AGPL candidate must prototype a browser-facing
source and license information surface, reproducible Corresponding Source
archive, build instructions, exact version mapping, and source-offer lifetime.
That prototype is compliance evidence for counsel, not proof of compliance.

## 8. Consumer/adoption implications

| Audience | Potential benefit of full AGPL | Technical/product cost |
| --- | --- | --- |
| Open-source maintainers | Clear strong-copyleft community posture; downstream modifications remain available where terms apply | License compatibility review; fewer projects can embed it unchanged in their existing license model |
| Proprietary React applications | Receives real Grafana fidelity and auditable source | Strong-copyleft frontend dependency may be rejected by policy or require exceptional counsel approval |
| SaaS vendors | Source-access expectations can align with open service development | Network-use and browser-bundle questions are central to their product model |
| Enterprises | Transparent code and provenance can aid auditability | Procurement, SBOM, source-offer, and combined-work review become mandatory and potentially slow adoption |
| Contributors | One visible copyleft posture can attract contributors aligned with it | Contributors and employers unwilling to use AGPL may opt out; inbound rights process must be explicit |
| Adapter/plugin authors | Open adapters can strengthen a shared ecosystem | Proprietary adapter viability remains legally uncertain; separate provider innovation may shrink |
| Downstream forks | Strong reciprocal source posture for covered modifications | Relicensing and proprietary distribution flexibility is intentionally limited |

**PRODUCT CONSIDERATION.** npm download friction is not only technical. Many
organizations use automated policy scanners that flag strong-copyleft packages
before architecture-specific legal analysis. A full-AGPL SDK in the direct
frontend dependency graph could therefore lose adopters even if a particular
integration might ultimately be permissible.

**PRODUCT CONSIDERATION.** A permissive core does not guarantee that a host
using an AGPL bridge avoids AGPL obligations. It does, however, keep
dashboard/lifecycle APIs, alternative providers, test tools, and integrations
usable without automatically placing every consumer of the core on the same
renderer-license path. That modularity has independent ecosystem value.

**INFERENCE.** Full AGPL would likely improve alignment with contributors and
users who prefer reciprocal open-source infrastructure, while reducing appeal
to proprietary product teams—the project's stated target audience includes
exactly those React application teams. No user research or adoption survey has
yet quantified either effect.

## 9. Architecture under full AGPL

A full-AGPL repository could physically combine these layers:

```text
grafana-react-sdk
├── public SDK API
├── compatibility/runtime layer
├── Grafana-version adapters
├── renderer-provider contract
└── exact Grafana renderer/datasource integrations
```

That source layout does not require one browser chunk or one npm package. Even
under a single root license, the technically stronger artifact shape remains:

```text
@grafana-react-sdk/core
└── host API + lifecycle + provider contract

@grafana-react-sdk/grafana-13.2-bridge
└── exact renderer/datasource source + adapters + assets + manifest
```

### What full AGPL can simplify

- **INFERENCE:** one declared outbound license for project-owned source and the
  application-derived combined bridge;
- **INFERENCE:** less pressure to replace real renderer modules solely to avoid
  incorporating upstream AGPL application source;
- **INFERENCE:** a more straightforward contribution policy if all
  project-owned code accepts the same inbound/outbound terms; and
- **INFERENCE:** fewer internal questions about whether application-derived
  code belongs in the same repository, assuming counsel approves the model.

### Why the provider/bridge boundary remains

| Requirement | Why AGPL does not remove it |
| --- | --- |
| Grafana version coupling | The bridge uses exact 13.2.3 application paths and eight unstable deep/source package modules |
| Bundle splitting | Hosts should not download editor, Monaco, TestData scenarios, or unused panels merely because licenses align |
| Optional panels/datasources | Capability manifests and lazy chunks constrain compatibility and cost |
| Upgrade isolation | Each Grafana release needs source diff, adapter review, POC regression, provenance, and assets audit |
| Runtime ownership | `@grafana/runtime` services and registries remain module-level singletons |
| Renderer replacement | Server-hosted, host-supplied, and future published-only providers remain useful alternatives |
| Testability | Provider conformance can be tested independently from the host API |
| Source provenance | AGPL source/notice handling increases rather than removes the need for exact provenance |
| Future integrations | A license-neutral provider API allows non-Grafana or independently implemented providers without core redesign |

**TECHNICAL RECOMMENDATION.** Treat package boundaries as capability,
versioning, loading, and ownership boundaries—not as assumed license
firewalls. Keep the core from importing renderer implementation modules even
if both packages eventually use AGPL.

## 10. Models 1–4 comparison

### Model 1 — permissive core plus separately distributed Grafana bridge

**Classification: TECHNICALLY PREFERRED; LEGAL REVIEW REQUIRED.**

- Fidelity remains high because the bridge can use the exact proven renderers.
- Core API, bridge versions, caches, chunks, and upgrades remain isolated.
- The bridge's outbound license and relationship to host applications remain
  unresolved; package separation alone is not a legal conclusion.
- Consumer adoption is better than a full-AGPL core only if counsel validates a
  usable bridge/host boundary and organizations accept the bridge.

### Model 2 — entire SDK and bridge AGPL-3.0-only

**Classification: TECHNICALLY VIABLE; PRODUCT-RISKY; LEGAL REVIEW REQUIRED.**

- Aligns the project's declared strong-copyleft posture with the upstream
  application-source default and preserves full fidelity.
- Simplifies the top-level license narrative and some source integration.
- Does not improve version isolation, bundle size, Runtime ownership, React
  peers, styles, transformations, or tests.
- Places the core API itself in every consumer's strong-copyleft review path,
  even when a consumer uses another provider.

### Model 3 — AGPL renderer/bridge plus permissive SDK-facing package

**Classification: TECHNICALLY PREFERRED CANDIDATE; VIABLE WITH TRADE-OFFS;
LEGAL REVIEW REQUIRED.**

- Preserves the same native fidelity and technical isolation as Model 1.
- Makes the bridge's proposed relationship to the AGPL application closure
  explicit while retaining a broadly reusable provider API.
- Still requires counsel to decide the bridge/core/host combined-work boundary,
  distribution obligations, and whether the resulting product model is useful.
- Requires separate contribution and release governance for core and bridge.

### Model 4 — permissive SDK plus locally generated or user-supplied bridge

**Classification: TECHNICALLY VIABLE; VIABLE WITH TRADE-OFFS; LEGAL REVIEW
REQUIRED.**

- The project need not distribute the generated application-source bridge in
  the contemplated workflow.
- Users inherit source checkout, toolchain, build, provenance, update, and
  compliance complexity; reproducibility and support become substantially
  harder.
- It is useful as a research and escape-hatch path, not the preferred developer
  experience.
- Local generation is not asserted as a legal workaround; tooling, recipes,
  patches, and generated outputs still require review.

### Comparative summary

| Dimension | Model 1 | Model 2 | Model 3 | Model 4 |
| --- | --- | --- | --- | --- |
| Native fidelity | Proven high | Proven high | Proven high | Proven high if build succeeds |
| Main package | Small, potentially permissive | Full AGPL | Small, potentially permissive | Small, potentially permissive |
| Bridge distribution | Project-distributed; license unresolved | Project-distributed under proposed AGPL | Project-distributed under proposed AGPL | Built/supplied by user |
| Version isolation | Strong | Weak if monolithic; strong only if boundary retained | Strong | Strong but user-operated |
| Bundle optimization | Strong with separate chunks | Possible, not automatic | Strong with separate chunks | Possible but tooling-heavy |
| Legal-review burden | High and unresolved | High, but different questions | High and explicit | High for tooling/user output |
| Enterprise/commercial adoption | Moderate; bridge still reviewed | Low pending user validation | Moderate-to-low; bridge flagged | Moderate core, poor setup experience |
| Maintenance | Localized by provider | Coupled unless provider retained | Localized by provider | Split between project and users |
| Contribution model | Two-boundary policy | One top-level policy | Two explicit license/governance paths | Core plus build-tool governance |
| Future flexibility | Highest | Lowest | High | Moderate |

**INFERENCE.** Model 2's strongest advantage is a coherent strong-copyleft
policy, not a superior runtime architecture. Models 1 and 3 preserve the most
valuable technical boundary. Model 4 avoids first-party generated-bridge
distribution but transfers too much operational burden to users.

## 11. Phase 1 blocker impact

| Phase 1 issue | Full-AGPL effect | Reason |
| --- | --- | --- |
| Grafana source licensing/distribution | **SIMPLIFY** | Same license identifier may reduce outbound mismatch, but source, notice, scope, and distribution questions remain |
| Bridge productization | **SIMPLIFY** | Fewer incentives to avoid `public/app`; package boundary, provenance, build, and release design remain |
| Grafana version policy | **NO MATERIAL EFFECT** | Exact 13.2.3 paths and package cohort still require a tested version matrix |
| Runtime singleton/isolation | **NO MATERIAL EFFECT** | Module-level service state is a runtime fact |
| React/Scenes compatibility | **NO MATERIAL EFFECT** | Scenes still declares React 18 peers while the POC uses React 19.2.8 |
| Bundle size/editor closure | **NO MATERIAL EFFECT** | License choice does not tree-shake Monaco, editors, or optional TestData scenarios |
| Styling containment | **NO MATERIAL EFFECT** | Emotion, global styles, portals, fonts, and host CSS still require isolation |
| Transformation compatibility | **NO MATERIAL EFFECT** | Registries, deep imports, and supported-transform policy remain |
| Server-hosted module experiment | **NO MATERIAL EFFECT** | Still useful for server/version alignment and alternative distribution, regardless of project license |
| Legal review | **NO MATERIAL EFFECT** | Questions shift toward downstream combination/network use; they do not disappear |
| Trademark concerns | **NO MATERIAL EFFECT** | Software licensing does not grant trademark permission |
| Commercial adoption | **WORSEN** | Full core becomes a strong-copyleft dependency subject to consumer policy and counsel review |
| Source provenance | **SIMPLIFY** only at top-level labeling | Exact source, modifications, notices, and reproducible outputs are still required |

**Conclusion.** Full AGPL solves none of the major technical Phase 1 blockers.
It simplifies two licensing-sensitive workflows and may worsen adoption. It
must not be used as a reason to skip bundle, compatibility, or isolation work.

## 12. Third-party license considerations

**VERIFIED FACT.** AGPL applies only to rights available under that license. It
does not replace the licenses or copyright notices of third-party inputs.

| Component | Phase 0 state | Work required under any project license |
| --- | --- | --- |
| Grafana Apache packages | Bundled at exact 13.2.3 versions | Include and map Apache license/NOTICE evidence; mark project modifications where applicable |
| Scenes | Bundled at 8.13.5 from separate Apache repository | Preserve Apache license and exact version/source identity |
| Monaco | `0.34.1`; editor JS/CSS and Codicon font emitted, not exercised in view-only path | Retain MIT and applicable `ThirdPartyNotices`; reduce unused closure; establish Codicon-specific provenance |
| Codicon | Font emitted through Monaco package | Confirm applicable notice/attribution rather than assuming the Monaco top-level license is the complete answer |
| uPlot | `1.6.32`; renderer code and CSS exercised | Retain MIT notice and source identity |
| Inter/Roboto | Diagnostic server requests only; not emitted by selected build | Audit exact font files/licenses if a production provider bundles or fetches them |
| Grafana CSS/UI assets | Published-package and application-derived styles compiled into chunks | Record each originating package/path and applicable license |
| React, Emotion, RxJS, Router, i18next, lodash, react-use | Independently licensed MIT, Apache-2.0, and Unlicense inputs according to installed manifests | Preserve each license and review the exact combined artifact; do not treat the root project license as a replacement |
| Other runtime dependencies | Thousands of transitive modules in the measured graph, including direct bridge dependencies not classified individually here | Produce artifact-specific SBOM and license report; do not rely on top-level dependency lists |

**INFERENCE.** Removing unused editor/configuration entrypoints is both a bundle
goal and a compliance-surface reduction. It should proceed regardless of
whether the bridge becomes AGPL.

**LEGAL QUESTION.** Counsel must confirm the distribution and attribution
requirements for the actual Codicon font, Monaco third-party material, any
future fonts, and all emitted CSS/assets. Full-project AGPL is not a substitute
for that review.

## 13. Trademark boundary

**VERIFIED FACT.** Grafana Labs' current
[`Trademark Usage Policy`](https://grafana.com/trademark-policy/) treats
software-license permission and trademark permission separately. It addresses
use of Grafana marks in product/service names, compatibility descriptions,
logos, attribution, and affiliation.

**VERIFIED FACT.** The repository uses “Grafana React SDK,” includes an
independence disclaimer, and did not emit a Grafana logo in the successful POC
asset inventory.

**INFERENCE.** Adopting AGPL-3.0-only would not authorize the current project or
future npm names, Grafana logos, screenshots, or affiliation language.

**LEGAL QUESTION.** Counsel should determine whether “Grafana React SDK,” npm
package names, compatibility phrasing, the existing disclaimer, and any future
visual evidence comply with the current policy or require permission. No
branding change is proposed here.

## 14. Contribution/governance implications

If project-owned code eventually adopts AGPL-3.0-only, governance should state
the inbound and outbound terms before accepting broader contributions.

**TECHNICAL RECOMMENDATION.** Before a license change or Phase 2 package work:

1. document which packages/files use which license and how third-party material
   is excluded from project copyright claims;
2. update `CONTRIBUTING.md` with an explicit contribution-license policy;
3. decide with counsel whether a DCO, CLA, copyright assignment, or a simpler
   inbound-equals-outbound rule fits the project's goals;
4. record contributor identity and employer authorization where appropriate;
5. automate SPDX/license/notice checks per package and generated artifact; and
6. define who can approve exceptions, relicensing, and dual-license grants.

**PRODUCT CONSIDERATION.** A DCO can document contributor representations, but
it is not automatically the same as copyright assignment or permission for a
future proprietary license. A CLA can preserve broader licensing flexibility
but adds contributor friction and governance overhead. The appropriate choice
depends on the product model and counsel.

**INFERENCE.** Relicensing becomes operationally harder as independent
copyright holders contribute. The present one-author Git history makes now the
right time to choose a durable policy, but not to change the license without
ownership verification.

**LEGAL QUESTION.** What contributor terms are necessary for a single AGPL
project, a permissive-core/AGPL-bridge split, and any future dual-license model?

## 15. Dual-licensing analysis

One possible future model is an AGPL community edition plus a separate
commercial/proprietary license for some project-owned code.

**PRODUCT CONSIDERATION.** Dual licensing could give open-source users a
reciprocal option while offering commercial users negotiated terms. It also
adds sales, contract, contributor-rights, release, and support complexity that
this early project does not currently have.

**VERIFIED FACT.** The project cannot offer alternative proprietary terms for
Grafana-derived code, published packages, or third-party assets merely because
it owns its adapters. Alternative terms can only cover rights the project is
authorized to license.

**INFERENCE.** Dual licensing is more plausible for a wholly project-owned core
than for a bridge containing the 55 Grafana application files. An AGPL bridge
could remain under its upstream-compatible terms while separately owned core
code has another commercial offer, but whether that creates a useful product
depends on the bridge/host legal boundary.

**TECHNICAL RECOMMENDATION.** Do not design Phase 1 around dual licensing. Keep
copyright and provenance records capable of supporting a later counsel/business
evaluation, and keep project-owned core code separated from upstream-derived
bridge code.

**LEGAL QUESTION.** Could the project offer alternative terms for any combined
artifact containing Grafana-derived AGPL code? What contributor grants or
assignments would be required? Could commercial terms cover only the core
without misleading users about the bridge?

## 16. Legal-review questions

Qualified counsel should receive the exact 55-file/eight-adapter/asset
inventory and answer:

1. If all project-owned code is AGPL-3.0-only, may the project distribute the
   exact Grafana application-source modules identified by Phase 0 in source and
   compiled npm/browser forms?
2. What license copies, notices, modification statements, Corresponding Source,
   build scripts, and source-offer mechanisms and durations would each artifact
   require?
3. How does AGPL Section 13 apply to a frontend SDK whose JavaScript is sent to
   and executed in users' browsers while making network requests to Grafana?
4. What obligations apply to host applications that import, bundle, split,
   cache, or dynamically load the SDK and bridge?
5. Does static or dynamic linking/bundling with proprietary React application
   code create obligations for the surrounding application, and does the
   provider boundary change that analysis?
6. How do statically bundled, separately chunked, dynamically imported,
   server-hosted, and user-locally-built renderer modules differ?
7. May the exact Apache-2.0 Grafana/Scenes packages and MIT dependencies be
   combined in an AGPL-3.0-only project as proposed, and how must their original
   licenses, notices, and patent terms be preserved?
8. How should the `@grafana/schema` and `@grafana/i18n` package-local Apache
   evidence be reconciled with their omission from Grafana's repository-wide
   Apache exception list?
9. What exact obligations apply to Monaco, Codicon, uPlot, future fonts, CSS,
   generated configuration, source maps, and other emitted assets?
10. Can the project offer commercial or proprietary alternative terms for any
    project-owned portion while the renderer includes Grafana-derived AGPL
    code? What may not be dual-licensed by this project?
11. What DCO, CLA, copyright-assignment, employer-authorization, or
    inbound-equals-outbound process best preserves the selected model?
12. Does current Git history and maintainer employment/contracting context
    establish authority to license all project-owned files, and what additional
    record is needed?
13. Does using “Grafana React SDK” in project/repository/npm naming comply with
    the current Grafana trademark policy, and what permission, disclaimer, or
    attribution is required?
14. Would a permissive core plus AGPL bridge create a legally meaningful and
    useful separation for proprietary hosts, or only a technical packaging
    boundary?
15. For unmodified versus modified SDK use, and internal-only versus external
    browser delivery, which AGPL provisions apply to each scenario in Section
    7?

This document does not answer these questions beyond the cited license text and
published guidance.

## 17. Weighted decision matrix

### 17.1 Method and weights

Scores use a 1–5 scale where 5 is most favorable. For maintenance cost and
legal uncertainty, 5 means lower cost or lower uncertainty. The weights are a
maintainer value judgment, not empirical user research:

| Criterion | Weight | Reason |
| --- | ---: | --- |
| Technical simplicity | 8% | Important, but not at the expense of isolation |
| Native fidelity | 12% | Core product objective |
| Maintenance cost | 10% | Exact Grafana coupling creates recurring work |
| Bundle optimization | 8% | Phase 0 bundle/editor closure is a release blocker |
| Grafana upgrade isolation | 12% | Versioned compatibility is fundamental |
| Open-source alignment | 8% | Reciprocal community value matters |
| Enterprise adoption | 12% | Intended platform users require policy review |
| Commercial adoption | 12% | Intended embedding use includes proprietary products |
| Legal uncertainty | 8% | No model may ship before its boundary is approved |
| Contributor simplicity | 4% | Governance should be understandable |
| Future flexibility | 6% | Alternative providers and licensing choices matter |
| **Total** | **100%** | |

### 17.2 Scores

| Criterion | Model 1 | Model 2 | Model 3 | Model 4 |
| --- | ---: | ---: | ---: | ---: |
| Technical simplicity | 3 | 4 | 3 | 1 |
| Native fidelity | 5 | 5 | 5 | 5 |
| Maintenance cost | 4 | 3 | 4 | 2 |
| Bundle optimization | 5 | 3 | 5 | 4 |
| Grafana upgrade isolation | 5 | 2 | 5 | 4 |
| Open-source alignment | 3 | 5 | 4 | 3 |
| Enterprise adoption | 3 | 1 | 2 | 2 |
| Commercial adoption | 3 | 1 | 2 | 2 |
| Legal uncertainty | 1 | 2 | 2 | 3 |
| Contributor simplicity | 3 | 3 | 2 | 3 |
| Future flexibility | 5 | 2 | 5 | 4 |
| **Weighted score / 5** | **3.70** | **2.74** | **3.58** | **3.00** |

### 17.3 Interpretation

Model 1 ranks first because the provider architecture maximizes version,
bundle, and future isolation without pre-deciding the bridge license. Its low
legal-certainty score is intentional: it is an architecture, not a completed
distribution decision.

Model 3 is a close second and the preferred concrete hybrid candidate for legal
review. It makes the bridge's proposed AGPL posture explicit, but scores lower
on adoption and contribution simplicity until counsel confirms that the split
is meaningful and target consumers accept it.

Model 2's single-license simplicity does not compensate for lost package
flexibility and expected adoption friction. Model 4 remains a useful fallback
and internal build path but imposes the worst developer experience.

Changing weights to prioritize reciprocal open-source alignment over
enterprise/commercial adoption would improve Model 2. That is a product-policy
choice, not a hidden technical fact; no user research presently justifies that
change.

## 18. Technical recommendation

**TECHNICAL RECOMMENDATION — HIGH confidence.** Keep the separated provider
architecture from the existing
[distribution strategy](licensing-distribution-strategy.md):

1. a small core owns the experimental dashboard API, lifecycle, host contracts,
   typed failures, and provider interface;
2. every renderer provider supplies an exact compatibility manifest covering
   Grafana source/server versions, package cohort, React/Scenes versions,
   panels, datasources, transformations, assets, and singleton scope;
3. the Grafana 13.2 bridge remains separately versioned and lazy-loadable;
4. provenance and source/notice outputs are generated per bridge artifact;
5. view-only entrypoints remove Monaco/editor and unused datasource scenario
   closures where technically possible; and
6. server-hosted and user-supplied providers remain possible without changing
   the core contract.

Full-project AGPL may simplify source imports and one outbound-license choice,
but it does not justify a monolithic package. The renderer boundary is a
technical design invariant.

**Second choice — MEDIUM confidence.** If a first-party bridge cannot be
distributed, retain Model 4 or a host-supplied provider while the server-hosted
module experiment continues. This has worse usability but preserves the core
product direction without fabricated renderers.

## 19. Product recommendation

**PRODUCT RECOMMENDATION — MEDIUM confidence: PREFER HYBRID MODEL.**

Do not license the complete project AGPL merely to make the bridge easier to
integrate. Preserve the option for a permissive SDK-facing core and evaluate an
explicit AGPL bridge as Model 3 with counsel and representative target users.
This keeps the native-fidelity implementation available without forcing every
consumer of core lifecycle/types/provider APIs into the same policy decision.

Before selecting Model 3, interview or obtain policy feedback from at least:

- an open-source host application;
- a proprietary SaaS frontend team;
- an enterprise platform/security/legal reviewer; and
- a potential third-party provider or plugin author.

The questions should measure whether an AGPL bridge is acceptable, whether
local generation is usable, and whether server-hosted loading would improve
adoption. This is product validation, not a substitute for counsel.

## 20. Legal approval dependencies

**LEGAL APPROVAL REQUIRED.** No license or public distribution action follows
from the weighted result.

| Decision | Required evidence/approval | State |
| --- | --- | --- |
| License project-owned files AGPL | Copyright/authority audit; chosen scope and headers | Blocked |
| Publish an AGPL Grafana bridge | Answers to combined-work, source, notice, asset, and host-use questions | Blocked |
| Publish a permissive core next to AGPL bridge | Counsel-approved package/runtime boundary and consumer guidance | Blocked |
| Represent proprietary-host compatibility | Counsel opinion for concrete static/dynamic integration models | Blocked |
| Offer dual licensing | Ownership/contributor rights and scope excluding third-party/Grafana rights | Blocked |
| Ship Monaco/Codicon/fonts/assets | Artifact-specific license and notice record | Blocked |
| Finalize project/npm naming | Trademark policy/permission review | Blocked |
| Select Schema/i18n package classification | Reconcile package-local and repository-level evidence | Blocked |

The following upstream facts do not by themselves clear those decisions:

- Grafana and a proposed project license both using the identifier
  AGPL-3.0-only;
- GNU guidance describing Apache 2.0 as compatible with GNU version 3 licenses;
- a separate npm package boundary; or
- a user building code locally rather than downloading a project-built bundle.

## 21. Phase 1 work impact

### 21.1 Work that may proceed now

- Define the project-owned provider interface and compatibility manifest
  without distributing Grafana source.
- Improve closed source/asset/SBOM/license/notice provenance automation.
- Split and measure view-only versus editor/configuration closures locally.
- Design version negotiation, failure-closed loading, and conformance tests.
- Continue runtime singleton/isolation, React/Scenes, styling, transformation,
  and bundle-reduction research.
- Run the server-hosted panel/datasource module experiment; it remains useful
  for version alignment and alternative distribution even if AGPL is selected.
- Prepare a counsel evidence packet and target-user adoption interviews.

### 21.2 Work blocked pending legal review

- Changing `LICENSE` or package license fields.
- Publishing or otherwise distributing a bridge containing the 55-file
  application closure.
- Choosing Model 2 or Model 3 as a release policy.
- Claiming that a permissive core protects proprietary hosts from bridge
  obligations.
- Publishing local-build tooling as a supposed compliance workaround.
- Dual-license or commercial-license offers.
- Final public package naming and trademark claims.

### 21.3 Bridge productization decision

**Decision: YES, BUT ONLY FOR LICENSE-NEUTRAL INTERNAL ARCHITECTURE WORK.**

The Phase 1 bridge-productization workstream may continue with interfaces,
compatibility metadata, exact internal boundaries, reproducible local builds,
provenance, conformance testing, source-closure reduction, and non-distributed
experiments. It must not assume that the whole project will become AGPL, and it
must remain compatible with Models 1, 3, and 4.

Stop before creating a distributable bridge, selecting package licenses, or
documenting proprietary-host compatibility until counsel has answered the
applicable Section 16 questions.

### 21.4 Issue routing

| Phase 1 issue/workstream | Result |
| --- | --- |
| Evaluate AGPL-3.0 licensing for the complete SDK | Ready to close after maintainer review if legal/product follow-ups are recorded as separate issues; it does not close the license decision |
| Define/select repository and package licenses | Blocked pending qualified legal review and ownership confirmation |
| Productize the bounded Grafana rendering bridge | Internal license-neutral architecture only |
| Publish a first-party renderer bridge | Blocked pending legal review |
| Runtime isolation, version policy, React/Scenes, bundle size, styles, transformations | Unblocked; AGPL has no material technical effect |
| Server-hosted module loading | Experiment remains useful and unblocked as non-distributed research |
| Trademark/package naming | Blocked before Phase 2 publication |

## 22. Final status

**PREFER HYBRID STRATEGY**

Full-project AGPL materially simplifies only the top-level alignment between
project-owned bridge code and the identified Grafana application-source
default. It does not solve the principal production engineering blockers and
would place the entire SDK-facing API in a strong-copyleft adoption path.

The preferred direction is therefore:

- retain a small, provider-oriented core;
- retain a separate, exact-version Grafana bridge;
- ask counsel to evaluate an explicitly AGPL bridge with a permissive core;
- preserve user-built and server-hosted provider experiments;
- do not choose or change a license until ownership, combination, network-use,
  notices, assets, trademark, and downstream-host questions are answered; and
- continue only license-neutral internal bridge work in the meantime.

### Decision record

| Question | Answer |
| --- | --- |
| Does full AGPL simplify the bridge? | Partly: source/license alignment and contribution policy can simplify |
| Does it remove the bridge/provider boundary? | No |
| Does it solve version/runtime/React/bundle/style/transformation blockers? | No material effect |
| Does it remove legal review? | No |
| Leading weighted model | Model 1, `3.70/5`; license of the bridge remains unresolved |
| Preferred concrete license candidate | Model 3, subject to counsel and user validation |
| Full-project AGPL result | Technically viable, but not recommended on current product evidence |
| Recommendation confidence | Technical: HIGH; product: MEDIUM; legal conclusion: none |
| May bridge productization continue? | Yes, only for license-neutral internal architecture work |
| Is a public bridge authorized? | No |

### Primary references

- Grafana v13.2.3
  [`LICENSING.md`](https://github.com/grafana/grafana/blob/v13.2.3/LICENSING.md),
  [`LICENSE`](https://github.com/grafana/grafana/blob/v13.2.3/LICENSE), and
  [`NOTICE.md`](https://github.com/grafana/grafana/blob/v13.2.3/NOTICE.md).
- Grafana v13.2.3
  [source commit](https://github.com/grafana/grafana/commit/6193dc03311b631b9727b560d24369e683dc396e).
- Grafana v13.2.3 published package manifests:
  [`data`](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-data/package.json),
  [`ui`](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-ui/package.json),
  [`runtime`](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-runtime/package.json),
  [`schema`](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-schema/package.json),
  [`i18n`](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-i18n/package.json), and
  [`e2e-selectors`](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-e2e-selectors/package.json).
- GNU
  [AGPL-3.0 text](https://www.gnu.org/licenses/agpl-3.0.en.html),
  [license FAQ](https://www.gnu.org/licenses/gpl-faq.en.html), and
  [license compatibility guidance](https://www.gnu.org/licenses/license-compatibility.en.html).
- Apache
  [License 2.0](https://www.apache.org/licenses/LICENSE-2.0).
- Scenes v8.13.5
  [`package.json`](https://github.com/grafana/scenes/blob/v8.13.5/package.json)
  and [`LICENSE`](https://github.com/grafana/scenes/blob/v8.13.5/LICENSE).
- Third-party runtime/asset evidence:
  [`monaco-editor@0.34.1`](https://github.com/microsoft/monaco-editor/tree/v0.34.1),
  its
  [`ThirdPartyNotices.txt`](https://github.com/microsoft/monaco-editor/blob/v0.34.1/ThirdPartyNotices.txt),
  and [`uPlot@1.6.32`](https://github.com/leeoniya/uPlot/tree/1.6.32).
- Grafana Labs
  [Trademark Usage Policy](https://grafana.com/trademark-policy/).
- Project
  [distribution strategy](licensing-distribution-strategy.md),
  [Phase 0 POC results](../research/poc-results.md),
  [project context](../../project/project-context.md), and
  [roadmap](../../project/roadmap.md).
