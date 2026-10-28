import {
  GrafanaDashboard,
  createDashboardRenderSdk,
  createHostTransportCapability,
  type DashboardRenderSdk,
} from '@dashboard-render-sdk-g/core';
import {
  Grafana13DashboardRenderer,
  assertCompatibleHostReactRuntime,
  grafana13Provider,
} from '@dashboard-render-sdk-g/provider-13';
import type {
  DashboardRenderStatus,
  HostReactRuntime,
} from '@dashboard-render-sdk-g/provider-contract';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as ReactDOMClient from 'react-dom/client';
import * as JsxDevRuntime from 'react/jsx-dev-runtime';
import * as JsxRuntime from 'react/jsx-runtime';
import { useMemo, useState } from 'react';

import { createSdkHostBrowserExecutor } from './transport';

const PRIMARY_UID = 'grsdk-phase0-poc';
const ALTERNATE_UID = 'grsdk-phase0-poc-alt';

const hostReact: HostReactRuntime = Object.freeze({
  identities: Object.freeze({
    jsxDevRuntime: JsxDevRuntime,
    jsxRuntime: JsxRuntime,
    react: React,
    reactDom: ReactDOM,
    reactDomClient: ReactDOMClient,
  }),
  versions: Object.freeze({ react: React.version, reactDom: ReactDOM.version }),
});

function inspectAdmission(): string {
  try {
    assertCompatibleHostReactRuntime(hostReact);
    return 'compatible';
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    for (const identity of ['reactDomClient', 'jsxDevRuntime', 'jsxRuntime', 'reactDom', 'react']) {
      if (message.includes(identity)) return `identity:${identity}`;
    }
    if (message.includes('host React and ReactDOM versions')) return 'version:host-claim-cell';
    if (message.includes('actual ReactDOM namespace version')) return 'version:provider-or-host-react-dom-namespace';
    if (message.includes('actual React namespace version')) return 'version:provider-or-host-react-namespace';
    if (message.includes('version evidence')) return 'version:host-evidence';
    return 'invalid';
  }
}

const admissionDiagnostic = inspectAdmission();

function createSdk(securityScopeId = 'sdk-host-grafana-session'): DashboardRenderSdk {
  const transport = createHostTransportCapability(
    {
      basePath: '/grafana',
      requestPolicyId: 'sdk-host-read-only-dashboard-v1',
      schemaVersion: 1,
      securityScopeId,
      targetOrigin: window.location.origin,
    },
    createSdkHostBrowserExecutor(window.location.origin)
  );
  if (!transport.valid) throw new Error('The SDK host transport configuration is invalid.');
  const creation = createDashboardRenderSdk({
    hostReact,
    namespace: 'default',
    provider: grafana13Provider,
    renderer: Grafana13DashboardRenderer,
    transport: transport.capability,
  });
  if (!creation.valid) throw new Error('The SDK host configuration is invalid.');
  return creation.sdk;
}

const sdk = createSdk();
const conflictingSdk = createSdk('sdk-host-conflicting-session');

function DashboardStatus({ status }: { readonly status?: DashboardRenderStatus }) {
  return (
    <output
      data-sdk-status={status?.kind ?? 'not-started'}
      data-sdk-status-uid={status?.uid ?? ''}
      data-testid="sdk-dashboard-status"
    >
      {status?.kind ?? 'not-started'}
    </output>
  );
}

export function App() {
  const [uid, setUid] = useState(PRIMARY_UID);
  const [mounted, setMounted] = useState(true);
  const [twoInstances, setTwoInstances] = useState(false);
  const [useConflict, setUseConflict] = useState(false);
  const [status, setStatus] = useState<DashboardRenderStatus>();
  const [secondaryStatus, setSecondaryStatus] = useState<DashboardRenderStatus>();
  const selectedSdk = useMemo(() => (useConflict ? conflictingSdk : sdk), [useConflict]);

  return (
    <main data-sdk-host="">
      <header className="sdk-host-header">
        <h1>Dashboard Render SDK G</h1>
        <p data-testid="sdk-host-sentinel">Host remains functional</p>
        <output
          data-host-react-19-2-8={React.version === '19.2.8'}
          data-host-react-dom-19-2-8={ReactDOM.version === '19.2.8'}
          data-testid="sdk-react-admission"
        >
          {admissionDiagnostic}
        </output>
        <nav aria-label="SDK test controls" data-sdk-host-controls="">
          <button data-testid="sdk-switch-uid" onClick={() => setUid((value) => value === PRIMARY_UID ? ALTERNATE_UID : PRIMARY_UID)} type="button">Switch UID</button>
          <button data-testid="sdk-toggle-mount" onClick={() => setMounted((value) => !value)} type="button">Toggle dashboard</button>
          <button data-testid="sdk-toggle-second" onClick={() => setTwoInstances((value) => !value)} type="button">Toggle second dashboard</button>
          <button data-testid="sdk-toggle-conflict" onClick={() => setUseConflict((value) => !value)} type="button">Toggle runtime conflict</button>
        </nav>
        <DashboardStatus status={status} />
        {twoInstances ? <DashboardStatus status={secondaryStatus} /> : null}
      </header>
      <section className="sdk-dashboard-slot" data-testid="sdk-primary-slot">
        {mounted ? (
          <GrafanaDashboard sdk={selectedSdk} uid={uid} onStatusChange={setStatus} />
        ) : null}
      </section>
      {twoInstances ? (
        <section className="sdk-dashboard-slot" data-testid="sdk-secondary-slot">
          <GrafanaDashboard sdk={sdk} uid={ALTERNATE_UID} onStatusChange={setSecondaryStatus} />
        </section>
      ) : null}
    </main>
  );
}
