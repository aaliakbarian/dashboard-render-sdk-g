# Third-Party Licensing and Notices Implementation Plan

> **Issue:** #64 — Third-party licensing and notices release gate
> **Baseline:** `cc24f09`
> **Branch:** `phase2/third-party-license-notices`

## Goal

Create a deterministic, failure-closed third-party license gate for the actual
Dashboard Render SDK G distribution closure. Generate reviewed notice, license,
dependency, source, and asset artifacts without changing SDK runtime behavior.
This gate records authoritative evidence and unresolved questions; it does not
replace legal review or the source-availability/reproducibility/SBOM work in
issue #65.

## Global constraints

- Do not change renderers, SDK APIs, dependency versions, runtime behavior, or
  the pinned Grafana source checkout.
- Do not publish, tag, commit, push, or start issue #65/#49.
- Run Node/Yarn/TypeScript/Vitest/build work in the existing Compose dev
  container.
- Use the actual provider and host bundle-evidence graphs, exact pinned Grafana
  source allowlists, workspace manifests, immutable install, and lockfile.
- Treat package manifests as one evidence source, never as sufficient evidence
  by themselves. Preserve license/NOTICE bytes; do not synthesize license text.
- Fail closed on missing/unrecognized evidence, conflicting declarations,
  unexpected production components, stale output, or missing required notice.
- Keep generated paths stable and repository-relative; never emit machine-local
  paths, secrets, cookies, tokens, or credentials.

## Task 1: Build the deterministic inventory and policy validator

**Files:**

- Create `scripts/third-party-license-gate.mjs`.
- Create `scripts/third-party-license-gate.test.mjs`.
- Create `compliance/third-party/policy.json`.
- Create `compliance/third-party/README.md`.

**TDD RED:** add focused `node:test` fixtures proving the gate rejects missing
license evidence, invalid/unknown SPDX identifiers or expressions, manifest /
evidence conflicts, unexpected bundle dependencies, missing notices, unknown
Grafana source paths, unsafe/machine-specific paths, and stale output. Prove it
accepts valid Apache/AGPL boundary cases, dual expressions, BlueOak, CC0,
Unlicense, and deterministic repeated generation.

**GREEN:** implement a bounded scanner that:

1. Reads provider and SDK-host bundle evidence and resolves every physical
   production package component and exact installed version.
2. Separately records provider-bundled, host-bundled, external-peer,
   source-derived, asset, generated-helper, demo-only, test-only, development-only, and
   installed-not-distributed scopes.
3. Reconciles production identities with workspace manifests and `yarn.lock`.
4. Reads package-local license/NOTICE files and explicit policy overrides only;
   validates supported SPDX syntax and a checked-in recognized identifier set.
5. Reconciles exact Grafana `public/app` AGPL paths, Apache-exception package/UI
   paths, source revision, and emitted/static asset evidence.
6. Emits stable JSON/Markdown and copies authoritative evidence verbatim.
7. Supports `generate` and non-mutating `check` modes; `check` fails on drift.

The policy file contains classification decisions and evidence references, not
copied or rewritten license prose. It must explicitly preserve the
`@grafana/schema` / `@grafana/i18n` evidence tension and DOMPurify's dual
expression until supported by authoritative evidence.

**Focused command:**

```bash
docker compose --env-file dev/grafana/.env exec -T dev node --test scripts/third-party-license-gate.test.mjs
```

## Task 2: Reconstruct and generate the complete current release inventory

**Files:**

- Update the Task 1 policy and tests only where the real closure requires an
  explicit evidence decision.
- Generate `THIRD_PARTY_NOTICES.md`.
- Generate `licenses/dependency-inventory.json`.
- Generate `licenses/source-inventory.json`.
- Generate `licenses/asset-inventory.json`.
- Generate `licenses/evidence/**` containing the exact applicable upstream
  license, NOTICE, attribution, and package-specific copyright files.
- Generate `licenses/README.md` describing scopes and unresolved evidence.

**TDD RED:** run `check` before generation and prove stale/missing artifacts
fail. Add real-closure assertions for exact Grafana revision, all production
package components, React/ReactDOM external/host treatment, Visx 3.12.0
transitives, TableNG/react-data-grid, Grafana application-source AGPL paths,
Grafana UI Apache paths, and current asset inclusion/non-inclusion.

**GREEN:** generate the current inventories and evidence. Record direct versus
transitive, bundled versus external, source/CSS/font/icon/worker type,
runtime-versus-static use, exact version/revision, source URL, evidence path,
attribution/NOTICE requirements, and unresolved status. Include nonproduction
installed material in the machine inventory without falsely including it in
the provider notice set. If canonical evidence is absent, mark the component
unresolved and make `check` fail rather than fabricating text.

**Focused commands:**

```bash
docker compose --env-file dev/grafana/.env exec -T dev node scripts/third-party-license-gate.mjs generate
docker compose --env-file dev/grafana/.env exec -T dev node scripts/third-party-license-gate.mjs check
docker compose --env-file dev/grafana/.env exec -T dev node --test scripts/third-party-license-gate.test.mjs
```

## Task 3: Integrate the release gate and maintenance documentation

**Files:**

- Update root `package.json` with dependency-free `licenses:generate`,
  `licenses:check`, and `test:licenses` scripts.
- Create `docs/development/third-party-licensing.md`.
- Update generated artifacts only through the generator.

Document the authoritative inputs, offline workflow, human-review boundary,
dual-license handling, Grafana AGPL/Apache classification, current unresolved
questions, distribution scope, and exactly what remains for #65. State that
passing #64 alone is not public-release approval and does not satisfy AGPL
source-availability obligations.

Add integration tests showing the root commands use the real closure and fail
closed if generated material is edited or a production component is added.

## Task 4: Full verification and independent review

Run, in the Compose dev container unless intrinsically a Git check:

```bash
docker compose --env-file dev/grafana/.env exec -T dev yarn install --immutable
docker compose --env-file dev/grafana/.env exec -T dev yarn test:licenses
docker compose --env-file dev/grafana/.env exec -T dev yarn licenses:check
docker compose --env-file dev/grafana/.env exec -T dev yarn typecheck
docker compose --env-file dev/grafana/.env exec -T dev yarn test:unit
docker compose --env-file dev/grafana/.env exec -T dev yarn test:integration
docker compose --env-file dev/grafana/.env exec -T dev yarn check:provider-contract-boundary
docker compose --env-file dev/grafana/.env exec -T dev yarn check:core-boundary
docker compose --env-file dev/grafana/.env exec -T dev yarn check:provider-13-boundary
docker compose --env-file dev/grafana/.env exec -T dev yarn build:sdk-slice
docker compose --env-file dev/grafana/.env exec -T dev yarn inspect:bundle
git diff --check
```

Also verify deterministic double generation, no secret-like material, no
machine-specific paths, repository ownership, and complete tracked/untracked
inventory. Request a fresh-context whole-branch review focused on inventory
completeness, false exclusions, legal-evidence fidelity, deterministic output,
and failure-closed behavior. Resolve all justified Critical/Important findings
with focused RED/GREEN tests and request scoped re-review.

## Acceptance criteria mapped to #64

- `THIRD_PARTY_NOTICES.md`, `licenses/`, machine-readable dependency/source/
  asset inventories, deterministic tooling, and maintenance documentation are
  present and reproducible.
- Every current provider/host production dependency, retained Grafana source,
  and emitted asset has an exact identity, scope, SPDX/evidence record, and
  notice/license path or a visible blocking unresolved status.
- Grafana AGPL application source and Apache exception boundaries are explicit;
  schema/i18n are not silently generalized.
- React peers, Scenes, RxJS, Emotion, uPlot, Zod, Visx, TableNG/react-data-grid,
  DOMPurify, Inter, Unicons, BlueOak, CC0, and Unlicense cases are explicitly
  accounted for.
- Check mode detects lock/bundle/source/asset drift and stale generated output.
- Runtime behavior, public APIs, dependency versions, and the pinned source
  tree are unchanged.
- The final verdict is PASS only if all material #64 evidence is resolved;
  otherwise it is BLOCKED with exact maintainer/legal-review questions. #65
  remains independently required in either case.
