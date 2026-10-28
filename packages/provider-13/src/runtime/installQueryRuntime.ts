import type { DataSourceApi, DataSourceInstanceSettings, DataTransformerInfo } from '@grafana/data';
import type { BackendSrv, DataSourceSrv, RuntimeDataSourceRegistration, TemplateSrv } from '@grafana/runtime';
import { Grafana13QueryRuntimeError, type Grafana13TestDataConstructor } from '../datasource/contracts';
import { loadGrafana13TestDataSettings } from '../datasource/loadFrontendSettings';
import { createGrafana13TestDataCatalog } from '../datasource/testDataCatalog';
import type { Grafana13TextPanelCatalog } from '../panels/catalog';
import { createGrafana13RunRequest, type Grafana13RunRequest } from '../query/runRequest';
import { installGrafana13FieldConfig, type Grafana13FieldProcessors, type Grafana13FieldRegistry } from '../registries/fieldConfig';
import { installGrafana13Transformations, type Grafana13TransformerRegistry } from '../registries/transformations';
import { createGrafana13TemplateSrv } from './templateSrv';

export interface Grafana13QueryCohort {
  readonly runtime: {
    getBackendSrv(): BackendSrv;
    getPluginImportUtils(): Grafana13TextPanelCatalog;
    setTemplateSrv(service: TemplateSrv): void;
    getTemplateSrv(): TemplateSrv;
    setDataSourceSrv(service: DataSourceSrv): void;
    getDataSourceSrv(): DataSourceSrv;
    setRunRequest(run: Grafana13RunRequest): void;
    getRunRequest(): Grafana13RunRequest;
  };
  initializeLoggersRegistry(): void;
  registerRuntimeDataSourceInstance(entry: RuntimeDataSourceRegistration): void;
  readonly fieldRegistry: Grafana13FieldRegistry;
  readonly transformerRegistry: Grafana13TransformerRegistry;
  readonly processors: Grafana13FieldProcessors;
  readonly renameByRegexTransformer: DataTransformerInfo;
}
export interface Grafana13QueryRuntime {
  readonly datasource: DataSourceApi;
  readonly dataSourceSrv: DataSourceSrv;
  readonly runRequest: Grafana13RunRequest;
  readonly settings: DataSourceInstanceSettings;
  readonly templateSrv: TemplateSrv;
}
const loggers = new WeakSet<() => void>();
interface Installation {
  readonly cohort: Grafana13QueryCohort;
  readonly backendSrv: BackendSrv;
  readonly panelCatalog: Grafana13TextPanelCatalog;
  templateSrv?: TemplateSrv;
  templateInstalled?: boolean;
  settings?: DataSourceInstanceSettings;
  dataSourceSrv?: DataSourceSrv;
  datasource?: DataSourceApi;
  datasourceInstalled?: boolean;
  registered?: boolean;
  runRequest?: Grafana13RunRequest;
  runnerInstalled?: boolean;
  pending?: Promise<Grafana13QueryRuntime>;
}
// Native registrations and service singletons live for the cohort lifetime.
// A rejected acquisition must retain completed checkpoints, not reinstall them.
const installations = new WeakMap<Grafana13QueryCohort['runtime'], Installation>();

interface InstallOptions {
  readonly backendSrv: BackendSrv;
  readonly panelCatalog: Grafana13TextPanelCatalog;
  readonly loadCohort?: () => Promise<Grafana13QueryCohort>;
  readonly loadDataSource?: () => Promise<Grafana13TestDataConstructor>;
}

async function resumeInstallation(state: Installation, options: InstallOptions): Promise<Grafana13QueryRuntime> {
  const { cohort } = state;
  const { runtime } = cohort;
  let phase: NonNullable<Grafana13QueryRuntimeError['phase']> = 'identity';
  try {
    if (runtime.getBackendSrv() !== state.backendSrv || runtime.getPluginImportUtils() !== state.panelCatalog) throw new Error();
    phase = 'logger';
    if (!loggers.has(cohort.initializeLoggersRegistry)) {
      cohort.initializeLoggersRegistry(); loggers.add(cohort.initializeLoggersRegistry);
    }
    phase = 'template';
    const templateSrv = state.templateSrv ??= createGrafana13TemplateSrv();
    if (!state.templateInstalled && runtime.getTemplateSrv() !== templateSrv) runtime.setTemplateSrv(templateSrv);
    if (runtime.getTemplateSrv() !== templateSrv) throw new Error();
    state.templateInstalled = true;
    phase = 'settings';
    const settings = state.settings ??= await loadGrafana13TestDataSettings(options.backendSrv);
    phase = 'datasource';
    const dataSourceSrv = state.dataSourceSrv ??= createGrafana13TestDataCatalog({ settings, templateSrv,
      load: options.loadDataSource ?? (() => import('../datasource/testDataPlugin').then(m => m.grafana13TestDataConstructor)) });
    const datasource = state.datasource ??= await dataSourceSrv.get('grsdk-testdata');
    if (!state.datasourceInstalled && runtime.getDataSourceSrv() !== dataSourceSrv) runtime.setDataSourceSrv(dataSourceSrv);
    if (runtime.getDataSourceSrv() !== dataSourceSrv) throw new Error();
    state.datasourceInstalled = true;
    phase = 'registration';
    if (!state.registered) {
      Object.defineProperty(datasource, 'instanceSettings', { value: settings, enumerable: true });
      cohort.registerRuntimeDataSourceInstance({ dataSource: datasource as RuntimeDataSourceRegistration['dataSource'] });
      state.registered = true;
    }
    phase = 'runner';
    const runRequest = state.runRequest ??= createGrafana13RunRequest();
    if (!state.runnerInstalled) {
      let retained: Grafana13RunRequest | undefined;
      // Unlike the other getters, the pinned runner getter throws until set.
      try { retained = runtime.getRunRequest(); } catch { /* Not initialized. */ }
      if (retained !== runRequest) runtime.setRunRequest(runRequest);
    }
    if (runtime.getRunRequest() !== runRequest) throw new Error();
    state.runnerInstalled = true;
    phase = 'registries';
    installGrafana13FieldConfig(cohort.fieldRegistry, cohort.processors);
    installGrafana13Transformations(cohort.transformerRegistry, cohort.renameByRegexTransformer);
    if (runtime.getPluginImportUtils() !== options.panelCatalog) throw new Error();
    return Object.freeze({ datasource, dataSourceSrv, runRequest, settings, templateSrv });
  } catch { throw new Grafana13QueryRuntimeError('query-runtime-initialization-failed', phase); }
}

export async function installGrafana13QueryRuntime(options: InstallOptions): Promise<Grafana13QueryRuntime> {
  let phase: NonNullable<Grafana13QueryRuntimeError['phase']> = 'cohort';
  try {
    const cohort = await (options.loadCohort ?? (() => import('grafana-provider13-query-services').then(m => m.queryServices)))();
    const runtime = cohort.runtime;
    phase = 'identity';
    if (runtime.getBackendSrv() !== options.backendSrv || runtime.getPluginImportUtils() !== options.panelCatalog) throw new Error();
    let state = installations.get(runtime);
    if (!state) {
      state = { cohort, backendSrv: options.backendSrv, panelCatalog: options.panelCatalog };
      installations.set(runtime, state);
    }
    if (state.cohort !== cohort || state.backendSrv !== options.backendSrv || state.panelCatalog !== options.panelCatalog) throw new Error();
    if (!state.pending) {
      const checkpoint = state;
      state.pending = resumeInstallation(state, options).catch(error => { checkpoint.pending = undefined; throw error; });
    }
    return state.pending;
  } catch { throw new Grafana13QueryRuntimeError('query-runtime-initialization-failed', phase); }
}
