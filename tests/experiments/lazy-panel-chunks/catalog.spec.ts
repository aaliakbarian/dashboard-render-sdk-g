// POC / EXPERIMENT / NOT FOR PRODUCTION
import type { PanelPlugin } from '@grafana/data';
import { describe, expect, it } from 'vitest';

import { classifyForbiddenGrafanaImport } from '../../../apps/poc-host/build/forbiddenGrafanaImportPlugin.ts';
import {
  LazyPanelLoadError,
  UnsupportedLazyPanelError,
  createClosedLazyPanelCatalogForExperiment,
  type LazyPanelLoadEvent,
} from '../../../experiments/bundle/lazy-panel-chunks/closedLazyPanelCatalog.ts';

const plugin = () => ({ meta: {} }) as PanelPlugin;

describe('independent lazy panel catalogue', () => {
  it('admits the Stat renderer alias only inside this bounded experiment', () => {
    const experimentRoot = '/workspace/experiments/bundle/lazy-panel-chunks';

    expect(
      classifyForbiddenGrafanaImport(
        'grafana-experiment-stat-renderer',
        `${experimentRoot}/features/stat.ts`,
        { lazyPanelExperimentRoot: experimentRoot }
      )
    ).toBeUndefined();
    expect(
      classifyForbiddenGrafanaImport(
        'grafana-experiment-stat-renderer',
        '/workspace/apps/poc-host/src/App.tsx',
        { lazyPanelExperimentRoot: experimentRoot }
      )
    ).toMatchObject({ category: 'grafana-application-source-outside-bridge' });
    expect(
      classifyForbiddenGrafanaImport(
        'grafana-experiment-timeseries-renderer',
        `${experimentRoot}/features/timeseries.ts`,
        { lazyPanelExperimentRoot: experimentRoot }
      )
    ).toBeUndefined();
  });

  it('keeps the loader mapping closed to Text, Stat, and Time series', async () => {
    const catalog = createClosedLazyPanelCatalogForExperiment({
      loadStat: async () => plugin(),
      loadText: async () => plugin(),
      loadTimeSeries: async () => plugin(),
    });

    expect(catalog.panelIds).toEqual(['text', 'stat', 'timeseries']);
    await expect(catalog.importPanelPlugin('table')).rejects.toBeInstanceOf(
      UnsupportedLazyPanelError
    );
    await expect(catalog.importPanelPlugin('../stat')).rejects.toBeInstanceOf(
      UnsupportedLazyPanelError
    );
  });

  it('coalesces concurrent loads and reuses the resolved plugin identity', async () => {
    let textLoads = 0;
    let resolveText: ((value: PanelPlugin) => void) | undefined;
    const pendingText = new Promise<PanelPlugin>((resolve) => {
      resolveText = resolve;
    });
    const catalog = createClosedLazyPanelCatalogForExperiment({
      loadStat: async () => plugin(),
      loadText: () => {
        textLoads += 1;
        return pendingText;
      },
      loadTimeSeries: async () => plugin(),
    });

    const first = catalog.importPanelPlugin('text');
    const concurrent = catalog.importPanelPlugin('text');
    expect(first).toBe(concurrent);
    expect(textLoads).toBe(1);

    const resolved = plugin();
    resolveText?.(resolved);
    await expect(first).resolves.toBe(resolved);
    await expect(catalog.importPanelPlugin('text')).resolves.toBe(resolved);
    expect(textLoads).toBe(1);
  });

  it('keeps failures panel-local, evicts the failed promise, and permits retry', async () => {
    const events: LazyPanelLoadEvent[] = [];
    let statAttempts = 0;
    const text = plugin();
    const retriedStat = plugin();
    const catalog = createClosedLazyPanelCatalogForExperiment({
      evidence: { record: (event) => events.push(structuredClone(event)) },
      loadStat: async () => {
        statAttempts += 1;
        if (statAttempts === 1) throw new Error('controlled experiment failure');
        return retriedStat;
      },
      loadText: async () => text,
      loadTimeSeries: async () => plugin(),
    });

    await expect(catalog.importPanelPlugin('stat')).rejects.toMatchObject({
      code: 'panel-plugin-load-failed',
      pluginId: 'stat',
    } satisfies Partial<LazyPanelLoadError>);
    await expect(catalog.importPanelPlugin('text')).resolves.toBe(text);
    await expect(catalog.importPanelPlugin('stat')).resolves.toBe(retriedStat);

    expect(statAttempts).toBe(2);
    expect(catalog.getPanelPluginFromCache('stat')).toBe(retriedStat);
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ cache: 'miss', pluginId: 'stat', type: 'start' }),
        expect.objectContaining({ category: 'module-load-failed', pluginId: 'stat', type: 'failure' }),
        expect.objectContaining({ pluginId: 'text', type: 'success' }),
        expect.objectContaining({ pluginId: 'stat', type: 'success' }),
      ])
    );
    expect(JSON.stringify(events)).not.toContain('controlled experiment failure');
  });
});
