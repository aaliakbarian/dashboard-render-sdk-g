# Runtime Singleton Ownership and Isolation Model

## 1. Document metadata

| Field | Value |
| --- | --- |
| Owner | Dashboard Render SDK G maintainers |
| Phase | Phase 1 — Production Architecture and Distribution Strategy |
| Workstream | Define runtime singleton ownership and isolation model |
| Status | Architecture research |
| Created | 2026-10-11 |
| Last Updated | 2026-10-11 |
| Upstream baseline | Grafana OSS 13.2.3; `@grafana/scenes` 8.13.5 |
| Related architecture | [Bounded Grafana renderer provider architecture](bridge-provider-architecture.md) |
| Historical evidence | [Phase 0 POC results](../research/poc-results.md) |

This document belongs to the current canonical **Phase 1 — Production
Architecture and Distribution Strategy**. The completed Phase 0 POC is
historical evidence; this document does not change its implementation or make
the POC a production SDK.

Evidence labels have the following meanings:

- **VERIFIED FACT** — directly established by the pinned upstream source or
  completed Phase 0 evidence.
- **INFERENCE** — an engineering consequence supported by that evidence but
  not promised by upstream.
- **TECHNICAL RECOMMENDATION** — the project policy proposed by this
  workstream.
- **DELEGATED/OPEN DECISION** — intentionally left to another Phase 1
  workstream or a future experiment.

## 2. Executive summary

**Final status: READY WITH CONSTRAINTS.**

**VERIFIED FACT.** Grafana Runtime 13.2.3 and Scenes 8.13.5 contain
process/module-level services, mutable registries, caches, and browser globals.
Several can be assigned only once, several have no production reset, and
Runtime configuration is constructed from `window.grafanaBootData` when its
module is evaluated. Phase 0 proved that two compatible dashboards can share
one such runtime while retaining independent scenes, queries, observers, and
cleanup. It did not prove multiple Grafana origins or incompatible runtime
configurations in one JavaScript realm.

**TECHNICAL RECOMMENDATION — HIGH confidence.** The initial product must allow
exactly one immutable, compatible `RuntimeIdentity` per JavaScript realm and
physical renderer-provider module cohort. It must support multiple dashboard
instances under that identity through reference-counted runtime leases and
independent dashboard-session leases. Releasing the final lease makes the
runtime dormant; it does not reset Grafana globals. A compatible identity may
be reacquired. A different identity requires a fresh JavaScript realm, normally
a full page load.

The host explicitly supplies a provider and a project-owned transport
capability. No provider is selected from a hidden global registry. Raw request
function object identity is not part of `RuntimeIdentity`; a stable,
non-secret transport capability ID and normalized security scope are. The
first concrete transport capability remains bound for the realm lifetime and
is never silently replaced.

The initial product policy is therefore:

- one Grafana origin/security scope per JavaScript realm;
- one version-compatible provider/package/Scenes cohort per realm;
- one physical React and ReactDOM runtime per realm;
- many compatible dashboards and React roots are supported;
- changing origin, provider cohort, locale, or other realm-scoped identity
  requires a page reload;
- server-side rendering of the Grafana renderer is unsupported; and
- micro-frontends must share the host-owned provider/runtime and dependency
  cohort rather than independently bootstrap Grafana.

This model preserves the license-neutral core/provider boundary. It does not
decide the provider's distribution license, final Grafana version range,
React/Scenes support range, or styling-containment strategy.

## 3. Phase 0 runtime evidence

The following evidence is authoritative for this decision:

| Evidence | Result | Runtime consequence |
| --- | --- | --- |
| Runtime bootstrap | A minimal boot prelude had to install `window.grafanaBootData` before importing `@grafana/runtime` | Import order is realm-level and irreversible for the evaluated module graph. |
| Compatible repeat acquisition | Repeated acquisition of the same POC runtime identity was deterministic | Compatible callers can share one initialization promise and ready runtime. |
| Conflicting identity | A different base/configuration or plugin/query boundary was rejected | Conflict rejection preserves the first working runtime instead of overwriting globals. |
| Two dashboard instances | Two dashboards shared one runtime and plugin cache while keeping independent scenes, requests, portals, and ResizeObservers | Multi-dashboard support is viable within one compatibility identity. |
| UID changes and remounts | Stale requests were cancelled and instance-owned resources returned to baseline | Dashboard/session cleanup can be independent of realm singleton lifetime. |
| Query runtime | One real TestData datasource/query path served independent SceneQueryRunner lifecycles | Datasource and query services may be runtime-shared when origin, auth scope, settings, and module identity match. |
| React | One physical React/ReactDOM 19.2.8 rendered Text, Stat, and Time series; Scenes 8.13.5 still declared a React `^18` peer | Physical React identity is a hard runtime prerequisite; the supported range remains delegated. |
| Styles/assets | A shared asset path, theme, portal root, and controlled style policy worked; full Grafana resets caused host-global effects | Asset/style policy has realm/document scope even when panel DOM is instance-owned. |
| Cleanup | Instance resources cleaned; Grafana module singletons and registries were not reset | Final release cannot truthfully return the realm to an uninitialized state. |

See [Grafana Runtime investigation](../research/grafana-runtime-investigation.md),
[Scenes investigation](../research/grafana-scenes-investigation.md),
[panel rendering dependencies](../research/panel-rendering-dependencies.md), and
[POC results](../research/poc-results.md).

**INFERENCE.** Phase 0 establishes compatibility sharing, not arbitrary
coexistence. A product claim must remain no broader than the tested model.

## 4. Upstream singleton/global inventory

### 4.1 Grafana Runtime and Data

The source links below are pinned to Grafana OSS 13.2.3.

| State/service | Pinned source and API | Initialization | Reset/teardown evidence | Scope and coexistence |
| --- | --- | --- | --- | --- |
| Runtime configuration | [`packages/grafana-runtime/src/config.ts`](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-runtime/src/config.ts), exported `config` | Reads `window.grafanaBootData` and constructs `GrafanaBootConfig` during module evaluation | No production setter or reset | **REALM/MODULE.** One evaluated configuration per physical Runtime module. |
| `BackendSrv` | [`services/backendSrv.ts`](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-runtime/src/services/backendSrv.ts), `setBackendSrv`/`getBackendSrv` | Explicit setter | Setter can overwrite; no ownership guard or reset | **RUNTIME MODULE.** Technically replaceable, but replacement invalidates consumers and is prohibited by this model. |
| `DataSourceSrv` | [`services/dataSourceSrv.ts`](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-runtime/src/services/dataSourceSrv.ts), `setDataSourceSrv`/`getDataSourceSrv` | Explicit setter | Setter can overwrite; no production reset | **RUNTIME MODULE.** One service identity under this model. |
| Application events | [`services/appEvents.ts`](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-runtime/src/services/appEvents.ts), `setAppEvents`/`getAppEvents` | Explicit setter | Setter can overwrite; no production reset | **RUNTIME MODULE.** Shared bus; event scoping remains provider-owned. |
| Template service | [`services/templateSrv.ts`](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-runtime/src/services/templateSrv.ts), `setTemplateSrv`/`getTemplateSrv` | Explicit setter | Setter can overwrite; Scenes may permanently patch a method | **RUNTIME MODULE.** Unsafe for independent incompatible roots. |
| Location service | [`services/LocationService.tsx`](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-runtime/src/services/LocationService.tsx), exported `locationService`, `LocationServiceProvider` | Default `HistoryWrapper` is constructed at module evaluation | Replacement is test-only; provider affects hook consumers but not all direct singleton readers | **RUNTIME MODULE plus React context.** One default history; initial SDK does not hand it host routing. |
| Legacy location service | [`services/LocationSrv.ts`](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-runtime/src/services/LocationSrv.ts), setter/getter | Explicit setter | Replaceable; no reset | **RUNTIME MODULE.** Compatibility-only; avoid where possible. |
| Panel import utilities | [`utils/plugin.ts`](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-runtime/src/utils/plugin.ts), `setPluginImportUtils`/`getPluginImportUtils` | Explicit bootstrap | Second set throws; no reset | **RUNTIME MODULE.** One closed panel catalogue/import policy. |
| Query runner factory | [`services/QueryRunner.ts`](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-runtime/src/services/QueryRunner.ts), `setQueryRunnerFactory` | Explicit bootstrap | Second set throws; no reset | **RUNTIME MODULE.** One factory. |
| `runRequest` | Same file, `setRunRequest`/`getRunRequest` | Explicit bootstrap | Second non-test set throws; no reset | **RUNTIME MODULE.** One query execution boundary. |
| Datasource importer | [`services/dataSource/dataSource.ts`](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-runtime/src/services/dataSource/dataSource.ts), internal `setDataSourcePluginImporter` | Explicit bootstrap | Reassignable internally; reset is test-only | **RUNTIME MODULE.** One importer policy. |
| Datasource instances/in-flight loads | [`pluginCache.ts`](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-runtime/src/services/dataSource/pluginCache.ts) and [`dataSource.ts`](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-runtime/src/services/dataSource/dataSource.ts) | Lazy by datasource UID | Runtime entries survive normal cache clearing; complete reset is test-only | **RUNTIME MODULE.** Share only inside one server/auth/settings identity. |
| Datasource settings | [`settings.ts`](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-runtime/src/services/dataSource/settings.ts) | Boot initialization and reload | Mutable caches; full reset helper is test-only | **RUNTIME MODULE.** Bound to server/org/security context. |
| Field-config/editor registries | [`standardFieldConfigEditorRegistry.ts`](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-data/src/field/standardFieldConfigEditorRegistry.ts) | Lazy/explicit registration | `Registry.setInit` rejects after initialization; duplicate IDs throw; no production clear | **DATA MODULE.** One compatible capability set per physical package. |
| Transformation registry | [`standardTransformersRegistry.ts`](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-data/src/transformations/standardTransformersRegistry.ts) | Lazy/explicit registration | Duplicate IDs throw; no production clear | **DATA MODULE.** Closed provider capability set. |
| Transformation promise cache | [`transformDataFrame.ts`](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-data/src/transformations/transformDataFrame.ts) | Lazy by transformation ID | Reset function is explicitly test-only and not a package-index export | **DATA MODULE.** Resolved operator identity persists. |
| Theme configuration | `config.theme2`, Data `ThemeContext`, UI hooks | Runtime config plus React provider | Context can vary by subtree; Runtime readers still observe shared config | **MIXED.** Initial policy binds theme strategy and selected theme to runtime identity. |

**VERIFIED FACT.** Some Runtime setters are mechanically replaceable. That is
not evidence that replacement is safe: already-created datasource instances,
Scenes objects, subscriptions, caches, and imported modules retain the prior
service assumptions.

### 4.2 Scenes

| State/service | Pinned source | Reset/teardown evidence | Scope and consequence |
| --- | --- | --- | --- |
| Legacy active-scene pointer | [`setWindowGrafanaSceneContext.ts`](https://github.com/grafana/scenes/blob/v8.13.5/packages/scenes/src/utils/compatibility/setWindowGrafanaSceneContext.ts) used by `EmbeddedScene` | Cleanup restores the prior value only if the current pointer still belongs to the scene | **WINDOW.** Cannot represent two simultaneously active legacy contexts. Avoid dependencies that read it for initial supported features. |
| Runtime panel map | [`registerRuntimePanelPlugin.ts`](https://github.com/grafana/scenes/blob/v8.13.5/packages/scenes/src/components/VizPanel/registerRuntimePanelPlugin.ts) | No public unregister/reset; duplicate registration rejects | **SCENES MODULE.** Shared closed plugin IDs. |
| Runtime datasource map | [`RuntimeDataSource.ts`](https://github.com/grafana/scenes/blob/v8.13.5/packages/scenes/src/querying/RuntimeDataSource.ts) | No public unregister/reset | **SCENES MODULE.** Shared registered UIDs. |
| Ad hoc compatibility patch | [`patchGetAdhocFilters.ts`](https://github.com/grafana/scenes/blob/v8.13.5/packages/scenes/src/variables/adhoc/patchGetAdhocFilters.ts) | Active entries clean up; original shared method is not restored | **RUNTIME/SCENES MODULE.** Initial product must exclude or separately qualify this feature. |
| Week-start setting/cache | `SceneTimeRange`/`evaluateTimeRange` described in the [Scenes investigation](../research/grafana-scenes-investigation.md#global-singleton-and-multi-instance-analysis) | Activation and deactivation write shared Data-library state | **DATA MODULE.** Concurrent differing week-start policies are unsafe. |
| Scene object lifecycle | [`SceneObjectBase.tsx`](https://github.com/grafana/scenes/blob/v8.13.5/packages/scenes/src/core/SceneObjectBase.tsx) | Reference-counted activation and subscription cleanup | **DASHBOARD/PANEL INSTANCE.** Independently owned when graphs are not shared. |
| Scene query lifecycle | [`SceneQueryRunner.ts`](https://github.com/grafana/scenes/blob/v8.13.5/packages/scenes/src/querying/SceneQueryRunner.ts) | Deactivation unsubscribes query/time/data-layer streams | **PANEL/QUERY.** Independent when request IDs, aborts, and scene graphs are independent. |

### 4.3 Browser, UI, i18n, and dependency globals

| State/service | Evidence | Reset/teardown | Policy |
| --- | --- | --- | --- |
| `window.grafanaBootData` | Runtime `config.ts` reads it at import time | POC-owned value can be removed, but evaluated Runtime config retains its derived object | Realm prelude; never include credentials; identity-bound. |
| `window.__grafana_public_path__` | Grafana application assets and some panels use it | Mutable global; already-imported chunks/assets may retain assumptions | One normalized asset base per realm/provider. |
| `window.__grafanaSceneContext` | Scenes compatibility path and legacy application/datasource code | Conditional restoration only | Do not use as the primary instance locator. Features requiring it need a separate compatibility decision. |
| `window.System`/SystemJS registry | Grafana application plugin loader uses a window-global SystemJS registry and hooks | Registrations/hooks are page-lifetime; Phase 0 did not use SystemJS | Unsupported in the initial provider path; server-hosted module research must not install arbitrary global hooks silently. |
| i18n instance | [`packages/grafana-i18n/src/i18n.tsx`](https://github.com/grafana/grafana/blob/v13.2.3/packages/grafana-i18n/src/i18n.tsx) uses the package-level i18next instance, module-level `tFunc`, and `react-i18next.setI18n` | Language/resources can mutate; no product reset/isolation API | One locale per physical i18n/provider cohort initially. |
| Portal/style nodes | UI and provider-owned document nodes | Provider can reference-count only nodes it creates; Emotion/package style caches may persist | Document/provider shared; dashboard leases own references, not the global cache. |
| React and ReactDOM | Hooks and contexts require the same physical runtime | No meaningful runtime swap after mount | Host peer singleton; incompatible/duplicate copies are fatal. |
| Module/import registry | ESM module cache, Vite chunks, module-federation share scopes | Not unloadable in normal browser execution | Realm lifetime; provider/Grafana package cohort cannot be hot-swapped safely. |

**INFERENCE.** A second physical copy of `@grafana/runtime` creates a second set
of module singletons, but that is not useful isolation by itself. Both copies
still touch the same `window`, document, React contexts, asset globals, and
application modules, and a panel may import a different Runtime copy than the
coordinator initialized.

## 5. `RuntimeIdentity`

`RuntimeIdentity` is a project-owned, immutable description of everything that
must agree before two dashboard sessions can safely share a provider runtime.
It contains no Grafana package types and no secrets.

### 5.1 Field classification

| Field | Classification | Normalization and reason |
| --- | --- | --- |
| Contract/runtime identity schema version | **REQUIRED** | Prevents comparing identities created under different rules. |
| Provider ID | **REQUIRED** | Stable project-owned identifier for the concrete renderer family. |
| Provider build/artifact ID | **REQUIRED** | Immutable build/version plus source-manifest identity; different builds may install different globals. |
| Normalized Grafana origin | **REQUIRED** | Lowercase scheme/host, default port removed; binds cookies, API, datasource settings, and server assets. |
| Grafana base path | **REQUIRED** | Canonical leading slash, no trailing slash except root; distinguishes subpath installations. |
| Namespace | **REQUIRED** | Dashboard API resource scope. |
| Organization/security scope ID | **REQUIRED** | Opaque, non-secret host-issued scope; separates org/cookie/auth contexts without storing credentials. |
| Transport capability ID | **REQUIRED** | Core-issued opaque ID for the bound host transport; see section 14. |
| Observed Grafana server/build compatibility identity | **REQUIRED once preflight completes** | Exact supported version/build facts defined by the version-policy workstream. It is not guessed from the provider. |
| Grafana package cohort | **REQUIRED** | Exact `@grafana/*` versions and integrity/build identity owned by provider. |
| Scenes version/build identity | **REQUIRED** | Scenes global registries and behavior are version-bound. |
| Renderer capability manifest fingerprint | **REQUIRED** | Closed panel, datasource, transformation, and schema/API capability set. |
| React/ReactDOM physical-runtime compatibility token | **REQUIRED** | Confirms one host peer identity and an approved version combination. Exact supported versions are delegated. |
| Locale | **REQUIRED initially** | Grafana i18n is a package-level singleton. |
| Theme/global-style strategy | **REQUIRED initially** | Runtime config, style nodes, Emotion assumptions, and shared portals must agree. |
| Selected theme | **REQUIRED initially** | Conservative because Runtime readers use `config.theme2`; future styling research may make it instance-local. |
| Asset/public-path policy | **REQUIRED** | Browser chunks, fonts, CSS, icons, and workers must resolve consistently. |
| Feature/config fingerprint | **REQUIRED** | Only the allowlisted Grafana config values that affect renderer behavior; never the whole boot payload. |
| Runtime isolation mode | **REQUIRED** | Initial value is `single-compatible-realm-v1`; prevents accidental mixing with a future virtualization model. |
| Default timezone policy | **OPTIONAL initially** | Include when a global default is used by Runtime/Data or datasource modules. An explicit scene time zone is otherwise instance-local. |
| Week-start policy | **OPTIONAL but required when enabled** | Shared Data-library behavior makes differing values incompatible. |
| Dashboard time range | **INSTANCE-LOCAL** | Each `SceneTimeRange` owns it. |
| Explicit dashboard time zone | **INSTANCE-LOCAL when provider capability says so** | May vary per scene only if all selected panels/datasources avoid global fallback. |
| Dashboard UID/title/revision | **MUST NOT PARTICIPATE** | Dashboard sessions are intended to share a runtime. Revision belongs to DTO caching. |
| Panel IDs/layout/options | **MUST NOT PARTICIPATE** | Validated against capability manifest, not identity fields. |
| Instance/root/container ID and dimensions | **MUST NOT PARTICIPATE** | Dashboard-instance state. |
| Current refresh interval | **MUST NOT PARTICIPATE** | Scene-instance state. |
| Request function object identity | **MUST NOT PARTICIPATE** | Bound functions are unstable and caused accidental POC conflicts. |
| Cookies, tokens, authorization headers, raw credentials | **MUST NOT PARTICIPATE** | Secrets must never enter identity, logs, errors, or fingerprints. |
| AbortSignal, callbacks, telemetry sinks, request IDs | **MUST NOT PARTICIPATE** | Ephemeral consumer/query state. |

### 5.2 Conceptual shape

The production contract should expose a readonly, serializable descriptor
similar to:

```text
RuntimeIdentity
  schemaVersion
  provider { id, buildId, capabilityManifestDigest }
  server { origin, basePath, namespace, securityScopeId, observedCompatibilityId }
  transportCapabilityId
  cohort { grafanaPackages, scenes, reactRuntimeToken }
  presentation { locale, themeStrategy, theme, assetPolicy }
  configDigest
  isolationMode
```

This is a semantic contract, not a requirement to expose every field in the
public React component API. The core should derive it from host configuration,
provider manifest, transport registration, and server preflight.

## 6. Compatibility fingerprint

**TECHNICAL RECOMMENDATION.** Compatibility uses structural equality of a
canonical identity document; a digest is a diagnostic/cache key, not the sole
source of truth.

1. Normalize URLs, enum values, sorted capability lists, and version records.
2. Reject unknown identity fields for the declared identity schema rather than
   silently ignoring them.
3. Serialize with stable key ordering.
4. Compute a cryptographic digest such as SHA-256 for logs, cache keys, and
   concise conflicts.
5. Compare the normalized structures when reporting a conflict so the error can
   name safe differing fields.
6. Redact security scope IDs in user-visible evidence to an already-safe label
   or digest; never include secrets.

Server discovery creates a two-stage identity:

- a **requested identity** contains provider, endpoint, namespace, security
  scope, transport capability, and cohort facts available before network work;
- a **finalized identity** adds the observed server compatibility identity and
  server-dependent capability/config digest before Grafana singleton commit.

Two concurrent acquisitions for the same requested identity share one preflight
and initialization promise. No Grafana setter or registry is mutated until the
identity is finalized and validated. If preflight reveals an incompatible
server, initialization ends without committing Grafana globals.

## 7. Acquisition/release lifecycle

### 7.1 State machine

```text
UNBOUND
  -> PREFLIGHTING
      -> UNBOUND                 (failure before any irreversible write)
      -> INITIALIZING
          -> READY
          -> POISONED            (failure after singleton/global commit starts)

READY --last release--> DORMANT
DORMANT --same identity acquire--> READY

PREFLIGHTING / INITIALIZING / READY / DORMANT / POISONED
  --different identity acquire--> typed conflict; existing state is preserved
```

`DORMANT` means zero consumer leases, not an uninitialized realm. `POISONED`
requires a fresh realm. The coordinator must record the first irreversible
commit point.

### 7.2 `acquireRuntime(identity)`

- Validate the complete requested input synchronously, including absence of
  credential-shaped identity values.
- First acquisition reserves the requested identity and begins one shared
  preflight/initialization promise.
- A compatible concurrent or later acquisition joins that promise or receives
  a new idempotent lease to the ready runtime.
- A structurally incompatible identity receives `RuntimeIdentityConflict`;
  the working runtime is not modified.
- Each lease has a unique ID, is idempotently releasable, and may create
  dashboard-session leases.
- The coordinator, not an individual dashboard, is the only owner allowed to
  call Runtime setters or initialize shared registries.

### 7.3 Dashboard-session lifetime

A runtime lease creates an independently owned session containing the scene
graph, generation token, abort group, query subscriptions, observers, portal
reference, error boundary, and component provider surface. A UID change replaces
the session generation, not the runtime.

### 7.4 `releaseRuntime(lease)`

- Releasing a runtime lease first releases any dashboard sessions it owns.
- Double release is a no-op or a typed development diagnostic, never a second
  decrement.
- The final release removes provider-owned listeners and DOM nodes that are
  proven reference-counted and safe to remove.
- It does not clear Grafana registries, overwrite services with placeholders,
  mutate the import cache, reset i18n, or claim that datasource/plugin caches
  are gone.
- Runtime state becomes `DORMANT`; the normalized identity and irreversible
  registrations remain bound for the realm lifetime.
- Reacquisition of the same finalized identity is legal. A different identity
  remains illegal even with zero active leases.

**TECHNICAL RECOMMENDATION — HIGH confidence.** Sequential incompatible
identities are not supported. Upstream production reset APIs are insufficient,
and replacing only the obvious setters would leave hidden module state.

## 8. Resource ownership hierarchy

```text
PAGE / JAVASCRIPT REALM
  provider coordinator + immutable RuntimeIdentity
  ESM/module cache, physical React/ReactDOM, browser globals
  Grafana Runtime/Data/i18n/Scenes singleton modules
  document-level asset/style/public-path policy
  |
  +-- PROVIDER BUILD
      immutable manifest and provenance
      panel/datasource module loaders and module-promise caches
      compatibility adapters
      |
      +-- RUNTIME
          BackendSrv/DataSourceSrv/events/template/query services
          registries, datasource settings/instances, shared portal manager
          runtime leases
          |
          +-- DASHBOARD INSTANCE / SESSION
              DTO generation, scene graph, time range, variables
              providers, portal reference, instance observers/listeners
              |
              +-- PANEL
                  VizPanel, plugin state, transformation/data subscriptions
                  |
                  +-- QUERY
                      request ID, AbortController, Observable subscription
                      PanelData generation and stale-result guard
```

| Owner | Must own | Must not claim to own |
| --- | --- | --- |
| Page/realm | Module cache, globals, one identity binding, physical dependency identities | Individual dashboard state |
| Provider | Manifest, Grafana adapters, loaders, module caches, conformance evidence | Host auth credentials or host routing |
| Runtime | Installed services/registries, shared datasource settings/instances, app events, shared portal/style references | Scene graphs or per-query aborts |
| Dashboard instance | Scene root, DTO/conversion generation, time range, variables, instance DOM/resources | Runtime singleton replacement |
| Panel | VizPanel/plugin state, panel-local error boundary, transformation subscription | Other panels' data or shared datasource disposal |
| Query | Request/cancellation, request ID, stale generation, data subscription | Global transport or datasource registry |

## 9. Multiple dashboard model

The initial SDK guarantees multiple dashboard instances only when all acquire
the same finalized `RuntimeIdentity`.

- Each dashboard receives a new converted scene graph; mutable scene objects
  are never cached or shared across dashboards.
- Query request IDs, `AbortController`s, subscriptions, generation guards, and
  `PanelData` state are instance/panel/query-owned.
- Mutation/ResizeObservers and portal references are independently accounted.
- Unmounting one dashboard deactivates only its graph and queries and releases
  only its resource references.
- Loaded panel/datasource modules, immutable metadata, shared registries, and
  safe datasource instances may be reused.
- A failure in one dashboard or panel is caught at the narrowest safe boundary;
  it does not release or replace the shared runtime.
- A runtime-level fatal failure prevents new sessions but must not silently
  corrupt an already-ready runtime. If corruption cannot be excluded, the
  coordinator becomes `POISONED` and instructs the host to reload.

### Known compatibility exclusions

Phase 0 did not prove strong isolation for features that rely on the single
`window.__grafanaSceneContext`, shared ad hoc-filter patches, conflicting
week-start values, or arbitrary external plugins. Providers must declare those
capabilities unsupported or subject them to dedicated conformance tests before
adding them.

## 10. Multiple Grafana origin analysis

### A. Reject multiple identities in one realm

**Selected initial model.** Correctly matches upstream singleton behavior and
Phase 0 evidence. Grafana A and Grafana B may coexist only in separate page
realms. A conflict fails the attempted acquisition while the existing runtime
continues.

### B. Sequential identities after teardown

**TECHNICALLY REJECTED for the initial product.** There is no complete
production reset for Runtime config, one-shot import/query setters, registries,
datasource caches, i18n, Scenes maps, evaluated modules, or application-source
caches. Zero active dashboard leases is not proof of reset.

### C. Virtualize project-owned services

**EXPERIMENT REQUIRED, not an initial commitment.** A multiplexing BackendSrv,
DataSourceSrv, event bus, and query runner could select a session using explicit
context. It does not virtualize import-time `config`, direct singleton readers,
Data registries, i18n, Scenes maps, public path, plugin modules, or legacy scene
context. Async context propagation across React, RxJS, timers, and plugin code
would be fragile unless upstream adds injection seams.

### D. Separate module realms or provider copies

**EXPERIMENT REQUIRED with low expected value.** Native browser ShadowRealm is
not a generally usable React DOM rendering boundary; Workers cannot own host
DOM. Bundler-created duplicate module graphs isolate some module variables but
not `window`, document, cookies, styles, SystemJS, or React contexts. They also
increase bundle cost and risk the wrong Runtime copy being imported.

### E. Separate iframe/window realms

A separate window or iframe provides genuine JavaScript/module/global
isolation. Iframe rendering violates the project's core product constraint and
does not deliver native host composition. A separate top-level window is not an
embedded dashboard experience. Test-only iframes remain useful for isolation.

### F. Upstream-injected, instance-scoped runtime

**FUTURE IMPROVEMENT.** If Grafana/Scenes expose instance-injected config,
services, registries, i18n, loaders, and legacy-context removal, a future
provider could support more than one origin. This requires upstream capability,
not an SDK-side claim.

**Initial multi-origin policy:** `UnsupportedMultipleOrigin` is returned before
any request or singleton mutation for the second identity. Changing Grafana
origin, base path, security scope, server compatibility identity, or provider
cohort requires a full page reload or another independently navigated page.

## 11. Micro-frontend implications

### Safe initial configurations

- Multiple React roots use one host-owned React/ReactDOM, one core contract
  package identity, one provider build, and one acquired runtime identity.
- The shell acquires the runtime and passes an explicit provider/runtime scope
  or factory to micro-frontends; micro-frontends create only dashboard sessions.
- Module Federation marks React, ReactDOM, renderer-contract, provider, Scenes,
  and the entire Grafana package cohort as strict singletons with compatible
  versions.
- Host navigation may mount/unmount sessions, but it does not replace the
  provider module graph or mutate Grafana location ownership.

### Unsafe/unsupported configurations

- Independently bundled SDK/provider copies each attempting Runtime bootstrap.
- Multiple React or ReactDOM copies, even if versions match.
- Different provider builds or Grafana package cohorts in the same realm.
- One micro-frontend changing `window.grafanaBootData`, public path, locale,
  Runtime services, registries, or plugin import utilities after initialization.
- Runtime acquisition hidden inside a component with no shell-level conflict
  coordination.
- Different Grafana origins/security scopes under separate React roots.

**INFERENCE.** Package-manager or Module Federation declarations reduce the
risk but do not prove physical identity. Provider startup must perform runtime
identity checks and fail deterministically before rendering.

## 12. Provider registration

**TECHNICAL RECOMMENDATION.** Providers are explicit factories or explicit
provider instances passed through the core SDK provider boundary. They are not
discovered from a process-wide “latest provider” registry.

```text
host composition root
  -> constructs/registers host transport capability
  -> imports one concrete renderer provider factory
  -> creates provider instance with immutable manifest
  -> passes provider to project-owned SDK Provider
  -> core requests a RuntimeLease
  -> dashboard components request DashboardSession leases
```

The provider instance is not itself required to be a global singleton, but
only one compatible provider build may commit Grafana globals in a realm. The
provider package owns a realm coordinator for its physical module graph. The
initial product also requires bundler deduplication so independently loaded
copies are unsupported rather than pretending they can coordinate.

**DELEGATED/OPEN DECISION.** A future versioned `globalThis[Symbol.for(...)]`
coordination record could detect duplicate physical provider copies across
bundles. It must not become a hidden provider-selection registry and needs a
security/upgrade design before adoption.

## 13. Cache ownership

| Cache | Owner/lifetime | Sharing rule | Release behavior |
| --- | --- | --- | --- |
| Panel module/plugin promises | Provider/realm | Share by provider build + plugin ID | Retain through dormant runtime; modules cannot be unloaded. |
| Datasource frontend modules | Provider/realm | Share by provider build + datasource type | Retain; loader failures may evict only the failed promise. |
| Datasource instances | Runtime | Share by UID only within same server, security scope, settings revision, and provider cohort | Retain or refresh through provider policy; do not dispose while any session/query uses them. Upstream has no complete production reset. |
| Datasource settings | Runtime | One server/org/security scope | Reload in place only under explicit provider operation; never reuse across identities. |
| Compatibility manifest | Provider build | Immutable and freely shared | Realm/module lifetime. |
| Validated dashboard DTO | Optional runtime cache | Key by server identity, namespace, UID, and revision/ETag; immutable values only | May evict by bounded cache policy. |
| Converted scene graph | Dashboard instance | **Never share.** Conversion may reuse immutable parsed definitions, not mutable scene objects | Destroy/deactivate with session. |
| Field/transform registries | Grafana Data module/runtime | Share one closed initialized catalog | Page lifetime; no production reset. |
| Transformation promises | Grafana Data module | Share by registered transformation ID inside one provider cohort | Page lifetime unless upstream changes. |
| Query/PanelData | Query/panel unless datasource explicitly owns a safe cache | Do not cross dashboard generations by default | Unsubscribe/abort/evict on replacement or deactivation. |
| Asset/chunk cache | Browser/provider | Share exact URLs and integrity under one asset policy | Browser cache/module lifetime. |
| Style/Emotion cache and portal root | Document/provider/runtime | Share only under one presentation policy; use reference-counted provider-owned nodes | Remove only owned nodes proven safe; do not claim to clear third-party caches. |

## 14. Transport identity

The host owns authentication and transport. A raw `fetch` or bound request
function is deliberately excluded from `RuntimeIdentity` because function
identity is not a stable semantic security boundary.

### Recommended contract

1. The host registers one immutable `TransportCapability` with the core at the
   composition root.
2. The core issues or validates a stable opaque `transportCapabilityId`.
3. Its non-secret descriptor includes normalized allowed Grafana origin/base,
   credential mode, security-scope ID, and any request-policy version.
4. The concrete request implementation and credentials remain encapsulated;
   credentials are never readable by the provider or fingerprinted.
5. Runtime acquisition references the capability, not a function.
6. The first capability remains bound to the finalized runtime. A later caller
   cannot replace its implementation under the same active registration.
7. A genuinely changed transport/security scope gets a new capability ID and
   therefore a deterministic `TransportConflict`/`RuntimeIdentityConflict`.

This avoids accidental conflict from newly bound functions while preventing a
caller from silently swapping authentication beneath cached datasource
instances. The provider's `BackendSrv` adapter delegates through the capability
and applies cancellation, URL policy, response normalization, and sanitized
observability; it does not own credentials.

## 15. Theme, locale, and timezone implications

| Concern | Initial scope | Reason | Future possibility |
| --- | --- | --- | --- |
| Locale | Runtime/realm identity | Grafana i18n and `react-i18next` share one package-level instance and mutable language/resources | Per-provider i18n instances would require upstream/component injection proof. |
| Theme strategy | Runtime/document identity | Runtime config, provider ThemeContext, Emotion/style policy, portals, and shared assets must agree | Styling workstream may prove per-dashboard contexts while holding global policy constant. |
| Selected light/dark theme | Runtime identity initially | Some code reads Runtime config instead of only React context | Could become instance-local only after source audit and two-theme concurrent test. |
| Dashboard time zone | Dashboard instance when explicit | Scenes owns a time range and can carry explicit time zone | Any fallback to Runtime user config/datasource global must be identity-compatible. |
| Default timezone | Runtime identity when used | Shared boot/config fallback | Avoid implicit defaults; normalize to explicit scene value where supported. |
| Week start | Runtime identity when feature enabled | Scenes/Data update shared state | Per-instance support requires upstream isolation or a proven adapter. |

This document does not choose Light DOM versus Shadow DOM, global-reset
strategy, or final Emotion ownership. It only requires the eventual styling
decision to declare which presentation fields are realm-scoped.

## 16. Conflict/error model

Errors are project-owned, serializable, safe to log, and never include
credentials or full identity documents.

| Error | Trigger | Scope/severity | Recovery |
| --- | --- | --- | --- |
| `RuntimeAlreadyInitialized` | Code attempts an initialization path after the coordinator already committed it, rather than acquiring a compatible lease | Provider programming error; existing realm may remain usable | Reject caller; fix provider. |
| `RuntimeIdentityConflict` | Requested normalized identity differs from bound identity | Fatal to attempted dashboard/provider acquisition, not the existing runtime | Use compatible identity or reload into fresh realm. |
| `ProviderConflict` | Different provider ID/build/manifest or duplicate uncoordinated provider copy | Fatal to attempted provider | Deduplicate/select one provider; reload. |
| `IncompatibleReactRuntime` | Duplicate or unsupported physical React/ReactDOM | Fatal to provider rendering in the realm | Correct host bundling/version; reload. |
| `IncompatibleGrafanaVersion` | Server preflight is outside provider manifest | Dashboard/provider acquisition failure before commit | Select compatible provider/server. |
| `TransportConflict` | Capability/security scope differs or a bound capability is replaced | Fatal to attempted runtime/dashboard | Use original capability or reload. |
| `UnsupportedMultipleOrigin` | A second origin/base is requested in the same realm | Dashboard acquisition failure | New page/realm. |
| `RuntimeInitializationFailure` | Preflight or bootstrap fails | Recoverable only if before commit; otherwise realm becomes `POISONED` | Retry pre-commit failure; otherwise reload. |
| `RuntimeCleanupFailure` | Dashboard/provider-owned cleanup fails or resources remain | Dashboard-fatal if contained; provider/realm `POISONED` if shared ownership is uncertain | Report evidence and reload before new sessions. |

Conflict errors include the safe active/requested fingerprint digests and a
list of non-secret differing field names. They do not expose endpoint query
parameters, cookies, headers, tokens, or raw configuration.

## 17. HMR/development policy

Production correctness is not weakened for HMR convenience.

- Vite may hot-replace host presentation code that does not own or reinstall
  Grafana services.
- The provider, renderer-contract, Grafana package cohort, Scenes, React,
  datasource/panel source bridge, registry bootstrap, boot prelude, and runtime
  coordinator form an HMR boundary that requires a full browser reload when
  changed.
- A disposed dashboard module must release its dashboard session before HMR
  accepts a replacement.
- The runtime identity/build ID includes development build identity. If HMR
  changes that identity after singleton commit, the coordinator marks the
  provider stale and requests a full reload; it does not reinitialize.
- A module replacement that duplicates the coordinator/provider is unsupported
  and should produce a development diagnostic rather than mutate globals.
- Development tools should expose status, active lease/session counts, safe
  fingerprint, and “reload required” state.

Phase 0's fresh-page recovery was correct evidence, not a missing production
reset feature.

## 18. Test isolation

### Tests that require a fresh JavaScript realm

- first/import-order initialization and boot prelude;
- each distinct `RuntimeIdentity` or Grafana origin/security scope;
- provider/Grafana/Scenes/React cohort conflict tests;
- one-shot plugin-import, `runRequest`, query-factory, and registry tests;
- locale/i18n initialization with different locales;
- public-path/asset strategy changes;
- initialization failure after the irreversible commit point;
- HMR stale-module and duplicate-provider experiments; and
- any assertion that globals are absent before first import.

Preferred isolation, strongest first:

1. fresh browser context for cross-cookie/storage/security tests;
2. fresh browser page for independent module/global identity;
3. a test-only iframe when same-page realm behavior is specifically under
   test—never as product rendering;
4. separate Node process for module singleton/import-order tests; and
5. Node VM/module isolation only when the bundler/module semantics under test
   are faithfully reproduced.

Production code must not call upstream test-only reset helpers. Same-identity
multi-dashboard tests intentionally share one page/runtime and must verify
independent cleanup. Test cleanup records residual resources but does not use
private resets to manufacture a production capability.

## 19. SSR policy

**UNSUPPORTED for the initial Grafana renderer — HIGH confidence.**

Runtime config, location, i18n detection, Scenes compatibility, panel modules,
canvas measurement, observers, assets, portals, and application-source modules
assume browser globals or DOM behavior. The provider must fail with a typed
browser-capability error if acquired during server rendering and must defer all
Grafana imports until the client boot prelude is installed.

The future core SDK may render a host-controlled placeholder during SSR, but
that is not Grafana dashboard SSR or hydration. SSR support is not promised by
this runtime model.

## 20. `RendererProvider` contract impact

The next revision of the conceptual contract in
[bridge-provider-architecture.md](bridge-provider-architecture.md) should add
project-owned runtime concepts without importing Grafana types:

| Concept | Required responsibility |
| --- | --- |
| `RuntimeIdentity` | Immutable normalized compatibility descriptor. |
| `CompatibilityFingerprint` | Identity schema version, safe digest, and safe comparison result. |
| `TransportCapability` | Host-owned opaque request authority and semantic security scope. |
| `RuntimeCapabilities` | Provider manifest subset finalized against observed server compatibility. |
| `RuntimeLease` | Idempotent release, status, safe fingerprint, and dashboard-session acquisition. |
| `DashboardSession` | Instance generation, render surface, refresh/time controls, cancellation, and cleanup. |
| `RuntimeStatus` | `unbound`, `preflighting`, `initializing`, `ready`, `dormant`, `poisoned`, plus safe counts/evidence. |
| Typed runtime errors | Conflict, compatibility, initialization, cleanup, and unsupported-environment outcomes. |

Recommended provider operations are conceptually:

```text
provider.describe() -> immutable manifest
provider.previewRuntimeIdentity(hostConfig, transportCapability) -> requested identity
provider.acquireRuntime(requestedIdentity, transportCapability) -> RuntimeLease
runtimeLease.openDashboardSession(request) -> DashboardSession
runtimeLease.getStatus() / getCompatibilityFingerprint()
runtimeLease.release()
```

The core owns host configuration, transport-capability registration, lease
orchestration, UID generation, stale-generation handling, and React error
presentation. The provider owns Grafana singleton commit, exact fingerprint
fields derived from its cohort, session construction, and safe inspection.

The public `<GrafanaDashboard>` API should not require callers to build a raw
`RuntimeIdentity`; it consumes the explicit provider and host configuration
from a parent SDK provider boundary.

## 21. Initial product constraints

| Constraint | Classification | Rationale |
| --- | --- | --- |
| One compatible `RuntimeIdentity` per JavaScript realm | **ACCEPTABLE INITIAL PRODUCT CONSTRAINT** | Matches upstream globals and Phase 0 proof. |
| Multiple compatible dashboards/React roots | **SUPPORTED INITIAL BEHAVIOR** | Proven in Phase 0; requires conformance tests. |
| One Grafana origin/base/security scope per realm | **ACCEPTABLE INITIAL PRODUCT CONSTRAINT** | Prevents transport/datasource/config leakage. |
| Full page reload to change identity | **ACCEPTABLE INITIAL PRODUCT CONSTRAINT** | Honest consequence of non-resettable modules. |
| One provider/package/Scenes cohort and one physical React/ReactDOM | **FUNDAMENTAL LIMITATION at this baseline** | Hooks, contexts, imports, and registries require coherent physical modules. |
| No renderer SSR | **ACCEPTABLE INITIAL PRODUCT CONSTRAINT** | Product is a frontend native renderer and upstream is browser-bound. |
| No arbitrary SystemJS/import-map provider path | **ACCEPTABLE INITIAL PRODUCT CONSTRAINT** | Phase 0 used a closed audited catalog. |
| Per-dashboard explicit time range/timezone where proven | **SUPPORTED INITIAL BEHAVIOR** | Instance-local Scenes state. |
| Concurrent per-dashboard locale or theme | **OPEN QUESTION / FUTURE IMPROVEMENT** | Global i18n/config/style readers require a dedicated experiment. |
| Multiple origins through virtualization | **FUTURE RESEARCH** | Significant gaps remain beyond service adapters. |
| Separate windows/iframes for product isolation | **REJECTED BECAUSE IT BREAKS PRODUCT GOALS** | Violates native host composition/no-iframe objective. |

## 22. Isolation strategy decision matrix

Weights reflect the initial SDK objective: correctness and Grafana compatibility
matter more than multi-origin breadth. Scores are 1 (poor) to 5 (strong).

| Criterion | Weight | A: one identity/realm | B: virtualized globals | C: provider/module realms | D: page/window isolation |
| --- | ---: | ---: | ---: | ---: | ---: |
| Correctness/evidence | 25% | 5 | 2 | 2 | 5 |
| Grafana compatibility/fidelity | 20% | 5 | 3 | 2 | 5 |
| Implementation simplicity | 10% | 5 | 1 | 2 | 3 |
| Maintenance/upgrade cost | 10% | 4 | 1 | 1 | 3 |
| Multi-dashboard support | 10% | 5 | 4 | 3 | 4 |
| Multi-origin support | 5% | 1 | 4 | 3 | 5 |
| Micro-frontend integration | 5% | 3 | 4 | 2 | 1 |
| Debuggability | 5% | 5 | 1 | 1 | 4 |
| Bundle cost | 5% | 4 | 3 | 1 | 2 |
| Native product UX | 5% | 5 | 5 | 4 | 1 |
| **Weighted score / 5** | **100%** | **4.55** | **2.55** | **2.05** | **3.90** |

Interpretation:

- **Model A — TECHNICALLY PREFERRED.** It is the only native-host model backed
  by completed Phase 0 evidence and honest upstream ownership.
- **Model B — EXPERIMENT REQUIRED.** It could improve multi-origin support but
  does not cover all globals and has high hidden-context risk.
- **Model C — VIABLE ONLY AS A RESEARCH EXPERIMENT.** Duplicate module graphs
  do not isolate browser/document globals and threaten React coherence.
- **Model D — TECHNICALLY CORRECT ISOLATION, REJECTED FOR PRODUCT RENDERING.**
  It scores well technically but breaks native composition/no-iframe goals.

The score is an engineering decision aid, not a claim of mathematical
precision. Model D's score demonstrates that isolation quality alone is
insufficient when the product UX constraint is mandatory.

## 23. Technical recommendation

### Technical recommendation

Adopt **Model A: one compatible `RuntimeIdentity` per JavaScript realm**.

- **Confidence: HIGH** for the single-identity and compatible multi-dashboard
  policy because it matches pinned source and passed browser evidence.
- **Confidence: HIGH** that incompatible sequential initialization must be
  rejected because complete production reset APIs do not exist.
- **Confidence: MEDIUM** for the exact identity field partition because the
  version, React/Scenes, styling, and transformation workstreams may refine
  fields without changing the one-identity rule.
- **Confidence: LOW** that project-level virtualization can ever provide full
  multi-origin compatibility without upstream changes; treat it only as future
  research.

Use explicit provider factories/instances, one realm coordinator, a semantic
host transport capability, two-stage identity finalization, shared compatible
initialization, reference-counted runtime leases, independent dashboard
sessions, and a permanent dormant binding after final release.

### Legal/distribution boundary

This design is license-neutral. It states how a renderer provider behaves, not
how Grafana-derived provider code is licensed or distributed. The decisions in
[licensing and distribution strategy](licensing-distribution-strategy.md) and
[AGPL project-license evaluation](agpl-project-license-evaluation.md) remain
separate approval gates.

## 24. Product policy

The experimental SDK product statement should be:

> One host page may use one compatible Grafana renderer provider and one
> Grafana server/security identity to render multiple dashboards. Dashboard
> instances have independent scenes and query lifecycles but share the
> provider's Grafana runtime, module caches, registries, and safe datasource
> resources. Switching server/provider/runtime identity requires a full page
> reload. Multiple origins in one JavaScript realm, SSR, and independently
> bootstrapped micro-frontend providers are unsupported.

The provider must expose these restrictions in its manifest and fail
deterministically. Documentation must not imply that “unmount” resets Grafana
or that a new React root creates a new runtime.

## 25. Future research

1. Test whether current selected panels can render two light/dark ThemeContext
   values concurrently while Runtime `config.theme2` remains shared.
2. Determine whether separate i18next instances can be injected through the
   full selected panel/Scenes closure; until then keep locale realm-scoped.
3. Prototype a narrow service-virtualization experiment only after inventorying
   every direct Runtime/config/global reader for a second provider target.
4. Track upstream Grafana/Scenes work toward injected Runtime services,
   instance-scoped registries, and removal of `window.__grafanaSceneContext`.
5. Test a versioned well-known-symbol duplicate-provider detector without
   enabling hidden provider selection.
6. Evaluate server-hosted modules only inside the same physical package/React
   cohort; loading code from a server does not create runtime isolation.
7. Define datasource-instance disposal requirements for future datasource
   families with sockets, live streams, or workers.
8. Measure page-lifetime cache limits and provide bounded DTO/metadata cache
   policies without pretending ESM modules can be unloaded.

## 26. Impact on other Phase 1 workstreams

| Workstream | Impact | State after this decision |
| --- | --- | --- |
| Bounded renderer provider architecture | Gains normative runtime identity, lease, status, conflict, and session concepts | **UNBLOCKED for design update/implementation planning.** |
| Grafana version compatibility and support policy | Must define `observedCompatibilityId`, package-cohort rules, server preflight, and provider selection | **NEXT RECOMMENDED WORKSTREAM; required before public compatibility claims.** |
| React/Scenes compatibility policy | Must define supported peer range and physical-runtime conformance checks | **UNBLOCKED research; public range still blocked.** |
| Styling/host containment | Must decide whether selected theme can become instance-local and define document/style/cache ownership | **UNBLOCKED research; production presentation fingerprint awaits result.** |
| Transformation compatibility | Registry is runtime-scoped and closed; capability IDs feed manifest/fingerprint | **UNBLOCKED research.** |
| Server-hosted module loading | Must reuse the same coordinator, React/Grafana cohort, identity, asset policy, and transport scope; it cannot bootstrap another Runtime | **EXPERIMENT REQUIRED.** |
| Bundle strategy | Must guarantee deduplication of provider, React/DOM, Scenes, and Grafana cohort and retain provider build identity | **UNBLOCKED analysis; packaging decision remains distribution-dependent.** |
| Public SDK API | Parent provider must carry explicit renderer/transport configuration; dashboard UID remains instance-local | **UNBLOCKED contract design; implementation waits for remaining Phase 1 decisions.** |
| Productize bounded Grafana rendering bridge | May build license-neutral coordinator/contracts and conformance harness; final distributed provider remains subject to licensing/distribution approval | **YES, but only within existing Phase 1 distribution constraints.** |

No new issue is blocked solely by this document. Final production provider
packaging remains blocked by the existing licensing/distribution decision, and
public support claims remain blocked by version and React/Scenes policies.

## 27. POC migration map

| POC element | Production disposition | Migration |
| --- | --- | --- |
| `acquirePocRuntime` / page coordinator | **SPLIT + REWRITE** | Split provider realm coordinator, core lease orchestration, server preflight, and dashboard sessions; preserve compatible acquisition concept. |
| `runtimeIdentity` / fingerprint | **KEEP CONCEPT + REWRITE** | Adopt the field classification, semantic transport capability, two-stage finalization, schema version, and structural comparison. |
| `installBootData` | **KEEP CONCEPT + REWRITE** | Provider-private pre-import prelude, minimal allowlist, no credentials, explicit irreversible commit and conflict checks. |
| `loadGrafanaCohort` | **KEEP CONCEPT + SPLIT** | Provider loader plus physical cohort verifier; exact package/version policy comes from separate workstreams. |
| BackendSrv adapter | **KEEP CONCEPT + REWRITE** | Delegate to host `TransportCapability`; remove raw function identity from conflicts; preserve URL policy, cancellation, normalization, and sanitation. |
| POC `DataSourceSrv` | **KEEP CONCEPT + REWRITE** | Provider runtime service with server/security-scoped settings and instance caches; add capability/disposal policy. |
| Event bus | **KEEP CONCEPT + REWRITE** | Runtime-owned bus with documented event namespaces and panel/session failure isolation. |
| Location policy | **KEEP CONCEPT** | Bounded no-route-takeover service; formalize unsupported navigation and avoid direct host-router ownership. |
| Theme creation/provider | **SPLIT + DEFER final policy** | Keep provider theme context; move global style/asset/theme scoping decision to styling workstream. |
| Portal manager | **KEEP CONCEPT + HARDEN** | Provider/document manager with dashboard reference leases, collision-safe ownership, and inspection. |
| Query runtime / `runRequest` | **KEEP CONCEPT + REWRITE** | One runtime installation with per-query request IDs, aborts, generations, and typed evidence. |
| Panel/datasource loaders and caches | **KEEP CONCEPT + SPLIT** | Provider-build module cache separate from runtime datasource instances and dashboard state. |
| Test-only coordinator inspection | **KEEP CONCEPT** | Safe production diagnostics plus richer conformance-only resource accounting. |
| POC function-object conflict checks | **DISCARD** | Replace with registered semantic transport capability and immutable provider manifest identities. |
| Any assumption that final release resets Runtime | **DISCARD** | Final release enters `DORMANT`; fresh realm is required for a new identity. |

No POC file should be promoted unchanged. Phase 0 code remains disposable
research evidence.

## 28. Decisions made

1. The initial production isolation unit is the JavaScript realm plus physical
   provider/Grafana module cohort.
2. One finalized `RuntimeIdentity` is permanently bound to that unit after
   singleton commit.
3. Multiple compatible dashboards are supported through independent sessions.
4. Compatible acquisitions are idempotent and reference-counted.
5. Final release produces `DORMANT`, not uninitialized, state.
6. Incompatible sequential or concurrent identities are rejected.
7. Multiple Grafana origins/security scopes in one realm are unsupported.
8. Provider selection is explicit; no hidden global provider registry is used.
9. Transport uses a stable host-registered capability, not function identity.
10. React/ReactDOM, provider, Scenes, and the Grafana cohort must be physically
    deduplicated.
11. Locale and selected theme are runtime-scoped initially; explicit scene time
    range/timezone may be instance-local when the provider declares support.
12. Grafana renderer SSR is unsupported initially.
13. HMR across the provider/Grafana runtime boundary requires a full reload.
14. Production code never uses upstream test-only resets to simulate isolation.
15. This runtime architecture does not decide licensing or distribution.

## 29. Delegated/open decisions

| Decision | Delegated workstream/reason |
| --- | --- |
| Exact supported Grafana server/package ranges and build matching | Grafana version compatibility and support policy |
| Exact supported React/ReactDOM/Scenes combinations | React/Scenes compatibility policy |
| Whether selected theme can safely become per-dashboard | Styling and host-containment strategy |
| Light DOM, Shadow DOM, Emotion cache, global CSS, fonts/icons/assets | Styling and host-containment strategy |
| Transformation catalog and registry expansion policy | Transformation compatibility strategy |
| Distribution form and license of concrete Grafana providers | Licensing/distribution workstreams and qualified legal review |
| Feasibility of server-hosted panel/datasource modules | Dedicated server-hosted-module experiment |
| General datasource instance disposal semantics | Datasource expansion workstream after initial controlled catalog |
| Cross-bundle well-known-symbol coordinator | Future micro-frontend experiment |
| Multi-origin virtualization | Future research; not on the initial product path |

## 30. Final status

**READY WITH CONSTRAINTS**

The runtime ownership decision is complete enough to guide the renderer
provider contract and license-neutral internal productization:

- one compatible runtime identity per JavaScript realm;
- multiple compatible dashboards supported;
- a different identity requires a fresh realm;
- explicit host transport and provider ownership;
- permanent page-lifetime Grafana singleton state after first commit;
- typed conflicts rather than service replacement; and
- no SSR or independent micro-frontend bootstrap claim.

The next recommended canonical Phase 1 workstream is **Define Grafana version
compatibility and support policy**, because server/package/provider compatibility
is a required finalized identity field and a prerequisite for public support
claims.

After human architecture review, the GitHub issue **[Phase 1] Define runtime
singleton ownership and isolation model** is ready to close. Follow-on
constraints and delegated decisions must remain tracked in their named Phase 1
issues; closing this issue must not be interpreted as production readiness.
