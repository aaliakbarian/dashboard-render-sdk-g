# Provider-Contract Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the private, provider-neutral `@dashboard-render-sdk-g/provider-contract` workspace with immutable TypeScript metadata contracts and pure manifest validation for issue #81.

**Architecture:** The workspace contains only project-owned, serializable TypeScript types and a deterministic validator. It exposes an inert compatibility manifest, closed capability declarations, a descriptive runtime identity, and a metadata-only renderer-provider boundary; it imports no Grafana, Scenes, React, DOM, network, or POC implementation. Structural validation produces a deep-frozen clone and typed diagnostics but never performs runtime compatibility admission.

**Tech Stack:** TypeScript 6.0.2, Vitest 4.1.10, Yarn 4.17.1 workspaces, Node.js 22.23.3, Docker Compose.

**Spec:** GitHub issue #81 and the approved Phase 1 architecture in `docs/architecture/production/phase1-production-architecture-decision.md`.

## Global Constraints

- Work only on `phase2/provider-contract-foundation`, starting from a clean tree.
- Keep the workspace private, experimental, and `AGPL-3.0-only`; do not publish it.
- Add no runtime or development dependencies and change no pinned dependency versions.
- Use container-first commands; host Node.js and Yarn are not required.
- Keep the contract provider-neutral; Grafana is one target family represented by test data, not a hard-coded universal provider.
- The only verified example cell is Grafana OSS 13.2.3, source commit `6193dc03311b631b9727b560d24369e683dc396e`, Grafana packages 13.2.3, Scenes 8.13.5, React/ReactDOM 19.2.8, dashboard API `dashboard.grafana.app/v1`, schema 42, panels `text`/`stat`/`timeseries`, datasource `grafana-testdata-datasource`, and an empty or single-`renameByRegex` transformation pipeline.
- Do not claim that a structurally valid manifest is runtime-compatible or project-verified.
- Do not implement transport, authentication, Grafana runtime initialization, Scenes, rendering, sessions, dashboard retrieval/conversion, datasource execution, transformations, presentation, or publication.
- Do not invent a concrete provider-13 package version. Tests use clearly synthetic provider metadata around the verified compatibility-cell values.
- Do not modify disposable POC behavior or historical research.
- Leave all changes uncommitted; do not push, publish, create a PR, or merge.

## Review Focus

- Accessor properties, cyclic objects, sparse arrays, non-finite numbers, and non-plain objects must be rejected before validation can invoke or normalize them; Task 4 owns these tests.
- A manifest containing semver ranges, shorthand versions, or malformed exact versions must fail rather than widen compatibility; Task 3 owns these tests.
- Duplicate IDs across each closed catalogue and duplicate package/API/schema declarations must produce stable path-specific diagnostics; Task 3 owns these tests.
- Mutating either the caller input or a successful result after validation must not alter validated metadata; Task 4 owns these tests.
- A future non-Grafana target family with otherwise valid exact metadata must remain representable, and a structurally valid unverified target must not become an admission claim; Tasks 2 and 3 own these tests.

---

### Task 1: Scaffold and wire the private workspace

**Files:**

- Create: `packages/provider-contract/package.json`
- Create: `packages/provider-contract/tsconfig.json`
- Create: `packages/provider-contract/tsconfig.typecheck.json`
- Create: `packages/provider-contract/src/index.ts`
- Modify: `package.json`
- Modify: `tsconfig.base.json`
- Modify: `yarn.lock`

**Interfaces:**

- Consumes: root workspace pattern `packages/*`, root TypeScript composite settings, and the existing `tsc6`/Vitest toolchain.
- Produces: a dependency-free private workspace named `@dashboard-render-sdk-g/provider-contract`, versioned `0.0.0-private`, licensed `AGPL-3.0-only`, with package-local `build`, `typecheck`, and `test:unit` scripts.

- [ ] **Step 1: Add the workspace configuration**

  Create the package manifest and composite TypeScript build configuration, plus a no-emit typecheck configuration that includes compile-only type fixtures while keeping tests out of declaration output. Keep `dependencies` and `devDependencies` absent, export only `./src/index.ts`, and mark the package private. Add the package to root typecheck/unit-test orchestration and the root project-reference graph without changing existing POC commands beyond including this workspace.

- [ ] **Step 2: Refresh only workspace lock metadata**

  Run: `docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn install`

  Expected: exit 0; `yarn.lock` gains only the local workspace record and no pinned package version changes.

- [ ] **Step 3: Prove the scaffold is reproducible**

  Run: `docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn install --immutable`

  Expected: exit 0 with the existing Scenes/React peer warning still visible and unsuppressed.

- [ ] **Step 4: Inspect the lockfile and dependency boundary**

  Run: `git diff -- package.json tsconfig.base.json yarn.lock packages/provider-contract/package.json packages/provider-contract/tsconfig.json`

  Expected: no dependency-version drift and no Grafana, Scenes, React, DOM, or network dependency in the new workspace.

### Task 2: Define the minimal provider-neutral contract surface

**Files:**

- Create: `packages/provider-contract/src/contracts.type-test.ts`
- Create: `packages/provider-contract/src/contracts.ts`
- Modify: `packages/provider-contract/src/index.ts`

**Interfaces:**

- Consumes: only TypeScript built-ins.
- Produces: `ProviderCompatibilityManifest`, `ProviderCapabilities`, `RuntimeIdentity`, `RendererProvider`, exact-version/source/dependency/dashboard metadata types, `ProviderSupportTier`, and `PROVIDER_MANIFEST_SCHEMA_VERSION`.

- [ ] **Step 1: Write the failing compile-time contract test**

  Add a TypeScript-only fixture that constructs a provider-neutral manifest and metadata-only `RendererProvider`, constructs a minimal descriptive `RuntimeIdentity`, and proves that a non-Grafana target family is structurally representable. The Grafana example must use synthetic provider ID/version/build values while retaining the exact approved compatibility-cell values. Use `satisfies`/assignability checks rather than a Vitest assertion because interfaces are erased at runtime.

- [ ] **Step 2: Run the focused test to verify RED**

  Run: `docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn workspace @dashboard-render-sdk-g/provider-contract typecheck`

  Expected: FAIL because the contract exports do not yet exist.

- [ ] **Step 3: Implement the contract types**

  Define these implementation-neutral shapes in `contracts.ts` (all fields
  and arrays are `readonly`):

  ```ts
  const PROVIDER_MANIFEST_SCHEMA_VERSION = 1 as const;

  type ProviderSupportTier =
    | 'experimental'
    | 'verified'
    | 'supported'
    | 'deprecated';

  interface ExactVersionedDependency {
    readonly id: string;
    readonly version: string;
  }

  interface SourceProvenance {
    readonly repository: string;
    readonly tag?: string;
    readonly revision: string;
  }

  interface TargetCompatibilityCell {
    readonly version: string;
    readonly edition: string;
    readonly source: SourceProvenance;
  }

  interface ProviderCapabilities {
    readonly panels: readonly string[];
    readonly datasources: readonly string[];
    readonly transformations: {
      readonly ids: readonly string[];
      readonly allowEmptyPipeline: boolean;
      readonly maxChainLength: number;
    };
  }

  interface ProviderCompatibilityManifest {
    readonly schemaVersion: typeof PROVIDER_MANIFEST_SCHEMA_VERSION;
    readonly provider: {
      readonly id: string;
      readonly version: string;
      readonly buildId: string;
      readonly supportTier: ProviderSupportTier;
    };
    readonly target: {
      readonly family: string;
      readonly cells: readonly TargetCompatibilityCell[];
    };
    readonly provenance: { readonly recordId: string };
    readonly runtimeDependencies: readonly ExactVersionedDependency[];
    readonly host: {
      readonly reactVersion: string;
      readonly reactDomVersion: string;
    };
    readonly dashboards: {
      readonly apis: readonly {
        readonly group: string;
        readonly version: string;
      }[];
      readonly schemas: readonly {
        readonly family: string;
        readonly schemaVersion: number;
      }[];
      readonly lookup: string;
    };
    readonly capabilities: ProviderCapabilities;
  }

  interface RuntimeIdentity {
    readonly schemaVersion: 1;
    readonly provider: {
      readonly id: string;
      readonly buildId: string;
      readonly manifestDigest: string;
    };
    readonly target: {
      readonly family: string;
      readonly observedCompatibilityId: string;
    };
    readonly cohort: {
      readonly runtimeDependencies: readonly ExactVersionedDependency[];
      readonly reactRuntimeToken: string;
    };
    readonly isolationMode: 'single-compatible-realm-v1';
  }

  interface RendererProvider {
    readonly manifest: ProviderCompatibilityManifest;
  }
  ```

  The declarations above intentionally contain no executable provider,
  admission, transport, or rendering methods. Define and export them with these
  exact property names; split helper interfaces into named exports where that
  improves declaration readability.

  Specifically:

  - `ProviderCompatibilityManifest` with numeric schema version, provider `{ id, version, buildId, supportTier }`, generic target family plus exact target cells, provenance, exact provider-owned runtime dependencies, exact host React/ReactDOM versions, dashboard API/schema/lookup declarations, and `ProviderCapabilities`;
  - `ProviderCapabilities` with closed panel and datasource ID arrays plus transformation IDs, `allowEmptyPipeline`, and `maxChainLength`;
  - `RuntimeIdentity` as a deliberately minimal readonly, serializable descriptor: schema version, provider/build/manifest identity, observed target compatibility identity, exact cohort, opaque host React runtime token, and the approved initial isolation mode. Endpoint, transport, security-scope, presentation, and configuration identity are deferred to the later runtime-admission workstream rather than speculated here;
  - `RendererProvider` with only `readonly manifest: ProviderCompatibilityManifest`; no initialization or runtime methods;
  - `PROVIDER_MANIFEST_SCHEMA_VERSION = 1` and support-tier vocabulary from the approved version policy.

- [ ] **Step 4: Run the focused test to verify GREEN**

  Run: `docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn workspace @dashboard-render-sdk-g/provider-contract typecheck`

  Expected: PASS.

- [ ] **Step 5: Run package typecheck**

  Run: `docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn workspace @dashboard-render-sdk-g/provider-contract typecheck`

  Expected: exit 0 under strict TypeScript settings.

### Task 3: Validate exact structure, versions, dashboards, and capabilities

**Files:**

- Create: `packages/provider-contract/src/manifestValidation.test.ts`
- Create: `packages/provider-contract/src/manifestValidation.ts`
- Modify: `packages/provider-contract/src/index.ts`

**Interfaces:**

- Consumes: `ProviderCompatibilityManifest` and `PROVIDER_MANIFEST_SCHEMA_VERSION` from `contracts.ts`.
- Produces: `ManifestValidationErrorCode`, `ManifestValidationError`, `ManifestValidationSuccess`, `ManifestValidationFailure`, `ManifestValidationResult`, and `validateProviderCompatibilityManifest(input: unknown): ManifestValidationResult`.

- [ ] **Step 1: Write RED tests for a valid exact manifest and typed failures**

  Use hand-written literals to test the approved Grafana compatibility cell and failures for missing/unknown fields, unsupported schema version, empty/invalid identifiers, duplicate provider-owned dependencies and capability IDs, semver ranges/shorthand/malformed versions, duplicate dashboard APIs/schemas, non-positive or non-integer schema versions, and incoherent transformation limits. Add a structurally valid synthetic target version outside the verified cell and assert that validation succeeds without returning any runtime-admission or project-verification outcome.

- [ ] **Step 2: Run validation tests to verify RED**

  Run: `docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn exec vitest run packages/provider-contract/src/manifestValidation.test.ts --environment node`

  Expected: FAIL because `validateProviderCompatibilityManifest` and typed diagnostics do not exist.

- [ ] **Step 3: Implement minimal deterministic validation**

  Implement strict object-key validation and an exact SemVer parser without adding a dependency. Return a discriminated result:

  ```ts
  type ManifestValidationErrorCode =
    | 'non-serializable'
    | 'missing-field'
    | 'unknown-field'
    | 'invalid-field'
    | 'unsupported-manifest-version'
    | 'invalid-identifier'
    | 'duplicate-identifier'
    | 'invalid-exact-version'
    | 'invalid-dashboard-declaration'
    | 'invalid-capability';

  interface ManifestValidationError {
    readonly code: ManifestValidationErrorCode;
    readonly path: string;
    readonly message: string;
  }

  type ManifestValidationResult =
    | { readonly valid: true; readonly manifest: ProviderCompatibilityManifest }
    | { readonly valid: false; readonly errors: readonly ManifestValidationError[] };
  ```

  Diagnostics carry a stable code, JSON-style path, and actionable safe message. Use separate codes for non-serializable input, invalid/missing/unknown fields, unsupported manifest schema, invalid identifiers, duplicates, invalid exact versions, invalid dashboard declarations, and invalid capabilities. Structural success must not expose an admission or verification status beyond the manifest's declared metadata.

- [ ] **Step 4: Run validation tests to verify GREEN**

  Run: `docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn exec vitest run packages/provider-contract/src/manifestValidation.test.ts --environment node`

  Expected: PASS with deterministic ordered diagnostics.

- [ ] **Step 5: Refactor shared validation helpers while keeping tests green**

  Keep helpers private to `manifestValidation.ts`; do not create a generic schema framework or expose speculative validation APIs.

### Task 4: Enforce JSON safety, purity, and immutable validated results

**Files:**

- Modify: `packages/provider-contract/src/manifestValidation.test.ts`
- Modify: `packages/provider-contract/src/manifestValidation.ts`

**Interfaces:**

- Consumes: `validateProviderCompatibilityManifest(input)` from Task 3.
- Produces: validation that never mutates caller input, never invokes accessor properties, rejects non-JSON inputs, and returns a detached deeply frozen success value or deeply frozen diagnostics.

- [ ] **Step 1: Write RED tests for serialization and mutation boundaries**

  Add separate tests for `undefined`, function, symbol, bigint, `NaN`, infinity, cyclic objects, sparse arrays, accessor properties, `Date`, `Map`, and symbol-keyed properties. Add tests proving input mutation after success cannot change the validated manifest, nested result mutation is rejected/ineffective, repeated validation is structurally identical, and invalid input is not mutated.

- [ ] **Step 2: Run focused tests to verify RED**

  Run: `docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn exec vitest run packages/provider-contract/src/manifestValidation.test.ts --environment node`

  Expected: FAIL on the newly introduced serialization or mutation cases.

- [ ] **Step 3: Implement safe traversal, cloning, and freezing**

  Inspect property descriptors before reading values, accept only JSON primitives, dense arrays, and plain/null-prototype records, detect cycles, and reject accessors or non-string keys. After structural validation, create a detached plain-data clone and recursively freeze it. Freeze failure results and their diagnostic arrays as well.

- [ ] **Step 4: Run focused tests to verify GREEN**

  Run: `docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn workspace @dashboard-render-sdk-g/provider-contract test:unit`

  Expected: all provider-contract tests pass with no console warnings/errors.

### Task 5: Verify package boundaries and repository regressions

**Files:**

- Create: `scripts/check-provider-contract-boundary.test.mjs`
- Create: `scripts/check-provider-contract-boundary.mjs`
- Modify: `package.json`
- Modify only if other verification finds an issue: files already listed above.

**Interfaces:**

- Consumes: the completed provider-contract workspace.
- Produces: fresh evidence that issue #81 acceptance criteria hold without changing POC behavior.

- [ ] **Step 1: Write a failing static-boundary checker test**

  Use Node's built-in test runner and the already-installed TypeScript parser to prove that the checker reports bare-module imports in all relevant forms: value imports, `import type`, value re-exports, `export type`, dynamic `import()`, TypeScript import types, and CommonJS `require()`. Also prove that it reports `dependencies`, `devDependencies`, `peerDependencies`, and `optionalDependencies` in the provider-contract package manifest while allowing relative project-owned imports.

- [ ] **Step 2: Run the boundary test to verify RED**

  Run: `docker compose --env-file dev/grafana/.env run --rm --no-deps dev node --test scripts/check-provider-contract-boundary.test.mjs`

  Expected: FAIL because the checker module does not yet exist.

- [ ] **Step 3: Implement and run the static-boundary checker**

  Parse TypeScript source with the existing `typescript` package, walk the AST for every static/type-only/re-export/dynamic/import-type/require form above, and reject every non-relative module specifier inside `packages/provider-contract`. Check the package manifest for all four dependency sections. Expose pure checker helpers for the test and a CLI that exits nonzero with path/line/specifier diagnostics.

  Run:

  ```bash
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev node --test scripts/check-provider-contract-boundary.test.mjs
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev node scripts/check-provider-contract-boundary.mjs
  ```

  Expected: the test passes and the real package reports a clean dependency/import boundary.

- [ ] **Step 4: Verify immutable install and focused package behavior**

  Run:

  ```bash
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn install --immutable
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn workspace @dashboard-render-sdk-g/provider-contract test:unit
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn workspace @dashboard-render-sdk-g/provider-contract typecheck
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn workspace @dashboard-render-sdk-g/provider-contract build
  ```

  Expected: all commands exit 0; the known Scenes/React peer warning remains unchanged.

- [ ] **Step 5: Verify repository regressions**

  Run:

  ```bash
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn test:unit
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn typecheck
  ```

  Expected: all unit tests pass and repository typecheck exits 0.

- [ ] **Step 6: Verify the import/dependency boundary**

  Run:

  ```bash
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev node --test scripts/check-provider-contract-boundary.test.mjs
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev node scripts/check-provider-contract-boundary.mjs
  ```

  Expected: the checker proves coverage for value/type imports, re-exports, dynamic imports, TypeScript import types, CommonJS `require`, and all dependency sections; the real package passes. Review emitted declarations to confirm they reference only project-owned contract types.

- [ ] **Step 7: Verify diff integrity and scope**

  Run:

  ```bash
  git diff --check
  git status --short
  git diff --stat
  git ls-files --others --exclude-standard
  ```

  Expected: `git diff --check` exits 0; only the plan, provider-contract workspace, root orchestration/configuration, and workspace lock metadata are changed.

- [ ] **Step 8: Perform a requirements and code-review pass**

  Review the complete diff against issue #81 and this plan. Treat critical/important findings as blocking, fix them through a new failing test, and rerun the relevant focused and repository verification before the final handoff.

