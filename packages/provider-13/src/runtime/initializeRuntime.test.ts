import type { HostReactRuntime, HostTransportCapability } from '@dashboard-render-sdk-g/provider-contract';
import { describe, expect, it, vi } from 'vitest';

import { createGrafana13TextPanelCatalog } from '../panels/catalog';
import { grafana13Provider } from '../provider';
import { initializeGrafana13Runtime, Grafana13NavigationUnsupportedError } from './initializeRuntime';

function hostReact(): HostReactRuntime {
  const object = {};
  return {
    identities: {
      jsxDevRuntime: object, jsxRuntime: object, react: object,
      reactDom: object, reactDomClient: object,
    },
    versions: { react: '19.2.8', reactDom: '19.2.8' },
  };
}

function transport(): HostTransportCapability {
  return {
    descriptor: {
      basePath: '/grafana', requestPolicyId: 'policy', schemaVersion: 1,
      securityScopeId: 'scope', targetOrigin: 'https://host.example',
    },
    execute: async (request) => ({ kind: 'cancelled', requestId: request.requestId }),
  };
}

describe('initializeGrafana13Runtime', () => {
  it('installs only the minimum Text/Scenes infrastructure in deterministic order', async () => {
    const installed: string[] = [];
    let backend: unknown;
    let catalog: unknown;
    let events: unknown;
    const history = { push: vi.fn(), replace: vi.fn() };
    const locationService = { getHistory: () => history, push: vi.fn(), replace: vi.fn() };
    class EventBusSrv { publish() {} removeAllListeners() {} }
    const ThemeContext = { Provider: Symbol('provider') };
    const cohort = {
      data: { EventBusSrv, ThemeContext },
      i18n: {
        initPluginTranslations: vi.fn(async () => {
          installed.push('i18n');
          return { language: 'en-US' };
        }),
      },
      runtime: {
        config: { theme2: { isLight: true } },
        getAppEvents: () => events,
        getBackendSrv: () => backend,
        getPluginImportUtils: () => catalog,
        locationService,
        setAppEvents(value: unknown) { installed.push('events'); events = value; },
        setBackendSrv(value: unknown) { installed.push('backend'); backend = value; },
        setPluginImportUtils(value: unknown) { installed.push('catalog'); catalog = value; },
      },
      scenes: { loadResources: vi.fn() },
      ui: {},
      versions: {},
    };
    const window = { location: { origin: 'https://host.example' } };
    const panelCatalog = createGrafana13TextPanelCatalog({ loadTextPlugin: vi.fn() });
    let queryLoads = 0;
    const queryValue = {};
    const result = await initializeGrafana13Runtime(
      {
        hostReact: hostReact(),
        namespace: 'default',
        providerId: '@dashboard-render-sdk-g/provider-13',
        providerBuildId: 'provider-build',
        providerManifest: grafana13Provider.manifest,
        transport: transport(),
      },
      {
        loadCohort: async ({ prelude, target }) => {
          installed.push('cohort');
          expect(target).toBe(window);
          expect(prelude?.bootData.settings).toMatchObject({
            appSubUrl: '/grafana', language: 'en-US', namespace: 'default',
          });
          return cohort as never;
        },
        panelCatalog,
        loadQueryRuntime: async () => { if (++queryLoads === 1) throw new Error('private module failure'); return queryValue as never; },
        window,
      }
    );

    expect(installed).toEqual(['cohort', 'catalog', 'backend', 'events', 'i18n']);
    expect(result.cohort).toBe(cohort);
    expect(result.providerValues).toEqual({ ThemeContext, theme: { isLight: true } });
    expect(catalog).toBe(panelCatalog);
    expect(typeof result.acquireQueryRuntime).toBe('function');
    expect(queryLoads).toBe(0);
    const firstQuery = result.acquireQueryRuntime(); const concurrentQuery = result.acquireQueryRuntime();
    expect(firstQuery).toBe(concurrentQuery);
    await expect(firstQuery).rejects.toMatchObject({ code: 'runtime-initialization-failed' });
    expect(queryLoads).toBe(1);
    expect(await result.acquireQueryRuntime()).toBe(queryValue);
    expect(await result.acquireQueryRuntime()).toBe(queryValue); expect(queryLoads).toBe(2);
    expect(() => locationService.push()).toThrow(Grafana13NavigationUnsupportedError);
    expect(() => history.replace()).toThrow(Grafana13NavigationUnsupportedError);
  });

  it('rejects an incompatible theme or i18n result without exposing a raw cause', async () => {
    let backend: unknown;
    let catalog: unknown;
    let events: unknown;
    const cohort = {
      data: { EventBusSrv: class { publish() {} removeAllListeners() {} }, ThemeContext: {} },
      i18n: { initPluginTranslations: async () => ({ language: 'en-US' }) },
      runtime: {
        config: { theme2: { isLight: false } }, locationService: {},
        getAppEvents: () => events, getBackendSrv: () => backend, getPluginImportUtils: () => catalog,
        setAppEvents(value: unknown) { events = value; },
        setBackendSrv(value: unknown) { backend = value; },
        setPluginImportUtils(value: unknown) { catalog = value; },
      },
      scenes: { loadResources: vi.fn() }, ui: {}, versions: {},
    };
    await expect(initializeGrafana13Runtime(
      {
        hostReact: hostReact(), namespace: 'default',
        providerId: '@dashboard-render-sdk-g/provider-13', providerBuildId: 'build',
        providerManifest: grafana13Provider.manifest, transport: transport(),
      },
      {
        loadCohort: async () => cohort as never,
        panelCatalog: createGrafana13TextPanelCatalog({ loadTextPlugin: vi.fn() }),
        window: { location: { origin: 'https://host.example' } },
      }
    )).rejects.toThrow('light theme');
  });
});
