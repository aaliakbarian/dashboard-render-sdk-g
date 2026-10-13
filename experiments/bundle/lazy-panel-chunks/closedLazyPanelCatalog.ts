// POC / EXPERIMENT / NOT FOR PRODUCTION
import type { PanelPlugin, PanelPluginMeta, PluginMetaInfo } from '@grafana/data';

export const LAZY_PANEL_IDS = ['text', 'stat', 'timeseries'] as const;
export type LazyPanelId = (typeof LAZY_PANEL_IDS)[number];

const GRAFANA_SOURCE_COMMIT = '6193dc03311b631b9727b560d24369e683dc396e' as const;
const GRAFANA_SOURCE_VERSION = '13.2.3' as const;

const descriptors = {
  stat: {
    moduleIdentity: 'public/app/plugins/panel/stat/StatPanel.tsx',
    name: 'Stat',
    strategy: 'renderer-only',
  },
  text: {
    moduleIdentity: 'public/app/plugins/panel/text/v1/TextPanel.tsx',
    name: 'Text',
    strategy: 'renderer-only-experiment-a',
  },
  timeseries: {
    moduleIdentity: 'poc-p2:public/app/plugins/panel/timeseries/TimeSeriesPanel.tsx',
    name: 'Time series',
    strategy: 'p2-renderer-only',
  },
} as const satisfies Record<
  LazyPanelId,
  { readonly moduleIdentity: string; readonly name: string; readonly strategy: string }
>;

export type LazyPanelLoadEvent =
  | {
      readonly cache: 'miss';
      readonly moduleIdentity: string;
      readonly pluginId: LazyPanelId;
      readonly sourceCommit: typeof GRAFANA_SOURCE_COMMIT;
      readonly strategy: string;
      readonly type: 'start';
    }
  | { readonly pluginId: LazyPanelId; readonly type: 'cache-hit' }
  | {
      readonly moduleIdentity: string;
      readonly pluginId: LazyPanelId;
      readonly version: typeof GRAFANA_SOURCE_VERSION;
      readonly type: 'success';
    }
  | {
      readonly category: 'module-load-failed' | 'unknown-plugin';
      readonly pluginId: string;
      readonly type: 'failure';
    };

export interface LazyPanelEvidenceRecorder {
  record(event: LazyPanelLoadEvent): void;
}

export class UnsupportedLazyPanelError extends Error {
  readonly code = 'panel-plugin-unsupported';

  constructor(readonly pluginId: string) {
    super(`Panel plugin ${pluginId || '<empty>'} is outside the closed lazy-panel experiment catalogue.`);
    this.name = 'UnsupportedLazyPanelError';
  }
}

export class LazyPanelLoadError extends Error {
  readonly code = 'panel-plugin-load-failed';

  constructor(readonly pluginId: LazyPanelId, options?: ErrorOptions) {
    super(`The pinned ${pluginId} renderer feature could not be loaded.`, options);
    this.name = 'LazyPanelLoadError';
  }
}

export interface LazyPanelLoaders {
  readonly loadStat: () => Promise<PanelPlugin>;
  readonly loadText: () => Promise<PanelPlugin>;
  readonly loadTimeSeries: () => Promise<PanelPlugin>;
}

export interface LazyPanelCatalog {
  readonly panelIds: typeof LAZY_PANEL_IDS;
  getPanelPluginFromCache(id: string): PanelPlugin | undefined;
  importPanelPlugin(id: string): Promise<PanelPlugin>;
}

function isLazyPanelId(value: string): value is LazyPanelId {
  return (LAZY_PANEL_IDS as readonly string[]).includes(value);
}

function attachMetadata(plugin: PanelPlugin, pluginId: LazyPanelId): PanelPlugin {
  const descriptor = descriptors[pluginId];
  plugin.meta = {
    ...plugin.meta,
    baseUrl: '',
    id: pluginId,
    info: {
      author: { name: 'Grafana Labs' },
      description: `Built-in Grafana ${descriptor.name} panel.`,
      links: [],
      logos: { large: '', small: '' },
      screenshots: [],
      updated: '',
      version: GRAFANA_SOURCE_VERSION,
    } as PluginMetaInfo,
    module: descriptor.moduleIdentity,
    name: descriptor.name,
    skipDataQuery: pluginId === 'text',
    suggestions: true,
    type: 'panel',
    version: GRAFANA_SOURCE_VERSION,
  } as PanelPluginMeta;
  return plugin;
}

/**
 * Fixed-ID loader used only by this experiment. Load functions are supplied by
 * provider-owned code/tests, never dashboard JSON or host-controlled URLs.
 */
export function createClosedLazyPanelCatalogForExperiment(
  loaders: LazyPanelLoaders & { readonly evidence?: LazyPanelEvidenceRecorder }
): LazyPanelCatalog {
  const promises = new Map<LazyPanelId, Promise<PanelPlugin>>();
  const plugins = new Map<LazyPanelId, PanelPlugin>();
  const loaderById = {
    stat: loaders.loadStat,
    text: loaders.loadText,
    timeseries: loaders.loadTimeSeries,
  } as const satisfies Record<LazyPanelId, () => Promise<PanelPlugin>>;

  return {
    panelIds: LAZY_PANEL_IDS,
    getPanelPluginFromCache(id) {
      return isLazyPanelId(id) ? plugins.get(id) : undefined;
    },
    importPanelPlugin(id) {
      if (!isLazyPanelId(id)) {
        loaders.evidence?.record({ category: 'unknown-plugin', pluginId: '<unsupported>', type: 'failure' });
        return Promise.reject(new UnsupportedLazyPanelError(id));
      }

      const cached = promises.get(id);
      if (cached) {
        loaders.evidence?.record({ pluginId: id, type: 'cache-hit' });
        return cached;
      }

      const descriptor = descriptors[id];
      loaders.evidence?.record({
        cache: 'miss',
        moduleIdentity: descriptor.moduleIdentity,
        pluginId: id,
        sourceCommit: GRAFANA_SOURCE_COMMIT,
        strategy: descriptor.strategy,
        type: 'start',
      });
      const pending = loaderById[id]()
        .then((plugin) => {
          const resolved = attachMetadata(plugin, id);
          plugins.set(id, resolved);
          loaders.evidence?.record({
            moduleIdentity: descriptor.moduleIdentity,
            pluginId: id,
            type: 'success',
            version: GRAFANA_SOURCE_VERSION,
          });
          return resolved;
        })
        .catch((cause: unknown) => {
          promises.delete(id);
          loaders.evidence?.record({
            category: 'module-load-failed',
            pluginId: id,
            type: 'failure',
          });
          throw new LazyPanelLoadError(id, { cause });
        });
      promises.set(id, pending);
      return pending;
    },
  };
}
