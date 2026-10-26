# Provider-13 Dashboard Retrieval and Static Preflight Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

Use `superpowers:test-driven-development` for every behavior change and `superpowers:requesting-code-review` for the final fresh-context whole-branch review. Do not commit; leave the completed working tree for human review.

**Goal:** Create the first private `@dashboard-render-sdk-g/provider-13` workspace and implement bounded Grafana OSS 13.2.3 dashboard API discovery, stable-V1 DTO retrieval by UID, and static schema/capability preflight without initializing Grafana, Scenes, React, queries, or rendering.

**Architecture:** Provider-13 depends only on the provider-neutral `@dashboard-render-sdk-g/provider-contract`. A single stateless facade consumes a canonical `ManifestValidationSuccess` and an existing `HostTransportCapability`, performs exact `dashboard.grafana.app` discovery, retrieves the stable-V1 `/dto` resource, decodes a bounded detached DTO, inventories all material dashboard features, and checks them against both the validated manifest and one named provider-13 static profile. A positive result means only that declared static requirements match; runtime compatibility admission, executable module availability, conversion, queries, and rendering remain deferred.

**Tech Stack:** TypeScript 6.0.2, Vitest 4.1.10, Yarn 4.17.1 workspaces, Node.js 22.23.3, Docker Compose, Grafana OSS 13.2.3 fixture, browser-standard `AbortSignal`.

**Spec:** Workstream `[Phase 2] Implement provider-13 dashboard retrieval and static preflight`, parent [Phase 2 issue #73](https://github.com/aaliakbarian/dashboard-render-sdk-g/issues/73), `docs/architecture/production/phase1-production-architecture-decision.md`, `docs/architecture/production/bridge-provider-architecture.md`, `docs/architecture/production/grafana-version-compatibility-policy.md`, and `docs/architecture/research/dashboard-json-api-investigation.md`.

## Project-control state

Issue #89 and branch `phase2/provider-13-dashboard-preflight` were created after the initial planning pass. Implementation must run on that branch from baseline `fe8738836e613e3377510a2fe0fc536c372f2f66` and report any deviation before changing code.

## Global Constraints

- Work only on `phase2/provider-13-dashboard-preflight`, based on `fe8738836e613e3377510a2fe0fc536c372f2f66`.
- Create exactly one production workspace: private `@dashboard-render-sdk-g/provider-13`, version `0.0.0-private`, license `AGPL-3.0-only`, never publish.
- Provider-13 has exactly one workspace dependency: `@dashboard-render-sdk-g/provider-contract: workspace:*`. It must not depend on core, Grafana packages, Scenes, React/ReactDOM, POC workspaces, RxJS, or application-source code.
- Consume `HostTransportCapability` and `ManifestValidationSuccess` only from the provider-contract public root. Do not duplicate manifest validation or transport normalization.
- Preserve frontend-only ownership: the host owns authentication, credentials, authorized execution, origin/base-path mapping, organization/security scope, redirects, and CORS policy.
- Support only Grafana OSS 13.2.3's discovered stable `dashboard.grafana.app/v1` DTO resource and V1 `schemaVersion: 42`.
- Do not use beta, V2, raw-resource, or legacy `/api/dashboards/uid/{uid}` routes and do not retry or fall back across API families.
- Treat the normal Grafana dashboard UID as `metadata.name`; never interpret `metadata.uid`, title, slug, or numeric ID as the requested UID.
- The successful static profile is closed to flat-grid Text Markdown, the verified Stat and Time series profiles, controlled TestData Predictable Pulse, and either no transformation or one exact `renameByRegex` transformation. Table is unsupported.
- Inventory the complete dashboard before deciding. Never silently filter unsupported panels, queries, transformations, variables, annotations, links, layout elements, or unknown material fields.
- A static preflight match is not core compatibility evaluation, runtime admission, React object-identity validation, Grafana cohort verification, module availability, query execution, conversion, or rendering.
- Keep the implementation stateless: no API cache, session, retry framework, generation registry, or cross-request mutable state. Callers remain responsible for stale-generation publication guards; provider-13 preserves request IDs and cancellation.
- Add no third-party dependency and change no pinned version, resolution, fixture, Compose service, POC behavior, provider-contract API, or core API.
- Use Docker Compose for every Node.js, Yarn, TypeScript, Vitest, and build command. Do not install host tools and do not use unavailable `rg` or `jq`.
- Do not commit, push, publish, open a PR, or merge while executing this plan.

## Review Focus

- A discovery response that advertises beta/V2 but not stable `v1` must fail as unsupported; advertising stable `v1` alongside V2 must select only `v1` and never request V2.
- A valid DTO with absent `status` or absent `status.conversion` must remain admissible, while `conversion.failed: true` must fail as unsupported without exposing the server's error/source payload.
- The whole dashboard must be inventoried before preflight: the primary fixture's fourth Table panel must make the result unsupported rather than being dropped to produce a false Text/Stat/Time-series match.
- Body, JSON graph, panel, transformation, and diagnostic bounds must fail deterministically; truncating returned diagnostics must not change the actual unsupported outcome or create a fake malformed-input result.
- Cancellation after discovery but before/during DTO retrieval must preserve the stage request ID, return `cancelled`, perform no fallback request, and never publish a ready result from late work.

## Approved Public Interfaces

Create these exports in `packages/provider-13/src/contracts.ts` and re-export them from the package root:

```ts
import type {
  HostTransportCapability,
  ManifestValidationSuccess,
  TransportPolicyErrorCode,
} from '@dashboard-render-sdk-g/provider-contract';

export const GRAFANA_13_DASHBOARD_API_GROUP = 'dashboard.grafana.app' as const;
export const GRAFANA_13_DASHBOARD_API_VERSION = 'v1' as const;
export const GRAFANA_13_DASHBOARD_SCHEMA_VERSION = 42 as const;
export const GRAFANA_13_STATIC_PREFLIGHT_PROFILE_ID =
  'grafana-13.2.3-v1-schema-42-static-v1' as const;

export type Grafana13JsonPrimitive = string | number | boolean | null;
export interface Grafana13JsonObject {
  readonly [key: string]: Grafana13JsonValue;
}
export type Grafana13JsonValue =
  | Grafana13JsonPrimitive
  | Grafana13JsonObject
  | readonly Grafana13JsonValue[];

export interface Grafana13DashboardRequestIds {
  readonly discovery: string;
  readonly dashboard: string;
}

export interface Grafana13DashboardLoadInput {
  readonly transport: HostTransportCapability;
  readonly manifest: ManifestValidationSuccess;
  readonly namespace: string;
  readonly uid: string;
  readonly requestIds: Grafana13DashboardRequestIds;
  readonly signal: AbortSignal;
}

export interface Grafana13DashboardV1 {
  readonly family: 'v1';
  readonly apiVersion: 'dashboard.grafana.app/v1';
  readonly kind: 'DashboardWithAccessInfo';
  readonly metadata: {
    readonly name: string;
    readonly namespace: string;
    readonly generation?: number;
    readonly resourceVersion?: string;
  };
  readonly access: {
    readonly url?: string;
    readonly slug?: string;
    readonly canSave?: boolean;
    readonly canEdit?: boolean;
    readonly canDelete?: boolean;
    readonly canShare?: boolean;
    readonly canStar?: boolean;
    readonly canAdmin?: boolean;
    readonly annotationsPermissions?: Grafana13JsonObject;
    readonly isPublic?: boolean;
  };
  readonly spec: Grafana13JsonObject & {
    readonly panels: readonly Grafana13JsonObject[];
    readonly schemaVersion: typeof GRAFANA_13_DASHBOARD_SCHEMA_VERSION;
  };
  readonly status?: {
    readonly conversion?: {
      readonly failed: false;
      readonly storedVersion?: string;
    };
  };
}

export interface Grafana13DashboardInventory {
  readonly panelCount: number;
  readonly panels: readonly {
    readonly index: number;
    readonly id: number;
    readonly type: string;
  }[];
  readonly panelTypes: readonly string[];
  readonly datasourceTypes: readonly string[];
  readonly transformationIds: readonly string[];
  readonly variableKinds: readonly string[];
  readonly layout: 'flat-grid' | 'unsupported';
  readonly annotationPolicy: 'none' | 'canonical-builtin-omitted' | 'unsupported';
}

export type Grafana13DashboardStage =
  | 'input'
  | 'discovery'
  | 'dashboard-v1'
  | 'preflight';

export type Grafana13DashboardFailureCode =
  | 'dashboard.input-invalid'
  | 'dashboard.transport-policy-error'
  | 'dashboard.network-error'
  | 'dashboard.unauthorized'
  | 'dashboard.forbidden'
  | 'dashboard.not-found'
  | 'dashboard.http-error'
  | 'dashboard.response-malformed'
  | 'dashboard.identity-mismatch';

export interface Grafana13DashboardFailure {
  readonly code: Grafana13DashboardFailureCode;
  readonly stage: Grafana13DashboardStage;
  readonly requestId?: string;
  readonly status?: number;
  readonly path?: string;
  readonly transportPolicyCode?: TransportPolicyErrorCode;
  readonly message: string;
}

export type Grafana13PreflightDiagnosticCode =
  | 'dashboard.api-unsupported'
  | 'dashboard.conversion-unsupported'
  | 'dashboard.schema-unsupported'
  | 'dashboard.layout-unsupported'
  | 'dashboard.feature-unsupported'
  | 'dashboard.manifest-declaration-missing'
  | 'panel.unsupported'
  | 'panel.profile-unsupported'
  | 'datasource.unsupported'
  | 'datasource.profile-unsupported'
  | 'transformation.unsupported'
  | 'transformation.profile-unsupported';

export interface Grafana13PreflightDiagnostic {
  readonly code: Grafana13PreflightDiagnosticCode;
  readonly path: string;
  readonly capabilityId?: string;
  readonly message: string;
}

export type Grafana13DashboardLoadResult =
  | {
      readonly kind: 'ready';
      readonly requestIds: Grafana13DashboardRequestIds;
      readonly dashboard: Grafana13DashboardV1;
      readonly inventory: Grafana13DashboardInventory;
      readonly staticPreflight: {
        readonly profileId: typeof GRAFANA_13_STATIC_PREFLIGHT_PROFILE_ID;
        readonly outcome: 'declared-requirements-match';
        readonly providerId: string;
        readonly providerBuildId: string;
      };
    }
  | {
      readonly kind: 'unsupported';
      readonly stage: 'discovery' | 'dashboard-v1' | 'preflight';
      readonly requestId: string;
      readonly diagnostics: readonly Grafana13PreflightDiagnostic[];
      readonly diagnosticsTruncated: boolean;
      readonly inventory?: Grafana13DashboardInventory;
    }
  | {
      readonly kind: 'cancelled';
      readonly stage: 'discovery' | 'dashboard-v1';
      readonly requestId: string;
    }
  | {
      readonly kind: 'failure';
      readonly error: Grafana13DashboardFailure;
    };

export function retrieveAndPreflightGrafana13DashboardV1(
  input: Grafana13DashboardLoadInput
): Promise<Grafana13DashboardLoadResult>;
```

The package root exports only the constants, public types, and facade above. Internal decoders, discovery data, safe-JSON helpers, profile constants, and stage functions remain relative modules and are not root exports.

## Exact Semantics

### Input and request identity

- `uid` is non-empty, at most Grafana's pinned `MaxUIDLength` of 40, and contains only `[A-Za-z0-9_-]`. This mirrors `pkg/util/shortid_generator.go`; unlike the POC's old regex it does not invent a first-character restriction or a 128-character limit.
- `namespace` is one DNS-1123 label: lowercase alphanumeric plus interior `-`, 1–63 characters. The initial fixture uses `default`; paths never accept slash, dot traversal, percent encoding, query, or fragment content from these fields.
- `requestIds.discovery` and `requestIds.dashboard` are distinct, non-empty, non-secret strings accepted by the existing Host Transport Capability. Provider-13 forwards each exact value to its corresponding request and returns the winning stage's exact ID.
- `signal` must be the input signal for both stage requests. Provider-13 performs no replacement, timeout, or independent cancellation mechanism.
- Input validation occurs before any transport call. The facade accepts the canonical `ManifestValidationSuccess` type and does not rerun or clone the manifest validator; tests obtain it through `validateProviderCompatibilityManifest`.

### Discovery

- Send exactly one `GET /apis/dashboard.grafana.app/` request with `Accept: application/json`, no credentials, body, or query.
- Require HTTP 200, `kind: "APIGroup"`, `name: "dashboard.grafana.app"`, a dense bounded `versions` array, and a well-formed `preferredVersion` entry.
- Accept only when advertised versions contain exact stable `v1`. V2 or beta entries may coexist, but provider-13 always selects `v1`. Missing stable `v1`, a discovery 404, or a manifest that does not declare group/version `dashboard.grafana.app/v1` returns an unsupported result.
- Do not cache discovery, guess a beta version, call aggregated `/apis`, probe V2, or call a legacy endpoint.

### V1 DTO retrieval and envelope

- Send exactly one `GET /apis/dashboard.grafana.app/v1/namespaces/{namespace}/dashboards/{uid}/dto` request with the validated literal namespace/UID segments and `Accept: application/json`.
- Require HTTP 200 and a `DashboardWithAccessInfo` envelope with exact `apiVersion`, exact `kind`, object `metadata`, object `spec`, and object `access`.
- Require `metadata.name === requested uid` and `metadata.namespace === requested namespace`. Ignore `metadata.uid` for identity and omit it from the returned project-owned metadata shape.
- Require the documented access booleans when present in the pinned DTO shape; accept optional `slug`/`url` strings and nullable/optional annotation permissions without using access data as compatibility admission.
- `status` and `status.conversion` are optional. If conversion is present, require a boolean `failed`; `failed: true` returns `dashboard.conversion-unsupported`. Never expose `conversion.error` or `conversion.source`.
- Require numeric integer `spec.schemaVersion`. Anything other than exact 42 returns `dashboard.schema-unsupported` before capability preflight. Do not migrate.
- Parse JSON only after applying the body bound. Construct a detached project-owned JSON graph, then deeply freeze the DTO and every result. Do not expose the mutable `JSON.parse` graph.

### Transport and HTTP mapping

- Map `TransportResult.kind: 'cancelled'` to the stage-specific cancelled result and preserve its request ID.
- Map `network-error` to `dashboard.network-error` and `policy-error` to `dashboard.transport-policy-error`; include only the neutral policy code, never raw causes or request/response data.
- Map HTTP 401/403 at either stage to `dashboard.unauthorized`/`dashboard.forbidden`.
- Map retrieval HTTP 404 to `dashboard.not-found`; discovery 404 means `dashboard.api-unsupported`.
- Map every other non-200 response to `dashboard.http-error` with status only. A 2xx status other than 200 is not a valid DTO/discovery response.
- Never include response body text, headers, dashboard content, credentials, or thrown messages in failure/diagnostic objects.

### Resource bounds and safe decoding

Use these fixed issue-level limits:

| Input | Limit |
| --- | ---: |
| Discovery/DTO response body | 1,048,576 UTF-16 code units |
| JSON/container traversal depth | 32 |
| JSON nodes visited | 16,384 |
| Own properties per object/array (excluding intrinsic array `length`) | 1,024 |
| Dense array length | 1,024 |
| Discovery versions | 64 |
| Dashboard panels | 256 |
| Transformations across all panels | 256 |
| Returned preflight diagnostics | 100 |

- JSON parsing produces plain acyclic data, but the decoder still rejects non-JSON numbers, unexpected `undefined`, sparse data introduced by internal tests, dangerous/non-enumerable/symbol/accessor properties in directly tested decoder inputs, over-depth/over-node graphs, and oversized containers.
- Use guarded reflection for decoder functions that tests can call with hostile values. Throwing/revoked Proxy traps may execute; catch their exceptions and return typed malformed-response failures rather than claiming sandboxing.
- Traverse and freeze iteratively or within the enforced depth bound. Diagnostic order is path, then code, then capability ID.
- Track the logical unsupported state independently from the bounded diagnostics array. Return at most 100 real diagnostics plus `diagnosticsTruncated: true`; do not insert a synthetic invalid-input diagnostic that changes outcome semantics.

### Static profile and manifest capability checks

The named profile `grafana-13.2.3-v1-schema-42-static-v1` is provider-owned and stricter than the neutral manifest vocabulary:

- Dashboard: schema 42, browser timezone, bounded string time range, no live mode, no preload behavior, no dashboard links, no material annotations, and only the exact known top-level keys from the controlled schema-42 fixture profile.
- Layout: one flat `panels[]` grid only; unique positive integer panel IDs; integer `x/y/w/h`; `x >= 0`, `y >= 0`, `w/h > 0`, `x + w <= 24`; no overlaps, rows, tabs, autogrid, repeats, or library panels.
- Variables: none or the exact hidden constant `environment=phase0` fixture form. Query, custom, datasource, interval, adhoc, group-by, global/folder, or otherwise unknown variables are unsupported.
- Annotations: an empty list is supported. The exact server-canonical hidden built-in `Annotations & Alerts` entry may be inventoried as `canonical-builtin-omitted`; it is never executed and any other annotation definition is unsupported.
- Text: `type: text`, `pluginVersion: 13.2.3`, Markdown view mode, string content, the controlled view-only option keys, no datasource, targets, transformations, panel links, or field links.
- Stat: `type: stat`, `pluginVersion: 13.2.3`, exact Phase 0 verified Stat options/field configuration, one `lastNotNull` reduction, controlled TestData datasource/target, and no transformations or links.
- Time series: `type: timeseries`, `pluginVersion: 13.2.3`, exact Phase 0 verified Time series options/field configuration, one controlled TestData Predictable Pulse target, and either no transform or exactly one `renameByRegex` with the verified `regex` and `renamePattern` string option shape.
- Datasource: only type `grafana-testdata-datasource`, UID `grsdk-testdata`, exact `predictable_pulse` scenario, one target `refId: A`, and the verified pulse-wave shape. No arbitrary datasource/query profile is inferred from the type ID.
- Transformations: empty is allowed only when `manifest.capabilities.transformations.allowEmptyPipeline` is true. One `renameByRegex` requires the manifest ID, `maxChainLength >= 1`, exact option shape, and no extra transformation properties. Chains longer than one or any other ID are unsupported.
- Table, unknown panel IDs, Table's `table_static` query, alerts, panel/dashboard links, shared/dashboard datasources, unknown field overrides/options, and unknown material keys are unsupported even if a caller supplies a manifest containing a broader string ID.

The preflight first checks `manifest.dashboards.lookup === 'uid'`, a declared `dashboard.grafana.app/v1` API, and declared `v1/schemaVersion 42`. It then checks every inventoried panel/datasource/transformation against both the manifest catalogues and the named static profile. It never evaluates manifest target cells, React versions, runtime dependencies, source revision, observed Grafana `BuildCommit`, loaded modules, or physical object identities.

### Result meaning, cancellation, and stale work

- `ready.staticPreflight.outcome === 'declared-requirements-match'` states only that the canonical manifest declares every statically inventoried requirement and the JSON matches the named profile.
- A ready result means only that retrieval, DTO validation, and the named static preflight succeeded. The absence of runtime-admission data is intentional: do not reuse `CompatibilityEvaluationOutcome`, construct `RuntimeIdentity`, or imply executable support, verified module compatibility, or renderability.
- The function owns no mutable generation state. Two concurrent UID requests have independent signals/request IDs and may resolve in either order; the future core dashboard session must prevent stale publication.
- If cancellation wins a transport stage, return cancelled and make no later API-family request. The merged core capability consumes late executor settlement. Provider-13 must not catch cancellation and reinterpret it as network/API failure.
- Every invocation repeats discovery and retrieval. Provider/runtime-scoped caching is a later admission/session decision.

## Planned File Set

Create:

- `packages/provider-13/package.json`
- `packages/provider-13/README.md`
- `packages/provider-13/tsconfig.json`
- `packages/provider-13/tsconfig.typecheck.json`
- `packages/provider-13/src/contracts.ts`
- `packages/provider-13/src/contracts.type-test.ts`
- `packages/provider-13/src/dashboardApi.ts`
- `packages/provider-13/src/dashboardApi.test.ts`
- `packages/provider-13/src/dashboardDto.ts`
- `packages/provider-13/src/dashboardDto.test.ts`
- `packages/provider-13/src/staticPreflight.ts`
- `packages/provider-13/src/staticPreflight.test.ts`
- `packages/provider-13/src/testFixtures.test.ts`
- `packages/provider-13/src/index.ts`
- `integration/provider13DashboardPreflight.test.ts`
- `scripts/check-provider-13-boundary.mjs`
- `scripts/check-provider-13-boundary.test.mjs`

Modify:

- `package.json` — add provider-13 typecheck/unit/boundary commands to existing root orchestration; no dependency/version change.
- `tsconfig.base.json` — add the provider-13 project reference before POC projects.
- `yarn.lock` — add only the new workspace locator and its `provider-contract: workspace:*` edge.

Explicitly unchanged:

- `packages/provider-contract/**`
- `packages/core/**`
- `packages/poc-compat/**`
- `packages/poc-grafana-bridge/**`
- `apps/poc-host/**`
- `dev/grafana/**`
- `compose.yaml`
- all Phase 0/Phase 1 architecture documents and fixtures

If implementation requires changing an explicitly unchanged file or adding a production dependency, stop for architectural review rather than widening the issue.

## Internal Interfaces

Keep these package-private signatures exact enough for task handoff; do not root-export them:

```ts
// dashboardApi.ts
export interface ValidatedGrafana13DashboardLoadInput
  extends Grafana13DashboardLoadInput {}

export type DashboardStageResult<T> =
  | { readonly kind: 'success'; readonly value: T }
  | Extract<Grafana13DashboardLoadResult, { readonly kind: 'cancelled' | 'failure' | 'unsupported' }>;

export interface Grafana13DashboardDiscovery {
  readonly advertisedVersions: readonly string[];
  readonly preferredVersion: string;
  readonly selectedVersion: 'v1';
}

export function validateDashboardLoadInput(
  input: Grafana13DashboardLoadInput
): DashboardStageResult<ValidatedGrafana13DashboardLoadInput>;

export function discoverStableGrafana13DashboardV1(
  input: ValidatedGrafana13DashboardLoadInput
): Promise<DashboardStageResult<Grafana13DashboardDiscovery>>;

export function retrieveGrafana13DashboardV1Dto(
  input: ValidatedGrafana13DashboardLoadInput,
  discovery: Grafana13DashboardDiscovery
): Promise<DashboardStageResult<Grafana13DashboardV1>>;

// dashboardDto.ts
export function decodeGrafana13DiscoveryBody(
  body: string,
  requestId: string
): DashboardStageResult<Grafana13DashboardDiscovery>;

export function decodeGrafana13DiscoveryValue(
  value: unknown,
  requestId: string
): DashboardStageResult<Grafana13DashboardDiscovery>;

export function decodeGrafana13DashboardV1Body(
  body: string,
  expected: { readonly namespace: string; readonly uid: string; readonly requestId: string }
): DashboardStageResult<Grafana13DashboardV1>;

export function decodeGrafana13DashboardV1Value(
  value: unknown,
  expected: { readonly namespace: string; readonly uid: string; readonly requestId: string }
): DashboardStageResult<Grafana13DashboardV1>;

// staticPreflight.ts
export type Grafana13StaticPreflightResult =
  | {
      readonly kind: 'match';
      readonly inventory: Grafana13DashboardInventory;
    }
  | {
      readonly kind: 'unsupported';
      readonly inventory: Grafana13DashboardInventory;
      readonly diagnostics: readonly Grafana13PreflightDiagnostic[];
      readonly diagnosticsTruncated: boolean;
    };

export function preflightGrafana13DashboardV1(
  dashboard: Grafana13DashboardV1,
  manifest: ManifestValidationSuccess
): Grafana13StaticPreflightResult;
```

`testFixtures.test.ts` may export test-only helpers that obtain a canonical validated manifest and wrap the committed synthetic dashboard JSON in a DTO envelope. Production modules must not import it.

---

### Task 1: Scaffold the private provider-13 workspace and enforce its boundary

**Files:**

- Create: `packages/provider-13/package.json`
- Create: `packages/provider-13/README.md`
- Create: `packages/provider-13/tsconfig.json`
- Create: `packages/provider-13/tsconfig.typecheck.json`
- Create: `packages/provider-13/src/contracts.type-test.ts`
- Create: `packages/provider-13/src/contracts.ts`
- Create: `packages/provider-13/src/index.ts`
- Create: `scripts/check-provider-13-boundary.mjs`
- Create: `scripts/check-provider-13-boundary.test.mjs`
- Modify: `package.json`
- Modify: `tsconfig.base.json`
- Modify: `yarn.lock`

**Interfaces:**

- Consumes: provider-contract public-root types `HostTransportCapability`, `ManifestValidationSuccess`, and `TransportPolicyErrorCode`.
- Produces: constants and data/result types in **Approved Public Interfaces**; no executable facade yet.

- [ ] **Step 1: Add workspace/configuration and update only workspace lock metadata**

  Add a private AGPL package following the existing provider-contract/core manifest and TypeScript patterns. Production `tsconfig.json` uses `jsx: "preserve"`, `types: []`, excludes `*.test.ts` and `*.type-test.ts`, and references `../provider-contract`; typecheck config includes all source tests without emit. Add root scripts `check:provider-13-boundary`, provider-13 package typecheck/unit participation, and the solution reference.

  Run once to register the workspace:

  ```sh
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn install
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn workspaces list --json
  git diff -- package.json tsconfig.base.json yarn.lock packages/provider-13/package.json
  ```

  Expected: workspace discovery includes provider-13; the lockfile adds only its workspace entry and provider-contract workspace edge; pinned versions/resolutions remain unchanged.

- [ ] **Step 2: Write compile-time RED assertions**

  In `contracts.type-test.ts`, assert readonly/discriminated result shapes, the exact constants/codes/stages, recursive JSON vocabulary, required transport/manifest/signal/request IDs, and ready-versus-unsupported narrowing. Assert that the ready result has no runtime-admission field, that a `ProviderCompatibilityManifest` is not accepted where `ManifestValidationSuccess` is required, and that no runtime/React/Grafana type appears.

  ```sh
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn workspace @dashboard-render-sdk-g/provider-13 typecheck
  ```

  Expected: FAIL because the contract exports do not exist.

- [ ] **Step 3: Implement only inert contracts and root exports**

  Add the exact types/constants above. Do not add behavior, provider manifest data, runtime code, Grafana imports, or a placeholder facade.

- [ ] **Step 4: Verify contract GREEN and declaration separation**

  ```sh
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn workspace @dashboard-render-sdk-g/provider-13 typecheck
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn tsc6 --project packages/provider-13/tsconfig.typecheck.json --pretty false --listFilesOnly
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn workspace @dashboard-render-sdk-g/provider-13 build
  ```

  Expected: PASS; `contracts.type-test.ts` is in the effective typecheck list and absent from emitted declarations.

- [ ] **Step 5: Write boundary-checker RED tests**

  Import the hardened `inspectProductionTypeScriptBoundary` traversal from `check-provider-contract-boundary.mjs`; duplicate only the small provider-13 package-specific allowlist/manifest policy. Test:

  - exact allowed static value/type/import-type references to provider-contract root;
  - forbidden core, Grafana, Scenes, React/ReactDOM, POC, Node production, provider-contract subpath, re-export, dynamic import, CommonJS, import-equals, JSX, triple-slash, test-module, outside-package, and unresolved references;
  - exact dependency/range and rejection of dev/peer/optional/bundled/bundle/dependenciesMeta/resolutions/overrides/pnpm sections;
  - inherited/direct compiler types, JSX runtime/import source, helpers, plugins, `paths`, wildcard paths, and `baseUrl` redirects;
  - the real package is clean.

  ```sh
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev node --test scripts/check-provider-13-boundary.test.mjs
  ```

  Expected: FAIL until the provider-specific checker is implemented.

- [ ] **Step 6: Implement and verify the boundary guard**

  Permit only relative static imports/re-exports within provider-13 and static value/type/import-type imports from the provider-contract public root. Fail closed on every other external/configuration/dependency source. Do not refactor the existing checkers broadly.

  ```sh
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev node --test scripts/check-provider-13-boundary.test.mjs
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn check:provider-13-boundary
  ```

  Expected: PASS.

- [ ] **Step 7: Review checkpoint (no commit)**

  Inspect all tracked/untracked Task 1 files and leave them uncommitted.

---

### Task 2: Implement input validation and stable-V1 API discovery

**Files:**

- Create: `packages/provider-13/src/dashboardApi.test.ts`
- Create: `packages/provider-13/src/dashboardApi.ts`
- Modify: `packages/provider-13/package.json`

**Interfaces:**

- Consumes: `Grafana13DashboardLoadInput` and provider-contract `HostTransportCapability`.
- Produces: `validateDashboardLoadInput` and `discoverStableGrafana13DashboardV1` internal stage functions.

- [ ] **Step 1: Write input RED tests**

  Cover valid `default`/fixture UIDs; empty, 41-character, slash, percent, whitespace, title/slug-like UID; invalid namespace casing, slash, traversal, empty/64-character namespace; duplicate/empty/control request IDs; non-native signal via hostile cast; and pre-abort. Assert invalid input invokes transport zero times and returns fixed data without echoing rejected values.

- [ ] **Step 2: Write discovery RED tests with a fake capability**

  Assert exact GET path/header/request ID/signal, v1 selection when preferred is v2, order-independent advertised versions, no V2/beta/legacy request, manifest API/lookup mismatch, 401/403/404/500, network/policy/cancelled transport results, malformed JSON/envelope/version entries, duplicates, sparse/oversized versions, throwing/revoked decoder values, body/depth/node/property limits, and deterministic detached/frozen output.

  ```sh
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn vitest run packages/provider-13/src/dashboardApi.test.ts --environment node
  ```

  Expected: FAIL because discovery does not exist.

- [ ] **Step 3: Implement bounded input and discovery behavior**

  Implement the exact input/discovery semantics, fixed transport/HTTP mapping, and resource bounds. Use the canonical manifest only to check the declared lookup/API capability; do not invoke core compatibility evaluation or inspect target/runtime/React fields.

- [ ] **Step 4: Verify discovery GREEN**

  ```sh
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn vitest run packages/provider-13/src/dashboardApi.test.ts --environment node
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn workspace @dashboard-render-sdk-g/provider-13 typecheck
  ```

  Expected: PASS.

- [ ] **Step 5: Review checkpoint (no commit)**

  Confirm no cache, runtime setup, fetch implementation, credential handling, or other endpoint exists.

---

### Task 3: Decode and retrieve the bounded stable-V1 DTO

**Files:**

- Create: `packages/provider-13/src/dashboardDto.test.ts`
- Create: `packages/provider-13/src/dashboardDto.ts`
- Modify: `packages/provider-13/src/dashboardApi.test.ts`
- Modify: `packages/provider-13/src/dashboardApi.ts`

**Interfaces:**

- Consumes: validated input and successful discovery from Task 2.
- Produces: `decodeGrafana13DashboardV1Body` and `retrieveGrafana13DashboardV1Dto` with a detached frozen `Grafana13DashboardV1` or typed non-success result.

- [ ] **Step 1: Write DTO retrieval RED tests**

  Assert the exact `/apis/dashboard.grafana.app/v1/namespaces/default/dashboards/{uid}/dto` GET, request ID/signal preservation, one discovery then one DTO call, and no fallback. Cover 401/403/404/500, network/policy/cancelled results, cancellation after discovery, and concurrent independent UIDs resolving out of order without shared state.

- [ ] **Step 2: Write envelope/identity RED tests**

  Cover exact API/kind/name/namespace/schema/access success; `metadata.uid` differing without affecting identity; metadata.name or namespace mismatch; absent status; absent conversion; conversion false; conversion true with secret-bearing error/source; malformed JSON; wrong/missing envelope fields; malformed access/metadata/panels/schema; 41/V2-shaped input; unknown top-level envelope fields; and safe omission of internal resource UID.

- [ ] **Step 3: Write resource and immutability RED tests**

  Cover body at/over 1,048,576 code units, depth 32/33, node 16,384/16,385, property/array 1,024/1,025, panels 256/257, non-finite values in the package-private value decoders, sparse/symbol/accessor/throwing/revoked values, prototype-sensitive keys, mutation of decoder input/result, and deep-frozen nested DTO data. Assert no body fragment, conversion error/source, or raw thrown cause appears in results. The value decoders are test seams for safe-reflection behavior and remain absent from the package root.

  ```sh
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn vitest run packages/provider-13/src/dashboardDto.test.ts packages/provider-13/src/dashboardApi.test.ts --environment node
  ```

  Expected: FAIL on unimplemented DTO behavior.

- [ ] **Step 4: Implement bounded JSON clone/validation and DTO retrieval**

  Bound the body before `JSON.parse`, validate/clone the graph without spread-based `__proto__` behavior, enforce identity and optional conversion semantics, omit resource UID, and freeze all returned data. Classify unsupported schema/conversion separately from malformed/identity/HTTP failures.

- [ ] **Step 5: Verify DTO GREEN**

  ```sh
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn vitest run packages/provider-13/src/dashboardDto.test.ts packages/provider-13/src/dashboardApi.test.ts --environment node
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn workspace @dashboard-render-sdk-g/provider-13 typecheck
  ```

  Expected: PASS.

- [ ] **Step 6: Review checkpoint (no commit)**

  Confirm the retrieved DTO remains provider-private data and no conversion, Grafana model, module loader, or dashboard session exists.

---

### Task 4: Inventory the complete dashboard and apply the named static profile

**Files:**

- Create: `packages/provider-13/src/testFixtures.test.ts`
- Create: `packages/provider-13/src/staticPreflight.test.ts`
- Create: `packages/provider-13/src/staticPreflight.ts`
- Modify: `packages/provider-13/src/dashboardApi.ts`
- Modify: `packages/provider-13/src/contracts.type-test.ts`
- Modify: `packages/provider-13/src/contracts.ts`
- Modify: `packages/provider-13/src/index.ts`

**Interfaces:**

- Consumes: canonical `ManifestValidationSuccess` and decoded `Grafana13DashboardV1`.
- Produces: `preflightGrafana13DashboardV1` internally and the public `retrieveAndPreflightGrafana13DashboardV1` facade/result.

- [ ] **Step 1: Add canonical test manifest and DTO fixture helpers**

  Build the manifest through `validateProviderCompatibilityManifest`, with exact group/version/schema/lookup plus panels `text/stat/timeseries`, datasource `grafana-testdata-datasource`, empty/one `renameByRegex`, exact Grafana OSS 13.2.3 provenance/runtime declarations, and no Table capability. Read committed fixture JSON only in test code; do not import POC production modules.

- [ ] **Step 2: Write positive static-profile RED tests**

  Assert the alternate Text fixture passes. Clone the primary fixture and remove only Table to prove the full verified Text/Stat/Time-series/TestData/renameByRegex profile passes. Assert inventory ordering, sorted unique capability IDs, exact panel indices/IDs/types, annotation policy, manifest provider/build evidence, detached/frozen data, and the absence of runtime-admission or renderability claims.

- [ ] **Step 3: Write fail-closed feature RED tests**

  Prove the unmodified primary fixture is unsupported because of Table and `table_static`, with no returned ready dashboard and no panel filtering. Cover rows, overlap/out-of-range/malformed grid, duplicate panel IDs, repeat/library/alert, dashboard/panel/field links, Live/preload, unsupported annotations, query/custom variables, unknown top-level/panel/option/field keys, plugin-version mismatch, HTML/Text mode, extra/malformed targets, wrong datasource UID/type/scenario/pulse profile, unknown transforms, malformed transform options, and chains longer than one.

- [ ] **Step 4: Write manifest-capability and diagnostic-limit RED tests**

  Remove API/schema/lookup, panel, datasource, empty-pipeline, rename ID, or chain-length declarations from otherwise valid canonical manifests and expect explicit manifest/capability diagnostics. Add more than 100 unsupported material items and assert deterministic first 100 diagnostics, `diagnosticsTruncated: true`, and an unchanged unsupported outcome with no synthetic invalid-observation marker.

  ```sh
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn vitest run packages/provider-13/src/staticPreflight.test.ts --environment node
  ```

  Expected: FAIL because inventory/preflight do not exist.

- [ ] **Step 5: Implement complete inventory and profile comparison**

  Traverse every panel and material dashboard feature within bounds before deciding. Record sanitized IDs/counts only in inventory/diagnostics; never include titles, Text content, query values, or the full dashboard. Compare the inventory with the canonical manifest and the fixed profile, collecting all bounded diagnostics in deterministic order.

- [ ] **Step 6: Implement and export the stateless facade**

  Compose input validation -> discovery -> V1 retrieval -> profile preflight. Return the full frozen DTO only for `ready`; return sanitized inventory/diagnostics for unsupported preflight. Add compile-time tests for the executable signature and result narrowing.

- [ ] **Step 7: Verify preflight/facade GREEN**

  ```sh
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn vitest run packages/provider-13/src/dashboardApi.test.ts packages/provider-13/src/dashboardDto.test.ts packages/provider-13/src/staticPreflight.test.ts --environment node
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn workspace @dashboard-render-sdk-g/provider-13 typecheck
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn workspace @dashboard-render-sdk-g/provider-13 build
  ```

  Expected: PASS; declarations contain only approved public symbols and no test/internal/Grafana implementation type.

- [ ] **Step 8: Review checkpoint (no commit)**

  Confirm positive static preflight language never claims runtime/module/rendering compatibility and unknown material features never disappear silently.

---

### Task 5: Prove the real Grafana 13.2.3 path through a core-created host capability

**Files:**

- Create: `integration/provider13DashboardPreflight.test.ts`
- Modify: `packages/provider-13/README.md`

**Interfaces:**

- Consumes: core `createHostTransportCapability`, provider-contract manifest validation/transport types, provider-13 facade, and the existing containerized Grafana fixture.
- Produces: real HTTP evidence for alternate success and primary-Table unsupported behavior; no production dependency from provider-13 to core.

- [ ] **Step 1: Write credential-gated integration RED test**

  Before choosing descriptor values or implementing the host executor, probe the running fixture from inside the `dev` service. Check the health and API discovery resources at the service origin both with and without `/grafana`, recording status and redirect behavior without printing credentials. Derive `targetOrigin`, `basePath`, and the executor's URL join from observed reachability. The direct container-to-container profile must not assume that Grafana's browser-facing `root_url` prefix is also its service-internal API prefix. Fail the integration setup if neither candidate is reachable or if following redirects would move outside the configured target origin.

  The test must:

  - create a real core capability using the verified service-internal origin/base-path pair, non-secret fixture scope/policy IDs, and a host-owned `fetch` executor;
  - inject Basic authentication only inside that integration host executor from `POC_GRAFANA_VERIFY_USER/PASSWORD`;
  - assert provider requests contain no authorization/cookie/org header;
  - use the canonical validated provider manifest;
  - retrieve `grsdk-phase0-poc-alt` and assert `ready`, schema 42, Text inventory, and exact metadata.name;
  - retrieve `grsdk-phase0-poc` and assert HTTP/DTO success followed by preflight `unsupported` for Table, not transport/retrieval failure;
  - prove the requests hit group discovery and stable V1 `/dto`, with no V2/beta/legacy/raw endpoint;
  - perform no query, module load, Grafana Runtime initialization, or rendering.

  Skip only when the credential environment is absent so ordinary root regression runs remain usable; the required verification command below supplies credentials and must execute, not skip.

- [ ] **Step 2: Run the real test to prove RED**

  ```sh
  docker compose --env-file dev/grafana/.env up -d --wait grafana
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev node -e "Promise.all(['/api/health','/grafana/api/health'].map(async (path) => { const response = await fetch('http://grafana:3000' + path, { redirect: 'manual' }); console.log(path, response.status, response.headers.get('location') ?? '-'); })).catch(() => process.exit(1))"
  set -a
  . dev/grafana/.env
  set +a
  POC_GRAFANA_VERIFY_USER="$GRAFANA_ADMIN_USER" \
  POC_GRAFANA_VERIFY_PASSWORD="$GRAFANA_ADMIN_PASSWORD" \
    docker compose --env-file dev/grafana/.env run --rm --no-deps \
      -e POC_GRAFANA_VERIFY_USER -e POC_GRAFANA_VERIFY_PASSWORD \
      dev yarn vitest run integration/provider13DashboardPreflight.test.ts --environment node
  ```

  Expected: FAIL before the integration wiring/facade is complete; credentials are never printed.

- [ ] **Step 3: Add only test-side host HTTP execution needed by the integration**

  Join the verified descriptor origin/base path and normalized provider path in the test host executor, encode no provider credentials into provider-13, return raw status/headers/body to core, and let core normalize. Assert the resulting URL matches the successful probe and does not duplicate or omit a prefix. Do not add a reusable SDK proxy/auth client.

- [ ] **Step 4: Verify real GREEN and fixture health**

  Run the credential-supplying command again, then:

  ```sh
  sh tests/container/grafana-fixture-contract.sh
  ```

  Expected: real integration and existing fixture contract pass; output contains no credentials or raw dashboard body.

- [ ] **Step 5: Document the private provider boundary**

  In the README state the exact endpoint/schema/profile, host transport ownership, result meaning, Table/unsupported limitations, bounds, cancellation/stateless behavior, and no Grafana/Scenes/React dependency. State that `ready` is a static-preflight result—not runtime admission, verified module compatibility, or renderability—and document deferred conversion/query/rendering. Do not advertise a published or generally compatible provider.

- [ ] **Step 6: Review checkpoint (no commit)**

  Inspect integration evidence and confirm all credential usage remains test-host-owned and ignored env files remain unmodified.

---

### Task 6: Run package, boundary, declaration, and repository regressions

**Files:**

- Verify all tracked and untracked changes relative to `fe8738836e613e3377510a2fe0fc536c372f2f66`.
- Verify unchanged: provider-contract/core/POC production sources, fixtures, Compose, dependencies, and pinned versions.

**Interfaces:**

- Consumes: completed provider-13 workspace and tests.
- Produces: verification evidence only.

- [ ] **Step 1: Run immutable install and focused package checks**

  ```sh
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn install --immutable
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn workspace @dashboard-render-sdk-g/provider-13 typecheck
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn workspace @dashboard-render-sdk-g/provider-13 test:unit
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn workspace @dashboard-render-sdk-g/provider-13 build
  ```

  Expected: PASS.

- [ ] **Step 2: Run all boundary regression suites and live guards**

  ```sh
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev node --test scripts/check-provider-contract-boundary.test.mjs
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev node --test scripts/check-core-boundary.test.mjs
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev node --test scripts/check-provider-13-boundary.test.mjs
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn check:provider-contract-boundary
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn check:core-boundary
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn check:provider-13-boundary
  ```

  Expected: all pass; provider-contract/core guards are not weakened.

- [ ] **Step 3: Verify effective typecheck roots and declaration output**

  ```sh
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn tsc6 --project packages/provider-13/tsconfig.typecheck.json --pretty false --listFilesOnly
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn tsc6 --build packages/provider-contract/tsconfig.json packages/provider-13/tsconfig.json --pretty false --force --listEmittedFiles
  ```

  Expected: all provider-13 tests/type tests are in the no-emit typecheck program; no `.test`/`.type-test` declaration is emitted; production declarations have only provider-contract external references.

- [ ] **Step 4: Run root and POC regressions**

  ```sh
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn typecheck
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn test:unit
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn test:integration
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn build:poc
  ```

  Expected: PASS; credential-gated integration may skip only in the unsupplied-env root command, while Task 5's supplied-env run is recorded as executed. Existing React/Scenes peer warnings remain unchanged.

- [ ] **Step 5: Run targeted existing browser dashboard-API regression**

  Source the local fixture environment again in this shell and do not print credentials:

  ```sh
  set -a
  . dev/grafana/.env
  set +a
  POC_GRAFANA_VERIFY_USER="$GRAFANA_ADMIN_USER" \
  POC_GRAFANA_VERIFY_PASSWORD="$GRAFANA_ADMIN_PASSWORD" \
    docker compose --env-file dev/grafana/.env run --rm --no-deps \
      -e POC_GRAFANA_VERIFY_USER -e POC_GRAFANA_VERIFY_PASSWORD \
      dev yarn playwright test tests/e2e/dashboard-api.spec.ts --project=chromium
  ```

  Expected: PASS. Full Gate A/B/C rendering reruns are not required because no POC/runtime/rendering source changes.

- [ ] **Step 6: Inspect scope, secrets, whitespace, and dependency drift**

  ```sh
  git status --short
  git diff --stat
  git diff --check
  git ls-files --others --exclude-standard
  git diff -- package.json yarn.lock packages/provider-contract packages/core dev/grafana compose.yaml
  grep -RInE "(@grafana/|@grafana/scenes|@dashboard-render-sdk-g/core|poc-compat|poc-grafana-bridge|react-dom|from ['\"]react['\"]|GrafanaApp|BackendSrv|Authorization:|Bearer |service.?account|password)" packages/provider-13 scripts/check-provider-13-boundary.mjs integration/provider13DashboardPreflight.test.ts || true
  ```

  Expected: only planned files are changed/untracked; provider-contract/core/fixture/Compose diffs are empty; lock diff is workspace-only; production provider-13 source has no forbidden import or credential; test references to env variable names and host-owned Basic auth are reviewed and contain no secret values.

---

### Task 7: Request independent whole-branch review

**Files:**

- Review all tracked and untracked files relative to `fe8738836e613e3377510a2fe0fc536c372f2f66`.
- Modify only for justified Critical/Important findings within this issue, using focused TDD.

**Interfaces:**

- Consumes: verified provider-13 working tree.
- Produces: independent verdict and any bounded remediation evidence.

- [ ] **Step 1: Request a fresh-context review**

  Use `superpowers:requesting-code-review`. Ask the reviewer to inspect:

  - exact endpoint strategy and absence of beta/V2/raw/legacy fallback;
  - UID/namespace/metadata.name semantics;
  - HostTransportCapability-only execution and host-owned credentials;
  - optional conversion status and exact schema-42 handling;
  - whole-dashboard inventory, no silent Table/panel filtering, and profile/manifest separation;
  - positive-result wording versus runtime admission;
  - cancellation/request IDs/stateless concurrent loads;
  - bounded JSON/reflection/diagnostic behavior and secret/body/cause leakage;
  - deep detachment/immutability;
  - package/dependency/compiler/import boundaries and no POC implementation reuse;
  - real alternate-pass/primary-unsupported integration evidence.

- [ ] **Step 2: Resolve justified blocking findings through focused TDD**

  Reproduce each Critical/Important finding first, apply the smallest in-scope correction, rerun focused tests and all three boundary suites/guards, then request a scoped re-review. Do not expand into conversion, runtime admission, queries, or rendering.

- [ ] **Step 3: Run final verification and leave uncommitted**

  Repeat Tasks 5–6 after any remediation. Report exact files, final API, RED/GREEN evidence, bounds, fake/real results, review verdict, deviations/risks, complete status/diff, recommended commit message, and PR title. Do not perform Git integration.

## Acceptance Criteria Mapping

| Workstream requirement | Plan evidence |
| --- | --- |
| Private provider-13 workspace | Task 1 manifest/config/workspace registration |
| Depends on provider-contract, not core | Task 1 package policy and boundary guard |
| HostTransportCapability consumption | Public input, Tasks 2–3 fake transport, Task 5 real core-created capability |
| Stable V1 discovery and exact DTO route | Task 2 discovery matrix, Task 3 endpoint assertions |
| No legacy/beta/V2/raw fallback | Tasks 2–3 negative request evidence and review |
| UID means metadata.name | Exact semantics and Task 3 identity tests |
| Optional conversion status; reject failed conversion | Task 3 envelope tests |
| V1 schema 42 only | Task 3 unsupported-schema tests |
| Canonical manifest plus explicit provider profile | Task 4 manifest/profile tests |
| Flat Text/Stat/Time-series/TestData/renameByRegex boundary | Task 4 positive/negative profile matrix |
| No silent unsupported-feature filtering | Primary Table failure and complete inventory tests |
| Positive preflight is not runtime admission | Public result omits admission data; Task 4 assertions and README define the narrow meaning |
| Typed HTTP/transport/malformed/identity errors | Tasks 2–3 matrices |
| Cancellation, request IDs, stateless concurrency | Tasks 2–3 cancellation/concurrency tests |
| Bounded detached immutable data/diagnostics | Tasks 3–4 resource/immutability tests |
| Alternate real fixture passes | Task 5 integration |
| Primary real fixture retrieves then fails Table preflight | Task 5 integration |
| Production source imports no POC internals | Task 1 guard and Task 6 grep/diff review |
| Existing package/POC behavior preserved | Task 6 regressions |
| Independent whole-branch review | Task 7 |

## Deferred Responsibilities

- observed Grafana semantic/build identity acquisition and comparison;
- core pure compatibility evaluation orchestration and executable runtime admission;
- React/ReactDOM object-identity validation and `RuntimeIdentity` construction;
- provider manifest artifact production, signing/integrity, and provenance/SBOM generation;
- Grafana/Scenes/runtime initialization, singleton ownership, leases, and cleanup;
- V1-to-Scenes conversion and any schema migration;
- panel/datasource/transformation module loading or executable registry initialization;
- datasource query execution, refresh, time range, transformation execution, and rendering;
- React component/session APIs, UID generation/state, stale-publication suppression, and lifecycle UI;
- cache, retry, ETag, stale-content, observability sink, or telemetry policy;
- V2, beta, legacy/raw API, other schema versions, Table, arbitrary variables/annotations/links, library panels, repeats, or additional datasources;
- authentication UI, credentials, login/session renewal, proxy/backend services, redirect policy, and CORS configuration;
- Jalali calendar behavior and public package publication.

## No Material Technical Conflict

The requested slice implements the exact Phase 1 ownership boundary: provider-contract supplies neutral manifest/transport vocabulary while provider-13 owns Grafana-specific discovery, DTO semantics, and static preflight. It does not require changes to issue #81/#83/#85/#87 contracts. Issue #89 and the expected branch now exist, so there is no remaining project-control blocker.

## Final Implementation Handoff

After execution, report:

- actual issue number and verified feature branch/baseline;
- exact changed and untracked files;
- final provider-13 exports and internal module structure;
- endpoint/discovery/UID/DTO/error/cancellation semantics;
- static profile, manifest-capability comparison, bounds, and result meaning;
- compile-time/runtime RED/GREEN evidence;
- fake transport and real Grafana fixture results;
- declaration/package/dependency/boundary evidence;
- root/POC regression results;
- independent-review findings and final verdict;
- deviations, remaining risks, and open questions;
- complete `git status --short` and diff summary;
- recommended commit message and PR title.

Leave everything uncommitted for review.
