# Source availability, reproducibility, and SBOM

This guide operates the issue #65 release-evidence gate. It is intentionally a
small offline workflow around the existing issue #64 inventory and production
bundle evidence. It neither publishes artifacts nor claims legal compliance.

## Prerequisites

- clean Dashboard Render SDK G Git checkout at the release commit;
- clean Grafana OSS 13.2.3 checkout at
  `.grafana-source/grafana-v13.2.3`, commit
  `6193dc03311b631b9727b560d24369e683dc396e`;
- the repository's Docker Compose development image; and
- the immutable Yarn installation from `yarn.lock`.

The pinned toolchain is Node 22.23.3 and Yarn 4.17.1. The provider compatibility
cell is Grafana OSS 13.2.3, React/ReactDOM 19.2.8, and Scenes 8.13.5. Exact Visx
and other runtime versions come from the lockfile and issue #64 inventory.

## Rebuild and generate evidence

From the repository root:

```bash
docker compose --env-file dev/grafana/.env build dev
export DRSDK_CONTAINER_IMAGE_DIGEST="$(docker image inspect dashboard-render-sdk-g-poc-dev:local --format '{{.Id}}')"
export DRSDK_BASE_IMAGE_DIGEST="$(docker image inspect node:22.23.3-bookworm --format '{{.Id}}')"
docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn install --immutable
docker compose --env-file dev/grafana/.env run --rm --no-deps \
  -e DRSDK_CONTAINER_IMAGE_DIGEST -e DRSDK_BASE_IMAGE_DIGEST \
  dev yarn release:evidence:verify-build
docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn licenses:check
docker compose --env-file dev/grafana/.env run --rm --no-deps \
  -e DRSDK_CONTAINER_IMAGE_DIGEST -e DRSDK_BASE_IMAGE_DIGEST \
  dev yarn release:evidence:generate
docker compose --env-file dev/grafana/.env run --rm --no-deps \
  -e DRSDK_CONTAINER_IMAGE_DIGEST -e DRSDK_BASE_IMAGE_DIGEST \
  dev yarn release:evidence:check
```

`verify-build`, `generate`, and `check` each perform two builds and require
byte-identical provider and host trees. Generation then invokes issue #64's
read-only gate against that freshly built tree before consuming its inventories.
The two image variables are observed on the host and must match the exact policy
identities; configured version strings alone are not treated as observation.

While reviewing uncommitted issue #65 work, invoke the script directly with
`--allow-dirty` instead of weakening the root release command:

```bash
docker compose --env-file dev/grafana/.env run --rm --no-deps \
  -e DRSDK_CONTAINER_IMAGE_DIGEST -e DRSDK_BASE_IMAGE_DIGEST \
  dev node scripts/release-evidence.mjs generate --allow-dirty
docker compose --env-file dev/grafana/.env run --rm --no-deps \
  -e DRSDK_CONTAINER_IMAGE_DIGEST -e DRSDK_BASE_IMAGE_DIGEST \
  dev node scripts/release-evidence.mjs check --allow-dirty
```

Dirty-development evidence is explicitly not release-eligible.

## Inspect and verify

The generated files live under ignored `artifacts/release/`. Verify recorded
hashes with the automated `check` command and, from the repository root:

```bash
sha256sum --check artifacts/release/SHA256SUMS
```

The source archive can be inspected without executing it:

```bash
tar -tzf artifacts/release/dashboard-render-sdk-g-source.tar.gz
```

The SPDX document uses SPDX 2.3 JSON. It lists the actual production-reachable
package closure, externally supplied React peers, Grafana-derived source files,
and included assets. Test, development, demo-only, and installed-only packages
remain in `licenses/dependency-inventory.json`; they are intentionally not
misrepresented as shipped runtime dependencies.

`provenance.json` connects the SDK and Grafana commits, lockfile and build-input
hashes, toolchain, artifact hashes, source archive, SBOM, and issue #64 status.
The release policy records the observed local development-image digest and the
locally available Node base-image digest; compare them with `docker image
inspect` after rebuilding. Dockerfile and Compose definitions are hashed as
independent build inputs. The Grafana fixture image digest is pinned in
`dev/grafana/compose.yaml`.

## Source retrieval and distribution material

The archive contains the exact project working source, build scripts,
configuration, lockfile, notices, issue #64 evidence, and every Grafana source
file incorporated into the provider artifacts. It also includes the pinned
RadialGauge constant and TableNG type-only files that build preflight reads even
though bundling folds them away. `source-manifest.json` records their SHA-256
identities and states that no patch was applied to the pinned Grafana checkout.
To reconstruct the upstream checkout independently:

```bash
git clone https://github.com/grafana/grafana.git .grafana-source/grafana-v13.2.3
git -C .grafana-source/grafana-v13.2.3 checkout 6193dc03311b631b9727b560d24369e683dc396e
```

A future distribution should keep the source archive, SBOM, `SHA256SUMS`,
`provenance.json`, project `LICENSE`, `THIRD_PARTY_NOTICES.md`, and generated
`licenses/` evidence together with the corresponding binaries.

## Outstanding legal review

Issue #64 remains independently blocked by the precise licensing conflicts in
the generated dependency inventory, including the current Grafana schema/i18n
boundary and `dangerously-set-html-content`. Notices and an SBOM do not by
themselves settle AGPL corresponding-source obligations. Qualified review must
confirm whether the bounded Grafana source closure is sufficient or whether a
complete upstream source offer is required. Do not claim public-release
readiness until issues #64 and #65 have both passed their separate gates.
