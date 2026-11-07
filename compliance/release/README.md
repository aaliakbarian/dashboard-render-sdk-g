# Release evidence policy

Issue #65 uses `scripts/release-evidence.mjs` to connect the production SDK
artifact closure to exact source, dependency, license, asset, and toolchain
inputs. The tool is dependency-free and consumes the issue #64 inventories; it
does not maintain a second dependency or licensing catalogue.

## Modes

- `generate` performs the double build, runs the issue #64 inventory gate,
  audits the resulting provider/host outputs, and writes deterministic evidence
  to ignored `artifacts/release/`.
- `check` repeats those same build and inventory checks, regenerates the same
  bytes, and rejects a missing, extra, or changed output.
- `verify-build` runs the fixed `yarn build:sdk-slice` command twice. Vite
  cleans each production output directory, and the tool compares every file
  path, size, and SHA-256 digest from both builds.

All three modes require the caller to obtain the development-container and Node
base-image IDs from Docker and pass them as `DRSDK_CONTAINER_IMAGE_DIGEST` and
`DRSDK_BASE_IMAGE_DIGEST`. Missing or malformed IDs are rejected. The base-image
ID must match policy exactly. The local development image is rebuilt locally,
so its policy digest is `null`: its valid host-observed ID is recorded in the
build binding and provenance rather than compared with a historical local ID.
A non-null container digest remains an exact pin, as required for a published
image policy. A configured image name or version string is not observed image
identity, and the generator never invents a digest.

Normal `generate` and `check` also require clean SDK and Grafana checkouts.
During uncommitted development only, pass `--allow-dirty`; the source archive
then contains the actual working-tree bytes, provenance records `dirty: true`,
and `releaseEligible` is false. The pinned Grafana checkout must always remain
clean at commit `6193dc03311b631b9727b560d24369e683dc396e`.

## Deterministic outputs

The output set is:

- `dashboard-render-sdk-g-source.tar.gz` — normalized project source plus the
  exact Grafana source closure and upstream license/notice files;
- `source-manifest.json` — source paths, normalized modes, and hashes;
- `dashboard-render-sdk-g.spdx.json` — SPDX 2.3 JSON for distributed runtime
  packages, emitted and build-required Grafana source, compiled artifacts, and
  included assets;
- `SHA256SUMS` — source, SBOM, runtime artifact, and asset hashes; and
- `provenance.json` — source commits, toolchain, build inputs, artifact tree,
  output hashes, and issue #64 gate status.

Metadata uses sorted paths, normalized archive ownership/modes/mtimes, the Git
commit timestamp, and a fixed SPDX creation timestamp. `provenance.json` is not
listed in `SHA256SUMS`, avoiding a self-referential hash. Generation timestamps
are deliberately absent.

The local development image is built from `node:22.23.3-bookworm` and is named
`dashboard-render-sdk-g-poc-dev:local`. Obtain its current image ID with
`docker image inspect dashboard-render-sdk-g-poc-dev:local --format '{{.Id}}'`
and pass that exact host observation into the container. The policy keeps the
base-image digest pinned, and the Dockerfile and Compose inputs are hashed in
provenance. Grafana's fixture image remains separately digest-pinned in
`dev/grafana/compose.yaml`.

Source inputs are scanned for credential-like material and machine-local paths
before archiving. The two scanner regression fixtures intentionally contain
sentinels; policy admits only their exact reviewed SHA-256 identities, so a
changed fixture fails closed rather than becoming a general scan exclusion.

## Legal boundary

This engineering evidence does not determine the complete legal meaning of
AGPL corresponding source. The archive conservatively includes all project
source visible to Git plus every Grafana source file identified by the shipped
bundle inventory, build configuration, notices, and upstream license material.
Qualified review must decide whether a public distribution should additionally
offer the complete upstream Grafana repository or other material.

Issue #64 remains `blocked-legal-review` for the exact components recorded in
`licenses/dependency-inventory.json`. A passing issue #65 tool does not clear
those conflicts and does not make the project publication-ready.
