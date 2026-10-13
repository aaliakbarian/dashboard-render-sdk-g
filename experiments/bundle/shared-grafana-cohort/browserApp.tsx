// POC / EXPERIMENT / NOT FOR PRODUCTION
import type { PanelData } from '@grafana/data';
import type { SceneGridItem, SceneQueryRunner, VizPanel } from '@grafana/scenes';
import {
  GrafanaDashboard,
  POC_GATE_C_TEXT_STAT_TIMESERIES_PANEL_CATALOG,
  PocGrafanaProviders,
  acquirePocRuntime,
  createPocQueryEvidenceRecorder,
  createPocStyleModeManager,
  inspectPocRuntime,
  loadPocSceneConversion,
  type PocDashboardSceneRoot,
  type PocRuntimeLease,
} from '@grafana-react-sdk/poc-compat';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { createSharedGrafanaCohortProvider } from './providerBootstrap.ts';
import type { SharedCohortEvent } from './sharedCohortLoader.ts';
import type { LazyPanelLoadEvent } from '../lazy-panel-chunks/closedLazyPanelCatalog.ts';

const modes = ['text', 'stat', 'timeseries', 'all', 'testdata', 'two'] as const;
type Mode = (typeof modes)[number];
const browserRequest = window.fetch.bind(window);
const panelIds = {
  all: ['text', 'stat', 'timeseries'],
  stat: ['stat'],
  text: ['text'],
  timeseries: ['timeseries'],
  two: ['text', 'stat', 'timeseries'],
} as const;
const requested = new URLSearchParams(window.location.search).get('mode');
const mode: Mode = modes.includes(requested as Mode) ? requested as Mode : 'text';
const cohortEvents: SharedCohortEvent[] = [];
const pluginEvents: LazyPanelLoadEvent[] = [];
const queryEvidence = createPocQueryEvidenceRecorder();
const scenes: PocDashboardSceneRoot[] = [];
const provider = createSharedGrafanaCohortProvider({
  cohortEvidence: { record: (event) => cohortEvents.push(structuredClone(event)) },
  panelEvidence: { record: (event) => pluginEvents.push(structuredClone(event)) },
});
const loadTestDataClass = async () => (await provider.loadTestData()).plugin.DataSourceClass;
const runtimePanelCatalog = Object.freeze({
  ...POC_GATE_C_TEXT_STAT_TIMESERIES_PANEL_CATALOG,
  pluginImportUtils: provider.panels,
});
const styleManager = createPocStyleModeManager(document.documentElement);
let queryProbe: { fields: number; points: number; series: number; state: string } | undefined;

function statRunner(root: PocDashboardSceneRoot): SceneQueryRunner {
  const index = root.state.legacyPanelIds.indexOf(2);
  const item = root.state.body.state.children[index] as SceneGridItem | undefined;
  const runner = (item?.state.body as VizPanel | undefined)?.state.$data;
  if (!runner || !('runQueries' in runner)) throw new Error('Shared-cohort query probe expected panel 2 SceneQueryRunner.');
  return runner as SceneQueryRunner;
}

function summarize(data: PanelData) {
  return {
    fields: data.series.reduce((count, frame) => count + frame.fields.length, 0),
    points: data.series.reduce((count, frame) => count + (frame.fields[0]?.values.length ?? 0), 0),
    series: data.series.length,
    state: String(data.state),
  };
}

async function activateQueryProbe(runtime: PocRuntimeLease) {
  const dashboard = await runtime.dashboardClient.loadByUid('grsdk-phase0-poc');
  const conversion = await loadPocSceneConversion();
  const root = conversion.convertFixtureV1ToScene({
    catalog: { identity: 'shared-cohort-testdata-only', panelIds: ['stat'] },
    input: dashboard,
    runtime,
  });
  scenes.push(root);
  const runner = statRunner(root);
  const deactivateRoot = root.activate();
  const deactivateRunner = runner.activate();
  let subscription: { unsubscribe(): void } | undefined;
  const done = await new Promise<PanelData>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      subscription?.unsubscribe();
      reject(new Error('Shared-cohort TestData query timed out.'));
    }, 15_000);
    const accept = (data: PanelData | undefined) => {
      if (!data) return;
      if (String(data.state) === 'Error') {
        window.clearTimeout(timeout);
        subscription?.unsubscribe();
        reject(new Error('Shared-cohort TestData query entered Error.'));
      } else if (String(data.state) === 'Done') {
        window.clearTimeout(timeout);
        subscription?.unsubscribe();
        resolve(data);
      }
    };
    subscription = runner.subscribeToState((state) => accept(state.data));
    accept(runner.state.data);
  });
  queryProbe = summarize(done);
  return () => {
    subscription?.unsubscribe();
    if (runner.isActive) deactivateRunner();
    if (root.isActive) deactivateRoot();
  };
}

export function inspectSharedGrafanaCohort() {
  return {
    cohortEvents: structuredClone(cohortEvents),
    pluginEvents: structuredClone(pluginEvents),
    queryEvents: queryEvidence.snapshot(),
    ...(queryProbe ? { queryProbe: structuredClone(queryProbe) } : {}),
    runtime: inspectPocRuntime(),
    scenes: scenes.map((scene) => ({ active: scene.isActive, uid: scene.state.uid })),
  };
}

export function SharedGrafanaCohortApp() {
  const [runtime, setRuntime] = useState<PocRuntimeLease>();
  const [runtimeError, setRuntimeError] = useState<string>();
  const [mounted, setMounted] = useState(true);
  const [secondary, setSecondary] = useState(true);
  const [queryState, setQueryState] = useState('Loading');
  const selected = mode === 'testdata' ? [] : panelIds[mode];
  const converterCatalog = useMemo(() => ({ identity: `shared-cohort-${mode}`, panelIds: selected }), []);

  useEffect(() => {
    let disposed = false;
    let lease: PocRuntimeLease | undefined;
    let deactivateProbe: (() => void) | undefined;
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
    }).then(async (acquired) => {
      lease = acquired;
      if (mode !== 'text') {
        await acquired.acquireQueryRuntime({
          evidence: queryEvidence,
          loadDataSourceClass: loadTestDataClass,
          moduleIdentity: 'public/app/plugins/datasource/grafana-testdata-datasource/datasource.ts',
        });
      }
      if (mode === 'testdata') {
        deactivateProbe = await activateQueryProbe(acquired);
        setQueryState(queryProbe?.state ?? 'Error');
      }
      if (disposed) {
        deactivateProbe?.();
        acquired.release();
        return;
      }
      setRuntime(acquired);
    }).catch((error: unknown) => {
      if (!disposed) setRuntimeError(error instanceof Error ? error.message : 'Runtime failed.');
      lease?.release();
    });
    return () => {
      disposed = true;
      deactivateProbe?.();
      lease?.release();
      styleLease.release();
    };
  }, []);

  const recordScene = useCallback((scene: PocDashboardSceneRoot) => scenes.push(scene), []);
  return (
    <main className="experiment-shell" data-testid="shared-cohort-host">
      <h1>Shared Grafana runtime cohort</h1>
      <p data-testid="probe-mode">{mode}</p>
      <div className="experiment-controls">
        <button data-testid="toggle-dashboard" onClick={() => setMounted((value) => !value)}>Toggle primary</button>
        {mode === 'two' ? <button data-testid="toggle-secondary" onClick={() => setSecondary((value) => !value)}>Toggle secondary</button> : null}
      </div>
      {runtimeError ? <div data-testid="runtime-error">{runtimeError}</div> : null}
      {mode === 'testdata' ? <output data-testid="testdata-result">{queryState}</output> : null}
      {runtime && mounted && mode !== 'testdata' ? (
        <PocGrafanaProviders values={runtime.providerValues}>
          <section className="experiment-dashboard" aria-label="Shared cohort dashboard">
            <GrafanaDashboard catalog={converterCatalog} instanceId="shared-primary" onSceneReady={recordScene} runtime={runtime} uid="grsdk-phase0-poc" />
          </section>
          {mode === 'two' && secondary ? (
            <section className="experiment-dashboard" aria-label="Shared cohort dashboard secondary">
              <GrafanaDashboard catalog={converterCatalog} instanceId="shared-secondary" onSceneReady={recordScene} runtime={runtime} uid="grsdk-phase0-poc" />
            </section>
          ) : null}
        </PocGrafanaProviders>
      ) : runtime && !mounted ? <div data-testid="dashboard-unmounted">Unmounted</div> : null}
    </main>
  );
}
