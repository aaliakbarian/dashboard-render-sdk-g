# React SDK integration

Dashboard Render SDK G is currently a set of private repository workspaces. It
is not published to npm and has no supported external installation command. This
guide describes the exact integration used by the checked-in React hosts.

The current compatibility cell is:

- Grafana OSS 13.2.3 and the stable `dashboard.grafana.app/v1` DTO endpoint;
- V1 dashboard schema 42 in namespace `default`;
- host-owned React 19.2.8 and ReactDOM 19.2.8;
- `@grafana/scenes` 8.13.5; and
- the bounded panel, TestData, and transformation profiles in the
  [Phase 2 support matrix](../architecture/production/phase-2-native-rendering-support.md).

The three private workspaces used by a host are
`@dashboard-render-sdk-g/core`, `@dashboard-render-sdk-g/provider-contract`,
and `@dashboard-render-sdk-g/provider-13`. Their current versions are
`0.0.0-private`. Keep the repository's pinned dependency graph; do not treat
these names as packages available from a public registry.

## Responsibility boundary

The browser host must:

1. establish an authorized Grafana session;
2. own one physical React/ReactDOM runtime;
3. decide which origin, path, redirects, headers, and requests are allowed;
4. execute HTTP with its own cookies or credentials; and
5. mount and unmount the React tree.

The host must not pass OIDC access tokens, Grafana credentials, cookies, or
organization-selection headers to the SDK. In the standalone reference app,
Keycloak authenticates the SPA first, then Grafana Generic OAuth independently
creates an HTTP-only Viewer session cookie. The executor below sends that cookie
through `credentials: 'same-origin'`; the cookie never becomes SDK data.

Core validates the non-secret transport descriptor and normalizes transport
outcomes. Provider 13 builds Grafana-specific request paths, validates and
classifies the dashboard, owns the pinned runtime cohort, and renders the
admitted panels. No SDK backend or Grafana application shell is involved.

## Build and resolve the provider artifact

Provider 13 is a production-shaped, separately built browser artifact. The
workspace package export points at source used by the provider build; a host
must not ask its application bundler to compile that Grafana source closure
directly. Build the artifact before starting or building the host:

```bash
docker compose --env-file dev/grafana/.env run --rm --no-deps dev yarn build:provider-13
```

The host's Vite configuration must resolve the provider package to that
artifact and deduplicate the host-owned React modules. This is the essential
part of the checked-in [standalone demo configuration](../../demo/standalone/vite.config.ts):

```ts
import react from '@vitejs/plugin-react';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const hostRoot = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [{
      find: /^@dashboard-render-sdk-g\/provider-13$/,
      replacement: resolve(hostRoot, '../../artifacts/sdk/provider-13/provider.js'),
    }],
    dedupe: ['react', 'react-dom'],
  },
});
```

Adjust only the repository-relative artifact path for the host's location. Its
TypeScript program needs `vite/client` for the `import.meta.hot` lifecycle hook
shown below, and a local declaration for the built provider module. The
checked-in host uses this declaration:

```ts
import type { ComponentType } from 'react';
import type {
  HostReactRuntime,
  ProviderDashboardRendererProps,
  RendererProvider,
} from '@dashboard-render-sdk-g/provider-contract';

declare module '@dashboard-render-sdk-g/provider-13' {
  export const Grafana13DashboardRenderer: ComponentType<ProviderDashboardRendererProps>;
  export const grafana13Provider: RendererProvider;
  export function assertCompatibleHostReactRuntime(hostReact: HostReactRuntime): unknown;
}
```

These are repository integration steps, not public package installation
instructions. The demo Compose service already builds the artifact before its
Vite server starts.

## Complete host example

The example uses the same fail-closed endpoint and query profile as the
standalone demo. A production host may use a different proxy prefix, but it must
enforce an equally explicit destination, redirect, credential, organization,
and request policy.

<!-- sdk-integration-example:start -->
```tsx
import {
  createDashboardRenderSdk,
  createHostTransportCapability,
  GrafanaDashboard,
  type DashboardRenderSdk,
} from '@dashboard-render-sdk-g/core';
import {
  assertCompatibleHostReactRuntime,
  Grafana13DashboardRenderer,
  grafana13Provider,
} from '@dashboard-render-sdk-g/provider-13';
import type {
  DashboardRenderStatus,
  HostReactRuntime,
  HostTransportExecutor,
  HostTransportResponse,
  TransportRequest,
} from '@dashboard-render-sdk-g/provider-contract';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as ReactDOMClient from 'react-dom/client';
import * as JsxDevRuntime from 'react/jsx-dev-runtime';
import * as JsxRuntime from 'react/jsx-runtime';
import { useState } from 'react';

const datasourceType = 'grafana-testdata-datasource';
const datasourceUid = 'grsdk-testdata';
const dtoPath =
  /^\/apis\/dashboard\.grafana\.app\/v1\/namespaces\/default\/dashboards\/[A-Za-z0-9_-]{1,40}\/dto$/;
const sensitiveResponseHeaders = new Set([
  'set-cookie',
  'set-cookie2',
  'authorization',
  'proxy-authorization',
  'authentication-info',
  'proxy-authentication-info',
]);

const hostReact: HostReactRuntime = Object.freeze({
  identities: Object.freeze({
    react: React,
    reactDom: ReactDOM,
    reactDomClient: ReactDOMClient,
    jsxRuntime: JsxRuntime,
    jsxDevRuntime: JsxDevRuntime,
  }),
  versions: Object.freeze({
    react: React.version,
    reactDom: ReactDOM.version,
  }),
});

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function onlyKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  return Object.keys(value).every(key => allowed.includes(key));
}

function positiveInteger(value: unknown, maximum: number): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) &&
    value > 0 && value <= maximum;
}

function exactHeaderProfile(request: TransportRequest): boolean {
  const allowedPlugins = new Set([
    'stat', 'timeseries', 'table', 'gauge', 'bargauge', 'piechart', 'barchart',
  ]);
  const seen = new Set<string>();
  for (const [rawName, value] of request.headers ?? []) {
    const name = rawName.toLowerCase();
    if (seen.has(name)) return false;
    seen.add(name);
    if (name === 'x-plugin-id' && value === datasourceType) continue;
    if (name === 'x-datasource-uid' && value === datasourceUid) continue;
    if (name === 'content-type' && value === 'application/json') continue;
    if (name === 'x-dashboard-uid' && /^[A-Za-z0-9_-]{1,40}$/.test(value)) continue;
    if (name === 'x-panel-id' && /^[1-9][0-9]{0,9}$/.test(value) &&
        Number(value) <= 2_147_483_647) continue;
    if (name === 'x-panel-plugin-id' && allowedPlugins.has(value)) continue;
    if ((name === 'x-dashboard-title' || name === 'x-panel-title') &&
        /^[\x20-\x7e]{1,256}$/.test(value)) continue;
    return false;
  }
  return true;
}

function exactQueryBody(body: string | undefined): boolean {
  if (typeof body !== 'string' || body.length > 16_384) return false;
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return false;
  }
  if (!record(parsed) || !onlyKeys(parsed, ['queries', 'from', 'to']) ||
      !Array.isArray(parsed.queries) || parsed.queries.length !== 1) {
    return false;
  }
  if (typeof parsed.from !== 'string' || typeof parsed.to !== 'string' ||
      !/^[0-9]{1,16}$/.test(parsed.from) || !/^[0-9]{1,16}$/.test(parsed.to)) {
    return false;
  }
  const from = Number(parsed.from);
  const to = Number(parsed.to);
  if (!Number.isSafeInteger(from) || !Number.isSafeInteger(to) ||
      from >= to || to - from > 86_400_000) return false;

  const query: unknown = parsed.queries[0];
  if (!record(query) || !onlyKeys(query, [
    'refId', 'scenarioId', 'alias', 'pulseWave', 'datasource',
    'datasourceId', 'intervalMs', 'maxDataPoints',
  ]) || query.refId !== 'A' || query.scenarioId !== 'predictable_pulse' ||
      typeof query.alias !== 'string' || !/^[\x20-\x7e]{0,256}$/.test(query.alias) ||
      !record(query.datasource) || !onlyKeys(query.datasource, ['type', 'uid']) ||
      query.datasource.type !== datasourceType || query.datasource.uid !== datasourceUid ||
      (query.datasourceId !== undefined &&
        !positiveInteger(query.datasourceId, 2_147_483_647)) ||
      !positiveInteger(query.intervalMs, 86_400_000) ||
      !positiveInteger(query.maxDataPoints, 10_000) ||
      !record(query.pulseWave) || !onlyKeys(query.pulseWave, [
        'offCount', 'offValue', 'onCount', 'onValue', 'timeStep',
      ])) return false;
  const pulse = query.pulseWave;
  return pulse.offCount === 5 && pulse.offValue === 10 &&
    pulse.onCount === 5 && pulse.onValue === 90 && pulse.timeStep === 1;
}

function allowedRequest(request: TransportRequest): boolean {
  if (request.method === 'GET') {
    const headers = request.headers ?? [];
    const acceptOnly = headers.length === 0 || (headers.length === 1 &&
      headers[0]?.[0].toLowerCase() === 'accept' &&
      headers[0]?.[1] === 'application/json');
    return request.body === undefined && (request.query?.length ?? 0) === 0 &&
      acceptOnly && (request.path === '/api/health' ||
        request.path === '/apis/dashboard.grafana.app/' ||
        request.path === '/api/frontend/settings' || dtoPath.test(request.path));
  }
  if (request.method !== 'POST' || request.path !== '/api/ds/query' ||
      !exactHeaderProfile(request) || !exactQueryBody(request.body)) return false;
  const query = request.query ?? [];
  if (query.length < 1 || query.length > 2) return false;
  const seen = new Set<string>();
  for (const [name, value] of query) {
    if (seen.has(name)) return false;
    seen.add(name);
    if (name === 'ds_type') {
      if (value !== datasourceType) return false;
    } else if (name === 'requestId') {
      if (!/^[A-Za-z0-9_-]{1,128}$/.test(value) || value !== request.requestId) return false;
    } else {
      return false;
    }
  }
  return seen.has('ds_type');
}

function createBrowserExecutor(origin: string): HostTransportExecutor {
  return async (request): Promise<HostTransportResponse> => {
    if (!allowedRequest(request)) {
      throw new Error('The host transport policy rejected the request.');
    }
    const url = new URL(`/grafana${request.path}`, origin);
    for (const [name, value] of request.query ?? []) url.searchParams.append(name, value);
    const headers = new Headers(request.headers?.map(([name, value]) => [name, value]));
    if (request.method === 'POST') headers.set('Content-Type', 'application/json');
    const response = await fetch(`${url.pathname}${url.search}`, {
      ...(request.body === undefined ? {} : { body: request.body }),
      credentials: 'same-origin',
      headers,
      method: request.method,
      redirect: 'error',
      signal: request.signal,
    });
    return Object.freeze({
      body: await response.text(),
      headers: Object.freeze([...response.headers.entries()]
        .filter(([name]) => !sensitiveResponseHeaders.has(name.toLowerCase()))
        .map(([name, value]) => Object.freeze([name, value] as const))),
      status: response.status,
    });
  };
}

function initializeSdk(origin: string): DashboardRenderSdk {
  // This checks the actual host module objects as well as their version strings.
  assertCompatibleHostReactRuntime(hostReact);

  const transport = createHostTransportCapability({
    schemaVersion: 1,
    targetOrigin: origin,
    basePath: '/grafana',
    securityScopeId: 'host-grafana-viewer-session',
    requestPolicyId: 'host-bounded-grafana-13-read-v1',
  }, createBrowserExecutor(origin));
  if (!transport.valid) throw new Error('Host transport configuration is invalid.');

  const creation = createDashboardRenderSdk({
    provider: grafana13Provider,
    renderer: Grafana13DashboardRenderer,
    hostReact,
    transport: transport.capability,
    namespace: 'default',
  });
  if (!creation.valid) throw new Error('Dashboard SDK configuration is invalid.');
  return creation.sdk;
}

const sdk = initializeSdk(window.location.origin);

export function DashboardHost() {
  const [uid, setUid] = useState('drsdk-g-phase2-visualizations');
  const [status, setStatus] = useState<DashboardRenderStatus>();

  return (
    <main>
      <button type="button" onClick={() => setUid('another-valid-uid')}>
        Switch dashboard
      </button>
      <output aria-live="polite">
        {status?.kind ?? 'not-started'}
      </output>
      <GrafanaDashboard sdk={sdk} uid={uid} onStatusChange={setStatus} />
    </main>
  );
}

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Missing React root.');
const root = ReactDOMClient.createRoot(rootElement);
root.render(<React.StrictMode><DashboardHost /></React.StrictMode>);

// The host's normal React teardown is the SDK teardown boundary.
if (import.meta.hot) import.meta.hot.dispose(() => root.unmount());
```
<!-- sdk-integration-example:end -->

This executor deliberately accepts only the endpoints, methods, headers, and
Predictable Pulse request shape required by the current support cell. Provider
checks are not authorization: the host is still responsible for server-side
access controls and for preventing redirects or proxy mappings to unapproved
destinations. Adapt the policy when the host's deployment path differs from
`/grafana`; do not broaden it to an arbitrary Grafana proxy.

## Loading, errors, and unsupported panels

`onStatusChange` receives a `DashboardRenderStatus` union:

- `loading` while a UID generation is retrieving or starting;
- `ready` with supported and unsupported panel counts;
- `unsupported-dashboard` for a target-version, schema, or dashboard-profile
  rejection; or
- `error` with a typed, sanitized failure code.

The provider displays `Loading dashboard.`, `Dashboard is not supported.`, or
`Dashboard unavailable.` for those dashboard states. Do not render raw HTTP
bodies, thrown causes, response headers, or credentials in a host error view.
Authentication outcomes remain distinct: the current renderer normalizes 401 to
`unauthorized`, 403 to `forbidden`, and 404 to `not-found`.

A structurally valid schema-42 dashboard can render partially. Each panel that
falls outside the exact support matrix keeps its title and grid position but
becomes a white `Not-Supported` placeholder. Unsupported panel models contain no
executable query, transformation, or plugin state. Invalid identity, layout,
schema, rows/tabs/repeat/library features, or other dashboard-level unsafe input
does not become a partial success.

## UID changes and lifecycle

Pass the selected UID as a normal React prop. A changed `uid` creates a new
provider generation, aborts stale retrieval/query work, releases the old scene,
and suppresses late status callbacks. No page reload or SDK recreation is
needed. Use a stable SDK handle when the provider, security scope, and transport
configuration have not changed.

Unmounting `GrafanaDashboard` releases its dashboard scene, request work,
observers, portal children, and runtime lease. Unmount the application root in
the host's own lifecycle (for example, the Vite HMR disposal shown above). Do
not reach into provider internals or try to dispose the shared Grafana cohort
from an individual dashboard component.

## Authentication checklist

- Establish the Grafana session before rendering the dashboard.
- Keep tokens and credentials in the host authentication layer.
- Use `credentials: 'same-origin'` only with a host-approved same-origin route,
  or implement an equivalently restricted executor for the deployment.
- Reject provider-controlled authentication, cookie, organization, tenant,
  identity-forwarding, and routing headers.
- Reject unexpected redirects and enforce the final destination in the host.
- Give each authorized security context a stable, non-secret `securityScopeId`;
  the string is identity metadata, not proof of authentication.
- Treat 401/403 as session or authorization failures to be handled by the host,
  not as signals to inject credentials into provider requests.

For a runnable implementation of the independent Keycloak and Grafana session
flow, see the [standalone demo](../../demo/standalone/README.md) and its
[host transport](../../demo/standalone/src/transport.ts).

## Current limits

The example is valid only for the exact compatibility cell at the top of this
guide. It does not establish support for arbitrary query bodies, panels,
datasources, transforms, Grafana editions or versions, dashboard V2, strict
nonce-only CSP, server-side rendering, or multiple incompatible provider
cohorts in one JavaScript realm. Consult the support matrix before changing a
dashboard or host policy.
