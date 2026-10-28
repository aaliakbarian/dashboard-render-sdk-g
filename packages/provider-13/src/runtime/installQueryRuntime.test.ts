import { expect, it, vi } from 'vitest';
import { installGrafana13QueryRuntime } from './installQueryRuntime';

it('retries after native registration without duplicating registration or replacing retained services', async () => {
  const values: Record<string, unknown> = {};
  const runtime: any = {};
  for (const key of ['TemplateSrv', 'DataSourceSrv', 'RunRequest']) {
    runtime[`set${key}`] = vi.fn((value: unknown) => { values[key] = value; });
    runtime[`get${key}`] = () => {
      if (key === 'RunRequest' && !values[key]) throw new Error('getRunRequest can only be used after Grafana instance has started.');
      return values[key];
    };
  }
  const backend: any = { get: vi.fn(async () => ({ datasources: { fixture: {
    uid: 'grsdk-testdata', type: 'grafana-testdata-datasource', name: 'TestData', access: 'proxy', url: '', meta: { id: 'grafana-testdata-datasource' },
  } } })) };
  const catalog = {};
  runtime.getBackendSrv = () => backend; runtime.getPluginImportUtils = () => catalog;
  const constructed = vi.fn();
  class Source { uid = 'grsdk-testdata'; type = 'grafana-testdata-datasource'; constructor() { constructed(); } query() {} }
  const native = new Map();
  const register = vi.fn(({ dataSource }: any) => {
    if (native.has(dataSource.uid)) throw new Error('duplicate native uid');
    native.set(dataSource.uid, dataSource);
  });
  let fail = true;
  const cohort = { runtime, initializeLoggersRegistry: vi.fn(), registerRuntimeDataSourceInstance: register,
    fieldRegistry: { setInit: vi.fn() }, transformerRegistry: { setInit: vi.fn(() => { if (fail) throw new Error('private registry failure'); }) },
    processors: { stringOverrideProcessor() {}, numberOverrideProcessor() {}, identityOverrideProcessor() {}, thresholdsOverrideProcessor() {}, valueMappingsOverrideProcessor() {} },
    renameByRegexTransformer: { id: 'renameByRegex', name: 'Rename' },
  };
  const options = { backendSrv: backend, panelCatalog: catalog as never, loadCohort: async () => cohort as never,
    loadDataSource: vi.fn(async () => Source as never) };
  await expect(installGrafana13QueryRuntime(options)).rejects.toMatchObject({ code: 'query-runtime-initialization-failed', phase: 'registries' });
  const retained = { ...values };
  fail = false;
  const result = await installGrafana13QueryRuntime(options);
  expect(result.templateSrv).toBe(retained.TemplateSrv); expect(result.dataSourceSrv).toBe(retained.DataSourceSrv);
  expect(result.runRequest).toBe(retained.RunRequest); expect(result.datasource).toBe(native.get('grsdk-testdata'));
  expect(register).toHaveBeenCalledTimes(1); expect(constructed).toHaveBeenCalledTimes(1);
  expect(backend.get).toHaveBeenCalledTimes(1); expect(options.loadDataSource).toHaveBeenCalledTimes(1);
  expect(cohort.fieldRegistry.setInit).toHaveBeenCalledTimes(1);
  expect(cohort.transformerRegistry.setInit).toHaveBeenCalledTimes(2);
  expect(runtime.setTemplateSrv).toHaveBeenCalledTimes(1); expect(runtime.setDataSourceSrv).toHaveBeenCalledTimes(1);
  expect(runtime.setRunRequest).toHaveBeenCalledTimes(1);
});

it('installs the exact query services in order and verifies singleton identities', async () => {
  const steps: string[] = []; const values: Record<string, unknown> = {};
  const runtime: any = {};
  for (const key of ['TemplateSrv', 'DataSourceSrv', 'RunRequest']) {
    runtime[`set${key}`] = (value: unknown) => { steps.push(key); values[key] = value; };
    runtime[`get${key}`] = () => values[key];
  }
  class Source { uid = 'grsdk-testdata'; type = 'grafana-testdata-datasource'; query() {} }
  const backend: any = { get: async () => { steps.push('settings'); return { datasources: { fixture: {
    uid: 'grsdk-testdata', type: 'grafana-testdata-datasource', name: 'TestData', access: 'proxy', url: '', meta: { id: 'grafana-testdata-datasource' },
  } } }; } };
  runtime.getBackendSrv = () => backend;
  runtime.getPluginImportUtils = () => catalog;
  const catalog = {};
  const fieldRegistry = { setInit() { steps.push('fields'); } };
  const transformerRegistry = { setInit() { steps.push('transforms'); } };
  const processors = { stringOverrideProcessor() {}, numberOverrideProcessor() {}, identityOverrideProcessor() {}, thresholdsOverrideProcessor() {}, valueMappingsOverrideProcessor() {} };
  const result = await installGrafana13QueryRuntime({ backendSrv: backend, panelCatalog: catalog as never,
    loadCohort: async () => ({ runtime, initializeLoggersRegistry() { steps.push('logger'); },
      registerRuntimeDataSourceInstance({ dataSource }: any) { steps.push('registration'); expect(dataSource.instanceSettings.uid).toBe('grsdk-testdata'); },
      fieldRegistry, transformerRegistry, processors, renameByRegexTransformer: { id: 'renameByRegex', name: 'Rename' } } as never),
    loadDataSource: async () => { steps.push('load'); return Source as never; },
  });
  expect(steps).toEqual(['logger', 'TemplateSrv', 'settings', 'load', 'DataSourceSrv', 'registration', 'RunRequest', 'fields', 'transforms']);
  expect(await result.dataSourceSrv.get('grsdk-testdata')).toBe(result.datasource);
  expect(values.RunRequest).toBe(result.runRequest);
});
