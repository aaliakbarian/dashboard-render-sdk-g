# `@dashboard-render-sdk-g/core`

Private, experimental core skeleton for Dashboard Render SDK G.

This workspace is `AGPL-3.0-only`, is not published, and does not render dashboards. It contains only the initial provider-neutral configuration, metadata-inspection, and pure compatibility-evaluation boundaries for Phase 2.

## Current API

`CoreSdkConfiguration` requires one explicit host-supplied `RendererProvider`. The provider is trusted executable configuration selected by the host; core does not sandbox arbitrary provider objects or throwing provider getters.

`inspectConfiguredProvider(configuration)` reads the configured provider's manifest once and delegates it to the canonical provider-contract validator. The result is `ProviderMetadataInspectionResult`, an alias of the existing `ManifestValidationResult` discriminated union.

A `valid: true` result means only that the manifest is structurally valid. It does not prove runtime compatibility, perform compatibility admission, initialize a provider, create a runtime, or start a dashboard session. Authentication and authorized connectivity to Grafana remain host-owned.

After structural inspection succeeds, `evaluateProviderCompatibility(inspection, observations)` compares explicit caller-supplied metadata with the manifest's exact target cell, React/ReactDOM requirements, and runtime dependency set:

```ts
const inspection = inspectConfiguredProvider(configuration);

if (inspection.valid) {
  const evaluation = evaluateProviderCompatibility(inspection, {
    host: { reactDomVersion: '19.2.8', reactVersion: '19.2.8' },
    runtimeDependencies: [{ id: '@example/runtime', version: '1.2.3' }],
    target: { edition: 'default', family: 'example', version: '1.2.3' },
  });

  // This is declared metadata equality only, never executable admission.
  if (evaluation.outcome === 'declared-requirements-match') {
    // A later Stage B boundary must still verify and admit the loaded runtime.
  }
}
```

The evaluator does not acquire observations. Server probing, React object-identity checks, loaded-cohort verification, runtime admission and identity, transport, provider execution, and rendering remain deferred. A matching result is comparison evidence only; it does not establish that the provider can safely initialize or render.

The package currently exports no SDK factory, provider registry, runtime acquisition API, React component, hook, calendar implementation, renderer, or transport.

## Future React-first API

The intended integration is conceptually:

```tsx
<GrafanaDashboard sdk={sdk} uid={uid} calendar="jalali" />
```

This snippet documents future design intent and is not runnable with the current package.

- React is the first planned integration surface.
- `uid` represents a normal Grafana dashboard UID and may be changed dynamically through React props.
- `calendar` will accept `gregorian` or `jalali`, with `gregorian` as the default.
- Jalali support will affect only the dashboard date/time picker. It will not change panel date formatting and will not automatically select a timezone.
- The concrete SDK handle/factory, component, hooks, rendering and session behavior, and calendar implementation are deferred.
- An imperative DOM mounting API is also deferred.
