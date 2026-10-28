import { describe, expect, it, vi } from 'vitest';

import { grafana13Provider } from '../provider';
import { validateProviderCompatibilityManifest } from '@dashboard-render-sdk-g/provider-contract';
import { createGrafana13TextPanelCatalog } from '../panels/catalog';
import { createGrafana13RuntimeDashboardMounter } from './implementation';

const manifest = validateProviderCompatibilityManifest(grafana13Provider.manifest);
if (!manifest.valid) throw new Error('Expected provider manifest.');

function input() {
  return {
    dashboard: { kind: 'renderable', uid: 'dashboard', panels: [{ kind: 'supported', panelType: 'text' }] },
    hostReact: {
      identities: { jsxDevRuntime: {}, jsxRuntime: {}, react: {}, reactDom: {}, reactDomClient: {} },
      versions: { react: '19.2.8', reactDom: '19.2.8' },
    },
    instanceId: 'instance', manifest, namespace: 'default', onPanelRenderFailure() {},
    transport: {
      descriptor: { basePath: '/', requestPolicyId: 'policy', schemaVersion: 1 as const, securityScopeId: 'scope', targetOrigin: 'https://example.invalid' },
      execute: async (request: { requestId: string }) => ({ kind: 'cancelled' as const, requestId: request.requestId }),
    },
  };
}

function harness(failAt?: 'scope' | 'convert' | 'activate' | 'provider') {
  const order: string[] = [];
  const plugin = {};
  const catalog = createGrafana13TextPanelCatalog({ loadTextPlugin: async () => plugin as never });
  const lease = {
    acquireSceneScope: vi.fn(() => {
      if (failAt === 'scope') throw new Error('scope failure');
      return { release: () => order.push('scope') };
    }),
    cohort: { runtime: { getPluginImportUtils: () => catalog }, scenes: {} },
    providerValues: {}, release: () => order.push('lease'),
  };
  const scene = {
    Component: () => null,
    activate: () => {
      if (failAt === 'activate') throw new Error('activate failure');
      return () => order.push('scene');
    },
  };
  const mount = createGrafana13RuntimeDashboardMounter({
    acquire: vi.fn(async () => lease as never),
    convert: () => {
      if (failAt === 'convert') throw new Error('convert failure');
      return { panelIds: [], scene };
    },
    createProviderElement: (_values, child) => {
      if (failAt === 'provider') throw new Error('provider failure');
      return child as never;
    },
  });
  return { catalog, lease, mount, order, plugin };
}

describe('runtime dashboard mount ownership', () => {
  it('keeps native plugin preparation failure local and still prepares the sibling', async () => {
    const catalogue = createGrafana13TextPanelCatalog({ loadStatPlugin: async () => { throw new Error('secret loader cause'); }, loadTimeSeriesPlugin: async () => ({} as never) });
    const convert = vi.fn((_dashboard: unknown, _scenes: unknown, _options?: unknown) => ({ panelIds: [], scene: { activate: () => () => {}, Component: () => null } }));
    const mount = createGrafana13RuntimeDashboardMounter({
      acquire: async () => ({ acquireQueryRuntime: async () => {}, acquireSceneScope: () => ({ release() {} }), cohort: { runtime: { getPluginImportUtils: () => catalogue }, scenes: {} }, release() {} } as never),
      loadQueryScenes: async () => ({}), convert,
      createProviderElement: (_values, child) => child as never,
    });
    const mounted = await mount({ ...input(), dashboard: { ...input().dashboard, panels: [{ kind: 'supported', panelType: 'stat' }, { kind: 'supported', panelType: 'timeseries' }] } } as never);
    expect(convert.mock.calls[0]?.[2]).toMatchObject({ failedPluginIds: ['stat'] });
    expect(catalogue.getPanelPluginFromCache('timeseries')).toBeDefined();
    mounted.release();
  });
  it('acquires query services and inventories only admitted query plugin IDs before activation', async () => {
    const order: string[] = [];
    const catalogue = createGrafana13TextPanelCatalog({
      loadTextPlugin: async () => { throw new Error('Text must remain unloaded'); },
      loadStatPlugin: async () => { order.push('stat'); return {} as never; },
      loadTimeSeriesPlugin: async () => { order.push('timeseries'); return {} as never; },
    });
    const acquireQueryRuntime = vi.fn(async () => { order.push('query'); });
    const mount = createGrafana13RuntimeDashboardMounter({
      acquire: async () => ({ acquireQueryRuntime, acquireSceneScope: () => ({ release() {} }), cohort: { runtime: { getPluginImportUtils: () => catalogue }, scenes: {} }, release() {} } as never),
      loadQueryScenes: async () => ({}),
      convert: () => ({ panelIds: [], scene: { activate: () => { order.push('activate'); return () => {}; }, Component: () => null } }),
      createProviderElement: (_values, child) => child as never,
    });
    await mount({ ...input(), dashboard: { ...input().dashboard, panels: [
      { kind: 'supported', panelType: 'stat' }, { kind: 'supported', panelType: 'timeseries' }, { kind: 'supported', panelType: 'stat' },
      { kind: 'unsupported', panelType: 'table' },
    ] } } as never);
    expect(order).toEqual(['query', 'stat', 'timeseries', 'activate']);
    expect(acquireQueryRuntime).toHaveBeenCalledOnce();
    expect(catalogue.getPanelPluginFromCache('text')).toBeUndefined();
    expect(catalogue.getPanelPluginFromCache('table')).toBeUndefined();
  });
  it('deactivates the scene, releases its scope, then releases its lease exactly once', async () => {
    const { catalog, mount, order, plugin } = harness();
    const mounted = await mount(input() as never);
    expect(catalog.getPanelPluginFromCache('text')).toBe(plugin);
    await expect(catalog.importPanelPlugin('text')).resolves.toBe(plugin);
    mounted.release();
    mounted.release();
    expect(order).toEqual(['scene', 'scope', 'lease']);
  });

  it('preloads the real closed Text catalogue before scene activation and sanitizes failure', async () => {
    const order: string[] = [];
    const loadTextPlugin = vi.fn(async () => {
      throw new Error('secret plugin loader cause Authorization: Bearer secret');
    });
    const catalog = createGrafana13TextPanelCatalog({ loadTextPlugin });
    const mount = createGrafana13RuntimeDashboardMounter({
      acquire: async () => ({
        acquireSceneScope: () => { throw new Error('scope must not be acquired'); },
        cohort: { runtime: { getPluginImportUtils: () => catalog }, scenes: {} },
        providerValues: {},
        release: () => order.push('lease'),
      } as never),
      convert: () => { throw new Error('conversion must not run'); },
      createProviderElement: () => { throw new Error('provider must not render'); },
    });

    const error = await mount(input() as never).catch((value: unknown) => value) as {
      readonly code?: string;
      readonly message?: string;
    };
    expect(error).toMatchObject({
      code: 'panel-render-failed',
      message: 'The Grafana 13 Text panel could not be prepared.',
    });
    expect(JSON.stringify(error)).not.toMatch(/secret|authorization|cause/i);
    expect(loadTextPlugin).toHaveBeenCalledTimes(1);
    expect(order).toEqual(['lease']);
  });

  it.each([
    ['scope', ['lease']],
    ['convert', ['scope', 'lease']],
    ['activate', ['scope', 'lease']],
    ['provider', ['scene', 'scope', 'lease']],
  ] as const)('releases all acquired resources in order when %s fails', async (stage, expected) => {
    const { mount, order } = harness(stage);
    await expect(mount(input() as never)).rejects.toThrow(`${stage} failure`);
    expect(order).toEqual(expected);
  });
});
