// POC / EXPERIMENT / NOT FOR PRODUCTION
import {
  GrafanaDashboard,
  POC_GATE_C_TEXT_STAT_TIMESERIES_PANEL_CATALOG,
  PocGrafanaProviders,
  acquirePocRuntime,
  createPocQueryEvidenceRecorder,
  createPocStyleModeManager,
  inspectPocRuntime,
  type PocDashboardSceneRoot,
  type PocRuntimeLease,
} from '@grafana-react-sdk/poc-compat';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { createSharedGrafanaCohortProvider } from '../../bundle/shared-grafana-cohort/providerBootstrap.ts';
import type { SharedCohortEvent } from '../../bundle/shared-grafana-cohort/sharedCohortLoader.ts';
import type { LazyPanelLoadEvent } from '../../bundle/lazy-panel-chunks/closedLazyPanelCatalog.ts';

export const HOST_CSS_PROFILES = [
  'baseline',
  'reset',
  'typography',
  'layout',
  'controls',
  'framework',
  'important',
] as const;
export type HostCssProfile = (typeof HOST_CSS_PROFILES)[number];

const query = new URLSearchParams(window.location.search);
const requestedProfile = query.get('profile');
const initialProfile: HostCssProfile = HOST_CSS_PROFILES.includes(requestedProfile as HostCssProfile)
  ? (requestedProfile as HostCssProfile)
  : 'baseline';
const initiallyMounted = query.get('mounted') !== '0';
const initiallyTwo = query.get('instances') === '2';
const browserRequest = window.fetch.bind(window);
const cohortEvents: SharedCohortEvent[] = [];
const pluginEvents: LazyPanelLoadEvent[] = [];
const queryEvidence = createPocQueryEvidenceRecorder();
const scenes: PocDashboardSceneRoot[] = [];
const provider = createSharedGrafanaCohortProvider({
  cohortEvidence: { record: (event) => cohortEvents.push(structuredClone(event)) },
  panelEvidence: { record: (event) => pluginEvents.push(structuredClone(event)) },
});
const runtimePanelCatalog = Object.freeze({
  ...POC_GATE_C_TEXT_STAT_TIMESERIES_PANEL_CATALOG,
  pluginImportUtils: provider.panels,
});
const loadTestDataClass = async () => (await provider.loadTestData()).plugin.DataSourceClass;
const styleManager = createPocStyleModeManager(document.documentElement);

function markPortalSurface() {
  const portal = document.getElementById('grafana-portal-container');
  if (!portal) return;
  portal.dataset.grsdkSurface = 'portal';
  portal.dataset.grsdkProvider = 'grafana-13.2.3';
  portal.dataset.grsdkTheme = 'light';
}

export function inspectHostCssContainment() {
  return {
    cohortEvents: structuredClone(cohortEvents),
    pluginEvents: structuredClone(pluginEvents),
    profile: document.body.dataset.hostCssProfile,
    queryEvents: queryEvidence.snapshot(),
    runtime: inspectPocRuntime(),
    scenes: scenes.map((scene) => ({ active: scene.isActive, uid: scene.state.uid })),
    style: styleManager.inspect(),
  };
}

export function HostCssContainmentApp() {
  const [mounted, setMounted] = useState(initiallyMounted);
  const [profile, setProfile] = useState(initialProfile);
  const [runtime, setRuntime] = useState<PocRuntimeLease>();
  const [runtimeError, setRuntimeError] = useState<string>();
  const [uid, setUid] = useState<'grsdk-phase0-poc' | 'grsdk-phase0-poc-alt'>('grsdk-phase0-poc');
  const [width, setWidth] = useState(1120);
  const [showSecond, setShowSecond] = useState(initiallyTwo);
  const converterCatalog = useMemo(
    () => ({
      identity: 'host-css-containment-text-stat-timeseries',
      panelIds: ['text', 'stat', 'timeseries'] as const,
    }),
    []
  );

  useEffect(() => {
    document.body.dataset.hostCssProfile = profile;
    return () => {
      delete document.body.dataset.hostCssProfile;
    };
  }, [profile]);

  useEffect(() => {
    if (!mounted) {
      setRuntime(undefined);
      setRuntimeError(undefined);
      return;
    }

    let disposed = false;
    let lease: PocRuntimeLease | undefined;
    const styleLease = styleManager.acquire('minimum-scoped');
    void acquirePocRuntime({
      assetBasePath: '/grafana/public/',
      grafanaBasePath: '/grafana',
      locale: 'en-US',
      namespace: 'default',
      panelCatalog: runtimePanelCatalog,
      request: browserRequest,
      theme: 'light',
      timezone: 'browser',
    })
      .then(async (acquired) => {
        lease = acquired;
        await acquired.acquireQueryRuntime({
          evidence: queryEvidence,
          loadDataSourceClass: loadTestDataClass,
          moduleIdentity: 'public/app/plugins/datasource/grafana-testdata-datasource/datasource.ts',
        });
        await Promise.all([
          provider.panels.importPanelPlugin('text'),
          provider.panels.importPanelPlugin('stat'),
          provider.panels.importPanelPlugin('timeseries'),
        ]);
        if (disposed) {
          acquired.release();
          return;
        }
        setRuntime(acquired);
      })
      .catch((error: unknown) => {
        lease?.release();
        if (!disposed) setRuntimeError(error instanceof Error ? error.message : 'Runtime failed.');
      });

    return () => {
      disposed = true;
      setRuntime(undefined);
      lease?.release();
      styleLease.release();
    };
  }, [mounted]);

  const recordScene = useCallback((scene: PocDashboardSceneRoot) => {
    scenes.push(scene);
    markPortalSurface();
  }, []);

  return (
    <main className="host-css-shell" data-testid="host-css-shell">
      <section className="host-css-sentinels" aria-labelledby="host-css-sentinel-title">
        <h1 id="host-css-sentinel-title" data-testid="host-css-heading">Host CSS containment</h1>
        <p data-testid="host-css-text">Host-owned sentinel text must not be restyled by the provider.</p>
        <div className="host-css-sentinel-container" data-testid="host-css-container">
          <button data-testid="host-css-button" type="button">Host button</button>
          <input aria-label="Host input" data-testid="host-css-input" defaultValue="Host input" />
          <svg aria-label="Host shape" data-testid="host-css-svg" height="24" viewBox="0 0 24 24" width="24">
            <circle cx="12" cy="12" fill="currentColor" r="9" />
          </svg>
          <canvas data-testid="host-css-canvas" height="24" width="48" />
        </div>
        <div className="host-css-controls">
          <label>
            Host profile
            <select
              data-testid="host-css-profile"
              onChange={(event) => setProfile(event.target.value as HostCssProfile)}
              value={profile}
            >
              {HOST_CSS_PROFILES.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <button data-testid="toggle-provider" onClick={() => setMounted((value) => !value)} type="button">
            {mounted ? 'Unmount provider' : 'Mount provider'}
          </button>
          <button
            data-testid="switch-uid"
            onClick={() => setUid((value) => value === 'grsdk-phase0-poc' ? 'grsdk-phase0-poc-alt' : 'grsdk-phase0-poc')}
            type="button"
          >
            Switch UID
          </button>
          <button data-testid="resize-provider" onClick={() => setWidth((value) => value === 1120 ? 640 : 1120)} type="button">
            Resize provider
          </button>
          <button data-testid="toggle-secondary" onClick={() => setShowSecond((value) => !value)} type="button">
            Toggle second dashboard
          </button>
        </div>
      </section>

      {mounted ? (
        <section
          aria-label="Grafana provider surface"
          className="grsdk-experiment-provider-surface"
          data-grsdk-instance="host-css-primary"
          data-grsdk-provider="grafana-13.2.3"
          data-grsdk-surface="dashboard"
          data-grsdk-theme="light"
          data-testid="provider-surface"
          style={{ width }}
        >
          {runtimeError ? <div data-testid="runtime-error">{runtimeError}</div> : null}
          {runtime ? (
            <PocGrafanaProviders values={runtime.providerValues}>
              <div className="grsdk-experiment-dashboard-list">
                <GrafanaDashboard
                  catalog={converterCatalog}
                  instanceId="host-css-primary"
                  onSceneReady={recordScene}
                  runtime={runtime}
                  uid={uid}
                />
                {showSecond ? (
                  <GrafanaDashboard
                    catalog={converterCatalog}
                    instanceId="host-css-secondary"
                    onSceneReady={recordScene}
                    runtime={runtime}
                    uid="grsdk-phase0-poc"
                  />
                ) : null}
              </div>
            </PocGrafanaProviders>
          ) : <div data-testid="provider-loading">Preparing provider.</div>}
        </section>
      ) : <output data-testid="provider-unmounted">Provider unmounted</output>}
    </main>
  );
}
