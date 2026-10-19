# AGPL-3.0-only License Adoption

## 1. Maintainer decision

On 2026-10-19, the maintainer selected `AGPL-3.0-only` for project-owned
Dashboard Render SDK G code. This implements GitHub issue `#69` following the
[Phase 1 compliance audit](../architecture/production/agpl-compliance-audit.md).

## 2. Effective project-owned license

The repository's canonical [LICENSE](../../LICENSE) is the unmodified
[GNU Affero General Public License version 3](https://www.gnu.org/licenses/agpl-3.0.txt)
text. The intended SPDX identifier is `AGPL-3.0-only`; the project grants no
“or later” option and adds no exception.

This decision applies only to code and documentation the project owns or is
authorized to license. It does not expand the supported product boundary or
authorize package publication.

## 3. Third-party licensing boundary

| Material | Licensing boundary |
| --- | --- |
| Project-owned code and documentation | `AGPL-3.0-only` |
| Grafana application source covered by upstream AGPL terms | Retains the applicable upstream AGPL terms |
| Published Grafana packages and other Apache-covered material | Retain Apache-2.0 where applicable |
| Other packages and assets | Retain their applicable MIT, BSD, OFL, Unlicense, or other upstream terms |

The project license does not relicense dependencies, Grafana-derived source,
or other incorporated upstream material. Artifact-specific license and notice
work remains a release gate.

## 4. Package metadata decisions

The root workspace and the three disposable POC workspaces declare
`"license": "AGPL-3.0-only"` for their project-owned code:

- [`package.json`](../../package.json);
- [`apps/poc-host/package.json`](../../apps/poc-host/package.json);
- [`packages/poc-compat/package.json`](../../packages/poc-compat/package.json);
  and
- [`packages/poc-grafana-bridge/package.json`](../../packages/poc-grafana-bridge/package.json).

All four remain private, unpublished `0.0.0-poc` workspaces. The bridge field
describes its project-owned adapters, loaders, and provenance definitions; it
does not relicense Grafana source or packages that the bridge references.

## 5. Contribution policy

[CONTRIBUTING.md](../../CONTRIBUTING.md) uses an inbound-equals-outbound rule:
contributors must have the right to submit their contribution and provide it
under `AGPL-3.0-only`. The project currently requires no CLA, copyright
assignment, or DCO.

## 6. Release gates still outstanding

License adoption alone does not authorize a public npm or renderer-provider
release. Phase 2 publication remains blocked on at least:

- issue `#64` — artifact-specific third-party licenses and notices;
- issue `#65` — source availability, reproducibility, and SBOM controls; and
- every other explicit security, provenance, trademark, compatibility, and
  release-compliance gate applicable to the candidate artifact.

No `THIRD_PARTY_NOTICES` file or public package is created by this decision.

## 7. Historical-documentation policy

Completed Phase 0 and Phase 1 documents may accurately say that the license
was undecided or a placeholder at the time of that research. Those statements
remain historical evidence. Current-state documentation must use this decision
without erasing unresolved third-party or distribution obligations.

## 8. Validation

The adoption change must verify:

- byte-for-byte canonical AGPLv3 license text and standard license detection;
- valid package JSON, immutable dependency installation, and unchanged private
  workspace status;
- workspace discovery, type checking, and unit tests;
- Markdown structure, local links, and clean whitespace; and
- no dependency, lockfile, runtime-source, third-party-license, or
  publishability change.

Bulk SPDX source headers are intentionally deferred to a future automated
compliance/release-gate task.

## 9. Follow-up

Complete issues `#64` and `#65`, generate artifact-specific license/notice and
source-provenance outputs, and run all remaining release gates before any
Phase 2 publication decision.
