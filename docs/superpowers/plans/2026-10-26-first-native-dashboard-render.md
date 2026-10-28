# First Native Dashboard Render with Panel Fallback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> `superpowers:subagent-driven-development` (recommended) or
> `superpowers:executing-plans` to execute this plan task-by-task. Use
> `superpowers:test-driven-development` for every behavior change and
> `superpowers:requesting-code-review` before handoff. Do not commit; leave the
> complete working tree for human review.

**Goal:** Deliver the first production-shaped React vertical slice that loads a
Grafana OSS 13.2.3 dashboard by UID, renders its supported Text panels with the
real Grafana Text implementation, preserves the complete grid, and renders a
white `Not-Supported` panel in every unsupported panel position.

**Architecture:** Core owns a provider-neutral React orchestration component and
an immutable SDK configuration. Provider-contract owns only the React-free data
contracts shared across that boundary. Provider-13 keeps its existing strict
whole-dashboard preflight and adds a separate panel-granular render preflight,
an inert React-externalized bootstrap, one fixed page-lifetime Grafana/Scenes
cohort, the exact audited Text renderer, constrained DTO-to-Scenes conversion,
and instance lifecycle cleanup. The host owns React, ReactDOM, authentication,
and the existing authorized `HostTransportCapability`.

**Tech stack:** Node.js 22.23.3, Yarn 4.17.1, TypeScript 6.0.2, React/ReactDOM
19.2.8, Grafana packages 13.2.3, `@grafana/scenes` 8.13.5, Vite 8.2.0,
Vitest 4.1.10, Playwright 1.56.1, Docker Compose, Grafana OSS 13.2.3.

**Spec:** GitHub issue
`[Phase 2] First native dashboard render with panel fallback` (#91), parent
issue #73, [Phase 1 production architecture](../../architecture/production/phase1-production-architecture-decision.md),
[runtime isolation model](../../architecture/production/runtime-isolation-model.md),
[provider architecture](../../architecture/production/bridge-provider-architecture.md),
[React/Scenes policy](../../architecture/production/react-scenes-compatibility-policy.md),
[bundle strategy](../../architecture/production/bundle-dependency-strategy.md),
[styling strategy](../../architecture/production/styling-containment-strategy.md),
and [Phase 0 POC results](../../architecture/research/poc-results.md).

## 1. Project-control state

- Branch: `phase2/first-native-dashboard-render`.
- Baseline: `8c2ba2a4149e8e22df1a613c6e78a7e4d338737a`.
- Phase: Phase 2 — SDK Foundation and Experimental Package.
- This issue deliberately defers the generalized runtime-admission framework,
  artifact attestation, broad deployment policy, Stat/Time series execution,
  datasource runtime, transformations, and public package publication.
- No automatic commit, push, PR creation, merge, or publication is permitted.

## 2. Non-negotiable boundaries

- Frontend only; no SDK backend, proxy server, credential manager, or embedded
  token.
- Host owns React/ReactDOM, credentials, authentication, redirects, authorized
  connectivity, and destination policy.
- Provider-13 depends on provider-contract, never on core. Core never depends on
  provider-13, Grafana, Scenes, or Grafana application source.
- No iframe, Grafana application shell, Grafana route tree, navigation/chrome,
  `GrafanaApp.init`, or arbitrary SystemJS/plugin URL.
- Use the exact Grafana OSS v13.2.3 source checkout at
  `6193dc03311b631b9727b560d24369e683dc396e`. The running Docker binary's
  `BuildCommit` is not this source-provenance revision and must not be compared
  to it.
- Host and provider must share the same physical React, ReactDOM,
  ReactDOM/client, JSX-runtime, and JSX-dev-runtime objects. Matching version
  strings alone is not sufficient.
- The provider artifact externalizes `react`, `react-dom`, `react-dom/client`,
  `react/jsx-runtime`, and `react/jsx-dev-runtime`. Bundle inspection must find
  zero bundled implementations of them.
- Grafana/Scenes/runtime modules stay behind a dynamic import. The inert provider
  entry may import provider-contract and host React peers, but no singleton-
  bearing Grafana module.
- A fixed, compatible provider/runtime cohort is shared in one JavaScript realm.
  An incompatible second transport/security scope, namespace, provider build,
  or React identity is rejected before reuse. Releasing the last dashboard makes
  the cohort dormant; global Grafana singleton state is not falsely reset.
- Strict `retrieveAndPreflightGrafana13DashboardV1` behavior and tests remain
  unchanged. Partial rendering is a new facade and new result type.
- Unsupported panels are never converted into `VizPanel`, never load a plugin,
  and never execute a query or transformation. They remain visible as grid
  placeholders.
- Unsupported target version or dashboard schema is dashboard-level fallback.
  Invalid/bounded-decoder failures, authentication failures, transport failures,
  and runtime failures remain typed errors rather than successful fallbacks.
- No full Grafana application stylesheet or global reset. Use the Phase 1
  scoped-light-DOM provider surface and only the measured Text/PanelChrome
  styles required by this slice.
- All Node, Yarn, TypeScript, Vitest, Vite, build, and Playwright commands run in
  Docker Compose. Do not install tools or dependencies on WSL. Use `grep`,
  `find`, Node.js, and existing scripts rather than unavailable `rg`/`jq`.

## 3. Approved first-slice public API

### 3.1 Provider-contract vocabulary

Add a React-type-free `rendering.ts`. Object references are intentionally
opaque: they are compared by identity and are not cloned, traversed, frozen, or
treated as proof merely because their version strings match.

```ts
export interface HostReactRuntime {
  readonly versions: {
    readonly react: string;
    readonly reactDom: string;
  };
  readonly identities: {
    readonly react: object;
    readonly reactDom: object;
    readonly reactDomClient: object;
    readonly jsxRuntime: object;
    readonly jsxDevRuntime: object;
  };
}

export type DashboardRenderFailureCode =
  | 'dashboard-input-invalid'
  | 'transport-policy-error'
  | 'network-error'
  | 'unauthorized'
  | 'forbidden'
  | 'not-found'
  | 'http-error'
  | 'response-malformed'
  | 'runtime-react-incompatible'
  | 'runtime-identity-conflict'
  | 'runtime-initialization-failed'
  | 'panel-render-failed';

export interface DashboardRenderFailure {
  readonly code: DashboardRenderFailureCode;
  readonly uid: string;
  readonly requestId?: string;
  readonly status?: number;
  readonly message: string;
}

export type DashboardRenderStatus =
  | { readonly kind: 'loading'; readonly uid: string }
  | {
      readonly kind: 'ready';
      readonly uid: string;
      readonly supportedPanelCount: number;
      readonly unsupportedPanelCount: number;
    }
  | {
      readonly kind: 'unsupported-dashboard';
      readonly uid: string;
      readonly reason: 'target-version' | 'dashboard-schema' | 'dashboard-profile';
    }
  | { readonly kind: 'error'; readonly uid: string; readonly error: DashboardRenderFailure };

export interface ProviderDashboardRendererProps {
  readonly hostReact: HostReactRuntime;
  readonly instanceId: string;
  readonly manifest: ManifestValidationSuccess;
  readonly namespace: string;
  readonly transport: HostTransportCapability;
  readonly uid: string;
  readonly onStatusChange?: (status: DashboardRenderStatus) => void;
}
```

The status/error surface is detached and sanitized. It never contains raw
response bodies, headers, cookies, authorization data, thrown causes, dashboard
JSON, or Grafana module objects.

### 3.2 Core React API

Keep the existing `CoreSdkConfiguration` and metadata inspection API intact.
Add a separate rendering configuration rather than turning the issue #83
skeleton into a registry or session framework.

```ts
import type { ComponentType } from 'react';

export interface DashboardRenderSdkConfiguration extends CoreSdkConfiguration {
  readonly hostReact: HostReactRuntime;
  readonly namespace?: string; // defaults to "default"
  readonly renderer: ComponentType<ProviderDashboardRendererProps>;
  readonly transport: HostTransportCapability;
}

export interface DashboardRenderSdk {
  readonly providerId: string;
  readonly providerBuildId: string;
  // Renderer/configuration remain opaque implementation details.
}

export type DashboardRenderSdkCreationResult =
  | { readonly valid: true; readonly sdk: DashboardRenderSdk }
  | {
      readonly valid: false;
      readonly errors: readonly {
        readonly code: 'provider-manifest-invalid' | 'configuration-invalid';
        readonly path: string;
        readonly message: string;
      }[];
    };

export interface GrafanaDashboardProps {
  readonly sdk: DashboardRenderSdk;
  readonly uid: string;
  readonly onStatusChange?: (status: DashboardRenderStatus) => void;
}

export function createDashboardRenderSdk(
  configuration: DashboardRenderSdkConfiguration
): DashboardRenderSdkCreationResult;

export function GrafanaDashboard(props: GrafanaDashboardProps): React.JSX.Element;
```

`createDashboardRenderSdk` calls the existing provider manifest validator via
`inspectConfiguredProvider`, reads the trusted host-supplied provider manifest
once, retains the canonical `ManifestValidationSuccess`, validates only the
small bounded configuration, and preserves the supplied transport, renderer,
and React identities by reference. It does not perform runtime admission,
execute provider code, initialize Grafana, or claim renderability.

`GrafanaDashboard` mounts only the configured renderer. A UID change replaces
the provider subtree immediately, so stale dashboard DOM is removed before the
new load begins. Core assigns an opaque instance/generation identifier and
suppresses stale status callbacks; provider-13 owns its request controller and
runtime/scene cleanup.

The future `calendar="gregorian" | "jalali"` prop remains deferred. This issue
does not expose a nonfunctional calendar prop or an imperative mount API.

### 3.3 Provider-13 concrete exports

```ts
export const grafana13Provider: RendererProvider;
export const Grafana13DashboardRenderer:
  ComponentType<ProviderDashboardRendererProps>;

export function retrieveAndClassifyGrafana13DashboardV1(
  input: Grafana13PartialDashboardLoadInput
): Promise<Grafana13PartialDashboardLoadResult>;

export function partialPreflightGrafana13DashboardV1(
  dashboard: Grafana13DashboardV1,
  manifest: ManifestValidationSuccess
): Grafana13PartialPreflightResult;
```

The concrete manifest declares only capabilities implemented by this artifact:
stable `dashboard.grafana.app/v1`, schema 42, and the exact Text Markdown view
profile. It does not claim Stat, Time series, Table, TestData, or transformation
support merely because Phase 0 proved those future capabilities.

## 4. Partial-preflight contract and policy

Additive provider-13 contracts:

```ts
export interface Grafana13RenderRequestIds {
  readonly health: string;
  readonly discovery: string;
  readonly dashboard: string;
}

export interface Grafana13PartialDashboardLoadInput
  extends Omit<Grafana13DashboardLoadInput, 'requestIds'> {
  readonly requestIds: Grafana13RenderRequestIds;
}

export interface Grafana13GridPosition {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export type Grafana13RenderablePanel =
  | {
      readonly kind: 'supported';
      readonly profile: 'text-markdown-view-v1';
      readonly index: number;
      readonly id: number;
      readonly panelType: 'text';
      readonly title: string;
      readonly grid: Grafana13GridPosition;
      readonly model: Grafana13TextPanelModel;
    }
  | {
      readonly kind: 'unsupported';
      readonly index: number;
      readonly id: number;
      readonly panelType: string;
      readonly title: string;
      readonly grid: Grafana13GridPosition;
      readonly diagnostics: readonly Grafana13PreflightDiagnostic[];
    };

export type Grafana13PartialPreflightResult =
  | {
      readonly kind: 'renderable';
      readonly uid: string;
      readonly title: string;
      readonly timeRange: { readonly from: string; readonly to: string };
      readonly timezone: 'browser';
      readonly constantVariables: readonly Grafana13ConstantVariable[];
      readonly panels: readonly Grafana13RenderablePanel[];
      readonly supportedPanelCount: number;
      readonly unsupportedPanelCount: number;
    }
  | {
      readonly kind: 'unsupported-dashboard';
      readonly reason: 'dashboard-schema' | 'dashboard-profile';
      readonly diagnostics: readonly Grafana13PreflightDiagnostic[];
      readonly diagnosticsTruncated: boolean;
    };

export type Grafana13PartialDashboardLoadResult =
  | {
      readonly kind: 'renderable';
      readonly requestIds: Grafana13RenderRequestIds;
      readonly dashboard: Grafana13PartialPreflightResult & { readonly kind: 'renderable' };
    }
  | {
      readonly kind: 'unsupported-dashboard';
      readonly reason: 'target-version' | 'dashboard-schema' | 'dashboard-profile';
      readonly diagnostics: readonly Grafana13PreflightDiagnostic[];
      readonly diagnosticsTruncated: boolean;
    }
  | {
      readonly kind: 'cancelled';
      readonly stage: 'health' | 'discovery' | 'dashboard-v1';
      readonly requestId: string;
    }
  | { readonly kind: 'failure'; readonly error: Grafana13DashboardFailure };
```

The load facade adds target verification and maps the partial preflight into:

- `renderable`: bounded V1 DTO and complete ordered panel list;
- `unsupported-dashboard`: wrong observed Grafana version, unsupported schema,
  or dashboard-wide semantic/layout feature outside the first profile;
- the existing typed `cancelled` and `failure` categories for request and input
  failures.

Rules:

1. Before any Grafana implementation import, call `/api/health` through the
   supplied `HostTransportCapability` and require exact version `13.2.3`.
   Treat a different well-formed version as dashboard-level unsupported.
   Treat malformed, 401/403, network, and transport policy results as typed
   failures. Do not compare health `commit` with source revision.
2. Reuse issue #89 API discovery, DTO retrieval, UID/namespace validation,
   bounded JSON decoding, and cancellation mapping. Refactor those internal
   stages once; do not copy them into a second client.
3. Validate dashboard-wide invariants before panel fallback: V1/schema 42,
   title/UID, flat grid, unique positive panel IDs, safe non-overflowing grid
   coordinates, time range, browser timezone, the controlled constant variable,
   canonical hidden built-in annotation, and absence of material links,
   repeats, rows, tabs, library panels, or unsupported dashboard interactions.
4. Require every panel to have a safe ID, type, title, and grid position. A
   malformed layout/identity is dashboard-fatal because its position cannot be
   preserved safely.
5. Support only the exact fixture Text profile: `type: "text"`, Markdown mode,
   view-only Text options, exact empty datasource/targets/transformations, exact
   field configuration, and plugin version 13.2.3. Copy only the fields needed
   by conversion into a detached, deeply frozen model.
6. Classify every other valid panel, including Stat, Time series, and Table, as
   unsupported. Panel-local unsupported options, datasource profiles, targets,
   or transformations also become unsupported panels. Preserve ID, title,
   order, and grid; do not preserve executable query/transform payloads in the
   render model.
7. A panel-local diagnostic never upgrades a panel to supported and never causes
   another supported panel to disappear. Diagnostic truncation cannot change the
   classification outcome.
8. The existing strict facade still inventories the whole primary fixture and
   returns `kind: "unsupported"` because of Table. Its public types and tests are
   not rewritten to use the partial result.

## 5. Minimal pinned runtime bootstrap

The provider entry is inert and may import only provider-contract, React peer
modules, the concrete manifest, the partial dashboard client, and project-owned
code with no Grafana import. Its flow is:

```text
Core <GrafanaDashboard>
  -> provider inert renderer
  -> compare exact React/ReactDOM versions and five module identities
  -> /api/health + dashboard discovery + V1 DTO + partial preflight
  -> install minimal grafanaBootData prelude
  -> dynamic import one provider-13 implementation chunk
  -> acquire fixed compatible runtime lease
  -> install closed Text plugin catalogue and minimal services/providers
  -> convert complete partial model to a Scenes grid
  -> activate scene and render native DOM
```

The fixed coordinator is intentionally smaller than the deferred generalized
realm coordinator:

- Identity fields: provider ID/build ID, canonical manifest object, exact five
  host React identities and React/ReactDOM versions, normalized transport
  descriptor (`targetOrigin`, `basePath`, `securityScopeId`, `requestPolicyId`),
  namespace, locale `en-US`, timezone `browser`, theme `light`, and asset base
  derived from the host transport base path.
- The transport descriptor is the semantic security identity. Executor function
  identity is not compared and no credential is inspected. The host is
  responsible for making equal descriptors semantically equivalent.
- First compatible acquisition installs one minimal boot object before the
  first `@grafana/runtime` evaluation, verifies exact package versions, installs
  theme/i18n, bounded app events/location behavior, a HostTransportCapability-
  backed BackendSrv adapter, a controlled portal root, and the Text catalogue.
- Same-identity acquisitions share the cohort, Text plugin promise/cache, and
  provider-lifetime presentation resources while owning independent scenes and
  dashboard scopes.
- A conflicting acquisition returns `runtime-identity-conflict` before using or
  modifying the existing cohort. It never tries to reset and reinitialize
  Grafana singletons.
- Releasing a dashboard deactivates its scene, aborts pending requests, removes
  its portal children/observers/subscriptions/timers, and releases its scope and
  lease. Zero active dashboards is `dormant`; the initialized module cohort,
  plugin cache, and base style/portal owner remain page-lifetime.
- Initialization failure poisons this fixed coordinator and yields the sanitized
  `runtime-initialization-failed` result. No retry/reinitialization mechanism is
  introduced here.

Minimum services are limited to what real Text/PanelChrome/Scenes require:

- exact `@grafana/data`, `@grafana/i18n`, `@grafana/runtime`,
  `@grafana/scenes`, `@grafana/schema`, and `@grafana/ui` cohort;
- runtime theme shared with `ThemeContext`;
- English plugin translation initialization;
- bounded app event bus and non-routing location service;
- BackendSrv adapter delegating to `HostTransportCapability`, with no embedded
  headers/credentials and no query-runtime registration;
- controlled provider portal root and scoped light-DOM surface;
- published plugin-import setter with a closed `text`-only catalogue.

Do not initialize datasource services, `SceneQueryRunner`, standard
transformers, Stat/Time series registries, query execution, Grafana Redux,
Grafana router, or application chrome.

## 6. DTO-to-Scenes conversion and fallback rendering

- Create one `SceneTimeRange` from the validated dashboard range and one
  `SceneVariableSet` containing only the controlled constant variable required
  by the fixture Text content.
- Create a root `SceneObjectBase` whose renderer mounts a `SceneGridLayout`.
- Preserve panel order and map Grafana `gridPos.{x,y,w,h}` exactly to
  `SceneGridItem.{x,y,width,height}`.
- A supported Text model creates one `VizPanel` with `pluginId: "text"`, the
  validated title/options/fieldConfig, and no `$data` provider.
- An unsupported model creates a project-owned Scene body in the same
  `SceneGridItem`. It renders a white panel surface containing the exact visible
  text `Not-Supported`, the original safe title, and non-public test/ownership
  markers. It receives no datasource, targets, transformations, plugin ID, or
  loader callback.
- The closed plugin loader accepts only `text`, records first-load/cache-hit/
  success/failure categories, and imports the exact Grafana v13.2.3 Text renderer
  dynamically. Unknown IDs reject before constructing a URL. No SystemJS.
- Use the renderer-only source closure already proven by Phase 1:
  `public/app/plugins/panel/text/v1/TextPanel.tsx` and
  `public/app/plugins/panel/text/panelcfg.gen.ts`. Construct the real published
  `PanelPlugin` around the real `TextPanel`. Reuse the measured view-only package
  shims; do not import the v1 editor/module closure or Monaco/Codicon assets.
- Add an exact build-time source identity check for the clean checkout commit
  and an audited application-source allowlist. Do not copy Grafana application
  source into the repository.
- Wrap the scene in the runtime-created Grafana theme/provider values and the
  scoped provider surface. Do not import Grafana `GlobalStyles`.

## 7. UID, cancellation, and cleanup semantics

Each provider component instance owns a monotonically increasing local
generation and one `AbortController` per UID.

1. On mount/UID change, publish `loading`, abort the previous controller,
   deactivate/release the previous scene and dashboard scope, and clear its DOM.
2. Health, discovery, DTO, and dynamic implementation work all capture the
   generation. A completion may publish only when the component is still
   mounted, the signal is not aborted, and the generation is current.
3. Pre-aborted stages make no transport call. Late cooperative or
   non-cooperative transport resolution/rejection is consumed and cannot publish
   stale state or cause an unhandled rejection.
4. Only a current renderable result may acquire a runtime lease and activate a
   scene. If the generation changes during dynamic import/acquisition, release
   anything acquired and publish nothing.
5. On unmount, abort, deactivate the scene, release its scope/portal children,
   unsubscribe observers/listeners/timers, and release the runtime lease.
6. Errors are caught by a provider-local React error boundary so a Text failure
   becomes a typed panel/render error surface without destroying the host root.
7. Remount uses the compatible dormant runtime and cached Text plugin; it creates
   a fresh scene and instance scope.

## 8. Exact implementation file inventory

The executor must keep changes within this inventory unless a material blocker
is reported for approval.

### Provider-contract

- Modify `packages/provider-contract/src/index.ts`.
- Create `packages/provider-contract/src/rendering.ts`.
- Create `packages/provider-contract/src/rendering.type-test.ts`.
- Modify `packages/provider-contract/package.json` only to include the new type
  test in existing scripts if its glob does not already include it.

### Core

- Modify `packages/core/package.json` (exact React 19.2.8 peer plus existing
  provider-contract dependency; no ReactDOM/Grafana/provider-13 dependency).
- Modify `packages/core/tsconfig.json` and
  `packages/core/tsconfig.typecheck.json` to include `.tsx` and exclude test/
  type-test files from declarations.
- Modify `packages/core/src/index.ts`.
- Create `packages/core/src/dashboardSdk.ts`.
- Create `packages/core/src/dashboardSdk.test.ts`.
- Create `packages/core/src/dashboardSdk.type-test.ts`.
- Create `packages/core/src/GrafanaDashboard.tsx`.
- Create `packages/core/src/GrafanaDashboard.type-test.tsx`.

### Provider-13 contracts, retrieval, and classification

- Modify `packages/provider-13/package.json` with exact provider-owned cohort
  dependencies and exact React/ReactDOM peers; no core dependency.
- Modify `packages/provider-13/tsconfig.json` and
  `packages/provider-13/tsconfig.typecheck.json` for `.tsx`.
- Modify `packages/provider-13/src/contracts.ts` and `src/index.ts`.
- Modify `packages/provider-13/src/dashboardApi.ts` only to extract reusable
  discovery/DTO stages without changing strict behavior.
- Modify `packages/provider-13/src/dashboardApi.test.ts` and
  `src/contracts.type-test.ts` additively.
- Create `packages/provider-13/src/provider.ts` and `src/provider.test.ts`.
- Create `packages/provider-13/src/targetHealth.ts` and
  `src/targetHealth.test.ts`.
- Create `packages/provider-13/src/partialPreflight.ts` and
  `src/partialPreflight.test.ts`.
- Create `packages/provider-13/src/partialDashboardApi.ts` and
  `src/partialDashboardApi.test.ts`.

### Provider-13 inert entry, runtime, scene, panel, and styles

- Create `packages/provider-13/src/react/Grafana13DashboardRenderer.tsx`.
- Create `packages/provider-13/src/react/Grafana13DashboardRenderer.test.ts` for
  pure state/error mapping using injected loaders; browser DOM lifecycle remains
  in Playwright.
- Create `packages/provider-13/src/react/reactIdentity.ts` and
  `src/react/reactIdentity.test.ts`.
- Create `packages/provider-13/src/runtime/bootstrapPrelude.ts` and test.
- Create `packages/provider-13/src/runtime/loadCohort.ts` and test.
- Create `packages/provider-13/src/runtime/coordinator.ts` and test.
- Create `packages/provider-13/src/runtime/backendSrvAdapter.ts` and test.
- Create `packages/provider-13/src/runtime/appEvents.ts`.
- Create `packages/provider-13/src/runtime/locationPolicy.ts`.
- Create `packages/provider-13/src/runtime/portalRoot.ts` and test.
- Create `packages/provider-13/src/runtime/providers.tsx`.
- Create `packages/provider-13/src/runtime/implementation.tsx` as the sole
  dynamic Grafana implementation entry.
- Create `packages/provider-13/src/render/convertPartialDashboard.ts` and test.
- Create `packages/provider-13/src/render/DashboardSceneRoot.tsx`.
- Create `packages/provider-13/src/render/UnsupportedPanelScene.tsx`.
- Create `packages/provider-13/src/render/errorBoundary.tsx`.
- Create `packages/provider-13/src/panels/catalog.ts` and test.
- Create `packages/provider-13/src/panels/textPlugin.ts` and test.
- Create `packages/provider-13/src/panels/grafana-source-modules.d.ts`.
- Create `packages/provider-13/src/styles/provider.css` and
  `src/styles/providerStyles.ts` for reference-counted provider-lifetime style
  ownership.

### Provider-13 browser artifact/build boundary

- Create `packages/provider-13/vite.config.ts`.
- Create `packages/provider-13/tooling/sourceIdentity.ts` and test.
- Create `packages/provider-13/tooling/pinnedGrafanaSourcePlugin.ts` and test.
- Create `packages/provider-13/tooling/textRendererOnlyImportsPlugin.ts` and test.
- Create `packages/provider-13/tooling/forbiddenGrafanaImportPlugin.ts` and test.
- Create `packages/provider-13/tooling/bundleEvidencePlugin.ts` and test.
- Create `packages/provider-13/tooling/viewOnly/data.ts`.
- Create `packages/provider-13/tooling/viewOnly/ui.tsx`.
- Create `packages/provider-13/tooling/viewOnly/runtimeConfig.ts`.
- Create `packages/provider-13/tooling/inspectProviderBundle.mjs`.

These are production-package build inputs derived from proven patterns. They
must not import POC or `experiments/` modules. Shared generic logic may be
extracted from an existing build utility only if both old and new tests prove no
boundary widening; otherwise copy the small generic mechanics and keep the new
source allowlist provider-owned.

### Private SDK host and browser/integration tests

- Create private workspace `apps/sdk-host/` with `package.json`, `tsconfig.json`,
  `index.html`, `vite.config.ts`, `src/main.tsx`, `src/App.tsx`, and
  `src/host.css`.
- Create `playwright.sdk.config.ts`.
- Create `tests/sdk-e2e/first-native-dashboard-render.spec.ts`.
- Create `tests/sdk-e2e/first-native-dashboard-lifecycle.spec.ts`.
- Create `tests/sdk-e2e/first-native-dashboard-failures.spec.ts`.
- Reuse `tests/e2e/support/grafanaAuth.ts`, console guards, observer wrappers,
  and sanitized network/resource evidence without altering their behavior.
- Create `integration/provider13PartialDashboard.test.ts` for the real fixture.

### Workspace, guards, and generated metadata

- Modify root `package.json`, `tsconfig.base.json`, and `yarn.lock` only for the
  new private host, exact package dependency metadata, and new verification
  scripts. Do not change pinned versions.
- Modify `scripts/check-core-boundary.mjs` and its tests for the exact React peer
  exception while continuing to reject ReactDOM, provider-13, Grafana, Scenes,
  POC, experiments, path redirects, compiler plugins, and dependency metadata
  bypasses.
- Modify `scripts/check-provider-13-boundary.mjs` and its tests for the exact
  provider-owned dependency set and exact audited Text virtual-source import.
  Continue to reject core, POC/experiment imports, arbitrary `public/app`, broad
  aliases, dynamic URL construction, SystemJS, compiler/path redirects, and
  dependency metadata bypasses.
- Add a root `build:sdk-slice` command that builds the provider artifact first,
  inspects it, and then builds `apps/sdk-host`.
- Add `test:sdk-e2e` without replacing the existing POC `test:e2e` command.

No Compose or Grafana fixture change is planned. The SDK host uses port 5173 in
its dedicated Playwright run so the existing fixture sub-path/root URL remains
valid, and proxies browser-visible `/grafana/*` to the existing container target.

## 9. Task-by-task TDD execution

### Task 1 — Add neutral render vocabulary

**Files:** provider-contract rendering files and exports listed above.

- [ ] Write compile-time RED cases for immutable props/statuses, opaque object
  identities, required UID/instance/transport/manifest fields, and sanitized
  error variants. Confirm the type-test is in the effective typecheck file list.
- [ ] Run the provider-contract typecheck and capture the expected RED result.
- [ ] Implement the minimum interfaces and root exports; do not add React types
  or runtime code.
- [ ] Run provider-contract typecheck, declaration build, unit tests, and inspect
  emitted declarations to prove type tests are not shipped.

```bash
docker compose --env-file dev/grafana/.env run --rm --no-deps dev \
  yarn workspace @dashboard-render-sdk-g/provider-contract typecheck
docker compose --env-file dev/grafana/.env run --rm --no-deps dev \
  yarn workspace @dashboard-render-sdk-g/provider-contract build
docker compose --env-file dev/grafana/.env run --rm --no-deps dev \
  yarn workspace @dashboard-render-sdk-g/provider-contract test:unit
docker compose --env-file dev/grafana/.env run --rm --no-deps dev \
  yarn tsc6 --project packages/provider-contract/tsconfig.typecheck.json --listFiles --pretty false
```

Expected GREEN: interfaces compile, declarations contain no React import or
type-test file, existing manifest/transport tests stay green.

### Task 2 — Add the provider-neutral core React shell

**Files:** core SDK/component/config files, core package/tsconfig, core boundary
guard/tests.

- [ ] Add type RED tests for valid configuration, invalid renderer/configuration,
  immutable SDK handle, dynamic UID prop, and absence of calendar/imperative APIs.
- [ ] Add runtime RED tests proving manifest validation is delegated once,
  canonical validation is retained, configuration does not execute the renderer,
  and malformed manifests return typed creation failures.
- [ ] Implement `createDashboardRenderSdk` and the thin keyed
  `GrafanaDashboard` wrapper. Do not add a registry, runtime lease, or provider
  discovery.
- [ ] Add boundary RED tests for forbidden provider-13/Grafana/Scenes/ReactDOM
  imports, forbidden runtime React dependency, compiler/path redirection, and
  dependency metadata bypass. Add only the exact React peer/import allowance.
- [ ] Confirm declaration output excludes tests and that the current issue #83/#85/#87
  tests remain green.

Expected GREEN: core imports only provider-contract plus React peer types/runtime;
SDK creation is inert; UID replacement is visible to a fake renderer; no Grafana
module appears in core declarations or build graph.

### Task 3 — Add concrete manifest and panel-granular preflight

**Files:** provider-13 contract/provider/health/partial files and existing
dashboard-stage refactor.

- [ ] RED: primary real JSON fixture produces four ordered panel records with
  exact IDs/grid positions; only Text is supported; Stat, Time series, and Table
  are unsupported. Alternate fixture produces one supported Text panel.
- [ ] RED: one supported Text plus unsupported Table preserves both panels;
  unsupported Text mode/options/datasource/targets/transforms produce a panel
  placeholder classification and retain layout.
- [ ] RED: duplicate IDs, malformed grid, rows/tabs/library/repeat, unsupported
  schema, unsupported target version, decoder bound failure, or security-invalid
  input cannot become renderable.
- [ ] RED: `/api/health` 401/403/network/malformed/version mismatch and dashboard
  request failures map to the required typed result; no body/header/cause leaks.
- [ ] RED: abort at health, discovery, and DTO stages; abort races and late
  settlement never publish renderable output.
- [ ] Implement the concrete Text-only manifest and the new partial facade by
  reusing extracted issue #89 stages. Keep the strict facade's results byte-for-
  behavior equivalent.
- [ ] Run strict and partial suites plus the real container fixture integration.

Expected GREEN: strict primary remains wholly unsupported; partial primary is
renderable with one supported Text plus three explicit unsupported panels; no
Grafana implementation is imported.

### Task 4 — Build an inert React-externalized provider and real Text loader

**Files:** provider React identity, panel/catalog, build plugins/config, package
dependencies, provider boundary guard/tests.

- [ ] RED: provider entry import causes zero Grafana/Scenes application or
  runtime modules to load.
- [ ] RED: exact version plus five actual object identities pass; same versions
  with a duplicate React/ReactDOM/client/JSX object fail before implementation
  import; unsupported versions fail before implementation import.
- [ ] RED: Text catalogue records miss/success/hit and stable plugin identity;
  unknown ID rejects without URL/SystemJS; failures are sanitized.
- [ ] RED: dirty/wrong source checkout, source path drift, unallowlisted
  `public/app` import, broad alias, editor/Monaco/Codicon module, or shell import
  fails the provider build.
- [ ] Implement the renderer-only Text source bridge and exact source check.
  The only Grafana application source in the browser graph is the two-file
  renderer closure stated above.
- [ ] Build and inspect the provider artifact. Assert zero React, ReactDOM,
  client, JSX-runtime, or JSX-dev-runtime implementation modules; no Text editor,
  Monaco, Codicon, Grafana shell, routes, or SystemJS; one coherent Grafana
  cohort; and exact provenance evidence.

Expected GREEN: importing the inert provider is safe; incompatible React is
rejected early; the dynamic Text feature yields the real Grafana PanelPlugin;
bundle/provenance reports are sanitized and ignored.

### Task 5 — Implement the fixed runtime and constrained Scenes graph

**Files:** provider runtime, providers/styles, scene conversion, fallback scene,
and their focused tests.

- [ ] RED: cohort import without installed boot prelude fails; correct prelude
  imports Runtime first and captures the exact base-path/namespace/theme values.
- [ ] RED: first acquisition initializes once; compatible acquisition shares the
  cohort and caches; incompatible transport descriptor, namespace, provider
  build, or React identity fails without mutation; final release becomes dormant.
- [ ] RED: initialization failure poisons the coordinator; no second singleton
  initialization is attempted.
- [ ] RED: converter preserves title, time range, constant variable, panel order,
  IDs, and exact grid positions. Supported Text becomes `VizPanel`; unsupported
  panels become fallback Scene bodies and contain no `$data`, target,
  transformation, or plugin loader reference.
- [ ] RED: BackendSrv delegates permitted relative requests to the exact host
  capability/signal/request ID, rejects credential/host-controlled headers, and
  maps cancellation/failures without raw causes. Do not add query APIs.
- [ ] Implement minimal theme/i18n/event/location/portal/style ownership and the
  fixed coordinator. Reuse behavior proven in the POC, but write production
  modules under provider-13 and import no POC/experiment code.
- [ ] Verify two compatible scene scopes are independent and one release does
  not remove the other's portal/style/runtime resources.

Expected GREEN: one real provider-owned cohort exists; scene conversion is
complete and non-executing for unsupported panels; runtime/instance ownership
matches the bounded lifecycle above.

### Task 6 — Implement provider component lifecycle and errors

**Files:** provider renderer, runtime implementation entry, error boundary, and
focused injected-loader tests.

- [ ] RED: initial status is loading; renderable result dynamically loads the
  implementation and publishes ready; unsupported target/schema/dashboard uses
  dashboard fallback; auth/transport/runtime failures use typed error surfaces.
- [ ] RED: a UID change immediately clears old content, aborts the old generation,
  and prevents late retrieval/import/runtime completion from publishing.
- [ ] RED: unmount during every asynchronous stage aborts/consumes work and
  releases any acquired scope/scene/lease exactly once. StrictMode double effects
  do not double-initialize or leak.
- [ ] RED: panel-local Text render error is caught and does not unmount the host
  root; unsupported panel placeholder remains independent.
- [ ] Implement the inert wrapper plus dynamic runtime entry and generation
  guards. Do not add retries, cache the dashboard response, or add generalized
  admission/session APIs.

Expected GREEN: loading/error/unsupported/ready states are deterministic and
sanitized; lifecycle ownership is balanced under UID changes and unmount.

### Task 7 — Prove the real vertical slice in Chromium

**Files:** private SDK host, dedicated Playwright config/suites, real integration
test, root scripts/TS reference.

- [ ] Create a host-owned fetch executor using the existing
  `HostTransportCapability`. It sends browser requests to `/grafana/*`, relies on
  the browser's authenticated cookie, adds no provider credential header, and
  keeps Grafana's configured `/grafana` sub-path. The test logs in through the
  existing fixture helper; no credentials are stored in app code/evidence.
- [ ] Construct `HostReactRuntime` from the host's actual React, ReactDOM,
  ReactDOM/client, JSX-runtime, and JSX-dev-runtime namespace objects. Configure
  SDK once, then render `<GrafanaDashboard sdk={sdk} uid={uid} />` inside
  StrictMode.
- [ ] Browser RED/GREEN: primary UID displays the real fixture Markdown Text
  sentinel and exactly three white `Not-Supported` placeholders for Stat, Time
  series, and Table. Assert all four IDs/titles and grid rectangles retain their
  relative Grafana coordinates/order.
- [ ] Assert the Text element is produced below real Grafana PanelChrome/Text
  component evidence, not host-authored replacement markup. Assert no
  `/api/ds/query` request occurs.
- [ ] Alternate UID displays its own real Text sentinel and no placeholders.
  Primary -> alternate -> primary never displays stale sentinels; force a late
  response in one test to prove the generation guard.
- [ ] Assert loading, 401, 403, 404, malformed DTO, unsupported health version,
  unsupported schema, runtime conflict, and Text load/render failure surfaces.
  The host root and independent sentinel remain alive.
- [ ] Unmount/remount and two compatible instances: independent scenes/scopes,
  shared compatible cohort/Text cache, one portal/style owner, and return to the
  zero-dashboard resource baseline after final unmount.
- [ ] Assert zero iframe, Grafana navigation/chrome/router, `GrafanaApp.init`,
  SystemJS, unexpected navigation, console errors, page errors, credential-
  bearing evidence, or duplicate React identity.
- [ ] Assert scoped light-DOM Text/PanelChrome styling, unchanged host sentinel,
  bounded style nodes, clean MutationObserver/ResizeObserver counts, and no
  retained instance subscriptions/timers/portal children.

Expected GREEN: the complete real path is

```text
host-owned React + authenticated HostTransportCapability
  -> core <GrafanaDashboard uid>
  -> provider-13 health/discovery/V1 DTO/partial preflight
  -> fixed provider runtime + constrained Scenes grid
  -> real Grafana Text PanelPlugin in panel 1
  -> project-owned Not-Supported panels in positions 2, 3, and 4
  -> native DOM, no iframe or Grafana shell
```

### Task 8 — Full verification and independent review

- [ ] Run immutable install, typechecks, focused unit/integration/browser suites,
  declaration builds, provider artifact/SDK host builds, boundary guards and
  their mutation/regression suites, existing issue #81/#83/#85/#87/#89 suites,
  existing POC unit/integration suite, Phase 0 Gate A regression, observer
  regressions, fixture contract, and bundle/provenance inspection.
- [ ] Inspect TypeScript effective file lists so every new type test runs and no
  type test enters declarations.
- [ ] Inspect `yarn.lock` and package manifests to prove no pinned version changed.
- [ ] Inspect tracked and untracked files, repository ownership, ignored evidence,
  secrets, and `git diff --check`.
- [ ] Request a fresh-context Superpowers whole-branch review focused on strict-
  versus-partial semantics, runtime import order/identity, React externalization,
  stale generation, unsupported-panel non-execution, source allowlist, styles,
  cleanup, and boundary-checker bypasses.
- [ ] Resolve justified Critical/Important findings through focused TDD and ask
  for scoped re-review. Do not commit.

## 10. Verification command set

Use the local Grafana env file without printing its values. Commands requiring
the real fixture inherit only the existing verification variables through the
repository's established wrapper pattern.

```bash
# Immutable install and versions
docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn install --immutable
docker compose --env-file dev/grafana/.env run --rm --no-deps dev node --version
docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn --version

# Focused packages
docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn workspace @dashboard-render-sdk-g/provider-contract typecheck
docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn workspace @dashboard-render-sdk-g/provider-contract test:unit
docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn workspace @dashboard-render-sdk-g/core typecheck
docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn workspace @dashboard-render-sdk-g/core test:unit
docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn workspace @dashboard-render-sdk-g/provider-13 typecheck
docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn workspace @dashboard-render-sdk-g/provider-13 test:unit

# Boundary guards and regression suites
docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn check:provider-contract-boundary
docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn check:core-boundary
docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn check:provider-13-boundary
docker compose --env-file dev/grafana/.env run --rm --no-deps dev node --test scripts/check-provider-contract-boundary.test.mjs scripts/check-core-boundary.test.mjs scripts/check-provider-13-boundary.test.mjs

# Root regression and builds
docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn typecheck
docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn test:unit
docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn build:sdk-slice
docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn build:poc
docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn inspect:bundle
```

Run the real integration and browser suites through the existing credential-safe
shell pattern; never echo the env file or values:

```bash
/bin/bash -lc 'set -a; . dev/grafana/.env; set +a; POC_GRAFANA_VERIFY_USER="$GRAFANA_ADMIN_USER" POC_GRAFANA_VERIFY_PASSWORD="$GRAFANA_ADMIN_PASSWORD" docker compose --env-file dev/grafana/.env run --rm --no-deps -e POC_GRAFANA_VERIFY_USER -e POC_GRAFANA_VERIFY_PASSWORD dev yarn vitest run integration/provider13DashboardPreflight.test.ts integration/provider13PartialDashboard.test.ts --environment node'
/bin/bash -lc 'set -a; . dev/grafana/.env; set +a; POC_GRAFANA_VERIFY_USER="$GRAFANA_ADMIN_USER" POC_GRAFANA_VERIFY_PASSWORD="$GRAFANA_ADMIN_PASSWORD" docker compose --env-file dev/grafana/.env run --rm --no-deps -e POC_GRAFANA_VERIFY_USER -e POC_GRAFANA_VERIFY_PASSWORD dev yarn playwright test --config playwright.sdk.config.ts'
/bin/bash -lc 'set -a; . dev/grafana/.env; set +a; POC_GRAFANA_VERIFY_USER="$GRAFANA_ADMIN_USER" POC_GRAFANA_VERIFY_PASSWORD="$GRAFANA_ADMIN_PASSWORD" docker compose --env-file dev/grafana/.env run --rm --no-deps -e POC_GRAFANA_VERIFY_USER -e POC_GRAFANA_VERIFY_PASSWORD dev yarn playwright test tests/e2e/gate-a-text.spec.ts tests/e2e/mutation-observer-instrumentation.spec.ts tests/e2e/resize-observer-instrumentation.spec.ts'
```

Host-only final checks:

```bash
git diff --check
git status --short
git ls-files --others --exclude-standard
git diff --stat
git diff -- package.json yarn.lock packages/core/package.json packages/provider-13/package.json
find . -user root -not -path './.git/*' -print
grep -R -n -E '(Authorization:|Bearer [A-Za-z0-9]|Basic [A-Za-z0-9]|GRAFANA_ADMIN_PASSWORD=)' \
  packages/provider-contract packages/core packages/provider-13 apps/sdk-host tests/sdk-e2e integration \
  --exclude='*.test.ts' --exclude='*.spec.ts' || true
```

The secret scan's expected output is empty in production/app source. Tests may
refer to environment variable names but must not contain values.

## 11. Acceptance criteria mapped to issue #91

| Issue requirement | Acceptance evidence |
| --- | --- |
| Host supplies React/config/auth transport | SDK host passes five actual React identities and an existing HostTransportCapability; login remains test/host owned |
| Dashboard accepted by UID | Real primary and alternate fixture requests use issue #89 stable V1 UID path |
| Provider retrieves and validates | Health, discovery, bounded DTO decoder, identity checks, and panel-granular preflight pass |
| Real Text renderer | Browser DOM comes from exact v13.2.3 `TextPanel`/PanelPlugin and contains fixture sentinel |
| Unsupported fallback | Stat, Time series, and Table each render one white `Not-Supported` panel; no unsupported query/transform/plugin execution |
| Grid preservation | Ordered panel IDs and measured x/y/width/height relationships match fixture `gridPos` |
| Strict behavior preserved | Existing primary strict preflight remains wholly unsupported and all issue #89 tests pass |
| Dashboard fallback | Unsupported health version/schema/dashboard-wide profile renders dashboard-level unsupported state |
| Typed operational errors | 401/403/404/network/policy/malformed/runtime failures expose sanitized typed status |
| UID and cancellation | Forced late primary request cannot overwrite alternate UID; no stale DOM/status |
| Cleanup/remount | Scene/scope/observer/subscription/timer/portal counts return to baseline; compatible dormant runtime remount works |
| Runtime safety | React identities checked before Grafana import; one cohort; incompatible reuse rejected; no duplicate React |
| Architectural guards | Core/provider-contract remain Grafana-free; provider app-source allowlist is exact; no POC/experiment production imports |
| Native/no shell | Zero iframe, GrafanaApp, shell/navigation/router, SystemJS, or unexpected navigation |
| Review | Fresh-context whole-branch review has no unresolved Critical/Important finding |

## 12. Actual blockers and bounded risks

No known blocker prevents starting the issue. The following are explicit limits,
not reasons to broaden scope:

1. `/api/health` proves the reported server version but not OSS edition or the
   exact source/build artifact. Selecting provider-13 remains the host's explicit
   assertion that the target is the approved OSS cell. General server/build
   attestation is deferred.
2. Grafana Runtime singletons cannot be reset reliably. The first compatible
   initialization is page/realm lifetime; final dashboard release is dormant,
   not empty. A different identity needs a new page/realm.
3. The provider artifact/source build is still private and AGPL-3.0-only. This
   plan adds exact provenance and does not authorize publication.
4. The Text renderer relies on an audited renderer-only source build and
   view-only shims. Any upstream source drift fails the build; multi-version
   support is not implied.
5. Partial fallback currently supports only flat schema-42 grids and the exact
   controlled Text Markdown view profile. It does not imply arbitrary Grafana
   dashboard, panel, datasource, transformation, variable, or layout support.
6. Provider-global styles, portal root, cohort, and plugin cache persist while
   the provider remains initialized. Tests must distinguish this bounded
   provider-lifetime baseline from an instance leak.

If implementation demonstrates that real Text requires an iframe, Grafana
application shell/router/chrome, a second React, uncontrolled application-source
imports, or non-cleanable per-instance state, stop and report the evidence rather
than bypassing it.

## 13. Handoff requirements

After execution, report:

- final public API and concrete provider manifest;
- exact tracked and untracked files;
- strict-versus-partial preflight behavior;
- real Text source identity and bundle/provenance evidence;
- React externalization and actual object-identity evidence;
- runtime initialization order, identity conflict, dormant-state, and cleanup
  behavior;
- primary/alternate UID, fallback, grid, cancellation, two-instance, remount,
  style, and no-query browser evidence;
- all commands and actual results;
- independent review findings and final verdict;
- deviations, blockers, and remaining risks;
- complete `git status --short` and diff summary;
- recommended commit message and PR title.

Leave all implementation and plan changes uncommitted.
