import { createContext } from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { PocHostConfig } from '../config/hostConfig';
import type { GrafanaCohort } from '../config/loadGrafanaCohort';
import type { PocMinimalBootData } from '../config/installBootData';
import type { DataSourceInstanceSettings } from '@grafana/data';
import type { TemplateSrv } from '@grafana/runtime';
import type { PocDataSourceConstructor } from '../datasource/pocDataSourceSrv';
import { createRuntimeEvidenceRecorder } from './runtimeIdentity';
import {
  createPocRuntimeCoordinator,
  PocRuntimeConflictError,
  type PocRuntimeCoordinatorEnvironment,
} from './acquirePocRuntime';

class FakeElement {
  childElementCount = 0;
  id = '';
  parentElement: FakeElement | null = null;

  constructor(
    readonly tagName: string,
    private readonly onId: (id: string, element: FakeElement) => void
  ) {}

  appendChild(child: FakeElement) {
    child.parentElement = this;
    this.childElementCount += 1;
    if (child.id) this.onId(child.id, child);
    return child;
  }

  remove() {
    if (this.parentElement) {
      this.parentElement.childElementCount -= 1;
      this.parentElement = null;
    }
    if (this.id) this.onId(this.id, undefined as never);
  }
}

function createEnvironment() {
  const elements = new Map<string, FakeElement>();
  const createdTags: string[] = [];
  const setElement = (id: string, element: FakeElement | undefined) => {
    if (element) elements.set(id, element);
    else elements.delete(id);
  };
  const body = new FakeElement('body', setElement);
  const document = {
    body,
    createElement(tagName: string) {
      createdTags.push(tagName);
      return new FakeElement(tagName, setElement);
    },
    getElementById(id: string) {
      return elements.get(id) ?? null;
    },
  };
  const window = {
    __grafana_public_path__: undefined as string | undefined,
    grafanaBootData: undefined as PocMinimalBootData | undefined,
    location: {
      hash: '',
      href: 'http://localhost:5173/',
      origin: 'http://localhost:5173',
      pathname: '/',
      search: '',
    },
  };
  return { createdTags, document, window };
}

function createFakeCohort(bootData: unknown) {
  const observedEvents: string[] = [];
  const theme = { isLight: true };
  let appEvents: unknown;
  let backendSrv: unknown;
  let dataSourceSrv: unknown;
  let pluginImportUtils: unknown;
  let runRequest: unknown;
  let templateSrv: unknown;
  const standardEditorsRegistry = { setInit: vi.fn() };
  const standardFieldConfigEditorRegistry = { setInit: vi.fn() };
  let transformerInitializer: (() => Array<{ id: string }>) | undefined;
  const standardTransformersRegistry = {
    getIfExists: vi.fn((id: string) => transformerInitializer?.().find((item) => item.id === id)),
    list: vi.fn(() => transformerInitializer?.() ?? []),
    setInit: vi.fn((initializer: typeof transformerInitializer) => {
      transformerInitializer = initializer;
    }),
  };
  class FakeEventBus {
    publish(event: { type?: string }) {
      if (event.type) observedEvents.push(event.type);
    }
    getStream() {
      return { subscribe: vi.fn() };
    }
    subscribe() {
      return { unsubscribe: vi.fn() };
    }
    removeAllListeners() {}
    newScopedBus() {
      return this;
    }
  }
  const locationService = {
    getHistory: vi.fn(() => locationService),
    getLocation: vi.fn(() => ({ hash: '', pathname: '/', search: '' })),
    getLocationObservable: vi.fn(),
    getSearch: vi.fn(() => new URLSearchParams()),
    getSearchObject: vi.fn(() => ({})),
    partial: vi.fn(),
    push: vi.fn(),
    reload: vi.fn(),
    replace: vi.fn(),
    update: vi.fn(),
  };
  const cohort = {
    data: {
      EventBusSrv: FakeEventBus,
      ThemeContext: createContext(theme),
      identityOverrideProcessor: vi.fn((value) => value),
      numberOverrideProcessor: vi.fn((value) => value),
      standardEditorsRegistry,
      standardFieldConfigEditorRegistry,
      standardTransformers: {
        renameByRegexTransformer: {
          defaultOptions: { regex: '(.*)', renamePattern: '$1' },
          description: 'Rename fields by regex.',
          id: 'renameByRegex',
          name: 'Rename fields by regex',
          operator: vi.fn(() => (source: unknown) => `resolved:${String(source)}`),
        },
      },
      standardTransformersRegistry,
      stringOverrideProcessor: vi.fn((value) => value),
      thresholdsOverrideProcessor: vi.fn((value) => value),
      valueMappingsOverrideProcessor: vi.fn((value) => value),
    },
    i18n: { initPluginTranslations: vi.fn(async () => ({ language: 'en-US' })) },
    moduleIdentities: {
      react: { copies: 1, labels: ['cohort:react'], version: '19.2.8' },
      'react-dom': { copies: 1, labels: ['cohort:react-dom'], version: '19.2.8' },
    },
    runtime: {
      config: { appSubUrl: '', bootData, namespace: 'default', theme2: theme },
      getBackendSrv: () => backendSrv,
      getDataSourceSrv: () => dataSourceSrv,
      getPluginImportUtils: () => pluginImportUtils,
      getRunRequest: () => runRequest,
      getTemplateSrv: () => templateSrv,
      getAppEvents: () => appEvents,
      locationService,
      setBackendSrv: (value: unknown) => {
        backendSrv = value;
      },
      setDataSourceSrv: (value: unknown) => {
        dataSourceSrv = value;
      },
      setPluginImportUtils: (value: unknown) => {
        pluginImportUtils = value;
      },
      setRunRequest: (value: unknown) => {
        runRequest = value;
      },
      setTemplateSrv: (value: unknown) => {
        templateSrv = value;
      },
      setAppEvents: (value: unknown) => {
        appEvents = value;
      },
    },
    scenes: { loadResources: vi.fn() },
    schema: {},
    ui: {},
    versions: {
      '@grafana/data': '13.2.3',
      '@grafana/i18n': '13.2.3',
      '@grafana/runtime': '13.2.3',
      '@grafana/scenes': '8.13.5',
      '@grafana/schema': '13.2.3',
      '@grafana/ui': '13.2.3',
      react: '19.2.8',
      'react-dom': '19.2.8',
    },
  } as unknown as GrafanaCohort;
  return {
    cohort,
    locationService,
    observedEvents,
    standardEditorsRegistry,
    standardFieldConfigEditorRegistry,
    standardTransformersRegistry,
    theme,
  };
}

function hostConfig(overrides: Record<string, unknown> = {}): PocHostConfig {
  return {
    assetBasePath: '/grafana/public/',
    grafanaBasePath: '/grafana',
    locale: 'en-US',
    namespace: 'default',
    panelCatalog: { identity: 'task5-empty-catalog', panelIds: [] },
    request: vi.fn<typeof fetch>(),
    theme: 'light',
    timezone: 'browser',
    ...overrides,
  } as PocHostConfig;
}

function runtimeHarness() {
  const browser = createEnvironment();
  let cohortLoads = 0;
  let fake: ReturnType<typeof createFakeCohort> | undefined;
  const initializeLoggersRegistry = vi.fn();
  const registerRuntimeDataSourceInstance = vi.fn();
  const environment: PocRuntimeCoordinatorEnvironment = {
    document: browser.document,
    loadQueryRuntimeApis: async () => ({
      initializeLoggersRegistry,
      registerRuntimeDataSourceInstance,
    }),
    loadCohort: async ({ bootDataInstallation }) => {
      if (!bootDataInstallation) throw new Error('Boot data must be installed before the cohort.');
      cohortLoads += 1;
      fake = createFakeCohort(bootDataInstallation.bootData);
      return fake.cohort;
    },
    window: browser.window,
  };
  return {
    ...browser,
    coordinator: createPocRuntimeCoordinator(environment),
    get cohortLoads() {
      return cohortLoads;
    },
    get fake() {
      if (!fake) throw new Error('Cohort was not loaded.');
      return fake;
    },
    initializeLoggersRegistry,
    registerRuntimeDataSourceInstance,
  };
}

describe('POC compatibility runtime coordinator', () => {
  it('installs the Task 10 query responsibilities once and rejects another loader identity', async () => {
    class FakeTestDataSource {
      constructor(
        readonly settings: DataSourceInstanceSettings,
        readonly templateSrv: TemplateSrv
      ) {}
    }
    const request = vi.fn<typeof fetch>(async () =>
      new Response(
        JSON.stringify({
          datasources: {
            Fixture: {
              access: 'proxy',
              id: 7,
              isDefault: true,
              jsonData: {},
              meta: { id: 'grafana-testdata-datasource', metrics: true },
              name: 'Dashboard Render SDK G POC TestData',
              readOnly: true,
              type: 'grafana-testdata-datasource',
              uid: 'grsdk-testdata',
            },
          },
          defaultDatasource: 'Dashboard Render SDK G POC TestData',
        }),
        { headers: { 'content-type': 'application/json' }, status: 200 }
      )
    );
    const loadDataSourceClass = vi.fn(async () =>
      FakeTestDataSource as unknown as PocDataSourceConstructor
    );
    const harness = runtimeHarness();
    const lease = await harness.coordinator.acquire(hostConfig({ request }));
    const options = {
      loadDataSourceClass,
      moduleIdentity: 'public/app/plugins/datasource/grafana-testdata-datasource/module.tsx',
    };

    const first = await lease.acquireQueryRuntime(options);
    const second = await lease.acquireQueryRuntime(options);

    expect(second).toBe(first);
    expect(loadDataSourceClass).toHaveBeenCalledOnce();
    expect(harness.initializeLoggersRegistry).toHaveBeenCalledOnce();
    expect(harness.registerRuntimeDataSourceInstance).toHaveBeenCalledOnce();
    expect(harness.registerRuntimeDataSourceInstance).toHaveBeenCalledWith({
      dataSource: await first.dataSourceSrv.get('grsdk-testdata'),
    });
    expect(harness.fake.cohort.runtime.getDataSourceSrv()).toBe(first.dataSourceSrv);
    expect(harness.fake.cohort.runtime.getTemplateSrv()).toBe(first.templateSrv);
    expect(harness.fake.cohort.runtime.getRunRequest()).toBe(first.runRequest);
    expect(harness.coordinator.inspect()).toMatchObject({
      initializationSteps: expect.arrayContaining([
        'frontend-settings-loaded',
        'template-service-installed',
        'datasource-service-installed',
        'testdata-instance-loaded',
        'testdata-runtime-instance-registered',
        'run-request-installed',
        'query-runtime-ready',
      ]),
      queryRuntimeStatus: 'ready',
    });
    await expect(
      lease.acquireQueryRuntime({ ...options, loadDataSourceClass: async () => loadDataSourceClass() })
    ).rejects.toBeInstanceOf(PocRuntimeConflictError);
  });
  it('initializes each named responsibility in order and reuses one compatible identity', async () => {
    const harness = runtimeHarness();
    const evidence = createRuntimeEvidenceRecorder();
    const request = vi.fn<typeof fetch>();
    const config = hostConfig({ request });

    const first = await harness.coordinator.acquire(config, evidence);
    const second = await harness.coordinator.acquire(config, evidence);

    expect(first.fingerprint).toBe(second.fingerprint);
    expect(harness.cohortLoads).toBe(1);
    expect(harness.coordinator.inspect()).toMatchObject({
      activeDashboardScopes: 0,
      activeLeases: 2,
      initializationSteps: [
        'host-config-validated',
        'boot-data-installed',
        'asset-policy-installed',
        'grafana-cohort-loaded',
        'theme-selected',
        'i18n-initialized',
        'backend-transport-installed',
        'app-events-installed',
        'location-policy-installed',
        'runtime-ready',
      ],
      status: 'ready',
    });
    expect(harness.window.grafanaBootData).toBeDefined();
    expect(harness.window.__grafana_public_path__).toBe('/grafana/public/');
    expect(first.providerValues.theme).toBe(harness.fake.theme);
    expect(first.backendSrv).toBe(harness.fake.cohort.runtime.getBackendSrv());
    expect(first.dashboardClient).toBe(second.dashboardClient);
    expect(harness.fake.cohort.runtime.config.theme2).toBe(first.providerValues.theme);
    expect(harness.fake.cohort.i18n.initPluginTranslations).toHaveBeenCalledWith(
      'grafana-scenes',
      [harness.fake.cohort.scenes.loadResources]
    );

    first.release();
    second.release();
    expect(harness.coordinator.inspect().activeLeases).toBe(0);
    expect(JSON.stringify(evidence.snapshot())).not.toMatch(/authorization|password|secret/i);
  });

  it('rejects a conflicting page identity with a typed error and preserves the first runtime', async () => {
    const harness = runtimeHarness();
    const first = await harness.coordinator.acquire(hostConfig());

    await expect(
      harness.coordinator.acquire(hostConfig({ grafanaBasePath: '/other-grafana' }))
    ).rejects.toBeInstanceOf(PocRuntimeConflictError);

    expect(harness.cohortLoads).toBe(1);
    expect(harness.coordinator.inspect()).toMatchObject({
      activeLeases: 1,
      fingerprint: first.fingerprint,
      status: 'ready',
    });
  });

  it('rejects a different host request boundary even when visible identity fields match', async () => {
    const harness = runtimeHarness();
    const firstRequest = vi.fn<typeof fetch>();
    await harness.coordinator.acquire(hostConfig({ request: firstRequest }));

    await expect(
      harness.coordinator.acquire(hostConfig({ request: vi.fn<typeof fetch>() }))
    ).rejects.toBeInstanceOf(PocRuntimeConflictError);
    expect(harness.cohortLoads).toBe(1);
  });

  it('installs the one closed Gate A Text catalogue once and reuses its exact identity', async () => {
    const harness = runtimeHarness();
    const request = vi.fn<typeof fetch>();
    const pluginImportUtils = {
      getPanelPluginFromCache: vi.fn(),
      importPanelPlugin: vi.fn(),
    };
    const config = hostConfig({
      panelCatalog: {
        identity: 'gate-a-text-v1',
        panelIds: ['text'],
        pluginImportUtils,
      },
      request,
    });

    const first = await harness.coordinator.acquire(config);
    const second = await harness.coordinator.acquire(config);

    expect(harness.fake.cohort.runtime.getPluginImportUtils()).toBe(pluginImportUtils);
    expect(harness.fake.standardEditorsRegistry.setInit).toHaveBeenCalledOnce();
    const initializer = harness.fake.standardEditorsRegistry.setInit.mock.calls[0]?.[0];
    expect(initializer?.().map((editor: { id: string }) => editor.id)).toEqual([
      'radio',
      'select',
      'boolean',
    ]);
    expect(harness.coordinator.inspect().initializationSteps).toContain('panel-catalog-installed');
    await expect(
      harness.coordinator.acquire({
        ...config,
        panelCatalog: {
          identity: 'gate-a-text-v1',
          panelIds: ['text'],
          pluginImportUtils: {
            getPanelPluginFromCache: vi.fn(),
            importPanelPlugin: vi.fn(),
          },
        },
      })
    ).rejects.toBeInstanceOf(PocRuntimeConflictError);
    first.release();
    second.release();
  });

  it('installs only the closed Gate B Text and Stat catalogue and required view registries', async () => {
    const harness = runtimeHarness();
    const pluginImportUtils = {
      getPanelPluginFromCache: vi.fn(),
      importPanelPlugin: vi.fn(),
    };
    const config = hostConfig({
      panelCatalog: {
        identity: 'gate-b-text-stat-v1',
        panelIds: ['text', 'stat'],
        pluginImportUtils,
      },
    });

    const first = await harness.coordinator.acquire(config);
    const second = await harness.coordinator.acquire(config);

    expect(harness.fake.cohort.runtime.getPluginImportUtils()).toBe(pluginImportUtils);
    expect(harness.fake.standardEditorsRegistry.setInit).toHaveBeenCalledOnce();
    const optionInitializer = harness.fake.standardEditorsRegistry.setInit.mock.calls[0]?.[0];
    expect(optionInitializer?.().map((editor: { id: string }) => editor.id)).toEqual([
      'radio',
      'select',
      'boolean',
      'number',
      'stats-picker',
    ]);
    expect(harness.fake.standardFieldConfigEditorRegistry.setInit).toHaveBeenCalledOnce();
    const fieldInitializer =
      harness.fake.standardFieldConfigEditorRegistry.setInit.mock.calls[0]?.[0];
    expect(fieldInitializer?.().map((editor: { id: string }) => editor.id)).toEqual([
      'unit',
      'color',
      'mappings',
      'thresholds',
    ]);
    expect(harness.coordinator.inspect().initializationSteps).toEqual(
      expect.arrayContaining([
        'stat-option-editors-installed',
        'stat-field-config-installed',
        'panel-catalog-installed',
      ])
    );

    first.release();
    second.release();
  });

  it('installs the closed Gate C catalogue plus the one fixture transformer', async () => {
    const harness = runtimeHarness();
    const pluginImportUtils = {
      getPanelPluginFromCache: vi.fn(),
      importPanelPlugin: vi.fn(),
    };
    const config = hostConfig({
      panelCatalog: {
        identity: 'gate-c-text-stat-timeseries-v1',
        panelIds: ['text', 'stat', 'timeseries'],
        pluginImportUtils,
      },
    });

    const lease = await harness.coordinator.acquire(config);

    expect(harness.fake.cohort.runtime.getPluginImportUtils()).toBe(pluginImportUtils);
    expect(harness.fake.standardTransformersRegistry.setInit).toHaveBeenCalledOnce();
    const transformInitializer = harness.fake.standardTransformersRegistry.setInit.mock.calls[0]?.[0];
    expect(transformInitializer?.().map((transformer: { id: string }) => transformer.id)).toEqual([
      'renameByRegex',
    ]);
    expect(harness.coordinator.inspect().initializationSteps).toEqual(
      expect.arrayContaining([
        'stat-option-editors-installed',
        'stat-field-config-installed',
        'timeseries-field-config-installed',
        'timeseries-transformers-installed',
        'panel-catalog-installed',
      ])
    );
    expect(
      lease.resolveGateCTransformation({
        id: 'renameByRegex',
        options: { regex: '/Raw/', renamePattern: 'Signal' },
      })({ interpolate: (value: string) => value } as never)('source' as never)
    ).toBe('resolved:source');
    expect(() =>
      lease.resolveGateCTransformation({ id: 'organize', options: {} })
    ).toThrow('Gate C admits only renameByRegex');

    lease.release();
  });

  it.each([
    ['absolute Grafana URL', { grafanaBasePath: 'http://localhost:3000/grafana' }],
    ['non-default namespace', { namespace: 'tenant-a' }],
    ['dark theme', { theme: 'dark' }],
    ['nonempty panel catalogue', { panelCatalog: { identity: 'too-early', panelIds: ['text'] } }],
  ])('rejects %s before any global installation', (_case, override) => {
    const harness = runtimeHarness();

    expect(() => harness.coordinator.acquire(hostConfig(override))).toThrowError();
    expect(harness.cohortLoads).toBe(0);
    expect(harness.coordinator.inspect()).toMatchObject({ status: 'empty' });
    expect(harness.window.grafanaBootData).toBeUndefined();
  });

  it('reference-counts one portal root and releases only POC-owned dashboard DOM', async () => {
    const harness = runtimeHarness();
    const runtime = await harness.coordinator.acquire(hostConfig());

    const first = runtime.acquireDashboardScope('dashboard-one');
    const second = runtime.acquireDashboardScope('dashboard-two');
    expect(harness.document.getElementById('grafana-portal-container')).not.toBeNull();
    expect(harness.coordinator.inspect().activeDashboardScopes).toBe(2);

    first.release();
    expect(harness.document.getElementById('grafana-portal-container')).not.toBeNull();
    second.release();
    expect(harness.document.getElementById('grafana-portal-container')).toBeNull();
    expect(harness.createdTags).not.toContain('iframe');
    expect(harness.coordinator.inspect().activeDashboardScopes).toBe(0);

    runtime.release();
  });

  it('records event types, rejects navigation, and never retains credential-shaped config', async () => {
    const harness = runtimeHarness();
    const evidence = createRuntimeEvidenceRecorder();
    const runtime = await harness.coordinator.acquire(hostConfig(), evidence);

    runtime.appEvents.publish({ type: 'task5-test-event' } as never);
    expect(harness.coordinator.inspect().observedEventTypes).toEqual(['task5-test-event']);
    expect(() => harness.fake.locationService.push('/grafana/d/example')).toThrowError(
      /navigation is unsupported/i
    );
    expect(() =>
      harness.coordinator.acquire(
        hostConfig({ authorization: 'Bearer must-not-persist' }),
        evidence
      )
    ).toThrowError(/credential-bearing/i);
    expect(JSON.stringify(harness.coordinator.inspect())).not.toContain('must-not-persist');
    expect(JSON.stringify(evidence.snapshot())).not.toContain('must-not-persist');

    runtime.release();
  });
});
