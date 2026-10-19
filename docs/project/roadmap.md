# Roadmap

The canonical source for project phase names, numbering, goals, and completion
criteria is this roadmap. GitHub milestones and the Dashboard Render SDK Roadmap
project track execution and status against this roadmap.

This roadmap is ordered by evidence and capability, not by calendar date.
Detailed workstream and task status belongs in GitHub issues and the
[Dashboard Render SDK Roadmap project](https://github.com/users/aaliakbarian/projects/1),
not in this document.

## Foundation — COMPLETE

Goal: establish the repository and project-control foundation needed for open
development.

- Repository setup.
- Contribution and code-of-conduct foundation.
- Initial architecture documentation.
- Initial architecture decision records (ADRs).

## Phase 0 — Architecture Research and Native Rendering POC — COMPLETE

Goal: determine whether existing Grafana dashboards can render natively in an
independent React host without an iframe or the Grafana application shell.

- Investigated Grafana OSS 13.2.3 source and package behavior.
- Investigated Scenes, Data, UI, Runtime, and dashboard APIs.
- Built a standalone compatibility runtime.
- Retrieved dashboards by user-facing Grafana UID.
- Converted the controlled current-schema V1/schema-42 subset to Scenes.
- Gate A — Text: **PASS**.
- Real TestData query runtime: **PASS**.
- Gate B — Stat: **PASS**.
- Gate C — Time series: **PASS**.
- Final Phase 0 decision: **REVISE**.

Gate C proved the core native-rendering hypothesis. `REVISE` means the
production and distribution architecture needs further work; it does not mean
the rendering architecture failed. See the
[Phase 0 results](../architecture/research/poc-results.md).

## Phase 1 — Production Architecture and Distribution Strategy — COMPLETE

Goal: turn the Phase 0 evidence into an approved, supportable production
architecture and distribution strategy.

- Resolved Grafana source licensing and distribution direction.
- Defined the bounded provider/core architecture and exact-version capability
  model.
- Established version, Runtime, React/Scenes, bundle, presentation, asset, CSP,
  lifecycle, and transformation policies.
- Completed the required production-shaped conformance experiments.
- Adopted `AGPL-3.0-only` for project-owned code and retained applicable
  third-party licensing boundaries.
- Final Phase 1 decision: **APPROVE**.

Phase 1 approval authorizes private, experimental Phase 2 implementation. It
does not authorize public package or provider publication. See the
[Phase 1 production architecture decision](../architecture/production/phase1-production-architecture-decision.md).

## Phase 2 — SDK Foundation and Experimental Package — CURRENT

Goal: implement the first production-oriented SDK foundation from approved
Phase 1 decisions.

### Implementation and validation

- Establish the production package and workspace structure.
- Implement the provider-contract and provider-neutral core boundaries.
- Implement the experimental exact-version Grafana-compatible provider.
- Establish durable conformance, compatibility, bundle, provenance, security,
  and lifecycle infrastructure.
- Deliberately rewrite and productize approved POC concepts rather than
  promoting disposable POC code wholesale.
- Stabilize known test-harness debt.
- Build and validate the experimental package against the approved
  compatibility cell.

### Publication

Phase 2 implementation does not automatically publish an npm package or
renderer provider. Public publication remains gated by at least:

- [#64 — third-party licenses and notices](https://github.com/aaliakbarian/dashboard-render-sdk-g/issues/64);
- [#65 — source availability, reproducibility, and SBOM](https://github.com/aaliakbarian/dashboard-render-sdk-g/issues/65); and
- applicable candidate-artifact conformance, provenance, security, bundle, and
  maintainer release review.

## Phase 3 — Alpha and Compatibility Expansion — FUTURE

Goal: expand tested compatibility and document supported integration patterns.

- Add supported panels, datasources, and dashboard features.
- Document deployment and authentication patterns.
- Expand theming and host-integration support.
- Publish a tested compatibility matrix.
- Provide migration and versioning guidance.

## Phase 4 — Stable Release — FUTURE

Goal: release a stable SDK only when its compatibility and support claims are
backed by evidence.

- Stabilize the public API.
- Document maintenance and support policy.
- Complete security, accessibility, and operational reviews.
- Back stable compatibility claims with automated and manual tests.

## Historical numbering note

The original roadmap separated repository foundation, integration research,
and the rendering POC into three numbered phases. Those activities were
completed together before the public milestone model was finalized. The
Foundation plus Phase 0–4 numbering in this document is canonical from now on.

## Out of scope until separately approved

- Dashboard editing or persistence.
- Grafana navigation or application-shell features.
- An SDK-operated proxy or backend.
- Server-side rendering.
- Unqualified compatibility with arbitrary panel plugins.
