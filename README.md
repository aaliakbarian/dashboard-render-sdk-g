# Dashboard Render SDK G

> **Experimental pre-release project.** There is no published npm SDK yet. The
> repository contains a disposable Phase 0 POC and is beginning private Phase 2
> implementation of the approved architecture; neither is a supported
> production SDK.

Dashboard Render SDK G is an independent open-source SDK project for rendering
supported dashboards compatible with its verified Grafana OSS provider cell as
native React components.

No iframe.  
No Grafana application shell.

The project explores how a host application can select a Grafana dashboard by
UID and render it inside its own React interface while retaining ownership of
navigation, layout, authentication, and product chrome.

## Phase 0 result

**Gate C: PASS**

**Overall Phase 0 decision: REVISE**

The core architectural hypothesis succeeded: native Grafana panel rendering
without an iframe or the Grafana application shell is viable. The controlled
POC renders real Grafana OSS 13.2.3 panels through React 19.2.8 without calling
`GrafanaApp.init`.

`REVISE` does not mean the rendering architecture failed. It records that
production and distribution architecture work was still required when Phase 0
ended. See the complete
[Phase 0 results](docs/architecture/research/poc-results.md).

## Project progression

- **Phase 0 — REVISE:** native rendering succeeded, but production architecture
  still needed definition and validation.
- **Phase 1 — APPROVE:** the production architecture was accepted and now
  authorizes private, experimental Phase 2 implementation. See the
  [Phase 1 production architecture decision](docs/architecture/production/phase1-production-architecture-decision.md).
- **Phase 2 — CURRENT:** the project is implementing and validating the
  production-oriented SDK foundation within that approved architecture.

Phase 1 approval does not authorize public npm or renderer-provider
publication. Public release remains gated by artifact-specific compliance,
conformance, provenance, security, bundle, and maintainer review.

## What works today

The disposable POC has demonstrated:

- dashboard retrieval by user-facing Grafana UID;
- stable V1/schema-42 dashboard DTO validation and constrained DTO-to-Scenes
  conversion;
- real Grafana Text panel rendering;
- a real Grafana TestData datasource and query path;
- real Grafana Stat and Time series rendering from query-backed data;
- time-range updates and manual refresh;
- responsive Time series resizing;
- UID changes, stale-work cancellation, and lifecycle cleanup;
- two compatible simultaneous dashboard instances sharing one runtime safely;
  and
- native React/DOM/canvas rendering with React and ReactDOM 19.2.8, no iframe,
  no Grafana application shell, and no `GrafanaApp.init`.

The controlled Time series comparison was visually close to the Grafana
reference, but the project does not claim pixel-perfect parity.

## Current POC boundary

Current support is intentionally constrained to:

- the exact Grafana OSS 13.2.3 baseline;
- a controlled current-schema V1/schema-42 dashboard fixture;
- Text, Stat, and Time series panels;
- the controlled built-in TestData datasource; and
- selected transformations required by the fixture.

The POC does not establish compatibility with arbitrary panels, plugins,
datasources, dashboard features, Grafana versions, or V2 dashboards. It is
evidence for the approved production architecture, not a general compatibility
promise and not production code to promote wholesale.

## Project boundaries

The intended SDK remains frontend-only. The host owns authentication, routing,
navigation, page chrome, and product-level error handling. The project will not
ship an SDK backend, reproduce Grafana navigation, or bootstrap the Grafana web
application shell.

## Run the POC

There is no SDK package to install. Contributors can run the private POC
workspaces, deterministic Grafana fixture, and verification suite through the
repository's container-first workflow. The host requires only Git, Docker with
Docker Compose, an editor, and the repository checkout.

See [Local development](docs/development/local-development.md) for setup and
commands.

## Documentation and tracking

- [Phase 0 results](docs/architecture/research/poc-results.md)
- [Phase 1 production architecture decision](docs/architecture/production/phase1-production-architecture-decision.md)
- [Standalone rendering POC design](docs/architecture/research/grafana-rendering-poc.md)
- [POC implementation plan](docs/development/poc-implementation-plan.md)
- [Local development](docs/development/local-development.md)
- [Project context](docs/project/project-context.md)
- [Vision](docs/project/vision.md)
- [Roadmap](docs/project/roadmap.md)
- [Phase 0 GitHub milestone](https://github.com/aaliakbarian/dashboard-render-sdk-g/milestone/1)
- [Dashboard Render SDK Roadmap project](https://github.com/users/aaliakbarian/projects/1)

## Contributing

All current packages are private research workspaces and must not be published.
Read [CONTRIBUTING.md](CONTRIBUTING.md), the
[development workflow](docs/project/development-workflow.md), and the
[Code of Conduct](CODE_OF_CONDUCT.md) before proposing a change.

## License

Dashboard Render SDK G project-owned code is licensed under
[AGPL-3.0-only](LICENSE). Third-party dependencies and incorporated upstream
materials retain their applicable licenses and notice requirements; the
project license does not relicense them. See the
[license-adoption record](docs/project/agpl-license-adoption.md) for the
boundary and outstanding release gates.

This license decision does not authorize public package or renderer-provider
distribution. Phase 2 publication remains subject to the third-party
license/notice, source-availability, reproducibility, SBOM, and other release
compliance gates, including
[#64](https://github.com/aaliakbarian/dashboard-render-sdk-g/issues/64) and
[#65](https://github.com/aaliakbarian/dashboard-render-sdk-g/issues/65).

Grafana is a trademark of Grafana Labs. Dashboard Render SDK G is an
independent project and is not affiliated with, endorsed by, or sponsored by
Grafana Labs or its affiliates. References to Grafana identify compatibility
targets only.
