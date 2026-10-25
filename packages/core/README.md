# `@dashboard-render-sdk-g/core`

Private, experimental core skeleton for Dashboard Render SDK G.

This workspace is `AGPL-3.0-only`, is not published, and does not render dashboards. It contains only the initial provider-neutral configuration and metadata-inspection boundary for Phase 2.

## Current API

`CoreSdkConfiguration` requires one explicit host-supplied `RendererProvider`. The provider is trusted executable configuration selected by the host; core does not sandbox arbitrary provider objects or throwing provider getters.

`inspectConfiguredProvider(configuration)` reads the configured provider's manifest once and delegates it to the canonical provider-contract validator. The result is `ProviderMetadataInspectionResult`, an alias of the existing `ManifestValidationResult` discriminated union.

A `valid: true` result means only that the manifest is structurally valid. It does not prove runtime compatibility, perform compatibility admission, initialize a provider, create a runtime, or start a dashboard session. Authentication and authorized connectivity to Grafana remain host-owned.

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
