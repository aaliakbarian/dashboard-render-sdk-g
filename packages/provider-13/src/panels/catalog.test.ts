import type { PanelPlugin } from '@grafana/data';
import { describe, expect, it, vi } from 'vitest';

import {
  Grafana13PanelPluginLoadError,
  Grafana13UnsupportedPanelPluginError,
  TEXT_PANEL_MODULE_IDENTITY,
  createGrafana13TextPanelCatalog,
  type Grafana13PanelPluginLoadEvent,
} from './catalog';

function panelPlugin(): PanelPlugin {
  return { meta: {}, panel: () => null } as unknown as PanelPlugin;
}

describe('Grafana 13 closed Text catalogue', () => {
  it.each(['stat', 'timeseries'] as const)('loads and caches only the fixed %s renderer identity independently', async (id) => {
    const plugin = panelPlugin();
    const other = panelPlugin();
    const catalogue = createGrafana13TextPanelCatalog({
      loadStatPlugin: async () => id === 'stat' ? plugin : other,
      loadTimeSeriesPlugin: async () => id === 'timeseries' ? plugin : other,
    });
    const first = catalogue.importPanelPlugin(id);
    const second = catalogue.importPanelPlugin(id);
    // Observe both rejections before asserting identity, even during RED.
    const results = await Promise.allSettled([first, second]);
    expect(second).toBe(first);
    expect(results).toEqual([{ status: 'fulfilled', value: plugin }, { status: 'fulfilled', value: plugin }]);
    expect(catalogue.getPanelPluginFromCache(id)).toBe(plugin);
    expect(plugin.meta).toMatchObject({ id, skipDataQuery: false, version: '13.2.3' });
    const otherId = id === 'stat' ? 'timeseries' : 'stat';
    expect(catalogue.getPanelPluginFromCache(otherId)).toBeUndefined();
    await expect(catalogue.importPanelPlugin(otherId)).resolves.toBe(other);
    for (const unsupported of ['table', 'gauge', 'bargauge', 'piechart', 'barchart']) {
      await expect(catalogue.importPanelPlugin(unsupported)).rejects.toBeInstanceOf(Grafana13UnsupportedPanelPluginError);
    }
  });

  it.each(['stat', 'timeseries'] as const)('evicts a rejected %s load without poisoning its sibling or leaking the cause', async (id) => {
    let attempts = 0;
    const plugin = panelPlugin();
    const load = async () => { if (++attempts === 1) throw new Error('Bearer secret-canary'); return plugin; };
    const catalogue = createGrafana13TextPanelCatalog({
      loadStatPlugin: id === 'stat' ? load : async () => panelPlugin(),
      loadTimeSeriesPlugin: id === 'timeseries' ? load : async () => panelPlugin(),
    });
    const failure = await catalogue.importPanelPlugin(id).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(Grafana13PanelPluginLoadError);
    expect(JSON.stringify(failure)).not.toContain('secret-canary');
    expect(catalogue.getPanelPluginFromCache(id)).toBeUndefined();
    await expect(catalogue.importPanelPlugin(id)).resolves.toBe(plugin);
  });

  it('records miss/success/hit and reuses one stable plugin identity', async () => {
    const plugin = panelPlugin();
    const events: Grafana13PanelPluginLoadEvent[] = [];
    const loadTextPlugin = vi.fn(async () => plugin);
    const catalogue = createGrafana13TextPanelCatalog({
      evidence: { record: (event) => events.push(structuredClone(event)) },
      loadTextPlugin,
    });

    const first = catalogue.importPanelPlugin('text');
    const second = catalogue.importPanelPlugin('text');

    expect(second).toBe(first);
    await expect(first).resolves.toBe(plugin);
    expect(catalogue.getPanelPluginFromCache('text')).toBe(plugin);
    expect(loadTextPlugin).toHaveBeenCalledOnce();
    expect(plugin.meta).toMatchObject({
      id: 'text',
      module: TEXT_PANEL_MODULE_IDENTITY,
      name: 'Text',
      skipDataQuery: true,
      version: '13.2.3',
    });
    expect(events).toEqual([
      {
        cache: 'miss',
        moduleIdentity: TEXT_PANEL_MODULE_IDENTITY,
        pluginId: 'text',
        sourceCategory: 'grafana-application-source',
        sourceRevision: '6193dc03311b631b9727b560d24369e683dc396e',
        type: 'start',
      },
      { pluginId: 'text', type: 'cache-hit' },
      {
        moduleIdentity: TEXT_PANEL_MODULE_IDENTITY,
        pluginId: 'text',
        type: 'success',
        version: '13.2.3',
      },
    ]);
  });

  it('rejects unknown IDs before invoking a loader or constructing a remote path', async () => {
    const loadTextPlugin = vi.fn(async () => panelPlugin());
    const events: Grafana13PanelPluginLoadEvent[] = [];
    const secret = 'https://attacker.test/System.import.js?token=panel-secret';
    const catalogue = createGrafana13TextPanelCatalog({
      evidence: { record: (event) => events.push(structuredClone(event)) },
      loadTextPlugin,
    });

    const failure = await catalogue.importPanelPlugin(secret).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(Grafana13UnsupportedPanelPluginError);
    expect(failure).toMatchObject({ pluginId: '<unsupported>' });
    expect(JSON.stringify(failure)).not.toContain(secret);
    expect(loadTextPlugin).not.toHaveBeenCalled();
    expect(events).toEqual([
      { category: 'unknown-plugin', pluginId: '<unsupported>', type: 'failure' },
    ]);
    expect(JSON.stringify(events)).not.toContain(secret);
  });

  it('sanitizes loader failures and permits a bounded retry', async () => {
    const secret = 'Bearer provider-task-secret';
    const plugin = panelPlugin();
    const events: Grafana13PanelPluginLoadEvent[] = [];
    const loadTextPlugin = vi
      .fn<() => Promise<PanelPlugin>>()
      .mockRejectedValueOnce(new Error(secret))
      .mockResolvedValueOnce(plugin);
    const catalogue = createGrafana13TextPanelCatalog({
      evidence: { record: (event) => events.push(structuredClone(event)) },
      loadTextPlugin,
    });

    const failure = await catalogue.importPanelPlugin('text').catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(Grafana13PanelPluginLoadError);
    expect(failure).not.toHaveProperty('cause');
    expect(JSON.stringify(failure)).not.toContain(secret);
    expect(JSON.stringify(events)).not.toContain(secret);
    await expect(catalogue.importPanelPlugin('text')).resolves.toBe(plugin);
    expect(loadTextPlugin).toHaveBeenCalledTimes(2);
  });
});
