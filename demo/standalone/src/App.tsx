import {
  createDashboardRenderSdk,
  createHostTransportCapability,
  GrafanaDashboard,
  type DashboardRenderSdk,
} from '@dashboard-render-sdk-g/core';
import { Grafana13DashboardRenderer, grafana13Provider } from '@dashboard-render-sdk-g/provider-13';
import type { HostReactRuntime } from '@dashboard-render-sdk-g/provider-contract';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as ReactDOMClient from 'react-dom/client';
import * as JsxDevRuntime from 'react/jsx-dev-runtime';
import * as JsxRuntime from 'react/jsx-runtime';
import { useEffect, useState } from 'react';

import type { AuthSessionState } from './authSession';
import { createDemoBrowserExecutor } from './transport';

const phase2Uid = 'drsdk-g-phase2-visualizations';
const uidPattern = /^[A-Za-z0-9_-]{1,40}$/;

const hostReact: HostReactRuntime = Object.freeze({
  identities: Object.freeze({
    react: React, reactDom: ReactDOM, reactDomClient: ReactDOMClient,
    jsxRuntime: JsxRuntime, jsxDevRuntime: JsxDevRuntime,
  }),
  versions: Object.freeze({ react: React.version, reactDom: ReactDOM.version }),
});

export function createStandaloneSdk(origin: string): DashboardRenderSdk {
  const transport = createHostTransportCapability({
    schemaVersion: 1, targetOrigin: origin, basePath: '/grafana',
    securityScopeId: 'standalone-demo-grafana-session',
    requestPolicyId: 'standalone-demo-read-only-dashboard-v1',
  }, createDemoBrowserExecutor(origin));
  if (!transport.valid) throw new Error('The demo transport configuration is invalid.');
  const result = createDashboardRenderSdk({
    provider: grafana13Provider, renderer: Grafana13DashboardRenderer,
    namespace: 'default', hostReact, transport: transport.capability,
  });
  if (!result.valid) throw new Error('The demo SDK configuration is invalid.');
  return result.sdk;
}

interface AppProps {
  readonly initialization: Promise<AuthSessionState>;
  readonly logout: () => void;
  readonly sdk: DashboardRenderSdk;
}

export function App({ initialization, logout, sdk }: AppProps) {
  const [session, setSession] = useState<AuthSessionState>({ status: 'loading' });
  const [collapsed, setCollapsed] = useState(false);
  const [uid, setUid] = useState(phase2Uid);
  const [lookupUid, setLookupUid] = useState(phase2Uid);

  useEffect(() => {
    let active = true;
    void initialization.then(state => { if (active) setSession(state); });
    return () => { active = false; };
  }, [initialization]);

  function selectPhase2() {
    setUid(phase2Uid);
    setLookupUid(phase2Uid);
  }

  return (
    <div className="demo-shell" data-navigation-collapsed={collapsed}>
      <header className="demo-header">
        <div>
          <span className="demo-eyebrow">Standalone reference app</span>
          <h1>Dashboard Render SDK G</h1>
        </div>
        {session.status === 'ready' ? (
          <div className="demo-account">
            <div className="demo-identity">
              <span>{session.user.displayName}</span>
              <small>{session.user.username}</small>
            </div>
            <button type="button" onClick={logout}>Log out</button>
          </div>
        ) : null}
      </header>
      <aside className="demo-sidebar">
        <button
          className="demo-navigation-toggle"
          type="button"
          aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
          aria-expanded={!collapsed}
          aria-controls="demo-dashboard-navigation"
          onClick={() => setCollapsed(value => !value)}
        >
          <span aria-hidden="true">{collapsed ? '»' : '«'}</span>
        </button>
        <nav id="demo-dashboard-navigation" aria-label="Dashboards">
          <button
            className="demo-dashboard-link"
            type="button"
            aria-label="Phase 2 visualizations"
            aria-current={uid === phase2Uid ? 'page' : undefined}
            title="Phase 2 visualizations"
            onClick={selectPhase2}
          >
            <span className="demo-navigation-icon" aria-hidden="true">◫</span>
            <span className="demo-navigation-label">Phase 2 visualizations</span>
          </button>
        </nav>
      </aside>
      <main className="demo-main" aria-label="Dashboard workspace">
        {session.status === 'loading' ? <p role="status">Signing in to Keycloak and Grafana…</p> : null}
        {session.status === 'redirecting' ? <p role="status">Connecting your Grafana session…</p> : null}
        {session.status === 'error' ? <p role="alert">{session.error}</p> : null}
        {session.status === 'ready' ? (
          <>
            <div className="demo-dashboard-heading">
              <div>
                <span className="demo-eyebrow">Grafana native rendering</span>
                <h2>{uid === phase2Uid ? 'Phase 2 visualizations' : 'Dashboard lookup'}</h2>
              </div>
              <form
                className="demo-lookup"
                aria-label="Optional demo dashboard lookup"
                onSubmit={event => {
                  event.preventDefault();
                  if (uidPattern.test(lookupUid)) setUid(lookupUid);
                }}
              >
                <label htmlFor="demo-dashboard-uid">Dashboard UID</label>
                <div className="demo-lookup-controls">
                  <input
                    id="demo-dashboard-uid" value={lookupUid} required maxLength={40}
                    pattern={'[A-Za-z0-9_\\-]{1,40}'}
                    aria-describedby="demo-lookup-help"
                    onChange={event => setLookupUid(event.currentTarget.value)}
                  />
                  <button type="submit" disabled={!uidPattern.test(lookupUid)}>Open dashboard</button>
                </div>
                <small id="demo-lookup-help">Optional demo lookup by UID</small>
              </form>
            </div>
            <section className="demo-dashboard" aria-label="Grafana dashboard">
              <GrafanaDashboard sdk={sdk} uid={uid} />
            </section>
          </>
        ) : null}
      </main>
    </div>
  );
}
