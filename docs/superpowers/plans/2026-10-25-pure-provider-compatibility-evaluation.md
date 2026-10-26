# Pure Provider Compatibility Evaluation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:test-driven-development` while implementing each behavior, and use `superpowers:executing-plans` or `superpowers:subagent-driven-development` to execute this plan task by task. After implementation and verification, use `superpowers:requesting-code-review` for a fresh-context whole-branch review. Do not commit; leave the completed working tree for human review.

**Goal:** Implement issue #85 Stage A: a provider-neutral, side-effect-free comparison of a canonically validated provider manifest with explicit target, host-version, and provider-runtime-dependency observations.

**Architecture:** `@dashboard-render-sdk-g/provider-contract` owns the neutral observation and result vocabulary. `@dashboard-render-sdk-g/core` owns one pure evaluator that consumes `ManifestValidationSuccess`, snapshots and validates only the bounded observation shape, compares exact declared metadata, and returns detached immutable diagnostics. A successful metadata comparison is not runtime compatibility admission; provider execution, evidence acquisition, transport, physical React identity, `RuntimeIdentity`, and lifecycle ownership remain deferred.

**Tech Stack:** TypeScript 6.0.2, Vitest 4.1.10, Yarn 4.17.1 workspaces, Node.js 22.23.3, Docker Compose.

**Spec:** [GitHub issue #85](https://github.com/aaliakbarian/dashboard-render-sdk-g/issues/85), `docs/architecture/production/phase1-production-architecture-decision.md`, `docs/architecture/production/bridge-provider-architecture.md`, `docs/architecture/production/runtime-isolation-model.md`, `docs/architecture/production/grafana-version-compatibility-policy.md`, and `docs/architecture/production/react-scenes-compatibility-policy.md`.

## Global Constraints

- Work only on `phase2/pure-compatibility-evaluation`, based on `8ec33af`.
- Extend only the existing private `@dashboard-render-sdk-g/provider-contract` and `@dashboard-render-sdk-g/core` workspaces; create no new package.
- Keep both packages private, experimental, `0.0.0-private`, and `AGPL-3.0-only`.
- Add no dependency and change no pinned dependency version, package resolution, workspace layout, or lockfile content.
- Keep provider-contract and core provider-neutral. Production source must not import Grafana, Scenes, React, ReactDOM, provider-13, POC packages, browser transport implementations, or application source.
- Use the canonical `ManifestValidationSuccess`; do not copy or rerun `validateProviderCompatibilityManifest` inside the evaluator and do not create a second manifest schema.
- A `declared-requirements-match` result means only that the supplied metadata exactly matches declarations in the validated manifest. It is not verification, support-tier promotion, runtime admission, or permission to initialize Grafana.
- Do not construct `RuntimeIdentity`, probe React object identity, access a configured provider, perform network work, initialize runtime modules, mutate global state, create a registry/cache, or retain observations.
- Source provenance (`TargetCompatibilityCell.source`) and a running Grafana artifact/`BuildCommit` are distinct. Stage A neither accepts nor compares runtime build identity.
- Runtime dependency observations are caller-supplied comparison inputs, not independently verified evidence. Their acquisition and authority remain deferred.
- Reuse one provider-contract exact-version predicate for both manifest validation and observation validation. Do not duplicate the exact-version grammar or add a semver dependency.
- Bound observation reflection and diagnostics with the same conservative constants used by the manifest validator: at most 1,024 array entries, 1,024 own properties per inspected container, and 100 returned checks. The observation schema is fixed-depth and non-recursive, so it needs no recursive traversal budget.
- Use Docker Compose for every Node.js, Yarn, TypeScript, Vitest, and build command. Do not install tools or dependencies on WSL and do not use unavailable `rg` or `jq`.
- Preserve all existing provider-contract, core-boundary, and Phase 0 POC behavior.
- Do not commit, push, publish, open a PR, or merge while executing this plan.

## Review Focus

- A manifest with two cells sharing a version but using different editions must match only an exact version/edition pair; it must never form a cross-cell match.
- A malformed, accessor-backed, sparse, symbol-keyed, proxy, or duplicate-dependency observation must fail closed as `invalid-observations`; reflection failures are caught, although JavaScript proxy traps cannot be prevented from executing.
- A dependency list with identical entries in different orders must compare identically, while missing, unexpected, duplicated, or version-mismatched IDs remain separately diagnosable.
- An experimental provider whose metadata matches must remain only `declared-requirements-match`; no `compatible`, `verified`, `admitted`, `RuntimeIdentity`, or lease surface may appear.
- Source tag/revision changes and runtime build identifiers must not become comparison axes in Stage A; target matching uses only family plus the exact version/edition cell.

## Approved API and Semantics

Add the following provider-contract vocabulary, using the existing `ExactVersionedDependency` and `TargetCompatibilityCell` rather than parallel shapes:

```ts
export interface CompatibilityObservations {
  readonly target?: {
    readonly family?: string;
    readonly version?: string;
    readonly edition?: string;
  };
  readonly host?: {
    readonly reactVersion?: string;
    readonly reactDomVersion?: string;
  };
  readonly runtimeDependencies?: readonly ExactVersionedDependency[];
}

export type CompatibilityEvaluationOutcome =
  | 'declared-requirements-match'
  | 'mismatch'
  | 'insufficient-evidence'
  | 'invalid-observations';

export type CompatibilityEvaluationCheckStatus =
  | 'match'
  | 'mismatch'
  | 'missing-evidence'
  | 'invalid-observation';

export interface CompatibilityEvaluationCheck {
  readonly path: string;
  readonly status: CompatibilityEvaluationCheckStatus;
  readonly expected?: string;
  readonly observed?: string;
}

export interface CompatibilityEvaluationResult {
  readonly outcome: CompatibilityEvaluationOutcome;
  readonly checks: readonly CompatibilityEvaluationCheck[];
  readonly matchedTargetCell?: TargetCompatibilityCell;
}
```

Core exports the function, but does not convenience-re-export provider-contract types:

```ts
export function evaluateProviderCompatibility(
  inspection: ManifestValidationSuccess,
  observations: CompatibilityObservations
): CompatibilityEvaluationResult;
```

Callers first use the existing `inspectConfiguredProvider`. They narrow its canonical result on `valid`, then pass the `ManifestValidationSuccess` into the evaluator. The function does not accept `CoreSdkConfiguration` or `RendererProvider`, so evaluation cannot reread a provider getter or initialize provider behavior.

### Observation validity

- The observation root, when evaluated at runtime, must be a plain record with only `target`, `host`, and `runtimeDependencies` own enumerable data properties.
- Present `target` and `host` values must be plain records containing only their declared optional fields.
- Missing records or fields are valid missing evidence. `undefined` is treated as absent.
- Present non-version scalar fields must be non-empty strings. Non-string or empty values are invalid observations.
- Present version fields must satisfy the provider-contract's existing exact-version grammar. Valid exact versions compare literally: equality is `match`, and a different valid exact version is `mismatch`. Semver ranges, wildcards, partial versions, empty strings, non-strings, and malformed exact-version syntax are `invalid-observation`; no range inference is added.
- A present `runtimeDependencies` value must be a dense array of plain `{ id, version }` data records with non-empty string fields, no unknown/symbol fields, and unique IDs. Structural failures or duplicate IDs are invalid observations.
- Observation arrays longer than 1,024 entries and inspected records exposing more than 1,024 own properties are deterministic `invalid-observation` limit failures. Array length is checked before indexed traversal, so large sparse arrays do not trigger length-proportional work.
- At most 100 checks are returned. If additional diagnostics would be produced, the final slot is a deterministic `invalid-observation` limit check and remaining diagnostics are omitted; this makes diagnostic exhaustion fail closed without unbounded output.
- Non-enumerable or symbol-keyed properties are invalid. Optional own data properties whose value is `undefined` are treated as missing evidence; accessor-backed properties are invalid and are not invoked when ordinary descriptors expose them.
- Accessors are rejected without invocation where ordinary descriptors permit. Reflection failures are converted to deterministic `invalid-observation` checks. Proxy traps may execute during required reflection; the API makes no stronger sandboxing claim.
- No general-purpose observation-schema framework or reusable arbitrary-object validator is introduced.

### Comparison and diagnostic order

Produce checks in this fixed order:

1. `$.target.family`;
2. missing/invalid `$.target.version` and `$.target.edition`, or one `$.target.cell` check for the exact `edition/version` pair;
3. `$.host.reactVersion`;
4. `$.host.reactDomVersion`;
5. `$.runtimeDependencies`, when the collection itself is missing/invalid;
6. otherwise dependency checks ordered lexicographically by dependency ID, using `$.runtimeDependencies[<JSON-encoded-id>]` paths.

Target family must match exactly. Version and edition select one existing `TargetCompatibilityCell` as a pair; never compare the two fields independently across different cells. `matchedTargetCell` is present only when both the family check and exact cell-pair check match. The cell's `source` is copied into that field as provenance metadata but is not a comparison axis.

Dependency comparison is an exact, order-independent set comparison. For each sorted ID:

- same ID and version: `match`;
- manifest ID absent from observations: `mismatch` with expected version only;
- observation ID absent from manifest: `mismatch` with observed version only;
- same ID with another version: `mismatch` with both versions.

Outcome precedence is independent of check ordering:

1. any `invalid-observation` → `invalid-observations`;
2. otherwise any `mismatch` → `mismatch`;
3. otherwise any `missing-evidence` → `insufficient-evidence`;
4. otherwise → `declared-requirements-match`.

The evaluator returns a fresh, deeply frozen result and retains no caller objects. `matchedTargetCell`, when present, is a detached frozen copy. Repeated evaluation is deeply equal but does not reuse a process-wide result or cache.

## Planned File Set

Create:

- `packages/provider-contract/src/exactVersion.ts`
- `packages/core/src/evaluateProviderCompatibility.ts`
- `packages/core/src/evaluateProviderCompatibility.test.ts`

Modify:

- `packages/provider-contract/src/contracts.ts`
- `packages/provider-contract/src/contracts.type-test.ts`
- `packages/provider-contract/src/manifestValidation.ts`
- `packages/provider-contract/src/manifestValidation.test.ts`
- `packages/provider-contract/src/index.ts`
- `packages/core/src/contracts.type-test.ts`
- `packages/core/src/index.ts`
- `packages/core/package.json`
- `packages/core/README.md`

Expected unchanged but blocking verification inputs:

- `scripts/check-provider-contract-boundary.mjs`
- `scripts/check-provider-contract-boundary.test.mjs`
- `scripts/check-core-boundary.mjs`
- `scripts/check-core-boundary.test.mjs`
- root `package.json`, TypeScript configurations, `yarn.lock`, and all POC source/tests

The manifest validator changes only to consume the extracted exact-version predicate; its schema, limits, errors, and behavior remain unchanged. If implementation proves that another listed unchanged file must change, stop and obtain review rather than widening this plan implicitly.

---

### Task 1: Add provider-neutral observation and result vocabulary

**Files:**

- Modify: `packages/provider-contract/src/contracts.type-test.ts`
- Modify: `packages/provider-contract/src/contracts.ts`
- Modify: `packages/provider-contract/src/index.ts`

**Interfaces:**

- Consumes: existing `ExactVersionedDependency` and `TargetCompatibilityCell`.
- Produces: `CompatibilityObservations`, `CompatibilityEvaluationOutcome`, `CompatibilityEvaluationCheckStatus`, `CompatibilityEvaluationCheck`, and `CompatibilityEvaluationResult` exactly as specified above.

- [ ] **Step 1: Write compile-time RED assertions**

  Extend `contracts.type-test.ts` to assert:

  - partial observation groups allow genuinely missing evidence;
  - dependency observations reuse `ExactVersionedDependency`;
  - the four outcomes and four check statuses are closed literal unions;
  - `matchedTargetCell` uses the existing target-cell type;
  - all nested arrays and properties are readonly;
  - result types expose no `compatible`, `verified`, `admitted`, `runtimeIdentity`, `runtimeLease`, or renderer field, using `@ts-expect-error` checks;
  - source provenance has no runtime `buildCommit` alias.

- [ ] **Step 2: Run the provider-contract typecheck to prove RED**

  Run:

  ```sh
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn workspace @dashboard-render-sdk-g/provider-contract typecheck
  ```

  Expected: FAIL because the new contract symbols are absent.

- [ ] **Step 3: Add and export only the approved vocabulary**

  Add the exact interfaces/unions in `contracts.ts` and type-only exports from the package root. Do not add observation acquisition, validation functions, admission errors, build identity fields, transport fields, or a new manifest version.

- [ ] **Step 4: Verify GREEN and declaration output**

  Run:

  ```sh
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn workspace @dashboard-render-sdk-g/provider-contract typecheck
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn workspace @dashboard-render-sdk-g/provider-contract build
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn tsc6 --project packages/provider-contract/tsconfig.typecheck.json --pretty false --listFilesOnly
  ```

  Expected: PASS; the file list contains `contracts.type-test.ts`, while the production declaration output contains the new types and no type-test artifact.

---

### Task 2: Share the exact-version grammar and implement exact target-cell and host-version comparison

**Files:**

- Create: `packages/provider-contract/src/exactVersion.ts`
- Modify: `packages/provider-contract/src/manifestValidation.ts`
- Modify: `packages/provider-contract/src/manifestValidation.test.ts`
- Modify: `packages/provider-contract/src/index.ts`
- Create: `packages/core/src/evaluateProviderCompatibility.test.ts`
- Create: `packages/core/src/evaluateProviderCompatibility.ts`
- Modify: `packages/core/src/contracts.type-test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**

- Consumes: `ManifestValidationSuccess`, `CompatibilityObservations`, and `CompatibilityEvaluationResult` from the provider-contract public root.
- Produces: `evaluateProviderCompatibility(inspection, observations)` from the core public root.

- [ ] **Step 1: Write exact-version predicate RED tests**

  Extend the provider-contract tests with table-driven, literal expectations proving that the shared predicate accepts exact releases plus valid prerelease/build metadata and rejects ranges, wildcards, partial versions, empty strings, non-strings, leading-zero violations, and malformed exact-version syntax. The existing manifest-validation exact-version behavior must remain unchanged.

- [ ] **Step 2: Run the provider-contract test to prove RED**

  Run:

  ```sh
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn workspace @dashboard-render-sdk-g/provider-contract test:unit
  ```

  Expected: FAIL because the shared predicate is not implemented/exported.

- [ ] **Step 3: Extract the smallest shared exact-version predicate**

  Move the existing exact-version grammar into `exactVersion.ts`, export a predicate from the provider-contract public root, and make `manifestValidation.ts` consume it. Do not add a parser, normalization, range handling, or a dependency.

- [ ] **Step 4: Verify the predicate GREEN and manifest regressions**

  Run the command from Step 2.

  Expected: PASS with unchanged manifest-validation semantics.

- [ ] **Step 5: Write compile-time RED assertions for the core function**

  Assert that the function:

  - requires a narrowed `ManifestValidationSuccess`, not the wider inspection union or a raw manifest;
  - accepts only `CompatibilityObservations` at its typed boundary;
  - returns exactly `CompatibilityEvaluationResult`;
  - does not return `RuntimeIdentity`, admission, compatibility, provider, or lease properties;
  - remains usable without Grafana, Scenes, React, or provider-13 types.

- [ ] **Step 6: Write focused runtime RED tests for target and host axes**

  Build manifests through `inspectConfiguredProvider`, narrow to success, and test:

  - exact family plus exact version/edition cell, React, and ReactDOM produce matching checks;
  - two cells sharing a version but using different editions select only the exact pair;
  - a version from one cell and edition from another produce one `$.target.cell` mismatch;
  - wrong family, version, edition, React, and ReactDOM values produce deterministic mismatches;
  - missing target/host groups and individual fields produce `missing-evidence` checks;
  - non-string and empty provided values produce `invalid-observation` checks;
  - semver ranges, wildcards, partial versions, and malformed exact-version strings produce `invalid-observation`, while a different valid exact version produces `mismatch`;
  - changing only `TargetCompatibilityCell.source.revision` does not change match status, while the detached matched cell retains that manifest's provenance;
  - an `experimental` support tier is not promoted or represented as runtime admission.

- [ ] **Step 7: Run TypeScript and Vitest to prove RED**

  Run:

  ```sh
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn workspace @dashboard-render-sdk-g/core typecheck
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn exec vitest run packages/core/src/evaluateProviderCompatibility.test.ts --environment node
  ```

  Expected: both fail because the evaluator is not implemented/exported.

- [ ] **Step 8: Implement the minimal evaluator shell and target/host checks**

  Add the exact function signature. Snapshot only the bounded target and host observation fields through a focused plain-data reader, accumulate checks in the fixed order, select the target cell only from the exact edition/version pair, calculate the approved outcome precedence, copy the matched cell, deep-freeze the new result, and retain no state.

  Add TSDoc stating that:

  - input must be the canonical successful structural inspection;
  - observations are explicit caller-supplied metadata, not verified evidence;
  - exact metadata equality is not admission;
  - React version equality does not prove physical React identity;
  - source provenance is not runtime build identity;
  - the function performs no provider access, network request, initialization, or global mutation.

- [ ] **Step 9: Verify the target/host slice GREEN**

  Run the two commands from Step 3.

  Expected: PASS with no import of a concrete provider, Grafana, Scenes, React, or transport implementation.

---

### Task 3: Add dependency-set comparison, malformed-input handling, and result immutability

**Files:**

- Modify: `packages/core/src/evaluateProviderCompatibility.test.ts`
- Modify: `packages/core/src/evaluateProviderCompatibility.ts`

**Interfaces:**

- Consumes: Task 2 evaluator and fixed diagnostic order.
- Produces: complete exact-set dependency semantics and all four final outcomes.

- [ ] **Step 1: Write dependency and precedence RED tests**

  Add tests for:

  - identical dependency sets compare as matches regardless of observation order;
  - an explicitly observed empty set matches an empty manifest set;
  - a missing dependency observation collection is insufficient evidence, including when the manifest declares no dependencies;
  - missing expected, unexpected observed, and same-ID/different-version dependencies are distinct sorted mismatch checks;
  - duplicate observed IDs are invalid observations;
  - malformed root/nested record shapes, malformed dependency collection shape, sparse arrays, malformed entries, empty/non-string fields, unknown fields, symbol keys, accessors, non-plain objects, and revoked/throwing proxies fail as deterministic invalid observations without leaking thrown messages;
  - dependency arrays longer than 1,024 entries and records with more than 1,024 own properties fail with deterministic typed limit checks;
  - large sparse arrays are rejected before length-proportional indexed traversal;
  - diagnostic output is capped at 100 checks and ends with one deterministic `invalid-observation` truncation check when more diagnostics exist;
  - non-enumerable properties are rejected, while optional enumerable own data properties explicitly set to `undefined` are classified as missing evidence;
  - ordinary accessors are rejected without invocation; proxy traps may execute but thrown trap errors are caught;
  - invalid observations outrank mismatches and missing evidence;
  - mismatches outrank missing evidence;
  - missing evidence outranks otherwise matching checks;
  - all matches produce only `declared-requirements-match`;
  - diagnostics are identical for dependency permutations;
  - mutating the original observations after evaluation cannot change the result;
  - result, checks array, each check, and copied matched cell/source are frozen;
  - repeated calls are deeply equal but return distinct result objects and create no cache.

- [ ] **Step 2: Run focused Vitest to prove RED**

  Run:

  ```sh
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn exec vitest run packages/core/src/evaluateProviderCompatibility.test.ts --environment node
  ```

  Expected: new dependency, malformed-input, precedence, and immutability tests fail.

- [ ] **Step 3: Complete the bounded evaluator**

  Extend the focused observation snapshot logic only for the declared dependency array. Before traversal, enforce the 1,024-entry array limit and 1,024-own-property container limit; cap returned checks at 100 with a deterministic final limit check. Compare IDs through maps after validation, iterate the sorted union of expected and observed IDs, emit the specified checks, apply outcome precedence after all safely detectable checks, and deep-freeze the detached result. Use fixed-depth, non-recursive inspection so cycles cannot cause recursion or stack overflow.

  Do not:

  - compare observation arrays by order;
  - parse or accept version ranges;
  - copy dependencies from the manifest into the observations;
  - expose the observation snapshot;
  - compare source revision with a runtime build value;
  - add network, provider, React-object, singleton, registry, or lifecycle behavior.

- [ ] **Step 4: Verify full evaluator GREEN**

  Run:

  ```sh
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn exec vitest run packages/core/src/evaluateProviderCompatibility.test.ts --environment node
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn workspace @dashboard-render-sdk-g/core typecheck
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn workspace @dashboard-render-sdk-g/core build
  ```

  Expected: PASS. Production declarations reference only provider-contract public types and local core modules.

---

### Task 4: Integrate tests and document the Stage A boundary

**Files:**

- Modify: `packages/core/package.json`
- Modify: `packages/core/README.md`

**Interfaces:**

- Consumes: complete evaluator from Task 3.
- Produces: package-local test orchestration and durable usage/boundary documentation.

- [ ] **Step 1: Add the evaluator suite to the core unit command**

  Keep an explicit file list in `packages/core/package.json` and run both `inspectConfiguredProvider.test.ts` and `evaluateProviderCompatibility.test.ts`. Do not change dependencies, exports, or versions.

- [ ] **Step 2: Document the two-stage workflow**

  Update `packages/core/README.md` with a concise non-rendering example:

  1. inspect configured provider;
  2. narrow `valid`;
  3. evaluate explicit metadata observations;
  4. treat `declared-requirements-match` as comparison evidence only.

  State explicitly that observation acquisition, server probing, React object identity, loaded-cohort verification, runtime admission/identity, transport, and rendering remain deferred. Preserve the existing future React-first/Jalali design section unchanged except for any cross-reference needed to avoid implying the evaluator renders.

- [ ] **Step 3: Verify package-local regressions**

  Run:

  ```sh
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn workspace @dashboard-render-sdk-g/provider-contract test:unit
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn workspace @dashboard-render-sdk-g/provider-contract typecheck
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn workspace @dashboard-render-sdk-g/core test:unit
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn workspace @dashboard-render-sdk-g/core typecheck
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn workspace @dashboard-render-sdk-g/provider-contract build
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn workspace @dashboard-render-sdk-g/core build
  ```

  Expected: all pass.

---

### Task 5: Prove dependency boundaries and whole-repository regressions

**Files:**

- Verify unchanged: `scripts/check-provider-contract-boundary.mjs`
- Verify unchanged: `scripts/check-provider-contract-boundary.test.mjs`
- Verify unchanged: `scripts/check-core-boundary.mjs`
- Verify unchanged: `scripts/check-core-boundary.test.mjs`
- Verify unchanged: root `package.json`, `yarn.lock`, and POC source/tests

**Interfaces:**

- Consumes: final source graph from Tasks 1–4.
- Produces: verification evidence only; no new production API.

- [ ] **Step 1: Run immutable install and boundary checker regression suites**

  Run:

  ```sh
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn install --immutable
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev node --test scripts/check-provider-contract-boundary.test.mjs
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev node --test scripts/check-core-boundary.test.mjs
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn check:provider-contract-boundary
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn check:core-boundary
  ```

  Expected: all pass. The existing guards inspect value imports, type imports, re-exports, TypeScript import types, dynamic imports, CommonJS/import-equals, triple-slash references, effective production roots, compiler-injected dependencies/plugins, path/baseUrl redirects, and forbidden dependency metadata. No checker modification should be necessary.

- [ ] **Step 2: Confirm effective type-test and production-declaration separation**

  Run:

  ```sh
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn tsc6 --project packages/provider-contract/tsconfig.typecheck.json --pretty false --listFilesOnly
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn tsc6 --project packages/core/tsconfig.typecheck.json --pretty false --listFilesOnly
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn tsc6 --build packages/provider-contract/tsconfig.json packages/core/tsconfig.json --pretty false --force --listEmittedFiles
  ```

  Expected: each typecheck file list includes its `contracts.type-test.ts`; production emitted files contain no `.test` or `.type-test` artifact.

- [ ] **Step 3: Run root regressions**

  Run:

  ```sh
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn typecheck
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn test:unit
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn test:integration
  docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn build:poc
  ```

  Expected: all pass; existing React/Scenes peer warnings remain visible and unchanged.

- [ ] **Step 4: Inspect scope, untracked files, whitespace, and dependency drift**

  Run:

  ```sh
  git status --short
  git diff --stat
  git diff --check
  git ls-files --others --exclude-standard
  git diff -- package.json yarn.lock packages/provider-contract/package.json packages/core/package.json
  grep -RInE "(@grafana/|@grafana/scenes|provider-13|poc-compat|react-dom|from ['\"]react['\"]|GrafanaApp|RuntimeIdentity|acquireRuntime|fetch\()" packages/provider-contract/src packages/core/src || true
  ```

  Expected: only the planned files changed/untracked; root/package dependency metadata and lockfile have no dependency drift; any grep matches are type names, tests, or explicit documentation assertions rather than forbidden production imports or behavior.

---

### Task 6: Request independent whole-branch review

**Files:**

- Review all tracked and untracked changes relative to `8ec33af`.
- Modify files only if the reviewer reports a justified Critical or Important finding and the correction remains within issue #85.

**Interfaces:**

- Consumes: verified issue #85 working tree.
- Produces: independent verdict and any focused TDD remediation evidence.

- [ ] **Step 1: Request a fresh-context review**

  Use `superpowers:requesting-code-review`. Ask the reviewer to inspect actual tracked and untracked files and focus on:

  - exact target-cell pairing and multi-cell edge cases;
  - malformed observation/reflection safety and deterministic diagnostics;
  - dependency-set normalization and outcome precedence;
  - immutability/detachment and absence of state;
  - structural validation versus metadata comparison versus runtime admission;
  - source provenance versus runtime build identity;
  - React version strings versus physical object identity;
  - package exports and both dependency boundaries.

- [ ] **Step 2: Resolve only justified blocking findings through focused TDD**

  For each Critical or Important finding, first reproduce it with a failing compile-time or runtime test, implement the smallest in-scope correction, and rerun the affected focused plus boundary suites. Do not broaden into Stage B.

- [ ] **Step 3: Run final verification after any remediation**

  Rerun Tasks 4 and 5 verification, then record the final reviewer verdict, exact commands/results, changed and untracked files, deviations, risks, `git status --short`, and diff summary. Leave everything uncommitted.

## Acceptance Criteria Mapping

| Issue #85 requirement | Plan evidence |
| --- | --- |
| Neutral observation and result types compile | Task 1 compile-time RED/GREEN and emitted declarations |
| Core owns pure evaluator; contract owns vocabulary | Approved API plus Tasks 1–3 |
| Canonically validated manifest input; no duplicate validator | Function accepts `ManifestValidationSuccess`; Tasks 2 and 4 documentation/tests |
| Exact target family and version/edition cell | Task 2 exact and cross-cell negative tests |
| Exact React/ReactDOM strings without physical-identity claim | Task 2 tests and TSDoc |
| Invalid exact-version syntax remains distinct from a valid mismatch | Shared predicate plus Task 2 target/host/dependency tests |
| Order-independent exact dependency set | Task 3 permutation and set-difference tests |
| Missing, malformed, duplicate, unexpected, and mismatched observations | Tasks 2–3 negative matrix |
| Resource-bounded reflection and diagnostics | Task 3 limit, sparse-array, proxy, and diagnostic-cap tests |
| Deterministic diagnostics and approved precedence | Tasks 2–3 fixed ordering and precedence tests |
| Detached immutable results | Task 3 mutation/freeze/repeat tests |
| No source/BuildCommit conflation | Global constraint and Task 2 provenance test |
| No network, provider initialization, runtime identity, or global mutation | API shape, Task 2 side-effect boundary, and Task 5 static checks |
| Existing package boundaries/regressions pass | Tasks 4–5 |
| Independent review before Git integration | Task 6 |

## Deferred Responsibilities

The following remain Stage B or later work and must not appear in issue #85:

- collecting or authenticating server observations;
- `/api/health`, API discovery, host transport, authentication, and security-scope handling;
- runtime Grafana build/image identity and source-equivalence policy;
- loaded Grafana/Scenes/package-cohort verification;
- actual React/ReactDOM/client/JSX module-object identity and bundle audit;
- compatibility admission, provider selection among candidates, `RuntimeIdentity`, singleton coordination, leases, dormant/poisoned states, and lifecycle;
- dashboards, sessions, rendering, React components, and calendar behavior.

## No Material Architectural Conflict

The issue fits the approved Phase 1 boundaries and merged issues #81/#83. Provider-contract gains only provider-neutral data vocabulary; core gains only a pure comparison function. The existing metadata inspector remains the sole path that reads configured provider metadata and the existing validator remains the sole manifest validator. Stage A deliberately produces comparison evidence, not executable admission.
