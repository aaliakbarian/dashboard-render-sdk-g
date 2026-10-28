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
