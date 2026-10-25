# Core SDK Skeleton Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:test-driven-development` while implementing each behavior, and use `superpowers:executing-plans` or `superpowers:subagent-driven-development` to execute this plan task by task. Do not commit; leave the completed working tree for human review.

**Goal:** Create the private, non-rendering `@dashboard-render-sdk-g/core` workspace for issue #83, with an explicit host-supplied provider configuration and a small provider-metadata inspection boundary that delegates structural validation to `@dashboard-render-sdk-g/provider-contract`.

**Architecture:** Core is a provider-neutral frontend orchestration boundary. In this issue it accepts one explicit `RendererProvider`, reads only that provider's inert manifest, and delegates validation to the canonical provider-contract validator. It neither creates a runtime nor decides runtime compatibility. No registry, renderer, React API, transport, authentication, Grafana dependency, or provider-13 implementation is introduced. The future React-first API is documented as design intent only.

**Tech Stack:** TypeScript 6.0.2, Vitest 4.1.10, Yarn 4.17.1 workspaces, Node.js 22.23.3, Docker Compose.

**Spec:** [GitHub issue #83](https://github.com/aaliakbarian/dashboard-render-sdk-g/issues/83), `docs/architecture/production/phase1-production-architecture-decision.md`, and the merged provider-contract baseline at commit `93c7750`.

## Global constraints

- Work only on `phase2/core-sdk-skeleton`, based on `93c7750`.
- Keep the package private, experimental, versioned `0.0.0-private`, and licensed `AGPL-3.0-only`.
- Use only the existing pinned repository toolchain. Add no third-party dependency and change no pinned dependency version.
- Add exactly one package dependency: `@dashboard-render-sdk-g/provider-contract` through Yarn's `workspace:*` protocol.
- Keep core provider-neutral. Production core source must not import Grafana packages, Scenes, `provider-13`, Grafana application source, POC packages, React, or ReactDOM.
- Treat the host-supplied provider as explicit trusted executable configuration. This issue validates its inert manifest data; it does not sandbox provider code or prove runtime object compatibility.
- Structural manifest validity is not runtime compatibility admission, support verification, or permission to initialize a provider.
- Do not implement runtime acquisition/admission, dashboard sessions, rendering, React components/hooks, authentication, transport execution, backend services, calendars, plugin discovery, or publication.
- Do not modify Phase 0 POC behavior. Existing POC regression commands must remain green.
- Run Node.js, Yarn, TypeScript, Vitest, and build commands only through Docker Compose. Do not use `rg` or `jq`; use Git, `grep`, Node.js, and repository scripts.
- Do not commit, push, publish, create a PR, or merge while executing this plan.

## Design decision: metadata inspection without a second validator

The issue requires a useful core responsibility, but a function that merely accepts a manifest and reimplements provider-contract validation would add no value and could drift. The smallest justified core boundary instead accepts the core's explicit provider configuration and inspects the configured provider's manifest through the existing canonical validator.

Core will not define new manifest fields, compatibility cells, validation error codes, or an admission result. It will alias the canonical validation result so callers receive the existing typed structural failures unchanged. Core's added responsibility is selection of the explicitly configured provider and presentation of its validated, detached, immutable manifest snapshot at the core boundary.

The initial public TypeScript surface is:

```ts
import type {
  ManifestValidationResult,
  RendererProvider,
} from '@dashboard-render-sdk-g/provider-contract';

export interface CoreSdkConfiguration {
  readonly provider: RendererProvider;
}

export type ProviderMetadataInspectionResult = ManifestValidationResult;

export function inspectConfiguredProvider(
  configuration: CoreSdkConfiguration
): ProviderMetadataInspectionResult;
```

`inspectConfiguredProvider` must call `validateProviderCompatibilityManifest(configuration.provider.manifest)` and return that result without translating, widening, or relabelling it. A `valid: true` result means only that the manifest is structurally valid. Runtime compatibility admission remains deferred.

No `DashboardSdk` instance, factory, provider resolver, or registry is exported in this issue. Inventing such a handle before runtime-admission and lifecycle responsibilities exist would make a nonfunctional API appear stable. The future `sdk` prop is documented but its concrete creation API remains a later design decision.

## Planned file set

Create:

- `packages/core/package.json`
- `packages/core/tsconfig.json`
- `packages/core/tsconfig.typecheck.json`
- `packages/core/README.md`
- `packages/core/src/contracts.ts`
- `packages/core/src/contracts.type-test.ts`
- `packages/core/src/inspectConfiguredProvider.ts`
- `packages/core/src/inspectConfiguredProvider.test.ts`
- `packages/core/src/index.ts`
- `scripts/check-core-boundary.mjs`
- `scripts/check-core-boundary.test.mjs`

Modify:

- `package.json`
- `tsconfig.base.json`
- `yarn.lock`

Do not create React source files, runtime files, transport files, calendar files, or provider registries.

---

### Task 1: Scaffold and wire the private core workspace

**Files:**

- Create: `packages/core/package.json`
- Create: `packages/core/tsconfig.json`
- Create: `packages/core/tsconfig.typecheck.json`
- Create: `packages/core/src/index.ts`
- Modify: `package.json`
- Modify: `tsconfig.base.json`
- Modify: `yarn.lock`

**Package policy:**

- Name: `@dashboard-render-sdk-g/core`
- Version: `0.0.0-private`
- Private: `true`
- License: `AGPL-3.0-only`
- Module type: `module`
- Export map: only `".": "./src/index.ts"`
- Runtime dependencies: exactly `"@dashboard-render-sdk-g/provider-contract": "workspace:*"`
- No peer, optional, or package-local development dependencies
- No React dependency yet: issue #83 exports no React implementation or React type

- [ ] **Step 1: Add the package scaffold**

  Mirror the merged provider-contract package conventions. Configure a composite declaration-only production build in `tsconfig.json`, and a separate no-emit `tsconfig.typecheck.json` that includes compile-time fixtures and tests. Keep `types: []`, `jsx: "preserve"`, strict settings inherited from the root, and tests/type-tests out of declaration output.

- [ ] **Step 2: Wire root orchestration**

  Add core after provider-contract in the root project-reference graph and root typecheck/test orchestration. Add `check:core-boundary` to root scripts. Do not reorder or remove POC workspaces and do not alter existing test selections except to include the new core checks.

- [ ] **Step 3: Refresh only workspace lock metadata**

  Run:

  ```sh
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn install
  ```

  Expected: exit 0; `yarn.lock` gains the private core workspace record and its local provider-contract workspace link, with no third-party version changes. Existing React/Scenes peer warnings remain visible and unsuppressed.

- [ ] **Step 4: Prove reproducibility**

  Run:

  ```sh
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn install --immutable
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn workspace @dashboard-render-sdk-g/core build
  ```

  Expected: both commands pass. The first build may emit only declarations and build metadata; it must not emit a renderer or browser bundle.

- [ ] **Step 5: Inspect dependency drift**

  Run:

  ```sh
  git diff -- package.json tsconfig.base.json yarn.lock packages/core/package.json packages/core/tsconfig.json packages/core/tsconfig.typecheck.json
  grep -nE '(@grafana/|@dashboard-render-sdk-g/provider-13|react|react-dom)' packages/core/package.json || true
  ```

  Expected: the only package dependency is the local provider-contract workspace, and no pinned third-party version changes.

---

### Task 2: Define the minimal core contracts with compile-time TDD

**Files:**

- Create: `packages/core/src/contracts.type-test.ts`
- Create: `packages/core/src/contracts.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**

```ts
interface CoreSdkConfiguration {
  readonly provider: RendererProvider;
}

type ProviderMetadataInspectionResult = ManifestValidationResult;
```

- [ ] **Step 1: Write the failing compile-time contract fixture**

  The type-only fixture must prove:

  - `CoreSdkConfiguration` requires exactly an explicit `RendererProvider` at its public boundary;
  - a merged provider-contract `RendererProvider` is assignable without Grafana- or React-specific types;
  - `ProviderMetadataInspectionResult` narrows on `valid` to the canonical success/failure variants;
  - validation errors retain the provider-contract error-code/path/message types;
  - a structurally valid result has no `compatible`, `admitted`, `verified`, runtime lease, or renderer property (use `@ts-expect-error` checks);
  - no duplicate core compatibility-manifest shape is introduced.

- [ ] **Step 2: Verify RED with TypeScript, not Vitest**

  Run:

  ```sh
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn workspace @dashboard-render-sdk-g/core typecheck
  ```

  Expected: FAIL because the core contracts are not yet exported.

- [ ] **Step 3: Implement only the contract aliases/configuration**

  Import `RendererProvider` and `ManifestValidationResult` from the provider-contract public export. Define the readonly configuration interface and exact result alias above. Do not copy manifest, provider, runtime-identity, or validation-error definitions into core. Export only the core-owned names from `src/index.ts`; do not convenience-re-export provider-contract.

- [ ] **Step 4: Verify GREEN**

  Run:

  ```sh
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn workspace @dashboard-render-sdk-g/core typecheck
  ```

  Expected: PASS, proving the type-only contract fixture is checked by TypeScript.

- [ ] **Step 5: Prove the type-only fixture is in the effective program but not declaration output**

  Run the actual typecheck configuration with TypeScript's file-list output and the production build with emitted-file output:

  ```sh
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn tsc6 --project packages/core/tsconfig.typecheck.json --pretty false --listFilesOnly | grep '/packages/core/src/contracts.type-test.ts$'
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn tsc6 --build packages/core/tsconfig.json --pretty false --force --listEmittedFiles
  ```

  Expected: the first command prints `contracts.type-test.ts`, proving the compile-time assertions execute. The production emitted-file list contains no `contracts.type-test` declaration, source map, or JavaScript output. Inspect the emitted list with `grep` and fail the step if any type-test artifact is present.

---

### Task 3: Add deterministic configured-provider inspection with runtime TDD

**Files:**

- Create: `packages/core/src/inspectConfiguredProvider.test.ts`
- Create: `packages/core/src/inspectConfiguredProvider.ts`
- Modify: `packages/core/src/index.ts`
- Modify: `package.json`

**Function:**

```ts
function inspectConfiguredProvider(
  configuration: CoreSdkConfiguration
): ProviderMetadataInspectionResult;
```

- [ ] **Step 1: Write focused RED tests**

  Use provider-neutral synthetic manifests plus exact provider-contract helpers. Cover:

  1. a valid configured provider returns the canonical `valid: true` result;
  2. the returned manifest is detached from the caller's manifest and deeply frozen, relying on the canonical validator's guarantees;
  3. repeated inspection of unchanged configuration is structurally deterministic and creates no global provider registry/cache;
  4. malformed provider metadata returns the canonical typed validation failure with deterministic errors;
  5. core returns exactly the same validation semantics as `validateProviderCompatibilityManifest`, including malformed proxy/reflection inputs already handled by provider-contract;
  6. a structurally valid but unverified target remains `valid: true` without any runtime compatibility/admission claim;
  7. inspection does not call provider initialization, transport, rendering, authentication, or lifecycle methods (none exist on the merged `RendererProvider` contract).
  8. a provider manifest accessor is read exactly once per inspection call.

  Keep malformed configuration-object shape and sandboxing of arbitrary provider getters out of scope: the explicit provider is trusted host-supplied executable configuration. Core does not promise to prevent provider code or a throwing/malicious `manifest` getter from executing. Once the manifest value has been read exactly once, that value remains hostile-data-safe under provider-contract validation.

- [ ] **Step 2: Verify RED**

  Run:

  ```sh
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn exec vitest run packages/core/src/inspectConfiguredProvider.test.ts --environment node
  ```

  Expected: FAIL because the inspection function does not exist.

- [ ] **Step 3: Implement the one-step delegation**

  Read `configuration.provider.manifest` once and pass that value directly to `validateProviderCompatibilityManifest`. Return its discriminated result unchanged. Add TSDoc that explicitly says:

  - validation is structural only;
  - success does not admit a runtime or prove compatibility;
  - no provider code is initialized;
  - the configured provider is trusted host-supplied executable configuration, and core does not sandbox arbitrary provider objects or throwing getters;
  - the manifest property is read once per call before canonical validation;
  - authentication/connectivity remain host-owned;
  - the function has no registry or process-wide state.

  Do not catch and relabel canonical manifest errors, compute runtime identity, compare React objects/versions, or retain the provider.

- [ ] **Step 4: Verify GREEN and package integration**

  Run:

  ```sh
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn exec vitest run packages/core/src/inspectConfiguredProvider.test.ts --environment node
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn workspace @dashboard-render-sdk-g/core typecheck
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn workspace @dashboard-render-sdk-g/core build
  ```

  Expected: all pass. Emitted declarations contain only core and provider-contract references.

- [ ] **Step 5: Add core to root unit regression orchestration**

  Place `yarn workspace @dashboard-render-sdk-g/core test:unit` after provider-contract's unit tests. Do not change the existing POC test list otherwise.

---

### Task 4: Document the current boundary and future React-first API

**Files:**

- Create: `packages/core/README.md`

- [ ] **Step 1: Document what exists now**

  State that the package is private, experimental, non-rendering, AGPL-3.0-only, and not published. Document the current `CoreSdkConfiguration` and `inspectConfiguredProvider` behavior, including that `valid: true` is structural validation only.

- [ ] **Step 2: Document future design without exporting placeholders**

  Include this conceptual, explicitly nonfunctional API:

  ```tsx
  <GrafanaDashboard sdk={sdk} uid={uid} calendar="jalali" />
  ```

  Record these decisions:

  - React is the first intended integration surface.
  - `uid` is a normal Grafana dashboard UID and may change through React props.
  - `calendar` will accept `gregorian` or `jalali` and default to `gregorian`.
  - Jalali affects only the dashboard date/time picker; it does not change panel date formatting and does not select a timezone.
  - The concrete SDK factory/handle, dashboard component, hooks, rendering/session behavior, and calendar implementation are not part of issue #83.
  - An imperative DOM mounting API is deferred.

  Do not add TSX, React types, React peer dependencies, placeholder exports, or examples that appear runnable.

- [ ] **Step 3: Validate documentation links/claims**

  Run a small Node.js link check over `packages/core/README.md` if it contains local links, then inspect it with:

  ```sh
  grep -nE '(GrafanaApp|@grafana/|@grafana/scenes|provider-13|createRoot|mount\()' packages/core/README.md || true
  ```

  Expected: only descriptive exclusions/future design references, never an implemented dependency or runnable rendering claim.

---

### Task 5: Enforce the core dependency/import boundary

**Files:**

- Create: `scripts/check-core-boundary.test.mjs`
- Create: `scripts/check-core-boundary.mjs`
- Modify: `scripts/check-provider-contract-boundary.mjs` only if a narrow extraction is required to reuse its hardened production-graph traversal
- Modify: `scripts/check-provider-contract-boundary.test.mjs` only to preserve/prove behavior across that narrow extraction
- Modify: `package.json`

**Policy:**

- The package manifest permits exactly one dependency: `@dashboard-render-sdk-g/provider-contract: workspace:*`.
- Production TypeScript may statically import values/types only from the provider-contract public package root and relative core modules.
- Provider-contract subpath imports and re-exports are rejected; core must use the existing public contract surface without becoming a second export facade.
- All Grafana/Scenes packages, `provider-13`, POC workspaces, React/ReactDOM, router/UI packages, Node-only packages, and other external dependencies are rejected.
- Dynamic imports, CommonJS `require`, import-equals, triple-slash package references, compiler-injected external helpers/types/plugins, JSX runtime injection, and imports from test/type-test files into production are rejected.
- Effective production roots come from `packages/core/tsconfig.json`, not filename grep alone.

- [ ] **Step 1: Write RED tests for the checker**

  Before writing the core checker, read `scripts/check-provider-contract-boundary.mjs` and its complete test file. Reuse its existing TypeScript AST reference detection, effective `tsconfig` parsing, relative-module resolution, test-module detection, synthesized dependency checks, deterministic sorting, and fail-closed behavior where practical.

  Build temporary package fixtures and verify:

  - exact static value and type imports from provider-contract pass;
  - unrelated external imports fail;
  - Grafana, Scenes, provider-13, React, ReactDOM, and POC imports fail;
  - provider-contract subpaths and re-exports fail;
  - dynamic imports, `require`, import-equals, type-only forbidden imports, and triple-slash references fail;
  - effective TypeScript roots and imported excluded/test-like files are checked;
  - JSX/compiler helpers/types/plugins cannot synthesize undeclared dependencies;
  - missing/unresolved local modules fail closed;
  - dependency sections other than the exact workspace dependency fail;
  - the real core package passes once implementation is complete.

- [ ] **Step 2: Verify RED**

  Run:

  ```sh
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev node --test scripts/check-core-boundary.test.mjs
  ```

  Expected: FAIL because the checker does not exist.

- [ ] **Step 3: Implement a core-specific static checker**

  Use the TypeScript compiler API already present in the root workspace to inspect the effective production graph and all relevant module-reference forms. Prefer a narrow exported internal traversal helper in the existing provider-contract checker if that avoids copying its hardened graph walk; keep the existing `inspectProviderContractBoundary` public behavior and CLI output unchanged. Do not create a general-purpose policy framework, rename the existing checker, or broadly refactor stable provider-contract code. The new core checker owns only the different core policy: one permitted workspace dependency and limited static imports from its public package root.

  Preserve and rerun every existing provider-contract boundary test before accepting the extraction. If reuse would require a risky broad refactor, record a ruling and keep the smallest core-specific wrapper around the already exported inspection primitives instead of duplicating the full traversal.

  Diagnostics must be deterministic, identify the file/reference or manifest field, and exit nonzero on policy violations. The checker validates dependency/import boundaries only; it must not claim runtime compatibility.

- [ ] **Step 4: Verify GREEN and run both boundary guards**

  Run:

  ```sh
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev node --test scripts/check-core-boundary.test.mjs
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn check:core-boundary
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn check:provider-contract-boundary
  ```

  Expected: all pass. The provider-contract guard remains unchanged and green.

---

### Task 6: Run complete verification and independent review

**Files:** No planned production changes. Fix only defects within the issue #83 file set if verification or review finds them.

- [ ] **Step 1: Run the focused package suite**

  ```sh
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn install --immutable
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn workspace @dashboard-render-sdk-g/provider-contract typecheck
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn workspace @dashboard-render-sdk-g/provider-contract test:unit
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn workspace @dashboard-render-sdk-g/core typecheck
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn workspace @dashboard-render-sdk-g/core test:unit
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn workspace @dashboard-render-sdk-g/core build
  ```

  Expected: all pass.

- [ ] **Step 2: Run root regressions**

  ```sh
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn typecheck
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn test:unit
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn test:integration
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn build:poc
  ```

  Expected: provider-contract, core, and the existing POC all remain green. Browser/E2E rendering is not required because this issue adds no browser/rendering behavior.

- [ ] **Step 3: Run static and repository checks**

  ```sh
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn check:provider-contract-boundary
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn check:core-boundary
  git diff --check
  git status --short
  git ls-files --others --exclude-standard
  grep -RInE '(@grafana/|@grafana/scenes|provider-13|GrafanaApp|react-dom|from ["'"']react["'"']|import\(["'"']react)' packages/core --exclude='README.md' || true
  ```

  Expected: no whitespace errors; all intended untracked files are included in review; no forbidden production references or unexpected files.

- [ ] **Step 4: Inspect declaration and lock output**

  Use `find`, `grep`, `git diff`, and Node.js scripts to confirm:

  - declarations expose only the planned three core symbols;
  - no React component/hook/factory/registry/lifecycle symbol leaked;
  - emitted declarations reference only provider-contract and relative core types;
  - `yarn.lock` changed only for the local core workspace and link;
  - no credential, token, cookie, authorization header, Grafana endpoint, or backend implementation was introduced.

- [ ] **Step 5: Request an independent whole-branch code review**

  Review the actual diff and every untracked file against issue #83, this plan, and the Phase 1 architecture. Include correctness, API minimality, structural-vs-admission semantics, package exports, dependency declarations, TypeScript configurations, tests, and static-boundary false negatives. Resolve only justified findings within scope, rerun affected checks, and leave the tree uncommitted.

## Acceptance criteria mapping

| Issue #83 requirement | Planned evidence |
| --- | --- |
| Private AGPL core workspace | Task 1 manifest, workspace link, immutable install |
| Consume provider-contract | Exact `workspace:*` dependency and public-root imports in Tasks 1–3 |
| Explicit host-supplied provider | `CoreSdkConfiguration.provider` compile-time contract |
| Minimal useful metadata inspection | `inspectConfiguredProvider` delegates configured manifest validation |
| Typed invalid-metadata result | Exact `ManifestValidationResult` alias and Task 3 failure tests |
| No duplicate validator/model | No core manifest/error definitions; semantic parity tests |
| Structural validity is not admission | Type tests, TSDoc, unit test, and README assertions |
| Provider-neutral / no Grafana or React implementation | Task 5 import/dependency guard |
| No runtime/rendering/transport/auth/backend | Minimal source set, exclusions, boundary audit, independent review |
| Future React-first API documented | Task 4 conceptual API and UID/calendar semantics |
| Focused tests and repository regressions | Tasks 2, 3, 5, and 6 |
| Reviewable complete working tree | `git status`, untracked-file listing, diff checks, independent review |

## Open design questions deliberately deferred

1. **SDK handle/factory name and lifecycle:** Do not export `DashboardSdk`, `createSdk`, or similar until runtime admission and session ownership give that object real behavior.
2. **Provider resolution:** Issue #83 accepts one explicit provider instance. Host resolvers, multiple provider families, and provider registries are later decisions; no global registry is justified now.
3. **Runtime compatibility admission:** React object identity, exact version cell selection, runtime identity conflicts, provider initialization, and lease management remain provider/runtime work, not metadata inspection.
4. **React package boundary:** React/ReactDOM peer dependencies, component exports, hooks, StrictMode behavior, and the concrete `sdk` prop type are deferred until a functioning React integration is implemented.
5. **Transport/authentication:** The host continues to own authenticated connectivity. The eventual shape of a host transport capability is not guessed here.
6. **Calendar contract placement:** The `gregorian | jalali` prop vocabulary is documented, but no shared type is exported until the date/time picker component exists.
7. **Provider object hostility:** Provider-contract validates hostile manifest data. A host-selected provider is executable trusted configuration; sandboxing arbitrary provider getters/proxies is not promised by this skeleton.

No item above blocks the bounded package, configuration type, canonical metadata inspection, or static dependency guard planned for issue #83.

## Final implementation handoff

After execution, report:

- exact changed and untracked files;
- final exported TypeScript interfaces/functions;
- how metadata validation delegates to provider-contract;
- RED/GREEN evidence and actual command results;
- package/export/dependency boundary results;
- root regression results;
- deviations from this plan;
- remaining risks/open questions;
- `git status --short` and diff summary;
- a recommended commit message and PR title.

Leave everything uncommitted for review.
