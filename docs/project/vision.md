# Vision

## Product vision

Dashboard Render SDK G should make a supported Grafana dashboard feel like a
native region of a React product rather than a separately embedded application.
Teams should be able to reuse dashboards they already operate while preserving
their own navigation, layout, and application identity.

## Experience principles

### Native composition

The dashboard participates in the host React tree and lifecycle. It must not rely on an iframe or expose Grafana's application shell.

### Small host contract

The host should provide only the information and capabilities that cannot belong to a reusable SDK, such as the dashboard UID, Grafana endpoint, authorization-aware request behavior, container size, and selected integration options.

### Grafana fidelity

Prefer Grafana-maintained rendering primitives and data types where they work outside the Grafana shell. Compatibility should be measured and documented rather than implied.

### Host ownership

The host owns routing, navigation, page chrome, authentication decisions, and product-level error experiences. The SDK owns the dashboard rendering boundary.

### Explicit compatibility

Supported Grafana versions, dashboard features, panel types, and plugin assumptions should be published as a compatibility contract. Unsupported behavior should fail clearly rather than degrade invisibly.

## Current validation status

- Phase 0 proved the core native-rendering hypothesis with a controlled Grafana
  OSS 13.2.3 POC.
- Gate C passed. The overall Phase 0 decision is **REVISE**, not failure:
  native rendering is viable, while the production and distribution
  architecture still requires work.
- Phase 1 — Production Architecture and Distribution Strategy is determining
  the architecture, compatibility, and distribution model that may support a
  production SDK.

The POC evidence is intentionally constrained and is not a general Grafana
compatibility claim or a supported production release.

## Non-goals

The project does not aim to:

- replace Grafana;
- provide dashboard authoring or administration;
- reproduce Grafana Home, Explore, Alerting, or navigation;
- bypass Grafana authorization or data-source controls;
- provide server-side rendering in the initial scope; or
- promise support for every third-party panel plugin.

## Long-term outcome

The desired outcome remains a focused, versioned React SDK with a documented
integration surface, a tested Grafana compatibility matrix, examples, and
migration guidance. Phase 0 established that the core native-rendering approach
is feasible. Phase 1 now uses that evidence to select a production architecture
and distribution model before SDK implementation and release work begins.
