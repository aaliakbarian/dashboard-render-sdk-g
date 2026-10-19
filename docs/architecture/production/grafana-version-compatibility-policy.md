# Grafana Version Compatibility and Support Policy

## 1. Document metadata

| Field | Value |
| --- | --- |
| Owner | Dashboard Render SDK G maintainers |
| Phase | Phase 1 — Production Architecture and Distribution Strategy |
| Workstream | Define Grafana version compatibility and support policy |
| Status | Architecture research |
| Created | 2026-10-11 |
| Last Updated | 2026-10-11 |
| Related architecture | [Bridge/provider architecture](./bridge-provider-architecture.md), [runtime isolation model](./runtime-isolation-model.md) |

This document uses the phase terminology defined by the canonical
[project roadmap](../../project/roadmap.md). It defines technical compatibility
and support policy; it does not change licensing, distribution, React support,
or the completed Phase 0 POC.

Evidence labels have the following meanings:

- **VERIFIED FACT** — directly supported by pinned source, manifests, or Phase 0
  test evidence.
- **INFERENCE** — an architectural conclusion drawn from verified evidence.
- **TECHNICAL RECOMMENDATION** — the policy proposed by this workstream.
- **DELEGATED DECISION** — a decision owned by another named workstream.

## 2. Executive summary

**TECHNICAL RECOMMENDATION.** Adopt a **manifest-driven verified compatibility
matrix**. Each provider build declares immutable compatibility cells, and every
cell must be backed by conformance evidence. A semver range is not evidence by
itself.

The initial Phase 2 matrix contains one verified cell only:

```text
Grafana OSS 13.2.3
  + public source v13.2.3 / 6193dc03311b631b9727b560d24369e683dc396e
  + exact @grafana/* 13.2.3 package cohort
  + @grafana/scenes 8.13.5
  + React / ReactDOM 19.2.8 (tested combination; final range delegated)
  + dashboard.grafana.app/v1 DTO
  + V1 schemaVersion 42
  + the bounded Phase 0 capability catalog
```

The official Phase 0 container digest and runtime `BuildCommit` remain artifact
evidence, not substitutes for the public source commit. Unknown, hidden, or
unverified server versions fail before the provider commits Grafana singletons,
unless the host supplies an explicit non-secret compatibility attestation that
matches a verified manifest cell.

This policy does not claim compatibility with every Grafana 13 patch, any
Grafana 13 minor, Grafana 14, dashboard V2, arbitrary panels or datasources, or
arbitrary React versions.

## 3. Phase 0 version evidence

### 3.1 Verified baseline

| Dimension | Phase 0 evidence |
| --- | --- |
| Grafana release | Grafana OSS `v13.2.3` |
| Public source commit | `6193dc03311b631b9727b560d24369e683dc396e` |
| Official fixture image | `grafana/grafana:13.2.3` for `linux/amd64` at `sha256:d84563330dc9d2fd2bc096d0fb96021b5319c75bf6ed555566709998e823dec4` |
| Runtime build metadata | `/api/health` reported version `13.2.3`, commit `90ffed056f0884267356c12a0eeb72a022af53f1`, branch `release-13.2.3#patched` |
| Grafana package cohort | `@grafana/data`, `ui`, `runtime`, `schema`, `i18n`, and `e2e-selectors` at `13.2.3` |
| Scenes | `@grafana/scenes@8.13.5` |
| React | `react@19.2.8`, `react-dom@19.2.8`, one physical runtime |
| Dashboard input | Stable `dashboard.grafana.app/v1` DTO, current V1 `schemaVersion: 42` |
| Rendering proof | Text, Stat, and Time series; controlled TestData query path; selected transformation only |

**VERIFIED FACT.** Phase 0 passed Gate C and proved this exact combination. Its
overall decision was REVISE because the production architecture and
distribution model still required work. See the [POC results](../research/poc-results.md).

### 3.2 Identity distinctions

The following values describe different artifacts and must never be compared as
if they were the same commit:

1. `6193dc...` identifies the public source tree analyzed at tag `v13.2.3`.
2. The Docker digest identifies immutable image bytes for a platform.
3. `90ffed...` is build metadata compiled into the patched official binary and
   returned by `/api/health`.
4. Published npm package versions and integrity hashes identify their own
   artifacts; package release pipeline metadata may not equal the public tag's
   commit.

**INFERENCE.** The semantic server version selects a compatibility entry. Source
commit, package integrity, container digest, and runtime build commit strengthen
provenance and artifact matching but do not collapse into one identifier.

### 3.3 Pinned upstream references

- [Grafana `v13.2.3` release](https://github.com/grafana/grafana/releases/tag/v13.2.3)
- [Grafana root manifest](https://github.com/grafana/grafana/blob/v13.2.3/package.json)
- [`/api/health` implementation](https://github.com/grafana/grafana/blob/v13.2.3/pkg/api/http_server.go)
- [Frontend settings implementation](https://github.com/grafana/grafana/blob/v13.2.3/pkg/api/frontendsettings/frontendsettings.go)
- [`@grafana/data` manifest](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-data/package.json)
- [`@grafana/ui` manifest](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-ui/package.json)
- [`@grafana/runtime` manifest](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-runtime/package.json)
- [`@grafana/schema` manifest](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-schema/package.json)
- [`@grafana/i18n` manifest](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-i18n/package.json)
- [`@grafana/e2e-selectors` manifest](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-e2e-selectors/package.json)
- [`@grafana/scenes@8.13.5` manifest in the Grafana tree](https://github.com/grafana/grafana/blob/v13.2.3/package.json)
- [Dashboard API investigation](../research/dashboard-json-api-investigation.md)

## 4. Version dimensions

One dimension can have multiple owners or discovery stages. `BUILD-TIME` and
`RUNTIME-DISCOVERED` describe when it becomes authoritative.

| Dimension | Primary owner | Stage | Policy role |
| --- | --- | --- | --- |
| Core SDK version | CORE-OWNED | BUILD-TIME | Public host API release; independent of provider version. |
| Renderer contract version | CORE-OWNED | BUILD-TIME | Compatibility between core and provider implementation. |
| Provider/bridge version and build ID | PROVIDER-OWNED | BUILD-TIME | Immutable renderer implementation identity. |
| Grafana semantic server version | SERVER-OWNED | RUNTIME-DISCOVERED | Primary server compatibility selector. |
| Grafana public source tag/commit | PROVIDER-OWNED | BUILD-TIME | Source provenance for source-derived provider code. |
| Docker image digest | HOST-OWNED / SERVER-OWNED | BUILD-TIME | Deployment artifact evidence when the host controls it; not browser-discoverable. |
| Runtime `BuildCommit` | SERVER-OWNED | RUNTIME-DISCOVERED | Running binary build evidence; distinct from public source commit. |
| `@grafana/*` package cohort | PROVIDER-OWNED | BUILD-TIME | Exact physical package implementation used by provider. |
| Scenes version/build | PROVIDER-OWNED | BUILD-TIME | Provider-private scene runtime identity. |
| React/ReactDOM version and physical identity | HOST-OWNED | BUILD-TIME and runtime-checked | Host peer runtime admitted by the provider. |
| Dashboard API group/version | SERVER-OWNED / PROVIDER-OWNED | RUNTIME-DISCOVERED | Server advertises; provider manifest admits. |
| Dashboard schema version | SERVER-OWNED / PROVIDER-OWNED | RUNTIME-DISCOVERED | DTO declares; provider adapter admits. |
| Panel source/plugin version | PROVIDER-OWNED | BUILD-TIME | Exact renderer source behavior and options/migrations. |
| Datasource source/plugin version | PROVIDER-OWNED | BUILD-TIME | Exact frontend datasource behavior and metadata contract. |
| Transformation registry profile | PROVIDER-OWNED | BUILD-TIME and runtime-installed | Closed set of transformation implementations and schemas. |
| Compatibility manifest schema | CORE-OWNED | BUILD-TIME | Contract-owned vocabulary used before provider initialization. |

Dashboard UID, revision, time range, and panel instance IDs are not version
dimensions. They are dashboard/session state validated against a compatible
provider.

## 5. Compatibility manifest requirements

The manifest is provider-owned, immutable, machine-readable, free of secrets,
and validated against a contract-owned schema. It is evidence metadata, not a
self-certified support claim: CI evidence is still required for each verified
cell.

### 5.1 Required fields

| Field group | Required content |
| --- | --- |
| Manifest | Schema version; immutable manifest digest; supported renderer-contract version/range |
| Provider | Provider ID, semantic version, immutable build ID, distribution mode, support tier |
| Server cells | Explicit Grafana edition and semantic versions; evidence state; known-incompatible builds |
| Source | Grafana tag, public commit, provenance record/digest for every source-derived closure |
| Package cohort | Exact package name, version, artifact integrity/build identity, and physical-deduplication requirement |
| Scenes | Exact version and artifact/source identity |
| React | Peer range placeholders plus exact tested React and ReactDOM pairs; physical-runtime requirement |
| Dashboard API | Group, stable versions, discovery requirement, namespace model, forbidden fallback versions |
| Dashboard schemas | Family/version adapter IDs, exact supported `schemaVersion` values, migration identity if any |
| Capabilities | Panel IDs, datasource IDs, transformation IDs, layouts/features, and per-capability constraints |
| Runtime | Isolation mode, required browser APIs, asset/public-path policy, style/provider strategy |
| Incompatibilities | Explicit known-incompatible combinations; required even when empty |

### 5.2 Optional fields

- tested server artifact digests and runtime `BuildCommit` allowlists;
- deprecation date, replacement provider, and support-end date;
- environment constraints such as minimum browser engine;
- signatures or external transparency-log references; and
- asset integrity maps when assets are delivered separately from the provider.

An optional field becomes required for a compatibility cell that relies on it.
For example, a cell constrained to one patched official image must include its
artifact identity.

### 5.3 Informational fields

- display name, documentation and release-note URLs;
- human-readable support notes;
- reproducible build timestamp, which must not be identity-bearing; and
- friendly capability descriptions.

### 5.4 Illustrative normalized structure

```text
manifestSchemaVersion
contract { range }
provider { id, version, buildId, distributionMode, supportTier }
grafana {
  cells [{ edition, serverVersion, testedArtifacts[], source { tag, commit } }]
}
cohort { packages[], scenes, reactPeer, testedReactPairs[] }
dashboards { apiVersions[], schemaAdapters[] }
capabilities { panels[], datasources[], transformations[], features[] }
runtime { isolationMode, browserRequirements, assetPolicy, stylePolicy }
knownIncompatibilities[]
provenance { recordId, digest }
```

## 6. Support strategy models

| Model | Assessment | Result |
| --- | --- | --- |
| A — exact Grafana patch only | Best fit for Phase 0 evidence; clear and safe, but produces frequent provider verification/release work. | **VIABLE INITIAL CELL**, not the long-term governance model. |
| B — same Grafana minor range | Better UX if every patch is verified; unsafe when inferred solely from semver because application source and runtime behavior can drift in patches. | **FUTURE OPTION ONLY WITH EVIDENCE.** |
| C — same Grafana major range | Hides minor API, schema, package, plugin, and asset drift. Phase 0 supplies no evidence for it. | **REJECTED.** |
| D — manifest-driven tested matrix | Represents exact verified cells, permits future expansion without pretending versions are interchangeable, and produces auditable failures. | **TECHNICALLY PREFERRED.** |
| E — optimistic runtime compatibility with fallback checks | Cannot prove source-built renderers or global Runtime behavior from superficial capability checks; failures may occur after singleton commit. | **REJECTED FOR SUPPORT CLAIMS.** Diagnostic experiments may use it only outside supported execution. |

**TECHNICAL RECOMMENDATION.** Use Model D, initially populated by one exact
Model A-style cell. A range is permitted only as compact notation for versions
that individually satisfy an approved verification policy; it must never create
untested implied cells.

## 7. Server version discovery

### 7.1 Evidence sources

| Source | Verified behavior in Grafana 13.2.3 | Policy use |
| --- | --- | --- |
| `GET /api/health` | Returns `version` and `commit` from `Cfg.BuildVersion` and `Cfg.BuildCommit`, unless version hiding removes them; also reports service health. | Primary lightweight semantic-version and runtime-build observation. |
| `GET /api/frontend/settings` | Build info includes version, version string, commit fields, build stamp, edition, and environment; it is a large application settings DTO and can also hide version data. | Secondary diagnostic/edition evidence, not mandatory primary discovery. |
| `GET /apis/dashboard.grafana.app` | Advertises API-group versions and preferred version. | Dashboard wire-capability discovery only; it does not establish Grafana semantic/source version. |
| Host deployment metadata | May know image digest, edition, or managed build ID. | Explicit non-secret attestation when browser endpoints intentionally hide version. |

### 7.2 Authoritative values

- **User-facing server version:** semantic `version` observed from `/api/health`
  or explicitly attested by the host.
- **Source compatibility:** the provider cell's pinned source tag/commit and
  provenance record. It is not inferred from runtime `BuildCommit` equality.
- **Provider selection:** semantic version + edition + compatible manifest cell;
  build/digest facts narrow the match when the cell requires them.

If version information is hidden, the provider must not guess. The host may
supply an explicit, non-secret attestation through the provider-selection
boundary. Otherwise selection fails with `ServerVersionUndiscoverable` before
Grafana runtime singleton commit.

A server reporting `13.2.3` but a different build commit is not automatically
the exact Phase 0 artifact. It may match a future verified cell, or it remains
unsupported until tested. The initial cell may require the exact tested artifact
when the deployment can attest it; browser-only deployments can be classified
as experimental until equivalent-build policy is decided.

## 8. Package cohort policy

**TECHNICAL RECOMMENDATION.** The provider pins and physically deduplicates the
Grafana package cohort. Versions do not float independently, even when package
manifests expose broad peers.

| Package | Phase 0 version | API categories used | Policy |
| --- | --- | --- | --- |
| `@grafana/data` | `13.2.3` | STABLE PUBLIC plus UNSTABLE/INTERNAL behavior reached by the source closure | Exact provider pin. |
| `@grafana/ui` | `13.2.3` | STABLE PUBLIC, UNSTABLE PUBLIC, and source-internal symbols used by application modules | Exact provider pin and asset/style audit. |
| `@grafana/runtime` | `13.2.3` | STABLE PUBLIC interfaces plus INTERNAL/UNSTABLE singleton setters/services | Exact provider pin; one physical singleton. |
| `@grafana/schema` | `13.2.3` | Generated public types and schemas | Exact provider pin, aligned with adapters. |
| `@grafana/i18n` | `13.2.3` | Public API with singleton initialization | Exact provider pin; runtime identity participates. |
| `@grafana/e2e-selectors` | `13.2.3` | Public selector constants consumed transitively | Exact provider pin. |

Application-source imports remain **APPLICATION-SOURCE** and provider-private.
Missing package exports reached through exact compiled-file adaptations are
**INTERNAL**, not stable API. Anything not traced is **UNRESOLVED** and cannot
enter a supported provider without review.

Drift risks include duplicate runtime registries, incompatible types that remain
structurally assignable, changed unstable exports, changed field/display
behavior, generated-schema mismatch, style/asset drift, and different singleton
initialization order. Package-manager resolution success is not compatibility
evidence.

## 9. Scenes policy

Scenes has an independent release cadence and version line. Grafana 13.2.3 pins
`@grafana/scenes@8.13.5`; the two version numbers are not interchangeable.

Each provider build must:

1. pin an exact Scenes artifact and include it in the package cohort identity;
2. declare the exact Grafana cells tested with that Scenes build;
3. declare React/ReactDOM peer expectations and exact tested pairs separately;
4. run scene activation, query, rendering, refresh, UID-change, multi-instance,
   and cleanup conformance tests; and
5. release a new immutable provider/manifest cell after a Scenes change.

No initial product range such as `^8.13.5` is supported. A future provider may
admit multiple exact Scenes builds only if each build has conformance evidence.

## 10. React policy dependency

**DELEGATED DECISION.** The final React and ReactDOM support ranges belong to
the separate React/Scenes compatibility workstream.

This policy requires that workstream to define:

- supported React and ReactDOM peer ranges;
- exact tested React/ReactDOM pairs for every support tier;
- one physical React and ReactDOM runtime across host, core, provider, Scenes,
  and Grafana renderer modules;
- duplicate-runtime detection before rendering;
- behavior when host versions are outside the provider declaration; and
- how the Scenes peer declaration is reconciled with tested runtime evidence.

Phase 0 establishes only that React/ReactDOM `19.2.8` worked with Scenes
`8.13.5` in the controlled combination. The manifest must represent that exact
tested pair without treating it as the final public range.

## 11. Dashboard API policy

The provider manifest declares API groups and versions independently from
Grafana semantic version.

Initial Phase 2 policy:

- discover `dashboard.grafana.app` through `GET /apis/dashboard.grafana.app`;
- require stable `v1` in the returned versions;
- retrieve the V1 `dto` subresource;
- reject V2 and beta versions with `UnsupportedDashboardApiVersion`;
- do not fall back to the deprecated legacy `/api/dashboards/uid/{uid}` route;
- do not reinterpret V2 as V1; and
- preserve the normal Grafana dashboard UID mapping to resource
  `metadata.name`.

Discovery establishes a wire capability, not a server-version support claim.
Both server/provider compatibility and API compatibility must pass.

## 12. Dashboard schema policy

Initial Phase 2 support is exact V1 `schemaVersion: 42`. The provider accepts an
already classified V1 DTO and rejects other schema versions before scene
construction.

Future compatibility may use explicit adapters with identities such as:

```text
v1-schema-42-direct
v1-schema-41-to-42-migration-<source-identity>
v2-<api-version>-<schema-adapter-version>
```

Every adapter must declare input family/version, output contract, migration
source/provenance, material-feature preservation rules, and conformance tests.
Server-side DTO normalization may reduce inputs but does not authorize an
unlisted schema. This project will not create an implicit general migration
engine or import Grafana's application `DashboardModel` merely to broaden a
claim.

## 13. Panel/datasource coupling

Built-in panels and datasources are tied to provider source, not merely to their
stable-looking plugin IDs. Source paths, metadata, option schemas, migration
logic, imports, emitted chunks, and assets can change between Grafana releases.

Each provider build therefore pins:

- Grafana tag and public commit;
- exact audited source-file closure and content/provenance digest;
- plugin ID and source/plugin version metadata;
- options and field-configuration behavior profile;
- required migrations and generated configuration sources;
- package cohort and runtime setters/services;
- emitted asset/chunk inventory; and
- conformance fixtures for each admitted capability.

Server plugin metadata can corroborate identity but cannot replace provider
source provenance. An unknown panel may fail panel-locally only when preflight
and isolation prove it cannot affect the dashboard materially. An unavailable
query datasource makes its dependent panels unsupported; it must never be
replaced by fabricated data.

## 14. Transformation coupling

Transformation IDs are not sufficient compatibility identities. A provider
manifest lists each supported transformation with:

- ID;
- implementation/package/source identity;
- accepted option-schema profile;
- ordering and frame-shape assumptions; and
- exact conformance fixtures.

The provider installs a closed transformation registry matching that list.
Unknown or mismatched transformations fail preflight rather than being ignored.

**DELEGATED DECISION.** Catalog expansion, parity criteria, and migration policy
belong to the transformation compatibility workstream. Phase 2 initially keeps
only the selected Phase 0 transformation evidence.

## 15. Provider selection

Provider selection is explicit and deterministic:

1. The host supplies one provider or an explicit resolver over a known local
   candidate set.
2. Core validates inert manifest schema and renderer-contract compatibility
   without importing a Grafana runtime cohort.
3. Host transport probes server version/edition and dashboard API discovery.
4. The resolver filters candidates by exact verified manifest cells and host
   React/browser constraints.
5. One candidate is selected; its full `RuntimeIdentity` is finalized before
   singleton commit.

No hidden mutable global registry, package scan, network registry lookup, or
"newest wins" rule is allowed.

| Situation | Result |
| --- | --- |
| No matching provider | `UnsupportedGrafanaVersion` or a more specific preflight error. |
| Multiple equally valid providers | `ProviderSelectionAmbiguous`; host must select explicitly. |
| Explicit host provider is compatible | Use it deterministically. |
| Explicit host provider is incompatible | Reject; explicit choice does not bypass manifest checks. |
| Different compatible identity already committed in the realm | `RuntimeIdentityConflict`; use a fresh realm/page. |

## 16. Typed version errors

All errors contain safe expected/observed descriptors and manifest/provider IDs,
never credentials, cookies, headers, dashboard bodies, or raw query payloads.

| Error | Scope | Recovery |
| --- | --- | --- |
| `ServerVersionUndiscoverable` | FATAL PROVIDER acquisition | Supply host attestation or use a server exposing supported metadata. |
| `UnsupportedGrafanaVersion` | FATAL PROVIDER acquisition | Install/select a provider with a verified cell. |
| `ProviderVersionMismatch` | FATAL PROVIDER | Select a contract-compatible provider build. |
| `ProviderSelectionAmbiguous` | RECOVERABLE preflight | Host chooses one compatible provider explicitly. |
| `PackageCohortMismatch` | FATAL PROVIDER | Correct bundler resolution/deduplication or provider artifact. |
| `ScenesVersionMismatch` | FATAL PROVIDER | Use the provider's pinned Scenes artifact. |
| `ReactVersionMismatch` | FATAL PROVIDER/realm | Use a supported host runtime; never install a second React copy. |
| `UnsupportedDashboardApiVersion` | DASHBOARD-LEVEL | Select another verified provider; no implicit legacy fallback. |
| `UnsupportedDashboardSchemaVersion` | DASHBOARD-LEVEL | Use a provider with an explicit schema adapter. |
| `UnsupportedPanelVersion` | PANEL-LOCAL only when isolation is proven; otherwise DASHBOARD-LEVEL preflight | Use a provider supporting that exact panel behavior. |
| `UnsupportedDatasourceVersion` | PANEL/DASHBOARD query scope | Use a compatible datasource provider; do not fabricate data. |
| `ManifestVersionUnsupported` | FATAL PROVIDER | Upgrade core/contract or provider manifest schema. |
| `SourceIdentityMismatch` | FATAL PROVIDER/build integrity | Reject the artifact and rebuild from audited source. |
| `RuntimeBuildIdentityMismatch` | FATAL when the selected cell constrains build identity | Use a verified server artifact or matching cell. |

## 17. Upgrade workflow

Every new Grafana patch, minor, or major begins as **UNSUPPORTED**, including
`13.2.4`, `13.3.x`, and `14.x`.

1. Pin the upstream tag, peeled public commit, package manifests/integrities,
   release evidence, and candidate server artifacts.
2. Diff the prior and candidate package cohort, exports, peers, Runtime globals,
   config readers, API discovery, schemas, and generated types.
3. Reconstruct and diff every admitted panel, datasource, transformation, and
   asset source closure.
4. Review options, migrations, plugin metadata, dynamic imports, public paths,
   and bundle composition.
5. Build a new immutable provider candidate; never mutate an already released
   manifest cell.
6. Run API/schema fixtures, provider contract tests, and full Gate A/B/C-
   equivalent browser conformance, including refresh, cancellation, resize,
   UID change, concurrent compatible instances, and cleanup.
7. Record provenance, bundle/integrity, browser, server artifact, and lifecycle
   evidence.
8. Promote the exact cell through support tiers only after review.

Patch upgrades may reuse code, but they do not skip source/provenance diff or
conformance. Minor and major upgrades require the same process plus explicit
architecture review of every changed boundary.

## 18. Support tiers

| Tier | Meaning | Minimum evidence |
| --- | --- | --- |
| EXPERIMENTAL | Candidate combination under research; no compatibility commitment. | Reproducible pins and scoped experiment results; failures documented. |
| VERIFIED | Exact matrix cell works under the defined environment and capability boundary. | Immutable provider build, source provenance, package/bundle integrity, full contract and Gate A/B/C-equivalent conformance, lifecycle and security guard checks. |
| SUPPORTED | Maintainers commit to a stated support window and response/upgrade policy for a verified cell. | VERIFIED evidence plus published support duration, maintenance/security process, documentation, deprecation and migration commitments. |
| DEPRECATED | Previously supported cell scheduled for removal. | Replacement or rationale, notice date, end date, and retained regression/security policy until end. |
| UNSUPPORTED | No verified claim or explicitly incompatible combination. | Clear early typed failure; optional diagnostic evidence. |

Phase 0 evidence can seed a **VERIFIED research cell** after production provider
conformance is implemented. It does not by itself create a published SUPPORTED
release. There is currently no supported npm SDK/provider release.

## 19. CI matrix

The matrix avoids a Cartesian product by treating a provider build as an
inseparable package + Scenes + source cohort.

### 19.1 Blocking lanes

1. **Core contract lane:** provider-free contract, manifest-schema, selection,
   error, and transport tests across supported core build targets.
2. **Provider cell lane:** for every VERIFIED/SUPPORTED cell, exact Grafana
   artifact + provider cohort + each exact supported React pair; full Chromium
   Gate A/B/C-equivalent suite and provider conformance.
3. **Browser lane:** full primary-browser suite plus focused smoke/accessibility
   checks for each additionally claimed browser engine.
4. **API/schema lane:** deterministic fixtures for every declared API and schema
   adapter, including unsupported/failure cases.
5. **Integrity lane:** package deduplication, source provenance, bundle/asset
   inventory, forbidden imports, secret/evidence sanitation, and manifest digest.

### 19.2 Non-blocking/candidate lanes

- scheduled discovery against new Grafana patch releases;
- source/package/provenance diff generation;
- candidate React/Scenes combinations owned by their workstream; and
- pairwise diagnostics for non-primary environments.

Every public support claim still needs a blocking exact cell. Sampling can find
regressions but cannot create untested support claims.

## 20. Validation timing

| Point | Required validation |
| --- | --- |
| Package build/release | Manifest schema, source/package integrity, cohort dedupe, provenance, bundle/asset inventory, conformance evidence link. |
| Core provider registration | Manifest schema and renderer-contract compatibility; no Grafana imports yet. |
| Provider initialization | React/ReactDOM physical identity, browser prerequisites, provider build/cohort integrity, isolation-mode compatibility. |
| First server connection | Server version/edition/build evidence, origin/base path/security scope, API discovery, exact manifest cell. Complete before irreversible singleton commit where technically possible. |
| Dashboard load | API response identity and dashboard schema adapter; complete feature inventory. |
| Panel load | Exact catalog entry, source identity, options/field-config constraints, assets. |
| Datasource load | Exact catalog entry, instance metadata/type, frontend module identity, query capabilities. |

The rule is "fail at the earliest authoritative observation," not "guess early."
Later checks may refine identity but cannot silently change the selected cell.

## 21. Negotiation/fallback

Compatibility is declarative and strict, not magical negotiation.

Allowed behavior:

- choose among explicitly installed providers whose verified cells match;
- allow an explicit host choice when multiple compatible providers exist;
- use an explicitly declared schema adapter inside the chosen cell; and
- report all safely detectable unsupported capabilities during preflight.

Forbidden behavior:

- downgrade dashboard API versions implicitly;
- fall back to the legacy dashboard endpoint;
- choose a nearby patch/minor/major because semver appears close;
- substitute unknown panels, transformations, datasources, or fake data;
- load a second Grafana/Scenes/React cohort; or
- retry with another provider after the realm has committed an incompatible
  Runtime identity.

## 22. Offline/air-gapped deployments

Compatibility manifests, provider code, assets, and verification metadata must
be bundleable locally. Runtime operation must not require npm, GitHub, a package
registry, or this project's infrastructure.

For on-prem Grafana, the host supplies its normal transport and, when server
version is hidden, a local non-secret deployment attestation. Offline selection
uses installed inert manifests. Artifact digests and provenance records can be
verified during build/deployment. Server-hosted frontend loading is not required
by the initial policy.

## 23. Server-hosted module implications

The separate server-hosted module workstream is not assumed to succeed. If it
does, its experiment must expose and verify:

- semantic server version, edition, runtime `BuildCommit`, and—when known—image
  or build artifact identity;
- module/plugin identity and cryptographic asset hashes;
- a discoverable module/asset manifest and public-path policy;
- module format, external dependency map, exact package/Scenes/React identity;
- panel/datasource source provenance and options/migration compatibility;
- CORS, CSP, cookies/auth, integrity, caching, and failure behavior; and
- proof that the modules run within the selected provider's one physical cohort
  without GrafanaApp, route tree, navigation, or a second Runtime.

Until that experiment supplies this evidence, server-hosted modules are
**EXPERIMENT REQUIRED** and cannot populate supported compatibility cells.

## 24. Initial Phase 2 product policy

The narrowest safe Phase 2 — SDK Foundation and Experimental Package policy is:

1. Provider installation/selection is explicit.
2. Only provider-declared, individually verified compatibility cells run.
3. The initial cell targets exact Grafana OSS `13.2.3` and the exact Phase 0
   package/Scenes/source cohort.
4. Only stable `dashboard.grafana.app/v1` and V1 `schemaVersion: 42` are admitted.
5. Only the bounded Text, Stat, Time series, controlled TestData, layout, and
   selected transformation capabilities are admitted.
6. No optimistic version compatibility or legacy API fallback exists.
7. Unsupported versions/features fail with typed preflight errors.
8. One provider build and one compatible `RuntimeIdentity` are allowed per
   JavaScript realm; different identity/origin requires a fresh realm/page.
9. React/DOM `19.2.8` remains the only tested pair until the delegated policy
   defines the product range.
10. The package is experimental until distribution, React/Scenes, styling,
    transformation, and support-window decisions complete.

## 25. Decision matrix

Scores are 1 (worst) to 5 (best). Weights emphasize correctness, source-drift
risk, and clarity because provider code includes version-bound application
source and Runtime singletons.

| Criterion | Weight | A: exact patch | B: tested minor ranges | C: verified matrix | D: optimistic |
| --- | ---: | ---: | ---: | ---: | ---: |
| Correctness | 25% | 5 | 4 | 5 | 1 |
| Source drift risk | 15% | 5 | 3 | 5 | 1 |
| Support clarity | 15% | 5 | 3 | 5 | 1 |
| Maintenance | 10% | 2 | 2 | 4 | 2 |
| User experience | 10% | 2 | 4 | 4 | 4 |
| Upgrade friction | 10% | 1 | 3 | 4 | 5 |
| Test cost | 15% | 3 | 1 | 3 | 5 |
| **Weighted result** | **100%** | **3.70** | **2.95** | **4.40** | **2.40** |

Model C wins because it retains exact evidence while allowing multiple verified
cells over time. The same-major model from section 6 is omitted here because it
is dominated by optimistic compatibility and already rejected by evidence.

## 26. Technical recommendation

### Technical recommendation — HIGH confidence

Adopt the manifest-driven verified matrix as the governance model. Make
compatibility a provider-build property, validate inert manifests before loading
Grafana code, and bind the selected cell into `RuntimeIdentity` before singleton
commit. Keep core SDK, renderer contract, provider, server, package cohort,
Scenes, React, API, schema, and capability identities explicit and independently
versioned.

Confidence is HIGH because Phase 0 and the prior provider/runtime decisions show
strong exact-version coupling and irreversible shared runtime state. Confidence
does not extend to untested Grafana or React versions.

### Initial product support policy — HIGH confidence

Ship only an experimental exact `13.2.3` verified cell at first. Do not label it
SUPPORTED until the maintainers publish a support window and the production
provider passes the final conformance, distribution, and security gates.

### Future expansion policy — MEDIUM confidence

Add immutable exact cells as releases are verified. Minor-range notation may be
introduced later only when an approved policy demonstrates every admitted patch
or defines a reviewed equivalence method. Same-major and optimistic fallback
remain rejected.

### Legal approval

This technical policy does not approve provider distribution. The
[licensing/distribution strategy](./licensing-distribution-strategy.md) and
qualified legal review continue to govern artifacts containing Grafana
application-source-derived code.

## 27. Upgrade recommendation

Treat each Grafana patch as a compatibility candidate, not a presumed upgrade.
Automate source/cohort/provenance and bundle diffs, but require human review of
application-source, unstable/internal API, Runtime/global, schema/API, and asset
changes. Run the full provider conformance cell before promotion.

Recommended release mechanics:

- publish a new provider build and immutable manifest for every admitted change;
- never widen an existing manifest after publication;
- keep old verified cells reproducible during their tier's lifetime;
- publish explicit deprecation/end dates before removing a supported cell; and
- keep provider versions independent of core SDK and Grafana versions.

## 28. Provider-contract impact

The following future changes are recommended for
[bridge-provider-architecture.md](./bridge-provider-architecture.md); this
workstream does not edit that document:

1. Replace `grafana.serverRange` as the primary concept with explicit verified
   compatibility cells; allow ranges only as evidence-backed shorthand.
2. Add the required/optional/informational manifest fields from section 5.
3. Add inert-manifest enumeration and an explicit host resolver hook.
4. Add selection outcomes for no match and ambiguity.
5. Add the typed errors in section 16 to the project-owned contract.
6. Add source identity, package integrity, exact Scenes, tested React pairs,
   support tier, and known-incompatibility fields.
7. Require a canonical manifest digest in `RuntimeIdentity` and safe diagnostics.
8. Define server preflight input as observed facts plus optional host attestation,
   not raw Grafana boot data.
9. Require provider conformance evidence references for every verified cell.

These are contract recommendations, not authorization to implement Phase 2.

## 29. Other Phase 1 impact

| Workstream | Impact | State |
| --- | --- | --- |
| Runtime isolation | `observedCompatibilityId` now comprises selected manifest cell + observed/attested server facts; one cell per realm. | **UNBLOCKED for durable contract update.** |
| React/Scenes policy | Must supply final peers/tested pairs and failure behavior required by manifest. | **NEXT RECOMMENDED WORKSTREAM.** |
| Server-hosted modules | Must expose identities listed in section 23 before compatibility selection. | **EXPERIMENT REQUIRED.** |
| Bundle strategy | Must preserve exact cohort dedupe, manifest/build identity, provenance, and reproducible assets. | **UNBLOCKED analysis; distribution still constrained.** |
| Transformation policy | Must define catalog/parity/adapter evidence consumed by manifest entries. | **UNBLOCKED research; expansion delegated.** |
| Public SDK API | Needs explicit provider/resolver and typed compatibility failures; should not expose Grafana package types. | **UNBLOCKED contract design; Phase 2 implementation waits for Phase 1 gates.** |
| Provider conformance | Gains exact cell axes, support-tier evidence, upgrade workflow, and failure assertions. | **UNBLOCKED for test-harness design.** |
| Productize bounded bridge | May refine license-neutral manifests, selection, and conformance architecture; distributed Grafana-derived provider remains constrained by licensing review. | **YES, but only within existing Phase 1 constraints.** |

Newly blocked: no Phase 2 public compatibility range can be declared until the
React/Scenes workstream finishes, and no server-hosted cell can be declared
until its experiment succeeds. Existing distribution/legal blockers remain; this
policy creates no new legal conclusion.

## 30. Decisions made

1. Compatibility uses a provider-owned manifest-driven verified matrix.
2. The initial matrix contains one exact Grafana OSS 13.2.3 cell only.
3. Semver ranges do not create evidence or implied support.
4. Same-major and optimistic fallback are rejected.
5. Core, contract, provider, server, package cohort, Scenes, React, API, schema,
   plugin, datasource, transformation, and manifest schema versions remain
   distinct dimensions.
6. The Grafana package cohort and Scenes are exact provider pins.
7. Public source commit, container digest, and runtime `BuildCommit` remain
   distinct identities.
8. `/api/health` is the primary lightweight semantic-version probe; API
   discovery separately proves wire capabilities.
9. Hidden version data requires explicit host attestation or early failure.
10. Provider selection is explicit, deterministic, and occurs before irreversible
    runtime singleton commit.
11. Dashboard API V1 and schema 42 are the only initial admitted dashboard input.
12. Panel, datasource, transformation, and schema support is catalog-based and
    never silently ignored or substituted.
13. Every Grafana release starts unsupported and earns a new immutable cell
    through the upgrade workflow.
14. Support tiers distinguish experimental evidence, verification, and a real
    maintainer support commitment.
15. Air-gapped operation must not require an external runtime registry.

## 31. Delegated/open decisions

| Decision | Owner/reason |
| --- | --- |
| Final React/ReactDOM ranges and Scenes peer-support interpretation | React/Scenes compatibility workstream |
| Whether multiple equivalent official/self-built artifacts may share one semantic version cell | Future artifact-equivalence experiment and support review |
| Concrete support-window duration and security/maintenance SLA | Maintainer governance before SUPPORTED tier |
| Final provider distribution and license | Licensing/distribution workstream and qualified legal review |
| Server-hosted module identity/discovery | Dedicated experiment; section 23 requirements apply |
| Styling/global reset/Emotion containment identity | Styling and host-containment workstream |
| Transformation catalog, parity, and migrations | Transformation compatibility workstream |
| Broader V1 schemas and V2 adapters | Future schema/API compatibility work after initial provider |
| Additional panels and datasources | Phase 3 capability expansion after exact source/conformance review |
| Manifest signing/transparency mechanism | Supply-chain design; digest is required initially, signature optional |
| Browser support matrix beyond primary Chromium evidence | Phase 2 product/testing policy |

## 32. Final status

**READY WITH CONSTRAINTS**

The version policy is sufficiently defined to guide provider manifest schema,
explicit provider selection, typed failures, conformance-matrix design, and an
exact experimental Phase 2 cell. It does not authorize broader Grafana ranges,
production support claims, or distributed provider packaging.

The next recommended canonical Phase 1 workstream is **Define React and Scenes
compatibility policy**. That decision is the nearest unresolved input to the
manifest, provider selection, and public compatibility boundary.
