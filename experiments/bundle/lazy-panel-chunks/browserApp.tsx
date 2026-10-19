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
} from '@dashboard-render-sdk-g/poc-compat';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  createIndependentLazyPanelCatalogWithOptions,
} from './providerBootstrap.ts';
import type { LazyPanelId, LazyPanelLoadEvent } from './closedLazyPanelCatalog.ts';

const allowedModes = ['text', 'stat', 'timeseries', 'all'] as const;
type ProbeMode = (typeof allowedModes)[number];
const selectedIds: Record<ProbeMode, readonly LazyPanelId[]> = {
  all: ['text', 'stat', 'timeseries'],
  stat: ['stat'],
  text: ['text'],
  timeseries: ['timeseries'],
};

const parameters = new URLSearchParams(window.location.search);
const requestedMode = parameters.get('panel');
const mode: ProbeMode = allowedModes.includes(requestedMode as ProbeMode)
  ? (requestedMode as ProbeMode)
  : 'text';
const failFirst = parameters.get('fail');
const pluginEvents: LazyPanelLoadEvent[] = [];
const queryEvidence = createPocQueryEvidenceRecorder();
const scenes: PocDashboardSceneRoot[] = [];
const styleManager = createPocStyleModeManager(document.documentElement);
const catalog = createIndependentLazyPanelCatalogWithOptions({
  evidence: { record: (event) => pluginEvents.push(structuredClone(event)) },
  ...(failFirst === 'stat' || failFirst === 'text' || failFirst === 'timeseries'
    ? { failFirst }
    : {}),
});
let activeRuntime: PocRuntimeLease | undefined;

function queryRunner(scene: PocDashboardSceneRoot | undefined, panelId: number) {
  if (!scene) return undefined;
  const index = scene.state.legacyPanelIds.indexOf(panelId);
  const panel = scene.state.body.state.children[index] as
    | { state?: { body?: { state?: { $data?: unknown } } } }
    | undefined;
  const data = panel?.state?.body?.state?.$data as
    | { state?: { $data?: unknown }; runQueries?: () => void }
    | undefined;
  return panelId === 3
    ? (data?.state?.$data as { runQueries?: () => void } | undefined)
    : data;
}

export function inspectLazyPanelExperiment() {
  return {
    mode,
    pluginEvents: structuredClone(pluginEvents),
    queryEvents: queryEvidence.snapshot(),
    runtime: inspectPocRuntime(),
    scenes: scenes.map((scene) => ({ active: scene.isActive, uid: scene.state.uid })),
  };
}

export function LazyPanelExperimentApp() {
  const [runtime, setRuntime] = useState<PocRuntimeLease>();
  const [runtimeError, setRuntimeError] = useState<string>();
  const [uid, setUid] = useState<'grsdk-phase0-poc' | 'grsdk-phase0-poc-alt'>('grsdk-phase0-poc');
  const [mounted, setMounted] = useState(true);
  const [failureResult, setFailureResult] = useState('idle');
  const converterCatalog = useMemo(
    () => ({ identity: `lazy-panel-${mode}`, panelIds: selectedIds[mode] }),
    []
  );

  useEffect(() => {
    let disposed = false;
    let lease: PocRuntimeLease | undefined;
    const styleLease = styleManager.acquire('minimum-scoped');
    const config = {
      assetBasePath: '/grafana/public/',
      grafanaBasePath: '/grafana',
      locale: 'en-US',
      namespace: 'default',
      panelCatalog: {
        ...POC_GATE_C_TEXT_STAT_TIMESERIES_PANEL_CATALOG,
        pluginImportUtils: catalog,
      },
      request: window.fetch.bind(window),
      theme: 'light',
      timezone: 'browser',
    } as const;

    void acquirePocRuntime(config)
      .then(async (acquired) => {
        lease = acquired;
        if (mode !== 'text') {
          await acquired.acquireQueryRuntime({
            evidence: queryEvidence,
            loadDataSourceClass: async () => {
              const module = await import('../testdata-runtime-only/providerMetadata.ts');
              if (typeof module.plugin.DataSourceClass !== 'function') {
                throw new Error('The runtime-only TestData provider did not expose its constructor.');
              }
              return module.plugin.DataSourceClass;
            },
            moduleIdentity:
              'public/app/plugins/datasource/grafana-testdata-datasource/datasource.ts',
          });
        }
        if (disposed) {
          acquired.release();
          return;
        }
        activeRuntime = acquired;
        setRuntime(acquired);
      })
      .catch((error: unknown) => {
        lease?.release();
        if (!disposed) setRuntimeError(error instanceof Error ? error.message : 'Runtime failed.');
      });

    return () => {
      disposed = true;
      if (activeRuntime === lease) activeRuntime = undefined;
      lease?.release();
      styleLease.release();
    };
  }, []);

  const recordScene = useCallback((scene: PocDashboardSceneRoot) => scenes.push(scene), []);
  const probeFailure = useCallback(async () => {
    try {
      await catalog.importPanelPlugin('stat');
      setFailureResult('success');
    } catch (error: unknown) {
      setFailureResult(
        error && typeof error === 'object' && 'code' in error ? String(error.code) : 'failed'
      );
    }
  }, []);
  const refresh = useCallback(() => {
    const scene = [...scenes].reverse().find((candidate) => candidate.isActive);
    queryRunner(scene, mode === 'stat' ? 2 : 3)?.runQueries?.();
  }, []);

  return (
    <main className="experiment-shell" data-testid="lazy-panel-host">
      <h1>Independent lazy panel chunks</h1>
      <p data-testid="probe-mode">{mode}</p>
      <div className="experiment-controls">
        <button data-testid="switch-uid" onClick={() => setUid((value) => value === 'grsdk-phase0-poc' ? 'grsdk-phase0-poc-alt' : 'grsdk-phase0-poc')}>Switch UID</button>
        <button data-testid="toggle-dashboard" onClick={() => setMounted((value) => !value)}>Toggle dashboard</button>
        {mode === 'stat' || mode === 'timeseries' || mode === 'all' ? <button data-testid="refresh" onClick={refresh}>Refresh</button> : null}
        {failFirst ? <button data-testid="probe-failure" onClick={probeFailure}>Probe failure/retry</button> : null}
      </div>
      <output data-testid="failure-result">{failureResult}</output>
      <section className="experiment-dashboard" aria-label="Lazy panel dashboard">
        {runtimeError ? <div data-testid="runtime-error">{runtimeError}</div> : runtime && mounted ? (
          <PocGrafanaProviders values={runtime.providerValues}>
            <GrafanaDashboard
              catalog={converterCatalog}
              instanceId="lazy-panel-primary"
              onSceneReady={recordScene}
              runtime={runtime}
              uid={uid}
            />
          </PocGrafanaProviders>
        ) : runtime ? <div data-testid="dashboard-unmounted">Unmounted</div> : <div>Preparing runtime.</div>}
      </section>
    </main>
  );
}
