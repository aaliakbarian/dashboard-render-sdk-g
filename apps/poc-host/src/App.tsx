import {
  GrafanaDashboard,
  POC_GATE_A_TEXT_PANEL_CATALOG,
  POC_GATE_B_TEXT_STAT_PANEL_CATALOG,
  POC_GATE_C_TEXT_STAT_TIMESERIES_PANEL_CATALOG,
  PocGrafanaProviders,
  acquirePocRuntime,
  createPocQueryEvidenceRecorder,
  createPocStyleModeManager,
  inspectPocRuntime,
  type PocDashboardSceneRoot,
  type PocRuntimeInspection,
  type PocRuntimeLease,
  type PocSceneConversionEvidenceEvent,
  type PocSceneConversionEvidenceRecorder,
  type PocStyleModeManager,
} from '@dashboard-render-sdk-g/poc-compat';
import {
  createTextPanelCatalog,
  createTextAndStatPanelCatalog,
  createTextStatAndTimeSeriesPanelCatalog,
  loadExactStatPanelPlugin,
  loadExactTextPanelPlugin,
  loadExactTimeSeriesPanelPlugin,
  loadExactTestDataDataSourceClass,
  TESTDATA_MODULE_IDENTITY,
  type PanelPluginLoadEvent,
} from '@dashboard-render-sdk-g/poc-grafana-bridge';
import { GlobalStyles } from '@grafana/ui';
import { useCallback, useEffect, useState } from 'react';
import '@dashboard-render-sdk-g/poc-compat/poc-panel.css';

const pluginEvents: PanelPluginLoadEvent[] = [];
const dashboardErrors: string[] = [];
const conversionEvents: PocSceneConversionEvidenceEvent[] = [];
const conversionEvidence: PocSceneConversionEvidenceRecorder = {
  record: (event) => conversionEvents.push(structuredClone(event)),
  snapshot: () => structuredClone(conversionEvents),
};
const observedScenes: PocDashboardSceneRoot[] = [];
let activeRuntimeLease: PocRuntimeLease | undefined;
const hostRequest = window.fetch.bind(window);
const textPluginCatalog = createTextPanelCatalog({
  evidence: { record: (event) => pluginEvents.push(structuredClone(event)) },
  loadTextPlugin: loadExactTextPanelPlugin,
});
const gateBPluginCatalog = createTextAndStatPanelCatalog({
  evidence: { record: (event) => pluginEvents.push(structuredClone(event)) },
  loadStatPlugin: loadExactStatPanelPlugin,
  loadTextPlugin: loadExactTextPanelPlugin,
});
const gateCPluginCatalog = createTextStatAndTimeSeriesPanelCatalog({
  evidence: { record: (event) => pluginEvents.push(structuredClone(event)) },
  loadStatPlugin: loadExactStatPanelPlugin,
  loadTextPlugin: loadExactTextPanelPlugin,
  loadTimeSeriesPlugin: loadExactTimeSeriesPanelPlugin,
});
const gateCPluginFailureCatalog = createTextStatAndTimeSeriesPanelCatalog({
  evidence: { record: (event) => pluginEvents.push(structuredClone(event)) },
  loadStatPlugin: loadExactStatPanelPlugin,
  loadTextPlugin: loadExactTextPanelPlugin,
  loadTimeSeriesPlugin: () => Promise.reject(new Error('Controlled Gate C plugin failure.')),
});
const queryEvidence = createPocQueryEvidenceRecorder();
const styleModeManager: PocStyleModeManager = createPocStyleModeManager(document.documentElement);
const gateAConfig = {
  assetBasePath: '/grafana/public/',
  grafanaBasePath: '/grafana',
  locale: 'en-US',
  namespace: 'default',
  panelCatalog: {
    ...POC_GATE_A_TEXT_PANEL_CATALOG,
    pluginImportUtils: textPluginCatalog,
  },
  request: hostRequest,
  theme: 'light',
  timezone: 'browser',
} as const;
const gateBConfig = {
  ...gateAConfig,
  panelCatalog: {
    ...POC_GATE_B_TEXT_STAT_PANEL_CATALOG,
    pluginImportUtils: gateBPluginCatalog,
  },
} as const;
const gateCConfig = {
  ...gateAConfig,
  panelCatalog: {
    ...POC_GATE_C_TEXT_STAT_TIMESERIES_PANEL_CATALOG,
    pluginImportUtils: gateCPluginCatalog,
  },
} as const;
const gateCPluginFailureConfig = {
  ...gateAConfig,
  panelCatalog: {
    ...POC_GATE_C_TEXT_STAT_TIMESERIES_PANEL_CATALOG,
    pluginImportUtils: gateCPluginFailureCatalog,
  },
} as const;

export interface GateAHostInspection {
  readonly conversionEvents: readonly PocSceneConversionEvidenceEvent[];
  readonly plugin?: { readonly id: string; readonly module: string; readonly version: string };
  readonly pluginEvents: readonly PanelPluginLoadEvent[];
  readonly runtime: PocRuntimeInspection;
  readonly scenes: ReadonlyArray<{ readonly active: boolean; readonly uid: string }>;
  readonly theme?: { readonly isLight: boolean };
}

export interface GateBHostInspection {
  readonly conversionEvents: readonly PocSceneConversionEvidenceEvent[];
  readonly pluginEvents: readonly PanelPluginLoadEvent[];
  readonly queryEvents: ReturnType<typeof queryEvidence.snapshot>;
  readonly runtime: PocRuntimeInspection;
  readonly scenes: ReadonlyArray<{ readonly active: boolean; readonly uid: string }>;
  readonly statScene?: {
    readonly colorMode?: unknown;
    readonly reduction?: unknown;
    readonly thresholds?: unknown;
    readonly unit?: unknown;
  };
  readonly statPlugin?: { readonly id: string; readonly module: string; readonly version: string };
  readonly transport: ReturnType<PocRuntimeLease['transportEvidence']['snapshot']>;
}

export interface GateCHostInspection extends GateBHostInspection {
  readonly dashboardErrors: readonly string[];
  readonly style: ReturnType<typeof styleModeManager.inspect>;
  readonly transformerRegistry: readonly string[];
  readonly transformerExecutions: number;
  readonly timeseriesPlugin?: { readonly id: string; readonly module: string; readonly version: string };
  readonly timeseriesScene?: {
    readonly dataState?: unknown;
    readonly fieldDisplayName?: string;
    readonly fieldDisplayNames?: readonly string[];
    readonly fieldNames?: readonly string[];
    readonly fieldStateDisplayNames?: readonly string[];
    readonly fieldConfig?: unknown;
    readonly fillOpacity?: unknown;
    readonly lineWidth?: unknown;
    readonly options?: unknown;
    readonly panelStateKeys?: readonly string[];
    readonly transformations?: unknown;
    readonly unit?: unknown;
  };
}

function recordDashboardError(error: Error) {
  const category = 'code' in error && typeof error.code === 'string' ? error.code : error.name;
  dashboardErrors.push(category);
}

export function inspectGateAHost(): GateAHostInspection {
  const plugin = textPluginCatalog.getPanelPluginFromCache('text');
  return {
    conversionEvents: structuredClone(conversionEvents),
    ...(plugin
      ? {
          plugin: {
            id: plugin.meta.id,
            module: plugin.meta.module,
            version: plugin.meta.info.version,
          },
        }
      : {}),
    pluginEvents: structuredClone(pluginEvents),
    runtime: inspectPocRuntime(),
    scenes: observedScenes.map((scene) => ({ active: scene.isActive, uid: scene.state.uid })),
    ...(activeRuntimeLease
      ? { theme: { isLight: activeRuntimeLease.providerValues.theme.isLight } }
      : {}),
  };
}

export function inspectGateBHost(): GateBHostInspection {
  const stat = gateBPluginCatalog.getPanelPluginFromCache('stat');
  const activeScene = [...observedScenes].reverse().find((scene) => scene.isActive);
  const statScene = inspectStatScene(activeScene);
  return {
    conversionEvents: structuredClone(conversionEvents),
    pluginEvents: structuredClone(pluginEvents),
    queryEvents: queryEvidence.snapshot(),
    runtime: inspectPocRuntime(),
    scenes: observedScenes.map((scene) => ({ active: scene.isActive, uid: scene.state.uid })),
    ...(statScene ? { statScene } : {}),
    ...(stat
      ? {
          statPlugin: {
            id: stat.meta.id,
            module: stat.meta.module,
            version: stat.meta.info.version,
          },
        }
      : {}),
    transport: activeRuntimeLease?.transportEvidence.snapshot() ?? [],
  };
}

export function inspectGateCHost(): GateCHostInspection {
  const base = inspectGateBHost();
  const timeseries = gateCPluginCatalog.getPanelPluginFromCache('timeseries');
  const scene = [...observedScenes].reverse().find((candidate) => candidate.isActive);
  const panel = getPanelState(scene, 3);
  const transformer = panel?.$data as
    | {
        state?: {
          data?: {
            series?: Array<{
              fields?: Array<{
                config?: { displayName?: string };
                name?: string;
                state?: { displayName?: string };
              }>;
            }>;
            state?: unknown;
          };
        };
      }
    | undefined;
  const fields = transformer?.state?.data?.series?.flatMap((frame) => frame.fields ?? []) ?? [];
  return {
    ...base,
    dashboardErrors: structuredClone(dashboardErrors),
    style: styleModeManager.inspect(),
    transformerExecutions: activeRuntimeLease?.inspectTransformerExecutions() ?? 0,
    transformerRegistry: activeRuntimeLease?.inspectTransformerRegistry() ?? [],
    ...(timeseries
      ? {
          timeseriesPlugin: {
            id: timeseries.meta.id,
            module: timeseries.meta.module,
            version: timeseries.meta.info.version,
          },
        }
      : {}),
    ...(panel
      ? {
          timeseriesScene: {
            dataState: transformer?.state?.data?.state,
            fieldDisplayName: fields.find((field) => field.config?.displayName)?.config?.displayName,
            fieldDisplayNames: fields.map((field) => field.config?.displayName ?? '<unset>'),
            fieldNames: fields.map((field) => field.name ?? '<unset>'),
            fieldStateDisplayNames: fields.map((field) => field.state?.displayName ?? '<unset>'),
            fieldConfig: panel.fieldConfig,
            fillOpacity: (panel.fieldConfig?.defaults?.custom as { fillOpacity?: unknown } | undefined)
              ?.fillOpacity,
            lineWidth: (panel.fieldConfig?.defaults?.custom as { lineWidth?: unknown } | undefined)
              ?.lineWidth,
            options: panel.options,
            unit: panel.fieldConfig?.defaults?.unit,
            panelStateKeys: Object.keys(panel),
            transformations: (panel.$data as { state?: { transformations?: unknown } } | undefined)
              ?.state?.transformations,
          },
        }
      : {}),
  };
}

interface GateBQueryRunnerHandle {
  readonly state?: { readonly queries?: ReadonlyArray<Record<string, unknown>> };
  runQueries?: () => void;
  setState?: (state: { readonly queries: ReadonlyArray<Record<string, unknown>> }) => void;
}

function getPanelState(scene: PocDashboardSceneRoot | undefined, panelId: number) {
  if (!scene) return;
  const index = scene.state.legacyPanelIds.indexOf(panelId);
  return (scene.state.body.state.children[index] as
    | {
        state?: {
          body?: {
            state?: {
              $data?: unknown;
              fieldConfig?: { defaults?: { custom?: unknown; unit?: unknown } };
              options?: Record<string, unknown>;
            };
          };
        };
      }
    | undefined)?.state?.body?.state;
}

function getStatQueryRunner(scene: PocDashboardSceneRoot | undefined): GateBQueryRunnerHandle | undefined {
  if (!scene) return;
  const index = scene.state.legacyPanelIds.indexOf(2);
  const child = scene.state.body.state.children[index] as
    | { state?: { body?: { state?: { $data?: GateBQueryRunnerHandle } } } }
    | undefined;
  return child?.state?.body?.state?.$data;
}

function getTimeSeriesQueryRunner(
  scene: PocDashboardSceneRoot | undefined
): GateBQueryRunnerHandle | undefined {
  const transformer = getPanelState(scene, 3)?.$data as
    | { state?: { $data?: GateBQueryRunnerHandle } }
    | undefined;
  return transformer?.state?.$data;
}

function inspectStatScene(scene: PocDashboardSceneRoot | undefined) {
  if (!scene) return;
  const index = scene.state.legacyPanelIds.indexOf(2);
  const panel = (scene.state.body.state.children[index] as
    | {
        state?: {
          body?: {
            state?: {
              fieldConfig?: {
                defaults?: { thresholds?: unknown; unit?: unknown };
              };
              options?: { colorMode?: unknown; reduceOptions?: unknown };
            };
          };
        };
      }
    | undefined)?.state?.body?.state;
  if (!panel) return;
  return {
    colorMode: panel.options?.colorMode,
    reduction: panel.options?.reduceOptions,
    thresholds: panel.fieldConfig?.defaults?.thresholds,
    unit: panel.fieldConfig?.defaults?.unit,
  };
}

function refreshStat(scene: PocDashboardSceneRoot | undefined) {
  getStatQueryRunner(scene)?.runQueries?.();
}

function refreshTimeSeries(scene: PocDashboardSceneRoot | undefined) {
  getTimeSeriesQueryRunner(scene)?.runQueries?.();
}

function setSceneTimeRange(scene: PocDashboardSceneRoot | undefined, from: string) {
  scene?.state.$timeRange.updateFromUrl({ from, to: 'now' });
}

function configureGateBQueryDiagnostic(scene: PocDashboardSceneRoot, mode: string | null) {
  if (mode !== 'server-error' && mode !== 'slow') return;
  const runner = getStatQueryRunner(scene);
  const queries = runner?.state?.queries;
  if (!runner?.setState || !queries) return;
  runner.setState({
    queries: queries.map((query) => ({
      ...query,
      scenarioId: mode === 'slow' ? 'slow_query' : 'server_error_500',
      ...(mode === 'slow' ? { stringInput: '5s' } : { errorType: 'server_panic' }),
    })),
  });
}

function configureGateCQueryDiagnostic(scene: PocDashboardSceneRoot, mode: string | null) {
  if (mode !== 'server-error' && mode !== 'slow') return;
  const runner = getTimeSeriesQueryRunner(scene);
  const queries = runner?.state?.queries;
  if (!runner?.setState || !queries) return;
  runner.setState({
    queries: queries.map((query) => ({
      ...query,
      scenarioId: mode === 'slow' ? 'slow_query' : 'server_error_500',
      ...(mode === 'slow' ? { stringInput: '5s' } : { errorType: 'server_panic' }),
    })),
  });
}

export function App() {
  const gate = new URLSearchParams(window.location.search).get('gate');
  const gateAEnabled = gate === 'a';
  const gateBEnabled = gate === 'b';
  const gateCEnabled = gate === 'c';
  const gateBQueryDiagnostic = new URLSearchParams(window.location.search).get('gateBQuery');
  const requestedInstances = new URLSearchParams(window.location.search).get('instances');
  const gateCQueryDiagnostic = new URLSearchParams(window.location.search).get('gateCQuery');
  const gateCPluginFailure = new URLSearchParams(window.location.search).get('gateCPlugin') === 'fail';
  const requestedStyle = new URLSearchParams(window.location.search).get('style');
  const gateCStyleMode =
    requestedStyle === 'none' || requestedStyle === 'full-reference'
      ? requestedStyle
      : 'minimum-scoped';
  const [runtime, setRuntime] = useState<PocRuntimeLease>();
  const [runtimeError, setRuntimeError] = useState<string>();
  const [uid, setUid] = useState<'grsdk-phase0-poc' | 'grsdk-phase0-poc-alt'>(
    'grsdk-phase0-poc'
  );
  const [dashboardWidth, setDashboardWidth] = useState(1200);
  const [showSecondInstance, setShowSecondInstance] = useState(requestedInstances === '2');

  useEffect(() => {
    if (!gateAEnabled && !gateBEnabled && !gateCEnabled) {
      return;
    }

    let disposed = false;
    let lease: PocRuntimeLease | undefined;
    const releaseLease = () => {
      lease?.release();
      if (activeRuntimeLease === lease) activeRuntimeLease = undefined;
      lease = undefined;
    };
    const styleLease = gateCEnabled ? styleModeManager.acquire(gateCStyleMode) : undefined;
    void acquirePocRuntime(
      gateCEnabled
        ? gateCPluginFailure
          ? gateCPluginFailureConfig
          : gateCConfig
        : gateBEnabled
          ? gateBConfig
          : gateAConfig
    )
      .then(async (acquired) => {
        lease = acquired;
        if (gateBEnabled || gateCEnabled) {
          await acquired.acquireQueryRuntime({
            evidence: queryEvidence,
            loadDataSourceClass: loadExactTestDataDataSourceClass,
            moduleIdentity: TESTDATA_MODULE_IDENTITY,
          });
          // Populate the closed runtime cache before Scenes first renders.
          // Stat declares `setNoPadding()`: allowing the loading plugin to render
          // first makes React 19 observe PanelChrome changing from padded to
          // unpadded shorthand/longhand styles and emit an upstream warning.
          const catalog = gateCEnabled
            ? gateCPluginFailure
              ? gateCPluginFailureCatalog
              : gateCPluginCatalog
            : gateBPluginCatalog;
          await Promise.allSettled([
            catalog.importPanelPlugin('text'),
            catalog.importPanelPlugin('stat'),
            ...(gateCEnabled ? [catalog.importPanelPlugin('timeseries')] : []),
          ]);
        }
        if (disposed) {
          releaseLease();
          return;
        }
        activeRuntimeLease = acquired;
        setRuntime(acquired);
      })
      .catch((error: unknown) => {
        releaseLease();
        if (!disposed) {
          setRuntimeError(error instanceof Error ? error.message : 'Runtime initialization failed.');
        }
      });

    return () => {
      disposed = true;
      releaseLease();
      styleLease?.release();
    };
  }, [gateAEnabled, gateBEnabled, gateCEnabled, gateCPluginFailure, gateCStyleMode]);

  const recordScene = useCallback(
    (scene: PocDashboardSceneRoot) => {
      if (gateBEnabled) configureGateBQueryDiagnostic(scene, gateBQueryDiagnostic);
      if (gateCEnabled) configureGateCQueryDiagnostic(scene, gateCQueryDiagnostic);
      observedScenes.push(scene);
    },
    [gateBEnabled, gateBQueryDiagnostic, gateCEnabled, gateCQueryDiagnostic]
  );

  return (
    <main className="poc-host" data-testid="poc-host-shell">
      <header className="poc-host__header">
        <p className="poc-host__eyebrow">Disposable research host</p>
        <h1>Standalone native-rendering POC</h1>
        <p>
          This independent React shell reserves a native DOM boundary for later Grafana rendering gates.
        </p>
      </header>

      <section className="poc-host__sentinel" aria-labelledby="host-sentinel-title">
        <h2 id="host-sentinel-title">Host style sentinel</h2>
        <p data-testid="host-style-sentinel">
          These host-owned styles must remain unchanged when Grafana styling is introduced.
        </p>
        <div
          className="poc-host__dashboard-boundary"
          data-testid="grafana-dashboard-root"
          aria-label="Grafana dashboard rendering boundary"
          style={gateCEnabled ? { width: dashboardWidth } : undefined}
        >
          {gateAEnabled || gateBEnabled || gateCEnabled ? (
            <>
              <div className="poc-host__gate-controls">
                <button
                  data-testid={gateCEnabled ? 'gate-c-switch-uid' : gateBEnabled ? 'gate-b-switch-uid' : 'gate-a-switch-uid'}
                  type="button"
                  onClick={() =>
                    setUid((current) =>
                      current === 'grsdk-phase0-poc'
                        ? 'grsdk-phase0-poc-alt'
                        : 'grsdk-phase0-poc'
                    )
                  }
                >
                  Switch fixture UID
                </button>
                {gateBEnabled || gateCEnabled ? (
                  <button
                    data-testid={gateCEnabled ? 'gate-c-refresh' : 'gate-b-refresh'}
                    type="button"
                    onClick={() =>
                      gateCEnabled
                        ? refreshTimeSeries(
                            [...observedScenes].reverse().find((scene) => scene.isActive)
                          )
                        : refreshStat([...observedScenes].reverse().find((scene) => scene.isActive))
                    }
                  >
                    {gateCEnabled ? 'Refresh Time series' : 'Refresh Stat'}
                  </button>
                ) : null}
                {gateCEnabled ? (
                  <>
                    <button
                      data-testid="gate-c-time-range"
                      type="button"
                      onClick={() =>
                        setSceneTimeRange(
                          [...observedScenes].reverse().find((scene) => scene.isActive),
                          'now-15m'
                        )
                      }
                    >
                      Use last 15 minutes
                    </button>
                    <button
                      data-testid="gate-c-resize"
                      type="button"
                      onClick={() => setDashboardWidth((width) => (width === 1200 ? 600 : 1200))}
                    >
                      Resize dashboard
                    </button>
                    <button
                      data-testid="gate-c-toggle-second"
                      type="button"
                      onClick={() => setShowSecondInstance((shown) => !shown)}
                    >
                      Toggle second dashboard
                    </button>
                  </>
                ) : null}
              </div>
              {runtimeError ? (
                <div data-poc-gate-a-error="runtime">{runtimeError}</div>
              ) : runtime ? (
                <PocGrafanaProviders values={runtime.providerValues}>
                  {gateCEnabled && gateCStyleMode === 'full-reference' ? <GlobalStyles /> : null}
                  <div className="poc-host__dashboard-instances">
                    {['primary', ...(gateCEnabled && showSecondInstance ? ['secondary'] : [])].map(
                      (instanceId) => (
                        <div data-testid={`gate-c-instance-${instanceId}`} key={instanceId}>
                          <GrafanaDashboard
                            catalog={
                              gateCEnabled
                                ? POC_GATE_C_TEXT_STAT_TIMESERIES_PANEL_CATALOG
                                : gateBEnabled
                                ? POC_GATE_B_TEXT_STAT_PANEL_CATALOG
                                : POC_GATE_A_TEXT_PANEL_CATALOG
                            }
                            conversionEvidence={conversionEvidence}
                            instanceId={instanceId}
                            onError={recordDashboardError}
                            onSceneReady={recordScene}
                            runtime={runtime}
                            uid={uid}
                          />
                        </div>
                      )
                    )}
                  </div>
                </PocGrafanaProviders>
              ) : (
                <div data-poc-gate-a-status="runtime-loading">Preparing compatibility runtime.</div>
              )}
            </>
          ) : null}
        </div>
      </section>
    </main>
  );
}
