# `@dashboard-render-sdk-g/core`

Private, experimental core skeleton for Dashboard Render SDK G.

This workspace is `AGPL-3.0-only` and is not published. It contains provider-neutral configuration, metadata inspection, compatibility evaluation, host transport, and a thin React shell for an explicitly configured provider renderer.

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

The evaluator does not acquire observations. Server probing, React object-identity checks, loaded-cohort verification, and runtime admission remain provider responsibilities. A matching result is comparison evidence only; it does not establish that the provider can safely initialize or render.

## Host transport capability

The host supplies a trusted executor and non-secret descriptor. Core validates and detaches the descriptor, normalizes provider requests, and exposes a capability that returns `TransportResult` values. The executor returns raw HTTP responses; it remains responsible for authorized connectivity, destination policy, redirects, cookies, credentials, and authentication.

```ts
import type {
  HostTransportDescriptor,
  HostTransportExecutor,
} from '@dashboard-render-sdk-g/provider-contract';
import { createHostTransportCapability } from '@dashboard-render-sdk-g/core';

const descriptor: HostTransportDescriptor = {
  schemaVersion: 1,
  targetOrigin: 'https://observability.example.invalid',
  basePath: '/dashboard-service',
  securityScopeId: 'organization-1',
  requestPolicyId: 'browser-session-policy-v1',
};

const hostExecutor: HostTransportExecutor = async (request) => {
  // The host privately maps descriptor + request, supplies its credentials,
  // applies its redirect/destination policy, and performs authorized HTTP.
  // This deterministic example performs no network request.
  return {
    status: 200,
    headers: [['content-type', 'application/json']],
    body: JSON.stringify({ requestId: request.requestId }),
  };
};

const creation = createHostTransportCapability(descriptor, hostExecutor);

if (creation.valid) {
  const result = await creation.capability.execute({
    requestId: 'request-1',
    method: 'GET',
    path: '/api/dashboard',
    query: [['uid', 'dashboard-uid']],
    signal: new AbortController().signal,
  });

  // result is a normalized response, cancellation, network error, or policy error.
}
```

Provider paths are root-relative to the descriptor's `basePath`; query parameters are separate unencoded pairs. Provider requests cannot set credential-bearing headers or the bounded host-controlled organization, tenant, identity-forwarding, and routing headers. Credentials, cookies, tokens, organization selection, and stricter deployment policy remain private to the host executor.

Completed HTTP exchanges—including 401, 403, and 500—remain response results. Core removes a bounded set of known sensitive response headers such as `Set-Cookie`, but raw response bodies and remaining headers are trusted host data and are not guaranteed credential-free. SDK-generated policy and network errors never include raw causes, response bodies, or headers.

Cancellation preserves the exact host/provider `AbortSignal`. A cancellation result is logical: a non-cooperative executor may continue its underlying work, while late fulfillment or rejection is consumed. Capability construction is not runtime compatibility admission, and issue #87 deliberately issues no stable capability ID.

Binary and streaming bodies, provider-13 and Grafana API adaptation, dashboard retrieval, retries, caching, runtime binding, and observability services remain deferred.

## React rendering shell

`createDashboardRenderSdk(configuration)` accepts the existing `provider` plus a
`renderer`, `hostReact`, and `transport`, with an optional `namespace` (default
`default`). Creation delegates manifest inspection once, retains its canonical
validated snapshot, and returns either typed creation errors or a frozen SDK
handle exposing `providerId` and `providerBuildId`. Creation executes no renderer,
network request, or runtime initialization. Host module identities and transport
remain opaque references; the provider owns physical runtime admission.

After successful creation, render the configured provider through React:

```tsx
<GrafanaDashboard sdk={result.sdk} uid={uid} onStatusChange={onStatusChange} />
```

Changing `uid` or the SDK replaces the provider subtree and its opaque instance
identifier. Status callbacks from replaced or unmounted renderers are suppressed,
including callbacks from provider cleanup. The provider owns request cancellation,
runtime leases, and scene cleanup. React `19.2.8` is an exact host-owned peer;
core does not depend on ReactDOM or a concrete provider.

No registry, runtime acquisition, session, calendar, or imperative mounting API is
exposed by this shell. Gregorian/Jalali calendar support remains deferred.
