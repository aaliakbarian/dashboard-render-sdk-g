# Phase 1 Production Architecture Decision

## 1. Document metadata

| Field | Value |
| --- | --- |
| Owner | Dashboard Render SDK G maintainers |
| Canonical phase | Phase 1 — Production Architecture and Distribution Strategy |
| Decision | **APPROVE** |
| Status | Final architecture synthesis; pending human review and merge |
| Created | 2026-10-19 |
| Last updated | 2026-10-19 |
| GitHub workstream | [#20 — Approve production SDK architecture](https://github.com/aaliakbarian/dashboard-render-sdk-g/issues/20) |
| Phase 2 umbrella | [#73 — SDK foundation and experimental package](https://github.com/aaliakbarian/dashboard-render-sdk-g/issues/73) |
| Repository | `aaliakbarian/dashboard-render-sdk-g` |

This document is the final synthesis for Phase 1. The canonical phase model
remains the [project roadmap](../../project/roadmap.md). Earlier Phase 1
documents are durable evidence of the state and questions at the time they were
written; this decision resolves their delegated production-architecture
questions without rewriting that history.

## 2. Executive decision

**APPROVE.** Dashboard Render SDK G has sufficient technical, product-boundary,
presentation, lifecycle, compatibility, and licensing-direction evidence to
begin Phase 2 — SDK Foundation and Experimental Package.

The approved architecture is a small provider-neutral core plus an explicit,
exact-version Grafana-compatible renderer provider. The host owns React,
ReactDOM, transport, and authentication. The provider owns one coherent
Grafana/Scenes runtime cohort, a closed capability catalogue, presentation
infrastructure, and versioned lazy features. Admission is manifest-driven and
fails before irreversible singleton initialization when any identity or
capability is unsupported.

This decision authorizes private/experimental Phase 2 implementation. It does
**not** authorize a public npm package or provider release. Artifact-specific
third-party notices and source/reproducibility/SBOM controls remain separate
public-release gates.

## 3. Decision scope

This decision settles the initial production architecture for:

- conceptual package and dependency boundaries;
- the public SDK versus provider-internal contract;
- the one exact verified compatibility cell;
- runtime, React, transport, dashboard, panel, datasource, and transformation
  ownership;
- view-only bundle delivery;
- styling, Emotion, portals, assets, CSP, and lifecycle;
- project license and independent-project identity; and
- the conformance and migration work required to enter Phase 2.

It does not freeze final TypeScript signatures, reserve npm names, approve a
public release, add capabilities, claim broad Grafana compatibility, or turn
the disposable Phase 0 POC into production code.

## 4. Evidence base

The decision is based on the following durable evidence:

- [Phase 0 POC results](../research/poc-results.md), including native Text,
  Stat, Time series, TestData query, transformation, resize, UID-change, and
  two-instance results;
- the [renderer-provider architecture](bridge-provider-architecture.md),
  [runtime isolation model](runtime-isolation-model.md),
  [Grafana version policy](grafana-version-compatibility-policy.md), and
  [React/Scenes policy](react-scenes-compatibility-policy.md);
- the [bundle/dependency strategy](bundle-dependency-strategy.md),
  [styling containment strategy](styling-containment-strategy.md), and
  [transformation strategy](transformation-compatibility-strategy.md);
- the [licensing/distribution strategy](licensing-distribution-strategy.md),
  [AGPL evaluation](agpl-project-license-evaluation.md),
  [compliance audit](agpl-compliance-audit.md), and
  [legal-review packet](legal-review-packet.md);
- completed provider/bundle Experiments A–E:
  [Text renderer](experiments/text-renderer-only.md),
  [TestData runtime](experiments/testdata-runtime-only.md),
  [lazy panel chunks](experiments/lazy-panel-chunks.md),
  [shared Grafana cohort](experiments/shared-grafana-cohort.md), and
  [React-externalized provider](experiments/react-externalized-provider.md);
- completed presentation experiments:
  [host CSS](experiments/host-css-containment.md),
  [Emotion coexistence](experiments/emotion-coexistence.md),
  [portal/focus/z-index](experiments/portal-focus-zindex.md),
  [assets](experiments/provider-assets.md),
  [strict CSP](experiments/strict-csp.md), and
  [style lifecycle](experiments/style-lifecycle.md);
- completed [transformation conformance](experiments/transformation-conformance.md);
  and
- the [server-hosted module experiment](server-hosted-module-experiment.md),
  which rejected server-hosted built-ins as the initial delivery model.

GitHub dependency metadata checked on 2026-10-19 shows 27 closed blockers and
zero open blockers for issue #20. Issue #20 is the sole blocker of issue #73.
The optional signed installed-plugin experiment is assigned to Phase 2 and is
not an initial architecture gate.

## 5. Phase 0 → Phase 1 progression

Phase 0 proved the core hypothesis: existing Grafana OSS dashboards can be
retrieved by UID and selected real Grafana panels can render natively without
an iframe, Grafana application shell, route tree, navigation, or
`GrafanaApp.init`. Gate C passed. The overall Phase 0 decision was **REVISE**
because a production/distribution architecture had not yet been established.

Phase 1 resolved that revision request:

1. it bounded Grafana-derived code behind a renderer-provider contract;
2. defined exact compatibility admission instead of semver optimism;
3. proved host-owned React with a provider-owned shared Grafana cohort;
4. proved renderer-only and runtime-only view artifacts with independent lazy
   features and no editor/Monaco closure;
5. selected runtime, transformation, presentation, asset, CSP, and lifecycle
   ownership models;
6. rejected server-hosted built-in modules as the baseline;
7. adopted `AGPL-3.0-only` for project-owned code; and
8. selected an independent project identity.

The move from Phase 0 **REVISE** to Phase 1 **APPROVE** means the fundamental
architecture questions are answered. It does not mean implementation or public
release work is complete.

## 6. Product/package architecture

The initial conceptual package shape is:

```text
host application
  ├─ @dashboard-render-sdk-g/core
  ├─ @dashboard-render-sdk-g/provider-contract
  └─ selected @dashboard-render-sdk-g/provider-13
         ├─ provider bootstrap/admission
         ├─ shared Grafana/Scenes cohort
         └─ closed lazy capabilities

conformance development
  └─ @dashboard-render-sdk-g/testing
```

These names are provisional until Phase 2 package implementation.

| Boundary | Owns | Exposes | Depends on | Must not import |
| --- | --- | --- | --- | --- |
| Core | Host-facing dashboard orchestration, sessions, lifecycle, typed public errors, provider selection | Dashboard-by-UID rendering concepts, configuration, session/status surface | Provider contract; host React-facing API | Grafana packages, Scenes, `public/app`, datasource or transform implementations |
| Provider contract | Project-owned manifests, capabilities, admission vocabulary, transport interface, provider/session handles | Inert metadata and opaque provider contracts | Project-owned types only | Grafana, React implementation, `public/app`, feature chunks |
| Grafana-compatible provider | Exact Grafana cohort, runtime coordinator, conversion, queries, panels, transforms, styles, portals, assets | Contract implementations and exact capability manifest | Host React peers, provider contract, exact Grafana source/packages | Host router/auth state, arbitrary plugin URLs, Grafana shell/chrome |
| Testing/conformance | Reusable contract assertions, fixture drivers, bundle/provenance checks | Provider/core conformance suites | Public contracts and explicit test adapters | Production secrets or hidden bypass APIs |
| Host application | React root, transport/auth, selected provider, deployment policy, container size and z-index base | Host capabilities/configuration | Core and selected provider | Grafana credentials embedded in SDK/provider artifacts |

Dependency direction is acyclic: core and contract do not depend on a concrete
Grafana provider; the provider implements the contract; testing observes public
or explicit conformance surfaces.

## 7. Public SDK boundary

The intended initial public surface provides architecture-level concepts for:

- selecting a dashboard by its normal user-facing Grafana UID;
- supplying host configuration and a renderer provider;
- supplying a stable host-owned transport/authentication capability;
- checking compatibility admission before runtime initialization;
- mounting, updating, replacing, and disposing a dashboard session;
- observing typed loading, rendering, query, capability, and lifecycle errors;
  and
- inspecting provider capabilities and exact compatibility metadata.

The public API should use project-owned DTOs and opaque handles. Exact
component and function signatures remain a Phase 2 API-design task.

The following remain provider-internal:

- Grafana package and `PanelPlugin` types;
- Scenes objects, scene graphs, query runners, and activation details;
- Grafana Runtime globals and singleton setters;
- `public/app` identities and generated renderer entries;
- datasource instances and query implementation types;
- transformation operators, registries, and DataFrame implementation types;
- Emotion cache objects, portal managers, and asset bootstrap internals; and
- Grafana boot adaptation.

## 8. Provider boundary

The provider is an explicit, versioned compatibility cell rather than an
ambient plugin registry. It owns:

- inert compatibility and deployment manifests;
- admission before any Grafana module with singleton side effects loads;
- one provider-wide Grafana/Scenes/package cohort;
- page-lifetime runtime services and caches;
- constrained dashboard validation and conversion;
- closed panel, datasource, and transformation catalogues;
- renderer/runtime-only lazy feature entries;
- scoped presentation, portals, assets, CSP integration, and diagnostics; and
- provenance for every source module, package, chunk, and asset it distributes.

The provider must not own host credentials, host navigation, the host React
implementation, arbitrary executable module locations, or the public SDK's
provider-neutral types. Dashboard content may select only declared logical
capability IDs; it can never supply import paths.

## 9. Verified compatibility cell

The only initially verified cell is:

| Axis | Admitted value |
| --- | --- |
| Grafana server/source | Grafana OSS 13.2.3 |
| Public source commit | `6193dc03311b631b9727b560d24369e683dc396e` |
| Published Grafana package cohort | Exact 13.2.3 |
| Scenes | Exact 8.13.5 |
| React / ReactDOM | Exact 19.2.8 / 19.2.8 |
| Dashboard API | `dashboard.grafana.app/v1` DTO endpoint |
| Dashboard schema | V1 `schemaVersion: 42` |
| Panels | Text Markdown, Stat, Time series |
| Datasource | Controlled `grafana-testdata-datasource` Predictable Pulse profile |
| Transformations | Empty pipeline or one exact `renameByRegex` profile |
| Theme/rendering | Client-only light theme, scoped light DOM |
| Evidence tier | Project-verified, initial product tier **EXPERIMENTAL** |

The source commit, Docker image identity, and running binary `BuildCommit` are
distinct provenance facts and must not be conflated. This cell makes no claim
for another Grafana patch, schema, browser matrix, panel, datasource,
transformation, theme, or server artifact.

## 10. Version policy

Compatibility is a provider-owned, manifest-driven verified matrix. The first
matrix contains exactly the cell in Section 9. Semver, same-major status, and
package-manager installability are not compatibility evidence.

Provider selection is explicit and deterministic. It compares observed or
host-attested server facts with exact provider metadata before irreversible
runtime initialization. Unknown, ambiguous, hidden, or mismatched combinations
fail early with typed errors. There is no optimistic fallback.

Every Grafana, package-cohort, Scenes, React, dashboard API/schema, capability,
or provider-build change starts unsupported and must earn a new immutable cell
through source review, bundle/provenance review, and conformance evidence.
Ranges may be documented only after multiple individually verified cells prove
the same claim.

## 11. React policy

- React and ReactDOM are host-owned required peers.
- The first admitted pair is exactly React/ReactDOM 19.2.8.
- `react`, `react-dom`, `react/jsx-runtime`, and `react/jsx-dev-runtime` are
  externalized from provider artifacts.
- There is exactly one physical and logical React/ReactDOM identity per
  JavaScript realm. Version-string equality alone is insufficient; actual
  runtime object identity is verified.
- A duplicate or incompatible identity is fatal and rejected before rendering
  or Grafana singleton initialization.
- Host-created roots and `StrictMode` are supported and required conformance
  profiles.
- Scenes 8.13.5 remains provider-owned and exact.

Scenes 8.13.5 declares React `^18`, while the tested host uses React 19.2.8.
That mismatch remains visible. The combination has strong bounded project
evidence but no upstream peer declaration, so the initial product support tier
is **EXPERIMENTAL**, not a general `SUPPORTED` claim.

## 12. Runtime ownership

The isolation unit is one JavaScript realm plus one physical provider/Grafana
module cohort. After admission, one immutable `RuntimeIdentity` is committed to
that realm.

- Provider/runtime state, Grafana globals, registries, module caches, portal
  root, and compatible static resources live for the provider/page lifetime.
- Dashboard scene, query, observer, overlay child, generation, and session
  state live for one dashboard instance.
- Compatible dashboards share provider services and caches while retaining
  independent scenes and lifecycle.
- Same-identity acquisition is idempotent and reference-counted.
- A conflicting identity is rejected before initialization, including during
  concurrent acquisition.
- Releasing the last dashboard makes the provider `DORMANT`; it does not reset
  unsupported Grafana globals or unload ESM modules.
- A different Grafana origin, security scope, provider cell, React identity,
  locale/theme identity where global, or other incompatible identity requires
  a fresh realm/page.

SSR, multi-origin virtualization in one realm, and independently bootstrapped
providers inside unrelated micro-frontends are unsupported initially.

## 13. Host transport/auth

Authentication and network transport are host responsibilities. The host
registers a stable semantic transport capability before provider admission.
The provider delegates Grafana requests through the host-owned `/grafana`
contract (or its production-equivalent host mapping) and never embeds admin
credentials, service-account tokens, or authorization policy.

The transport contract preserves request identity, cancellation, credentials
behavior chosen by the host, response/error normalization, and sanitized
observability. Transport compatibility is part of `RuntimeIdentity`; raw
function identity is not. The provider must not become an SDK backend or
authentication service.

## 14. Dashboard API/schema

The initial boundary accepts a normal Grafana dashboard UID. In the new API it
maps to resource `metadata.name` and the path:

```text
GET /apis/dashboard.grafana.app/v1/namespaces/{namespace}/dashboards/{uid}/dto
```

The provider performs API discovery, stable V1 selection, DTO validation,
identity checks, and schema/capability preflight. It accepts only the constrained
current-schema V1 profile with `schemaVersion: 42`.

V2, other schema versions, malformed DTOs, unsupported layouts/features, and
unsupported configuration fail with typed errors. The initial implementation
does not silently reinterpret V2, migrate legacy dashboards, or fall back to
deprecated `/api/dashboards/uid/{uid}` routes.

## 15. Panel capability model

The initial closed provider-owned panel catalogue contains exactly:

- Text, limited to the verified Markdown view profile;
- Stat, limited to the verified query/display profile; and
- Time series, limited to the verified field/options/interaction profile.

Each manifest descriptor binds a logical panel ID to exact provider/source
identity, options profile, lazy feature, assets, provenance, and conformance
evidence. First use loads the feature lazily; compatible later use shares the
provider cache. Failed loads are isolated and retry policy is explicit.

Unknown IDs, undeclared modes/options, arbitrary URLs, and SystemJS fallback
are rejected. Table is not supported merely because it appeared in a fixture.
Additional panels require new manifest capabilities and conformance evidence.

## 16. Datasource model

The initial provider declares only the controlled TestData query runtime:

- type `grafana-testdata-datasource`;
- deterministic configured datasource identity;
- verified Predictable Pulse scenario;
- real browser → host transport → Grafana query execution; and
- query lifecycle, refresh, cancellation, error, and stale-generation checks.

Query runtime is separated from datasource authoring/configuration UI. The
view-only provider excludes TestData editors and unused scenario closures.
Arbitrary datasources, discovery, live streams, workers, and authoring are not
supported. Future datasources enter as exact provider-manifest capabilities
with their own module, runtime, lifecycle, security, and provenance evidence.

## 17. Transformation model

The provider capability catalogue—not Grafana's broad mutable application
registry—is the compatibility authority. The initial admitted pipelines are:

1. empty; or
2. exactly one `renameByRegex` using Grafana/Data 13.2.3, a verified series
   DataFrame input, exact string `regex` and `renamePattern` options, and maximum
   chain length one.

The provider uses a closed lazy exact-operator loader and may mirror the
operator into a one-entry registry for execution. It validates order, options,
input shape, operator identity, and output invariants. DataFrames and Grafana
transform types remain provider-private.

Unsupported material transforms reject the dashboard during preflight.
Unexpected runtime input/operator failures are panel-local and fail closed.
There is no raw-data fallback: Scenes 8.13.5 can retain errored raw series after
a `SceneDataTransformer` failure, so the provider must prevent those series
from reaching the visualization.

## 18. Bundle/delivery model

Experiments A–E prove this production candidate:

```text
small provider bootstrap/admission
  + one shared provider-owned Grafana/Scenes/runtime cohort
  + independently lazy renderer/datasource/transformation capabilities
  + host-externalized React/ReactDOM/JSX runtimes
```

Renderer/runtime-only generated or source-built entries exclude authoring code.
The view profile must contain no Monaco, React-Monaco, CodeMirror, Codicon,
editor CSS, or configuration/editor closure. Closed logical loader tables—not
dashboard paths—select content-hashed modules. One shared cohort supplies
Grafana packages, Scenes, Runtime, registries, RxJS, Emotion, and common code
without merging independently lazy features into a monolith.

Provider bootstrap and compatibility metadata remain renderer-free. Local and
offline deployment is required. Size budgets, source deltas, duplication,
editor exclusion, and provenance are CI review gates; the Phase 0 POC bundle
does not itself satisfy future Phase 2 numeric budgets.

## 19. Styling/presentation model

The initial model is scoped ordinary light DOM with light theme only.

- Provider surfaces and portal content carry stable ownership markers.
- A versioned presentation-normalization catalogue contains only audited rules
  proven necessary against hostile host CSS.
- Full Grafana `GlobalStyles`, the Grafana application stylesheet, broad reset,
  blanket specificity escalation, Shadow DOM, and iframe containment are
  excluded.
- The host and provider own distinct `@emotion/react` caches with unique keys.
- Grafana's provider-owned `@emotion/css` singleton is a third, separately
  governed style path.
- Shared `document.head` insertion is sufficient for the verified client-only
  profile; dedicated insertion position and prepend are not required.
- Provider-lifetime cached rules are not leaks; growth must remain bounded
  across dashboard cycles.

Host CSS still has an explicit contract. Universal isolation, dark theme,
dynamic switching, SSR/hydration, and arbitrary design-system coexistence are
not claimed.

## 20. Portal/z-index model

The provider creates one intentional, marked portal root as a controlled child
of `document.body` before overlays open. Direct or silent body fallback is
forbidden. The root is reference-counted at provider lifetime; dashboard-owned
children carry instance ownership and clean up independently.

Stacking uses a host-supplied bounded base plus provider-relative overlay
levels. This avoids claiming that fixed numbers cross unrelated stacking
contexts. Portals escape dashboard overflow, grid/flex clipping, and transformed
ancestors without weakening panel containment.

The tested contract covers React context, synthetic versus native event
behavior, outside-click classification, non-modal popovers, one modal with
dialog name/semantics, focus entry/trap/return, background inertness, Escape,
deterministic provider-surface fallback when the invoker disappears, and one
nested overlay case. It is not a claim of universal screen-reader or
accessibility support.

## 21. Asset model

The provider owns an enumerable asset/deployment manifest with:

- a module base for content-hashed lazy JS/CSS assets;
- a separate Grafana-compatible asset base for stable path-addressed assets;
- exact source/package/license/provenance and hashes;
- expected MIME types, cache policy, and required/optional classification; and
- root and nested-base deployment metadata.

Bootstrap installs and validates the asset policy before Grafana UI observes
public paths. Fetches validate status and MIME. Fonts have a documented
fallback policy; missing required assets fail explicitly. The verified view
profile is locally hosted and offline-capable and does not require a CDN or the
Grafana application asset server.

## 22. CSP model

The initial supported profile is a documented strict client-side CSP cell, not
arbitrary CSP compatibility:

- no `unsafe-eval`;
- no `unsafe-inline` scripts;
- `style-src-attr 'none'`;
- nonce-authorized style elements;
- same-origin/local script, font, image, asset, and connect sources for the
  verified deployment; and
- no iframe requirement.

The host generates a per-response nonce and supplies it before provider
initialization. Provider bootstrap configures Zod's jitless path before
relevant Grafana dependency evaluation. The same nonce is applied to host
Emotion, provider Emotion, and Grafana `@emotion/css` style creation. CSP,
nonce, asset, and portal identities participate in admission and lifecycle
tests. Cross-origin modules, workers, external images, editors, and other CSP
profiles require separate cells.

## 23. Lifecycle model

Initialization order is explicit:

1. validate inert provider, server, React, transport, deployment, style, CSP,
   and asset identity;
2. acquire provider-level presentation and portal resources;
3. install the minimal pre-import runtime/configuration prelude;
4. load and register the single Grafana cohort and bounded services;
5. acquire a dashboard lease, retrieve/preflight the DTO, construct and
   activate its scene; and
6. load only admitted lazy capabilities and start queries.

Teardown reverses instance ownership: cancel requests/generations, deactivate
the scene, remove dashboard overlay children, observers, subscriptions and
timers, release assets/styles owned by the instance, then release the runtime
lease. Provider globals, caches, Emotion sheets, and the empty portal root may
remain at the zero-dashboard baseline until provider/page disposal.

Evidence covers 20 repeated cycles, StrictMode, UID change, refresh,
time-range update, resize, two dashboards, unmounting one owner, final owner
release, dormant-compatible reuse, remount, incompatible admission, and
failure recovery. Test-harness order dependence tracked by issue #67 remains
Phase 2 debt, not an architectural blocker.

## 24. Licensing/distribution

Project-owned Dashboard Render SDK G code and documentation are
`AGPL-3.0-only`, as recorded in the
[license adoption decision](../../project/agpl-license-adoption.md) and the
repository [LICENSE](../../../LICENSE). The project grants no “or later” option
and no exception.

Grafana-derived application code and all published packages, fonts, icons,
styles, and other third-party components retain their applicable upstream
licenses, notices, provenance, and source obligations. Project licensing does
not relicense them. The core/provider separation is a technical architecture
boundary, not a claimed legal firewall.

No public npm/core/provider release is authorized by this architecture
decision. A concrete candidate artifact must pass the notice and source gates
in Section 31. Package publication, release attachments, and public provider
distribution remain prohibited until those gates and all applicable human
reviews pass.

## 25. Project identity/trademark posture

The current independent project identity is:

- family: **Dashboard Render SDK**;
- implementation: **Dashboard Render SDK G**; and
- repository: `aaliakbarian/dashboard-render-sdk-g`.

The `G` is a project-owned provider-family discriminator. It is not trademark
permission, affiliation, endorsement, or a general compatibility claim.
“Grafana” is used descriptively for the upstream compatibility target,
products, APIs, packages, source, versions, and evidence. Historical technical
references remain unchanged. Public descriptions must preserve a clear
independent-project disclaimer and avoid Grafana logos or affiliation claims.

The conceptual `@dashboard-render-sdk-g/*` names remain provisional until
Phase 2 package design; no name reservation or publication follows from this
decision.

## 26. Test/CI conformance matrix

Phase 2 must replace disposable experiment shape with durable provider-cell
conformance. Every admitted cell runs at least:

| Category | Blocking evidence |
| --- | --- |
| Package/bundle | No bundled React/ReactDOM/JSX implementations; one Grafana cohort; closed source allowlist; forbidden-import and source-delta checks; provenance/SBOM inputs; editor/Monaco/Codicon exclusion; lazy-feature request isolation; budgets |
| Runtime | Pre-init admission; exact identity and conflict paths; singleton ordering; compatible reuse; dormant state; StrictMode; cancellation; cleanup; failure recovery |
| Dashboard | Real UID retrieval; API discovery; schema-42 preflight; UID replacement; malformed/unsupported schema/API rejection |
| Panels | Real Text Markdown, Stat, and Time series renderers; option/profile checks; unknown panel rejection; load/cache/failure behavior |
| Query | Real TestData Predictable Pulse request; Loading → Done; refresh; cancellation; stale-generation protection; server/datasource errors |
| Transforms | Empty pipeline; exact `renameByRegex`; input/options/identity checks; result parity; panel-local fail-closed behavior; no raw fallback |
| Presentation | Host CSS hostile profiles; Emotion three-owner identity; portal/focus/z-index contract; font/icon/static assets; strict CSP; bounded style/resource lifecycle |
| Multi-instance | Two compatible dashboards; shared runtime/module caches; independent scenes, queries, portals, observers and cleanup |
| Deployment | Root and nested bases; local/offline assets; host transport; status/MIME failures; no CDN or Grafana app-server assumption |
| Security/invariants | No iframe, shell, navigation, `GrafanaApp.init`, SystemJS, arbitrary URL loading, credentials, secret evidence, or unexpected navigation |

Historical experiments remain evidence and diagnostic fixtures; Phase 2 may
consolidate their mechanics into a smaller contract-focused suite. Real browser
vertical slices, negative admission cases, bundle graph inspection, and
artifact-derived provenance must remain durable.

## 27. POC migration classification

Phase 2 deliberately productizes approved concepts; it does not promote the POC
wholesale.

| Current element | Classification | Phase 2 disposition |
| --- | --- | --- |
| `poc-compat` workspace | **REWRITE FOR PRODUCTION** | Split provider-neutral core/contract from provider implementation |
| `poc-grafana-bridge` | **PROVENANCE / TEST FIXTURE** | Retain exact evidence; generate/source-build bounded provider entries through reviewed production seams |
| `poc-host` | **EXPERIMENT-ONLY / DELETE LATER** | Keep temporarily as conformance reference; replace with consumer fixtures/examples |
| `.grafana-source` aliases | **PROVENANCE / TEST FIXTURE** | Preserve exact-source build evidence; replace ad hoc aliases with reproducible provider build inputs |
| Runtime coordinator/identity | **RETAIN CONCEPT** | Rewrite as provider realm coordinator with two-stage admission, leases and dormant state |
| Boot/config adaptation | **RETAIN CONCEPT** | Rewrite minimal provider-private pre-import prelude; no fake full boot payload |
| Transport | **RETAIN CONCEPT** | Rewrite against stable host capability; preserve cancellation and sanitation |
| Dashboard client | **RETAIN CONCEPT** | Rewrite V1 discovery/retrieval/preflight with project-owned DTO/errors |
| V1 converter | **RETAIN CONCEPT** | Rewrite constrained schema-42 converter; keep Grafana model/migrations out |
| Panel loaders | **RETAIN CONCEPT** | Productize closed manifest-backed lazy renderer-only entries |
| Datasource runtime | **RETAIN CONCEPT** | Productize TestData runtime-only capability; no authoring UI |
| Query runtime | **RETAIN CONCEPT** | Rewrite request IDs, generations, refresh/cancellation and instance disposal |
| Transformation adapter | **RETAIN CONCEPT** | Rewrite exact lazy operator plus fail-closed Scenes containment |
| Presentation normalization | **RETAIN CONCEPT** | Convert only evidenced rules to a versioned catalogue |
| Emotion ownership | **RETAIN CONCEPT** | Productize three-owner contract, unique keys, nonce and bounded diagnostics |
| Portal manager | **RETAIN CONCEPT** | Harden controlled root, reference counts, owner children and focus fallback |
| Asset policy | **RETAIN CONCEPT** | Generate enumerable deployment/provenance manifest and validate it pre-import |
| CSP setup | **RETAIN CONCEPT** | Replace experiment transforms with reviewed bootstrap/configuration seams |
| Instrumentation | **REWRITE FOR PRODUCTION** | Separate safe diagnostics from conformance-only invasive wrappers |
| Evidence/build tools | **PROVENANCE / TEST FIXTURE** | Retain useful scanners; rebuild as deterministic CI/artifact checks |
| Broad POC bundle and test-only resets | **EXPERIMENT-ONLY / DELETE LATER** | Do not ship; never use reset APIs as production isolation |

## 28. Phase 2 entry criteria

This **APPROVE** decision authorizes Phase 2 to begin after human review and
merge of issue #20. Phase 2 may immediately undertake:

- production workspace/package structure kept private;
- provider-contract and core implementation;
- the exact compatibility/deployment manifest schemas;
- conformance and artifact/provenance infrastructure;
- runtime admission, identity, transport, dashboard, and lifecycle foundations;
- deliberate migration/rewrite of proven POC concepts;
- the internal exact-version provider and vertical slices;
- issue #67 lifecycle test-order stabilization; and
- issue #71 package-local test working-directory stabilization.

Phase 2 may not publish the core or provider, claim a supported public release,
or distribute release artifacts until Section 31 passes. No Phase 2 work may
broaden the exact cell without a separately reviewed capability/compatibility
change.

## 29. Phase 2 recommended order

1. Stabilize conformance infrastructure and issues #67/#71.
2. Create the private provider-contract package and inert manifest validation.
3. Create the private core skeleton with no Grafana dependencies.
4. Implement React/provider/server/transport admission and runtime identity.
5. Implement host transport and typed public error normalization.
6. Implement V1 dashboard discovery, retrieval, schema-42 preflight, and the
   constrained converter.
7. Implement provider capability and deployment manifests plus deterministic
   provenance/build checks.
8. Deliver the Text Markdown vertical slice.
9. Deliver the TestData query-runtime slice.
10. Deliver Stat, including display/field conformance.
11. Deliver Time series, including resize, time range and multi-instance tests.
12. Deliver empty/`renameByRegex` transformation support with fail-closed
    containment.
13. Integrate scoped presentation, Emotion, portals, assets, and strict CSP.
14. Enforce production bundle budgets, consumer-build profiles, and source
    closure.
15. Complete third-party notice and source/reproducibility/SBOM release gates.

The recommended first workstream is **conformance/test infrastructure
stabilization**, followed immediately by the provider-contract package. This
keeps every production slice measurable against the approved cell from its
first commit.

## 30. Known debt/risks

| Item | Classification | Required handling |
| --- | --- | --- |
| Scenes 8.13.5 declares React 18 peers while verified runtime is React 19.2.8 | **SUPPORTED LIMITATION** | Keep initial tier EXPERIMENTAL; retain visible warning; re-evaluate for any SUPPORTED tier |
| Exact Grafana/package/Scenes coupling | **SUPPORTED LIMITATION** | Fail outside exact cell; upgrades earn new cells |
| Deep/private/exact-version source seams | **PHASE 2 IMPLEMENTATION DEBT** | Generate/review narrow entries and track immutable provenance |
| Grafana application-source AGPL distribution responsibilities | **RELEASE GATE** | Preserve applicable terms; complete artifact compliance before publication |
| Production numeric bundle budgets not yet achieved | **PHASE 2 IMPLEMENTATION DEBT** | Establish measured budgets in production-shaped build and fail regressions |
| Page-lifetime Grafana singleton model | **SUPPORTED LIMITATION** | One identity per realm; dormant reuse; new identity requires new realm |
| SSR/RSC renderer unsupported | **SUPPORTED LIMITATION** | Client-only provider; separate future decision |
| Dark theme and dynamic switching unsupported | **FUTURE EXPERIMENT** | Initial light theme only |
| Text/Stat/Time series only | **SUPPORTED LIMITATION** | Closed catalogue; add one capability at a time |
| TestData only | **SUPPORTED LIMITATION** | No arbitrary datasource claim |
| Empty/one `renameByRegex` only | **SUPPORTED LIMITATION** | Closed transform catalogue and chain length one |
| #67 lifecycle test ordering | **PHASE 2 IMPLEMENTATION DEBT** | Stabilize before vertical-slice expansion |
| #71 package-local test cwd | **PHASE 2 IMPLEMENTATION DEBT** | Remove repository-root assumptions |
| Signed installed-plugin provider | **FUTURE EXPERIMENT** | Optional issue #49; does not block initial provider |
| #64 third-party notices | **RELEASE GATE** | Generate and audit artifact-specific license/notice output |
| #65 source/reproducibility/SBOM | **RELEASE GATE** | Prove source availability, clean rebuild and SBOM before publication |
| Broader browsers/bundlers/micro-frontends | **FUTURE EXPERIMENT** | Add verified deployment cells before claims |

## 31. Public-release gates

Architecture approval and public-release authorization are deliberately
separate. Before any public npm/core/provider or release artifact:

1. [#64](https://github.com/aaliakbarian/dashboard-render-sdk-g/issues/64)
   must generate, verify, and package artifact-specific third-party licenses,
   notices, copyright, asset, and modification/provenance material.
2. [#65](https://github.com/aaliakbarian/dashboard-render-sdk-g/issues/65)
   must implement and verify corresponding-source availability,
   reproducibility, clean-recipient build instructions, checksums, and SBOM.
3. The candidate tarballs/bundles must pass license, notice, source,
   provenance, secret, forbidden-source, editor-exclusion, integrity, and size
   audits.
4. The exact candidate cell must pass the conformance matrix in Section 26 in
   supported consumer/deployment profiles.
5. Maintainers must explicitly approve package names, support language,
   independent-project/trademark wording, and the release checklist.

These gates do not reopen the package/runtime/presentation architecture unless
they reveal a fundamental contradiction. They block publication, not private
Phase 2 implementation.

## 32. Alternatives rejected

| Alternative | Decision and reason |
| --- | --- |
| Monolithic SDK containing core, Grafana cohort and every feature | Rejected: couples public API to Grafana internals, defeats lazy closure, increases duplication and upgrade risk |
| Promote/rename the Phase 0 POC | Rejected: disposable evidence has mixed boundaries, experimental instrumentation and repository assumptions |
| Optimistic semver/same-major compatibility | Rejected: version strings do not prove server/package/schema/runtime/React compatibility |
| Provider-bundled React or a second React realm identity | Rejected: hooks, contexts, portals and roots require the host's single identity |
| Reset/swap Grafana singletons between dashboards | Rejected: complete supported teardown does not exist; incompatible identity needs a fresh realm |
| Broad application transformation registry | Rejected initially: not the capability authority, expands source/bundle closure, and overstates support |
| Arbitrary plugin URLs or SystemJS | Rejected: violates closed capability and trust boundaries |
| Server-hosted built-in panel/datasource chunks as baseline | Technically rejected for the pinned cell: core webpack chunks are not standalone discoverable modules; TestData AMD discovery did not prove independent native execution |
| Full Grafana application stylesheet/GlobalStyles | Rejected: unacceptable host-side global effects; scoped presentation passed instead |
| Shadow DOM | Deferred/rejected for initial cell: unnecessary for proven containment and risks portal/theme/asset behavior |
| iframe or Grafana shell | Rejected because they break the product goal |
| Public release immediately after Phase 1 | Rejected: #64/#65 and artifact-specific conformance remain mandatory |

## 33. Decision criteria evaluation

| Approval criterion | Evidence | Result |
| --- | --- | --- |
| Coherent package/provider boundaries | Provider architecture plus A–E experiments establish an acyclic core/contract/provider/test split | PASS |
| Runtime identity model proven | One identity, compatible sharing, conflict rejection, dormant reuse, two instances and lifecycle tests | PASS |
| Host-owned React model proven | Externalized React/DOM/JSX, identity probe, duplicate negative test, StrictMode and real panels | PASS for exact cell |
| Real renderer paths proven | Text, Stat and Time series use exact Grafana renderers and native DOM/canvas | PASS |
| Real query runtime proven | TestData Predictable Pulse reaches Grafana and real PanelData with refresh/cancellation | PASS |
| Transformation contract proven | Empty and exact `renameByRegex`, real Time series, input/options/order/error evidence | PASS for bounded profile |
| Presentation/CSP/assets/lifecycle proven | Host CSS, Emotion, portal/focus/z-index, local assets, strict CSP, 20 cycles and two instances | PASS for verified client-side profile |
| Licensing direction explicit | Project-owned AGPL-3.0-only; third-party terms retained; publication gates identified | PASS for architecture; release gates remain |
| Fundamental question still unresolved | Remaining items are implementation debt, explicit limitations, release gates or future expansion | NO |
| Native rendering/productization viable under goals | No iframe, shell, route tree, second React, fabricated data or uncontrolled loading required | YES |

The evidence meets every architecture-approval criterion. Selecting **REVISE**
solely because Phase 2 must implement the design or because release gates
remain would conflate architecture completion with product release readiness.

## 34. Final APPROVE / REVISE / STOP decision

**APPROVE.**

The fundamental product architecture is coherent and evidence-backed for one
exact experimental compatibility cell. Real renderer and query behavior,
runtime/React ownership, lazy provider delivery, transformation containment,
host presentation coexistence, strict CSP, assets, and lifecycle all passed
their bounded tests. The adopted AGPL direction and independent identity remove
the remaining Phase 1 choice dependencies.

Known limitations do not require another Phase 1 architectural model. They are
classified and fail closed. Public-release compliance is explicitly gated and
does not prevent private/experimental Phase 2 implementation.

## 35. Immediate next actions

After human review and merge:

1. close issue #20;
2. close Phase 1 umbrella issue #10 once it records this decision and confirms
   all workstreams are complete;
3. close the Phase 1 milestone after #10 and #20 are closed;
4. unblock and begin Phase 2 umbrella issue #73;
5. start with conformance/test infrastructure stabilization, including #67 and
   #71, then implement the private provider-contract package;
6. retain all package names and APIs as provisional until their Phase 2 review;
7. keep capability scope pinned to Section 9; and
8. keep public publication blocked until #64, #65, and the full candidate
   release checklist pass.

Project-control documents that describe Phase 1 as current remain correct until
this decision is reviewed, merged, and the milestone is closed. They should be
updated in a separate project-control change after that state transition,
rather than as part of this synthesis.

## 36. Final status

**APPROVE**

Phase 1 — Production Architecture and Distribution Strategy has produced a
complete initial production architecture and may close after human review,
merge, and issue bookkeeping. Phase 2 — SDK Foundation and Experimental Package
may then begin within the exact boundaries in this document. Public release
remains unauthorized until the separate release gates pass.
