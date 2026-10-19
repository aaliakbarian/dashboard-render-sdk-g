# Project Context

## Problem

Teams often want an existing Grafana dashboard inside a React product without presenting a second application's frame, navigation, or user experience. An iframe keeps Grafana isolated but limits integration with the host application's layout, styling, lifecycle, and interaction model. Running the Grafana web application shell carries substantially more behavior than an embedded dashboard needs.

## Objective

Create a React and TypeScript SDK that renders an existing Grafana OSS 13 dashboard natively in a React application. The host selects the dashboard by UID and remains responsible for its own application shell.

## Intended users

- React application teams that already operate Grafana OSS 13.
- Platform teams that want a reusable embedding boundary across products.
- Maintainers evaluating whether Grafana's frontend packages can support a smaller, application-neutral runtime.

## Fixed constraints

- No iframe rendering.
- No Grafana web application shell.
- No reproduction of Grafana navigation.
- A frontend-only SDK; the project will not ship a backend.
- Dashboard selection by UID.
- Prefer Grafana's native rendering packages where technically possible.

## Proven Phase 0 evidence

Within the controlled Grafana OSS 13.2.3 POC boundary, Phase 0 proved that:

- Native Grafana panel rendering without an iframe or Grafana application shell
  is feasible.
- Dashboard retrieval by user-facing Grafana UID works through the browser
  transport boundary.
- Constrained current-schema V1/schema-42 dashboard-to-Scenes conversion works.
- Real Grafana Text, Stat, and Time series panels render natively.
- Real TestData datasource query execution reaches Grafana and produces
  `PanelData` through `SceneQueryRunner`.
- React and ReactDOM 19.2.8 work in the tested combination with
  `@grafana/scenes@8.13.5`.
- Multiple compatible dashboards can share one process-wide compatibility
  runtime while retaining independent scene and query lifecycles.

These results prove the core architectural hypothesis only within the
controlled POC. They do not imply general compatibility with arbitrary Grafana
versions, dashboards, panels, plugins, datasources, transformations, or V2
dashboard schemas.

## Approved Phase 1 production architecture

The canonical
[Phase 1 production architecture decision](../architecture/production/phase1-production-architecture-decision.md)
is **APPROVE**. It defines a conceptual provider-neutral core,
provider-contract, exact-version Grafana-compatible provider, and testing /
conformance separation.

The initial verified provider cell is intentionally narrow:

- Grafana OSS 13.2.3 with the exact 13.2.3 package cohort;
- host-owned React and ReactDOM 19.2.8 with provider-owned Scenes 8.13.5;
- stable dashboard API V1 and `schemaVersion: 42`;
- Text, Stat, and Time series panels;
- the controlled TestData query runtime;
- an empty transformation pipeline or one exact `renameByRegex`;
- one compatible Runtime identity per JavaScript realm;
- host-owned transport and authentication; and
- scoped light-DOM presentation with bounded Emotion, portal, asset, CSP, and
  lifecycle ownership.

Project-owned code is `AGPL-3.0-only`. Incorporated third-party material keeps
its applicable licensing and notice requirements. The provider/core boundary
is a technical architecture boundary, not a claimed legal firewall.

## Current Phase 2 implementation boundary

Phase 2 — SDK Foundation and Experimental Package is current. It may implement
and validate the production package foundation, provider contract, core,
exact-version provider, conformance infrastructure, and deliberately rewritten
POC concepts within the approved architecture.

Phase 2 work remains private and experimental. It must not present the POC as
the production SDK, widen the verified compatibility cell without new evidence,
or publish public npm/provider artifacts. Public release remains gated by
[#64](https://github.com/aaliakbarian/dashboard-render-sdk-g/issues/64),
[#65](https://github.com/aaliakbarian/dashboard-render-sdk-g/issues/65), and
applicable candidate-artifact conformance, provenance, security, bundle, and
maintainer release review.

## Remaining limitations and future compatibility questions

The initial architecture deliberately leaves expansion work for later phases:

- additional Grafana versions, dashboard schemas, and V2;
- additional panels, installed plugins, datasources, and dashboard features;
- broader transformation pipelines and input profiles;
- broader browser, bundler, deployment, and micro-frontend matrices;
- dark theme, dynamic theme switching, SSR, and authoring; and
- movement from the initial experimental compatibility tier to a supported
  release claim, including resolution of the React 19 / Scenes peer mismatch.

These are future compatibility or product questions, not unresolved Phase 1
architecture decisions. Every expansion requires explicit provider-manifest
capabilities and conformance evidence.

## Definition of success

The project succeeds when a React application can render a supported existing
dashboard by UID, with documented compatibility and predictable lifecycle
behavior, while the host retains control of navigation and product chrome.
Phase 0 established technical feasibility for the controlled POC, and Phase 1
approved the production architecture. Phase 2 now implements and validates the
experimental SDK foundation. Public-release success additionally requires the
explicit compliance and candidate-artifact gates to pass before any published
compatibility claim.
