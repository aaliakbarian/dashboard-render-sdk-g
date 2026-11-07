# Source Availability, Reproducibility, and SBOM Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task by task with TDD and one fresh whole-branch review.

**Issue:** #65 — Source Availability, Reproducibility and SBOM  
**Baseline:** `5bccabbaaea8d291d0d8fd4dabea4ce789571cd0`  
**Branch:** `phase2/source-reproducibility-sbom`

## Goal

Add a small, dependency-free release-evidence pipeline that reuses the audited
issue #64 inventories and actual provider/host bundle evidence. It must connect
the exact SDK and Grafana sources to deterministic production artifacts, emit an
SPDX 2.3 JSON SBOM, audit package contents, and generate hashes and provenance.
It records but does not resolve issue #64's legal-review blockers.

## Design

Use one Node entry point with strict configuration and three modes:

- `generate` writes deterministic outputs beneath ignored
  `artifacts/release/`;
- `check` regenerates in memory/temporary storage and rejects stale output;
- `verify-build` builds the production SDK slice twice from clean output
  directories and compares complete SHA-256 manifests.

The source archive contains the current project source set plus the exact 62
Grafana source files named by the audited source inventory and authoritative
Grafana license/notice material. A release invocation requires a clean project
and pinned Grafana checkout. `--allow-dirty` exists only to exercise the
uncommitted development tree; provenance records that state and marks it
ineligible for release.

The SBOM is SPDX 2.3 JSON. It contains first-party distribution packages,
production-reachable package components, Grafana application-source files, and
included assets. Test, development, demo-only, and installed-only components
remain distinguishable in the issue #64 inventory and are not misrepresented as
distributed runtime dependencies.

## Global constraints

- Do not change SDK/runtime behavior, renderer support, public APIs, dependency
  versions, authentication, transport, or the pinned Grafana source checkout.
- Do not add dependencies, a backend, signing infrastructure, publication, tags,
  releases, commits, pushes, or PRs.
- Run Node/Yarn/build/test operations in the existing Compose dev container.
- Reuse `licenses/*.json`, `THIRD_PARTY_NOTICES.md`, the exact bundle-evidence
  graphs, `yarn.lock`, and existing provenance tooling as authoritative inputs.
- Generate no timestamps in deterministic content. Normalize archive paths,
  modes, ownership, ordering, and mtimes. Never emit machine-local paths or
  secrets.
- Do not claim that a passing engineering gate resolves AGPL interpretation or
  issue #64's `blocked-legal-review` status.

## Task 1: Define the fail-closed release policy and core generator

**Files:**

- Create `compliance/release/policy.json`.
- Create `scripts/release-evidence.mjs`.
- Create `scripts/release-evidence.test.mjs`.

**RED:** Add fixtures proving rejection of malformed/unsafe policy paths,
unexpected artifact files, missing bundle files, dependency/source/asset drift,
wrong Grafana commit, dirty source in release mode, local absolute paths,
secret-like content, and stale output. Prove exact size/count limits.

**GREEN:** Implement strict parsing, safe path resolution, bounded reads, stable
JSON, SHA-256 trees, source selection, deterministic tar/gzip generation, and
package-content auditing. Validate the exact Grafana revision and every source
hash against `licenses/source-inventory.json`. Allow development generation only
with an explicit `--allow-dirty` flag and record the dirty state.

## Task 2: Generate SPDX SBOM, hashes, and provenance

**Files:**

- Extend `scripts/release-evidence.mjs` and its tests.

**RED:** Add exact assertions for SPDX 2.3 document/package/file/relationship
shape, production-scope filtering, external React treatment, Grafana-derived
files, included assets, source archive hash, lockfile/toolchain/build-config
hashes, artifact hashes, and unresolved #64 status. Reject malformed SBOMs,
missing relationships, and mismatched bundle/inventory content.

**GREEN:** Emit:

- `artifacts/release/dashboard-render-sdk-g-source.tar.gz`;
- `artifacts/release/dashboard-render-sdk-g.spdx.json`;
- `artifacts/release/SHA256SUMS`;
- `artifacts/release/provenance.json`; and
- `artifacts/release/source-manifest.json`.

The provenance schema connects the SDK commit/dirty state, Grafana commit,
Node/Yarn/container/build identities, lockfile/configuration hashes, SBOM,
archive, provider/host artifact trees, included asset hashes, and #64 release
gate status. Keep generation time outside deterministic files.

## Task 3: Reproducible-build command and operator documentation

**Files:**

- Update `package.json` with release-evidence generate/check/test/rebuild scripts.
- Create `compliance/release/README.md`.
- Create `docs/development/source-reproducibility-sbom.md`.

**RED:** Prove the documented root commands are absent and a deliberately
different second artifact tree fails comparison.

**GREEN:** Implement `verify-build` using the fixed `yarn build:sdk-slice`
command twice, with clean Vite output each time, and compare every provider and
host file. Document the exact Compose commands, source retrieval/rebuild steps,
SPDX scope, hash verification, dirty-development mode, source material to
accompany distribution, local-image digest limitation, and unresolved #64/AGPL
questions.

## Task 4: Real generation, clean-container evidence, regression, and review

Build twice in an ephemeral Compose development container, run issue #64's gate,
generate/check release evidence with the explicitly dirty development flag,
validate the source archive and SPDX document, and inspect all hashes. Run:

```bash
docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn install --immutable
docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn test:release-evidence
docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn release:evidence:verify-build
docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn licenses:check
docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn typecheck
docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn test:unit
docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn test:integration
docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn check:provider-contract-boundary
docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn check:core-boundary
docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn check:provider-13-boundary
docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn build:sdk-slice
```

Also verify deterministic double generation, byte-identical double builds,
archive extraction, SBOM/bundle reconciliation, secret and local-path absence,
repository ownership, `git diff --check`, and complete tracked/untracked state.
Request a fresh-context whole-branch review focused on false exclusions,
corresponding-source fidelity, SPDX validity, artifact self-reference,
determinism, and fail-closed behavior. Resolve justified Critical/Important
findings in one focused TDD pass.

## Acceptance criteria

- Exact SDK/Grafana source identities and incorporated source files are linked
  to the actual provider/host artifacts.
- Source package, SPDX 2.3 SBOM, SHA-256 manifest, and provenance are
  deterministic and validate without network access after preparation.
- Production components and assets reconcile with issue #64 inventories and
  bundle evidence; nonproduction dependencies are not presented as shipped.
- Package-content audit rejects unreviewed files, secrets, local paths, and
  inventory drift.
- Two clean artifact builds are byte-identical, or the exact non-deterministic
  input is reported without claiming byte reproducibility.
- #64's legal-review blockers remain explicit, and no public-release readiness
  is claimed.

