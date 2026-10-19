# Project Name and Grafana Trademark Decision

## 1. Document metadata

| Field | Value |
| --- | --- |
| Owner | Project maintainer |
| Phase | Phase 1 — Production Architecture and Distribution Strategy |
| Workstream | Project name and trademark |
| GitHub issue | [`#66` — Resolve project name and Grafana trademark usage](https://github.com/aaliakbarian/grafana-react-sdk/issues/66) |
| Status | Working name selected; rename pending |
| Created | 2026-10-18 |
| Last Updated | 2026-10-19 |

## 2. Scope / not legal advice

This document is product-naming and trademark-compliance research, not legal
advice or formal trademark clearance. It records the operational decision to
rename the independent project before Phase 2, documents the selected neutral
family identity, and preserves the analysis explaining why “Grafana React SDK”
should not continue as the project brand without explicit written permission
from Grafana Labs.

The following labels remain distinct:

- **VERIFIED POLICY** — language or identity directly supported by Grafana
  Labs' current published policy or trademark list.
- **PROJECT DECISION** — the maintainer's proposed product or engineering
  action; it is not a legal conclusion.
- **TRADEMARK QUESTION** — an issue requiring Grafana Labs' written response,
  qualified trademark review, or both.

The candidate screen in Section 8 is a basic public search performed on
2026-10-18, with a basic exact-name check of the selected identity on
2026-10-19. It is not a jurisdiction-specific trademark search,
corporate-name search, domain clearance, common-law search, or legal opinion.
No repository, package, scope, domain, or social account was created or
reserved.

## 3. Current project identity

The repository still uses its historical working identity pending a controlled
rename:

| Surface | Current identity | State |
| --- | --- | --- |
| Display name | Grafana React SDK | Experimental working name |
| GitHub repository | `aaliakbarian/grafana-react-sdk` | Public source repository |
| Repository slug | `grafana-react-sdk` | Contains the Grafana mark |
| Root private workspace | `grafana-react-sdk` | POC-only; unpublished |
| Private workspace scope | `@grafana-react-sdk/*` | POC-only; unpublished |
| Roadmap project | Grafana React SDK Roadmap | Project-control working name |
| Public npm packages | None | No package or scope has been published/reserved by this workstream |

The maintainer has selected the following replacement working identity:

| Surface | Selected working identity | State |
| --- | --- | --- |
| Neutral family convention | Dashboard Render SDK | Names the provider family, not a standalone product or existing package |
| Current implementation display name | Dashboard Render SDK G | Selected working name for the current Grafana-compatible implementation |
| Repository slug | `dashboard-render-sdk-g` | Selected rename target; not yet applied |
| Conceptual private package prefix | `@dashboard-render-sdk-g/*` | Provisional until package implementation; not created or reserved |
| Future illustrative sibling | Dashboard Render SDK K / `dashboard-render-sdk-k` | Illustrates a possible future Kibana-compatible family member; it does not exist today |

`G` and `K` are short provider-family discriminators. `G` identifies the
current Grafana-compatible implementation, while `K` illustrates a possible
future Kibana-compatible implementation. A suffix does not grant trademark
permission, imply affiliation or endorsement, or replace precise compatibility
metadata and reviewed descriptive wording.

The README already says that the project is independent and is not endorsed by
or affiliated with Grafana Labs. The repository contains no documented written
permission from Grafana Labs to use its marks in the project, repository, or
future package names.

The current identity does not define the provider/core architecture. The
[renderer-provider architecture](../architecture/production/bridge-provider-architecture.md)
uses architectural working names and explicitly delegates final package names.
The [AGPL compliance audit](../architecture/production/agpl-compliance-audit.md)
also treats naming as a release gate separate from copyright licensing.

## 4. Grafana trademark-policy evidence

Primary evidence reviewed on 2026-10-18:

- Grafana Labs' current
  [Trademark List](https://grafana.com/trademark-policy/trademark-list/) lists
  **Grafana®** as a Grafana Labs mark.
- The current
  [Trademark Usage Policy](https://grafana.com/trademark-policy/) says the
  marks may be used for open-source discussion, development, and support only
  subject to the policy, and says other use requires a separate trademark
  license agreement.
- The policy says not to use Grafana Labs marks as part of a product or
  service name or incorporate them into company logos or designs.
- The policy says not to incorporate the marks into a website or domain name,
  Internet keywords, social accounts, metatags, or identifiers leading to a
  product, business, or service.
- The policy says not to adopt confusingly similar marks and not to use the
  marks with derivative software incorporating modified Grafana Labs product
  code or for goods/services Grafana Labs did not create or provide.
- The policy specifies form, prominence, adjective use, attribution, and
  independence language for uses it permits. Its published attribution text
  includes a statement that the marks are used with permission.
- The policy provides `hello@grafana.com` as the contact for questions or
  written permission for uses not specifically addressed.
- The policy may be amended; release review must use the then-current version.

**VERIFIED POLICY.** The current working name places the registered Grafana®
mark directly in the product and repository identity. The policy language is
therefore directly relevant rather than merely analogous.

**PROJECT DECISION.** Classify “Grafana React SDK” as **LIKELY RENAME
REQUIRED** for planning purposes. This is a conservative operational reading,
not a legal judgment. Keep the working name only during the bounded Phase 1
migration decision; do not carry it into public Phase 2 package branding
without written permission.

**TRADEMARK QUESTION.** Does Grafana Labs permit purely descriptive references
to Grafana® OSS software in independent compatibility documentation without a
separate written permission, and what exact attribution wording applies when
the policy's template itself says “used with permission”?

## 5. Decision alternatives

### Option A — rename before Phase 2/publication

Choose a neutral independent project name, use Grafana only as an upstream
proper name and compatibility descriptor where permitted, and keep an explicit
independence statement.

Benefits:

- removes the Grafana mark from the project's primary product, repository, and
  future package identities;
- avoids making the project's continuity depend on external permission;
- reduces the risk and cost of a forced rename after packages or users exist;
- gives contributors a clear distinction between project-owned interfaces and
  the versioned Grafana provider;
- remains valid if another dashboard/rendering source is supported later; and
- permits a framework-independent primary brand while descriptions still say
  “React SDK.”

Costs:

- requires a controlled repository, documentation, workspace, and eventual
  public-API migration;
- requires basic clearance and preferably qualified review of the selected
  neutral name; and
- creates historical references that must be preserved rather than blindly
  replaced.

### Option B — request written permission

Retain “Grafana React SDK” only if Grafana Labs provides explicit written
permission covering the project, repository, websites, documentation, and
proposed package family.

Benefits:

- preserves current recognition and immediately communicates the upstream
  compatibility target; and
- avoids a rename if permission is sufficiently broad and durable.

Costs:

- introduces external approval and timing dependency;
- may require conditions, recurring review, or a narrower permission than the
  architecture needs;
- leaves a risk of future package or scope constraints and later renaming;
- complicates contributor guidance and descriptive-versus-brand use; and
- remains unsuitable for future non-Grafana providers as the primary brand.

**PROJECT DECISION.** Select **Option A** as the operational direction. Option
B remains available only if the maintainer rejects the neutral-name direction
and obtains written permission before public Phase 2 identity or publication.

## 6. Naming requirements

The neutral name must:

- contain neither “Grafana” nor a confusing variation of a Grafana Labs mark;
- avoid third-party product/framework names as the core brand where practical;
- be short, pronounceable, reasonably distinctive, and readable as a GitHub
  slug and npm scope;
- fit an open-source dashboard/rendering SDK without implying affiliation;
- support core, provider, version-adapter, and testing package roles;
- remain meaningful if React becomes one supported host rather than the whole
  product identity;
- remain meaningful if providers for another dashboard source appear later;
- evoke native composition, rendering, panels, visualization, or bridging
  without needing to state all of them literally; and
- pass a deeper clearance review before public adoption.

“React SDK” may remain a descriptive tagline for the initial product. It should
not control the primary brand or prevent future framework adapters.

## 7. Candidate names considered

The following preliminary candidates are retained as decision history. The
maintainer did not select them; in particular, **RenderWeft is rejected as the
preferred working name**. All package examples are conceptual and unreserved.
The compact family syntax
`{core,provider,provider-13,testing}` means four possible packages under the
candidate scope.

| Display name | Repository slug | Candidate npm scope / family | Meaning and rationale | Pronunciation | Initial collision concern | Provider example |
| --- | --- | --- | --- | --- | --- | --- |
| PanelWeave | `panelweave` | `@panelweave/{core,provider,provider-13,testing}` | Panels woven into a host application | “PAN-uhl-weev” | Exact current software/app use found | `@panelweave/provider-13` |
| RenderWeft | `renderweft` | `@renderweft/{core,provider,provider-13,testing}` | Renderer output forms the weft woven through a host UI | “REN-der-weft” | Distinctive, though “weft” may need pronunciation help | `@renderweft/provider-13` |
| ViewBraid | `viewbraid` | `@viewbraid/{core,provider,provider-13,testing}` | Independent view/rendering strands composed together | “view-brayd” | No obvious exact collision in the basic screen | `@viewbraid/provider-13` |
| DashStrand | `dashstrand` | `@dashstrand/{core,provider,provider-13,testing}` | A dashboard becomes one strand of the host experience | “dash-strand” | “Dash” is descriptive and less distinctive | `@dashstrand/provider-13` |
| VizLattice | `vizlattice` | `@vizlattice/{core,provider,provider-13,testing}` | Visualization components arranged on a composable lattice | “viz-LAT-iss” | “Viz” is common shorthand | `@vizlattice/provider-13` |
| PanelMosaic | `panelmosaic` | `@panelmosaic/{core,provider,provider-13,testing}` | Multiple panels form a native application mosaic | “PAN-uhl moh-ZAY-ik” | Generic technical/art term and code identifiers exist | `@panelmosaic/provider-13` |
| RenderRelay | `renderrelay` | `@renderrelay/{core,provider,provider-13,testing}` | A provider relays rendering capability into the host | “REN-der ree-lay” | Exact active protocol/project collision | `@renderrelay/provider-13` |
| ViewSpindle | `viewspindle` | `@viewspindle/{core,provider,provider-13,testing}` | A spindle organizes rendering threads/providers | “view-SPIN-duhl” | Existing software uses “ViewSpindle” wording | `@viewspindle/provider-13` |
| CanvasWeave | `canvasweave` | `@canvasweave/{core,provider,provider-13,testing}` | Visual surfaces woven into a host-owned canvas | “CAN-vus-weev” | “Canvas” is common but the compound screened cleanly | `@canvasweave/provider-13` |
| PanelHarbor | `panelharbor` | `@panelharbor/{core,provider,provider-13,testing}` | A controlled host for independently sourced panels | “PAN-uhl HAR-bor” | Metaphor is less directly about rendering | `@panelharbor/provider-13` |
| VizFoundry | `vizfoundry` | `@vizfoundry/{core,provider,provider-13,testing}` | A place where visualization capabilities are assembled | “viz-FOUN-dree” | “Foundry” is widely used in software branding | `@vizfoundry/provider-13` |
| FrameLoom | `frameloom` | `@frameloom/{core,provider,provider-13,testing}` | Frames woven into an application | “fraym-loom” | Multiple exact software/package collisions | `@frameloom/provider-13` |
| DashTrellis | `dashtrellis` | `@dashtrellis/{core,provider,provider-13,testing}` | A support structure for dashboard composition | “dash-TREL-iss” | Distinctive compound; “dash” remains descriptive | `@dashtrellis/provider-13` |
| RenderMosaic | `rendermosaic` | `@rendermosaic/{core,provider,provider-13,testing}` | Renderer outputs compose into one visual surface | “REN-der moh-ZAY-ik” | Similar to existing `renderMosaic` APIs/projects | `@rendermosaic/provider-13` |
| ViewForge | `viewforge` | `@viewforge/{core,provider,provider-13,testing}` | Views forged from provider capabilities | “view-forj” | Exact active software/project collisions | `@viewforge/provider-13` |

## 8. Availability/collision screen

Method:

- exact-name GitHub repository search through the public API where its
  unauthenticated quota permitted, supplemented by indexed `site:github.com`
  search;
- exact unscoped npm registry lookup (`404` means no exact unscoped package was
  returned at the time, not that a scope is reservable);
- quoted broad-web search for obvious software/project uses; and
- qualitative review for generic or confusing software terminology.

npm organization/scope availability cannot be authoritatively established
without the account/reservation workflow. No scope was reserved. Results can
change immediately after this check.

| Candidate | GitHub screen | npm screen | Broad-web/obvious collision | Basic result |
| --- | --- | --- | --- | --- |
| PanelWeave | 2 exact-name repository results | Exact unscoped package absent | Current “Panelweave: Home Panel Map” application | **COLLISION / REJECT** |
| RenderWeft | 0 exact-name repository results | Exact unscoped package absent | No obvious exact software result found | **CLEAR ENOUGH FOR FURTHER REVIEW** |
| ViewBraid | 0 exact-name repository results | Exact unscoped package absent | No obvious exact software result found | **CLEAR ENOUGH FOR FURTHER REVIEW** |
| DashStrand | 0 exact-name repository results | Exact unscoped package absent | No obvious exact software result found | **CLEAR ENOUGH FOR FURTHER REVIEW** |
| VizLattice | 0 exact-name repository results | Exact unscoped package absent | No obvious exact software result found | **CLEAR ENOUGH FOR FURTHER REVIEW** |
| PanelMosaic | 0 exact-name repository results | Exact unscoped package absent | Existing code identifiers and generic panel/mosaic uses | **AMBIGUOUS** |
| RenderRelay | 4 exact-name repository results | Exact unscoped package absent | Active Render Relay Protocol and SDKs | **COLLISION / REJECT** |
| ViewSpindle | 0 exact-name repository results | Exact unscoped package absent | Existing Spindle software uses “ViewSpindle” wording | **AMBIGUOUS** |
| CanvasWeave | 0 exact-name repository results | Exact unscoped package absent | No obvious exact software result found | **CLEAR ENOUGH FOR FURTHER REVIEW** |
| PanelHarbor | 0 exact-name repository results | Exact unscoped package absent | No obvious exact software result found | **CLEAR ENOUGH FOR FURTHER REVIEW** |
| VizFoundry | Indexed GitHub search found no obvious exact project; API quota exhausted | Exact unscoped package absent | No obvious exact software result found | **CLEAR ENOUGH FOR FURTHER REVIEW**, GitHub recheck required |
| FrameLoom | Exact active repositories found | Exact npm package exists | Multiple current image/video products and projects | **COLLISION / REJECT** |
| DashTrellis | Indexed GitHub search found no obvious exact project; API quota exhausted | Exact unscoped package absent | No obvious exact software result found | **CLEAR ENOUGH FOR FURTHER REVIEW**, GitHub recheck required |
| RenderMosaic | Indexed GitHub search found no obvious exact repository name; API quota exhausted | Exact unscoped package absent | Existing software APIs use `renderMosaic` | **AMBIGUOUS** |
| ViewForge | Exact active repositories found | Exact unscoped package absent | Active Python UI framework and ViewForge AI product | **COLLISION / REJECT** |

The selected `dashboard-render-sdk-g` repository slug was checked separately
on 2026-10-19. The exact GitHub repository-name search returned zero results,
the exact unscoped npm package lookup returned `404`, and a quoted broad-web
screen found no obvious exact product result. This is **BASIC SCREENING ONLY**:
it does not establish that the display name, repository slug, npm scope, or
package family is available or legally cleared. The illustrative
`dashboard-render-sdk-k` sibling was not selected, created, reserved, or
formally screened as a product.

“Clear enough” means only that this basic screen did not reveal an obvious
blocking collision. It does not mean available, registrable, protectable, or
formally cleared. Before adoption, repeat all registry checks, search relevant
trademark databases and jurisdictions, check domains/social identifiers if
needed, and seek qualified review proportional to the intended use.

## 9. Prior shortlist and selection outcome

### RenderWeft — not selected

The name captures the architecture unusually well: a renderer/provider is a
thread woven into a host-owned UI rather than a second application shell. It is
short, independent from React and Grafana, readable as `renderweft`, and scales
cleanly across core, providers, version adapters, and testing. Its basic screen
was the cleanest. The trade-off is that “weft” is less familiar than “weave”
and may need a pronunciation cue during initial adoption.

**PROJECT DECISION.** The maintainer rejected RenderWeft as the working name.
It and the other candidates below remain only as historical naming research;
none is an active fallback or reserved identity.

### ViewBraid

This communicates composition of independent visual/provider strands and is
easy to pronounce. It is framework- and source-independent with a clean basic
screen. “View” and “braid” are individually common, so deeper clearance remains
important and the rendering connection is slightly less direct.

### DashStrand

This clearly relates to dashboards and composition and screened cleanly. It is
easy to spell and supports a coherent package family. It is less future-proof
if the project grows beyond dashboards, and “dash” is a common, weakly
distinctive software term.

### VizLattice

This evokes a structured visualization surface and future provider grid. It is
source- and framework-independent and screened cleanly. “Viz” is common jargon,
and “lattice” may suggest layout more strongly than rendering.

### CanvasWeave

This describes native visual composition and has readable package names. Its
basic screen found no obvious exact collision. “Canvas” can misleadingly imply
HTML Canvas as the only renderer, while the actual product also uses DOM and
React components.

## 10. Selected working name

**PROJECT DECISION.** Select **Dashboard Render SDK G** as the current working
name, subject to deeper availability and trademark clearance before public
release.

| Surface | Proposed working identity |
| --- | --- |
| Neutral family convention | Dashboard Render SDK |
| Current implementation display name | Dashboard Render SDK G |
| GitHub repository slug | `dashboard-render-sdk-g` |
| Conceptual private package prefix | `@dashboard-render-sdk-g/*` — provisional, not verified or reserved |
| Product description | Independent open-source dashboard rendering SDK; React is the initial host |
| Provider model | Source-specific compatibility lives in explicit provider metadata and descriptions, not the primary brand |

The project name itself does not contain “Grafana.” The `G` suffix identifies
the current Grafana-compatible member of a neutral provider family; it does not
spell the upstream mark, confer permission, or imply affiliation. Grafana
remains a descriptive upstream compatibility target in reviewed prose and
exact technical identifiers.

`Dashboard Render SDK K` with repository slug `dashboard-render-sdk-k` is an
illustrative possible name for a future Kibana-compatible sibling. It is not an
existing product, repository, package, committed roadmap deliverable, or
reserved identity.

This selected working name is not formal trademark clearance. The basic screen
does not establish availability, registrability, or permission to use any
third-party mark descriptively.

## 11. Repository/package naming proposal

Conceptual Phase 2 family for the current repository:

| Package | Responsibility |
| --- | --- |
| `@dashboard-render-sdk-g/core` | Host-facing SDK and dashboard lifecycle orchestration |
| `@dashboard-render-sdk-g/provider-contract` | Provider interfaces, compatibility manifest, errors, and capability vocabulary |
| `@dashboard-render-sdk-g/provider` | Default or resolver-facing provider composition, if Phase 2 needs it |
| `@dashboard-render-sdk-g/provider-13` | Version-bounded provider working name; exact upstream compatibility belongs in its manifest/description |
| `@dashboard-render-sdk-g/testing` | Provider/core conformance helpers |

The `@dashboard-render-sdk-g/*` prefix is a recommended conceptual private
package convention only. These names are provisional until package
implementation, are not approved public exports, and have not been created or
reserved on npm. Before publication, re-evaluate the scope and individual
package names. Do not put `grafana` in a public package name without explicit
written permission. State “compatible with Grafana® OSS software 13.2.3” only
in reviewed descriptions, manifests, and documentation.

## 12. Grafana compatibility wording

Candidate wording for review—not presumed permitted wording:

> Dashboard Render SDK G is an independent open-source SDK for rendering
> dashboards created for Grafana® OSS software inside React applications.

More constrained compatibility statement:

> Dashboard Render SDK G has been tested only with Grafana® OSS software
> 13.2.3, React/ReactDOM 19.2.8, and the capabilities listed in its
> compatibility manifest.

Usage policy:

- use Dashboard Render SDK G, not Grafana, as the prominent project and
  package name;
- use Grafana only to identify the upstream software and exact compatibility
  target, never as part of the project name;
- distinguish tested compatibility from affiliation, endorsement, ownership,
  or complete parity;
- use the registered symbol and adjective/generic-noun form where the current
  policy requires them and where geographically appropriate;
- link factual compatibility references to `https://grafana.com/` when the
  policy requires links on the mark;
- do not use Grafana logos as Dashboard Render SDK branding;
- review screenshots, marketing copy, metadata, keywords, domains, and social
  identifiers separately; and
- obtain written clarification or qualified review before treating these
  candidate sentences as approved.

**TRADEMARK QUESTION.** Does “dashboards created for Grafana® OSS software”
satisfy the policy's adjective/generic-noun and derivative-software clauses,
and what exact symbol/attribution treatment applies in each target country?

## 13. Independence disclaimer

Proposed future disclaimer for review:

> Dashboard Render SDK G is an independent open-source project. It is not
> affiliated with, endorsed by, or sponsored by Grafana Labs or its affiliates.
> Grafana® and the Grafana Labs marks are trademarks of Grafana Labs.
> References to those marks identify compatibility targets only.

This proposal deliberately does not say the marks are “used with permission,”
because the repository contains no documented permission. The current Grafana
Labs policy publishes an attribution statement containing that phrase.
Therefore the final wording and whether descriptive use is allowed without a
separate permission remain a **TRADEMARK QUESTION**. A disclaimer does not cure
otherwise impermissible mark use.

## 14. Repository rename plan

Execute only after maintainer selection and the required clearance review:

1. record the selected name, clearance scope, date, and decision owner;
2. freeze unrelated merges during the rename window;
3. rename the GitHub repository from `aaliakbarian/grafana-react-sdk` to
   `aaliakbarian/dashboard-render-sdk-g` and verify GitHub redirects;
4. update local `origin`, contributor instructions, clone commands, and any
   submodule/worktree references;
5. rename the GitHub Project and update milestone descriptions while retaining
   issue history and canonical phase semantics;
6. update README display name, repository description, badges, links,
   independence disclaimer, and compatibility wording;
7. update current project-control documentation where the old text is a
   project brand, without rewriting factual upstream references;
8. update repository-level package/workspace names and scripts in one reviewed
   implementation change;
9. update Docker Compose project/container names only where they are
   project-brand identifiers, preserving documented local migrations;
10. update source identifiers, CSS/data attributes, bundle names, generated
    evidence, and CI/workflow references according to Section 16;
11. update package descriptions, repository URLs, bug/support URLs, and future
    npm scope only after the scope is available and approved;
12. regenerate local artifacts and evidence rather than hand-editing ignored
    outputs;
13. run a case-sensitive repository scan for stale project-brand references;
14. validate all local/external links and GitHub redirects;
15. run the complete container-first conformance suite to ensure the naming
    migration changed identity only, not runtime behavior; and
16. publish a concise migration note mapping the old repository identity to
    the new one, without presenting the old name as a continuing product name.

Do not combine the rename with the AGPL license change, provider publication,
or public API stabilization. Each requires separate review and rollback scope.

## 15. Package rename plan

1. confirm the provisional `@dashboard-render-sdk-g/*` npm scope/package
   availability immediately before use;
2. create no npm organization or scope until the maintainer approves the name;
3. map private POC workspaces to temporary internal names or the future neutral
   scope without publishing them;
4. preserve the architectural separation among core, provider contract,
   provider, and conformance tooling;
5. keep React/ReactDOM as host-owned peers and upstream compatibility in the
   provider manifest rather than the brand;
6. avoid `grafana` in public package names unless written permission expressly
   covers the proposed package identity;
7. put exact Grafana OSS version/support claims in package descriptions,
   compatibility manifests, provenance, and documentation;
8. update imports, exports, lockfile identities, test fixtures, bundle guards,
   SBOM/provenance rules, and documentation as one planned migration;
9. run `npm pack --dry-run`-equivalent inspection for every candidate package;
10. keep all packages private until licensing, notices, source availability,
    trademark wording, and release gates pass; and
11. do not publish compatibility aliases under the old scope merely to ease a
    migration from packages that were never public.

## 16. Identifier migration classification

| Current identifier | Classification | Decision |
| --- | --- | --- |
| `Grafana React SDK` | **HISTORICAL PROJECT BRAND — MUST RENAME** | Replace current-brand use with Dashboard Render SDK G; preserve historical evidence where necessary |
| `grafana-react-sdk` | **HISTORICAL PROJECT BRAND — MUST RENAME** | Rename repository slug to `dashboard-render-sdk-g`, then update root workspace identity, Compose project identity, and current-brand URLs where applicable |
| `@grafana-react-sdk/*` | **HISTORICAL PRIVATE SCOPE — MUST RENAME** | Use the provisional project-owned private prefix `@dashboard-render-sdk-g/*` during package implementation; do not publish either scope without the relevant release checks |
| `Dashboard Render SDK` | **PROJECT-OWNED FAMILY CONVENTION — KEEP** | Neutral naming family for provider-specific implementations; it is not currently a standalone product or npm package |
| `Dashboard Render SDK G` / `dashboard-render-sdk-g` | **SELECTED CURRENT WORKING IDENTITY — ADOPT** | Current Grafana-compatible implementation and selected repository slug; `G` is only a family discriminator |
| `Dashboard Render SDK K` / `dashboard-render-sdk-k` | **FUTURE ILLUSTRATION — DO NOT CREATE YET** | Illustrative possible Kibana-compatible sibling only; it is not an existing product, repository, package, or commitment |
| `GrafanaDashboard` | **PUBLIC API — REVIEW** | POC-only today. Prefer a provider-neutral Phase 2 API such as `Dashboard`; retain only if descriptive use is reviewed and architecturally justified |
| `poc-grafana-bridge` | **INTERNAL COMPATIBILITY TERM — MAY REMAIN DESCRIPTIVE** | Historical/private POC name may remain; a production provider gets a neutral package brand and compatibility metadata |
| `grafana-provider` / “Grafana provider” | **INTERNAL COMPATIBILITY TERM — MAY REMAIN DESCRIPTIVE** | May identify the upstream-specific provider internally and in technical prose, subject to reviewed descriptive wording; not the public product brand |
| `grafanaBootData`, `GrafanaApp`, Grafana API/type names | **UPSTREAM PROPER NAME — KEEP** | Preserve exact upstream symbols; do not falsify source evidence |
| `@grafana/*`, `dashboard.grafana.app`, plugin IDs and Grafana source paths | **UPSTREAM PROPER NAME — KEEP** | Exact package/API/source identifiers must remain unchanged |
| Grafana OSS version/support references | **INTERNAL COMPATIBILITY TERM — MAY REMAIN DESCRIPTIVE** | Keep factual versioned compatibility claims with attribution/disclaimer review |
| Phase 0/Phase 1 document titles containing Grafana | **UPSTREAM PROPER NAME — KEEP** when factual; otherwise historical project brand | Preserve evidence; add a historical-name note only where reader confusion is likely |

Staged migration:

1. approve and clear the primary brand;
2. rename repository/project-control surfaces;
3. establish neutral Phase 2 package/workspace identities;
4. review the public component/API vocabulary independently;
5. preserve upstream identifiers and historical evidence; and
6. scan future public artifacts for accidental old-brand use.

## 17. Historical-documentation policy

Do not rewrite completed Phase 0/Phase 1 evidence merely to erase “Grafana.”
The following should remain:

- Grafana OSS product/version names and exact compatibility claims;
- `@grafana/*` package names, source paths, API groups, plugin IDs, symbols,
  screenshots/evidence identities where separately permitted, and quotations;
- historical branch, artifact, test, or package identifiers needed for
  reproducibility; and
- the old project name where it documents what existed at that time.

Change only text that continues to present “Grafana React SDK” as the current
project brand. Where necessary, add one short note: “Dashboard Render SDK G
was previously developed under the working name Grafana React SDK.” Do not
bulk-replace “Grafana,” because that would corrupt upstream proper names and
provenance. The rejected RenderWeft candidate does not become an intermediate
historical product identity.

## 18. License/trademark separation

Copyright licensing and trademark permission are separate:

- renaming does not alter the intended `AGPL-3.0-only` direction for
  project-owned code;
- renaming does not alter Grafana-derived source licensing, package licenses,
  third-party notices, source availability, or provider provenance;
- adopting AGPL does not grant permission to use Grafana Labs marks;
- written trademark permission would not change AGPL or third-party
  obligations; and
- the provider/core technical boundary remains unchanged by the brand.

The [AGPL compliance audit](../architecture/production/agpl-compliance-audit.md)
and this decision therefore remain separate release-gate inputs.

## 19. Remaining trademark questions

1. Does the current policy allow the proposed factual compatibility wording
   without separately documented written permission?
2. What exact attribution text should an independent project use when it has
   no permission but makes a nominative compatibility reference?
3. Does the derivative-software restriction affect documentation that names
   Grafana OSS as the source/compatibility target of the provider?
4. Are screenshots of the reference Grafana UI permissible in technical
   comparison evidence, and what attribution, logo treatment, or permission is
   required?
5. Which countries require or prohibit use of the registered symbol for the
   relevant mark?
6. Is the selected neutral name clear in the jurisdictions and software
   classes that matter to the maintainer?
7. Are the proposed repository slug, npm scope, domains, and social identifiers
   available immediately before migration?
8. If the maintainer wants to retain the current name, will Grafana Labs grant
   written permission covering repository, package, documentation, website,
   and derivative-provider uses?

## 20. Decision

**PROJECT DECISION: READY TO RENAME**

The policy evidence makes a neutral identity the lower-dependency operational
choice. The project has not published packages, so renaming now is materially
less disruptive than renaming after Phase 2. The provider/core architecture,
technical evidence, and AGPL direction do not depend on retaining the current
brand.

Selected current working name: **Dashboard Render SDK G**.

Selected repository slug: **`dashboard-render-sdk-g`**.

Neutral family convention: **Dashboard Render SDK**. The `G` suffix denotes
the current Grafana-compatible implementation and is not a statement of
permission, affiliation, endorsement, or general compatibility. RenderWeft and
the prior shortlist are not selected.

This decision is not formal trademark clearance. It records the maintainer's
selection and authorizes controlled rename planning, not an automatic
repository rename, npm reservation, or package publication.

## 21. Next action

1. Record Dashboard Render SDK G and `dashboard-render-sdk-g` as the selected
   working identity in the rename implementation issue.
2. Repeat the GitHub/npm/web screen near adoption and perform proportionate
   formal trademark, business-name, domain, and jurisdiction checks for the
   selected identity.
3. Decide whether qualified trademark review is needed before public use.
4. Open a separate, reviewable rename implementation issue using Sections
   14–17; do not combine it with the AGPL license change.
5. Keep all `@dashboard-render-sdk-g/*` package names provisional until Phase 2
   package implementation defines the actual package set; do not create or
   reserve npm identities in this workstream.
6. Keep public package/provider publication blocked until naming, licensing,
   notice, source-availability, and release-gate work all pass.

Issue `#66` is ready to close after human review **only when any required
follow-up clearance and migration work has been recorded**. The maintainer has
selected the working identity, but this document alone does not rename the
repository or create package identities.

## 22. Final status

**READY TO RENAME**

Use **Dashboard Render SDK G** as the selected current working name,
`dashboard-render-sdk-g` as the selected repository slug, and Dashboard Render
SDK as the neutral family convention. Treat `@dashboard-render-sdk-g/*` as a
provisional project-owned private package prefix until package implementation.
Keep the current name only during the bounded Phase 1 transition. Do not create
or reserve npm packages, establish a public release identity, or claim formal
availability from the basic screen.
