import type { PanelPlugin, PanelPluginMeta, PluginMetaInfo } from '@grafana/data';

export const TEXT_PANEL_MODULE_IDENTITY =
  'public/app/plugins/panel/text/v1/TextPanel.tsx' as const;
export const GRAFANA_13_SOURCE_REVISION =
  '6193dc03311b631b9727b560d24369e683dc396e' as const;
export const PANEL_MODULE_IDENTITIES = Object.freeze({
  text: TEXT_PANEL_MODULE_IDENTITY,
  stat: 'public/app/plugins/panel/stat/StatPanel.tsx',
  timeseries: 'public/app/plugins/panel/timeseries/TimeSeriesPanel.tsx',
  gauge: 'public/app/plugins/panel/gauge/GaugePanel.tsx',
  bargauge: 'public/app/plugins/panel/bargauge/BarGaugePanel.tsx',
} as const);
type PanelId = keyof typeof PANEL_MODULE_IDENTITIES;

export type Grafana13PanelPluginLoadEvent =
  | {
      readonly cache: 'miss';
      readonly moduleIdentity: typeof PANEL_MODULE_IDENTITIES[PanelId];
      readonly pluginId: PanelId;
      readonly sourceCategory: 'grafana-application-source';
      readonly sourceRevision: typeof GRAFANA_13_SOURCE_REVISION;
      readonly type: 'start';
    }
  | { readonly pluginId: PanelId; readonly type: 'cache-hit' }
  | {
      readonly moduleIdentity: typeof PANEL_MODULE_IDENTITIES[PanelId];
      readonly pluginId: PanelId;
      readonly type: 'success';
      readonly version: '13.2.3';
    }
  | {
      readonly category: 'module-load-failed' | 'unknown-plugin';
      readonly pluginId: string;
      readonly type: 'failure';
    };

export interface Grafana13PanelPluginEvidence {
  record(event: Grafana13PanelPluginLoadEvent): void;
}

export interface Grafana13TextPanelCatalog {
  getPanelPluginFromCache(id: string): PanelPlugin | undefined;
  importPanelPlugin(id: string): Promise<PanelPlugin>;
}

export class Grafana13UnsupportedPanelPluginError extends Error {
  override readonly name = 'Grafana13UnsupportedPanelPluginError';
  readonly code = 'panel-plugin-unsupported' as const;
  readonly pluginId = '<unsupported>' as const;

  constructor() {
    super('The requested panel plugin is outside the closed Grafana 13 catalogue.');
  }
}

export class Grafana13PanelPluginLoadError extends Error {
  override readonly name = 'Grafana13PanelPluginLoadError';
  readonly code = 'panel-plugin-load-failed' as const;
  constructor(readonly pluginId: PanelId = 'text') {
    super('The pinned Grafana 13 panel module could not be loaded.');
  }
}

function attachMetadata(plugin: PanelPlugin, id: PanelId): PanelPlugin {
  const name = { text: 'Text', stat: 'Stat', timeseries: 'Time series', gauge: 'Gauge', bargauge: 'Bar gauge' }[id];
  plugin.meta = {
    ...plugin.meta,
    baseUrl: '',
    id,
    info: {
      author: { name: 'Grafana Labs' },
      description: `Built-in Grafana ${name} panel.`,
      links: [],
      logos: { large: '', small: '' },
      screenshots: [],
      updated: '',
      version: '13.2.3',
    } as PluginMetaInfo,
    module: PANEL_MODULE_IDENTITIES[id],
    name,
    skipDataQuery: id === 'text',
    suggestions: true,
    type: 'panel',
    version: '13.2.3',
  } as PanelPluginMeta;
  return plugin;
}

export function createGrafana13TextPanelCatalog(options: {
  readonly evidence?: Grafana13PanelPluginEvidence;
  readonly loadTextPlugin?: () => Promise<PanelPlugin>;
  readonly loadStatPlugin?: () => Promise<PanelPlugin>;
  readonly loadTimeSeriesPlugin?: () => Promise<PanelPlugin>;
  readonly loadGaugePlugin?: () => Promise<PanelPlugin>;
  readonly loadBarGaugePlugin?: () => Promise<PanelPlugin>;
}): Grafana13TextPanelCatalog {
  const pending = new Map<PanelId, Promise<PanelPlugin>>();
  const resolved = new Map<PanelId, PanelPlugin>();
  const loaders = {
    text: options.loadTextPlugin ?? (() => import('./textPlugin').then(m => m.grafana13TextPanelPlugin)),
    stat: options.loadStatPlugin ?? (() => import('./statPlugin').then(m => m.grafana13StatPanelPlugin)),
    timeseries: options.loadTimeSeriesPlugin ?? (() => import('./timeSeriesPlugin').then(m => m.grafana13TimeSeriesPanelPlugin)),
    gauge: options.loadGaugePlugin ?? (() => import('./gaugePlugin').then(m => m.grafana13GaugePanelPlugin)),
    bargauge: options.loadBarGaugePlugin ?? (() => import('./barGaugePlugin').then(m => m.grafana13BarGaugePanelPlugin)),
  };

  return {
    getPanelPluginFromCache(id) {
      return resolved.get(id as PanelId);
    },
    importPanelPlugin(id) {
      if (!Object.hasOwn(PANEL_MODULE_IDENTITIES, id)) {
        options.evidence?.record({
          category: 'unknown-plugin',
          pluginId: '<unsupported>',
          type: 'failure',
        });
        return Promise.reject(new Grafana13UnsupportedPanelPluginError());
      }

      const panelId = id as PanelId;
      const cached = pending.get(panelId);
      if (cached) {
        options.evidence?.record({ pluginId: panelId, type: 'cache-hit' });
        return cached;
      }

      options.evidence?.record({
        cache: 'miss',
        moduleIdentity: PANEL_MODULE_IDENTITIES[panelId],
        pluginId: panelId,
        sourceCategory: 'grafana-application-source',
        sourceRevision: GRAFANA_13_SOURCE_REVISION,
        type: 'start',
      });
      const loading = Promise.resolve().then(loaders[panelId])
        .then((plugin) => {
          const value = attachMetadata(plugin, panelId);
          resolved.set(panelId, value);
          options.evidence?.record({
            moduleIdentity: PANEL_MODULE_IDENTITIES[panelId],
            pluginId: panelId,
            type: 'success',
            version: '13.2.3',
          });
          return value;
        })
        .catch(() => {
          pending.delete(panelId);
          options.evidence?.record({
            category: 'module-load-failed',
            pluginId: panelId,
            type: 'failure',
          });
          throw new Grafana13PanelPluginLoadError(panelId);
        });
      pending.set(panelId, loading);
      return loading;
    },
  };
}
