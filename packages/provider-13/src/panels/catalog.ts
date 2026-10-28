import type { PanelPlugin, PanelPluginMeta, PluginMetaInfo } from '@grafana/data';

export const TEXT_PANEL_MODULE_IDENTITY =
  'public/app/plugins/panel/text/v1/TextPanel.tsx' as const;
export const GRAFANA_13_SOURCE_REVISION =
  '6193dc03311b631b9727b560d24369e683dc396e' as const;

export type Grafana13PanelPluginLoadEvent =
  | {
      readonly cache: 'miss';
      readonly moduleIdentity: typeof TEXT_PANEL_MODULE_IDENTITY;
      readonly pluginId: 'text';
      readonly sourceCategory: 'grafana-application-source';
      readonly sourceRevision: typeof GRAFANA_13_SOURCE_REVISION;
      readonly type: 'start';
    }
  | { readonly pluginId: 'text'; readonly type: 'cache-hit' }
  | {
      readonly moduleIdentity: typeof TEXT_PANEL_MODULE_IDENTITY;
      readonly pluginId: 'text';
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
  readonly pluginId = 'text' as const;

  constructor() {
    super('The pinned Grafana 13 Text panel module could not be loaded.');
  }
}

function attachTextMetadata(plugin: PanelPlugin): PanelPlugin {
  plugin.meta = {
    ...plugin.meta,
    baseUrl: '',
    id: 'text',
    info: {
      author: { name: 'Grafana Labs' },
      description: 'Built-in Grafana Text panel.',
      links: [],
      logos: { large: '', small: '' },
      screenshots: [],
      updated: '',
      version: '13.2.3',
    } as PluginMetaInfo,
    module: TEXT_PANEL_MODULE_IDENTITY,
    name: 'Text',
    skipDataQuery: true,
    suggestions: true,
    type: 'panel',
    version: '13.2.3',
  } as PanelPluginMeta;
  return plugin;
}

export function createGrafana13TextPanelCatalog(options: {
  readonly evidence?: Grafana13PanelPluginEvidence;
  readonly loadTextPlugin?: () => Promise<PanelPlugin>;
}): Grafana13TextPanelCatalog {
  let pending: Promise<PanelPlugin> | undefined;
  let resolved: PanelPlugin | undefined;

  return {
    getPanelPluginFromCache(id) {
      return id === 'text' ? resolved : undefined;
    },
    importPanelPlugin(id) {
      if (id !== 'text') {
        options.evidence?.record({
          category: 'unknown-plugin',
          pluginId: '<unsupported>',
          type: 'failure',
        });
        return Promise.reject(new Grafana13UnsupportedPanelPluginError());
      }

      if (pending) {
        options.evidence?.record({ pluginId: 'text', type: 'cache-hit' });
        return pending;
      }

      options.evidence?.record({
        cache: 'miss',
        moduleIdentity: TEXT_PANEL_MODULE_IDENTITY,
        pluginId: 'text',
        sourceCategory: 'grafana-application-source',
        sourceRevision: GRAFANA_13_SOURCE_REVISION,
        type: 'start',
      });
      const loadTextPlugin =
        options.loadTextPlugin ??
        (() => import('./textPlugin').then((module) => module.grafana13TextPanelPlugin));
      pending = loadTextPlugin()
        .then((plugin) => {
          resolved = attachTextMetadata(plugin);
          options.evidence?.record({
            moduleIdentity: TEXT_PANEL_MODULE_IDENTITY,
            pluginId: 'text',
            type: 'success',
            version: '13.2.3',
          });
          return resolved;
        })
        .catch(() => {
          pending = undefined;
          options.evidence?.record({
            category: 'module-load-failed',
            pluginId: 'text',
            type: 'failure',
          });
          throw new Grafana13PanelPluginLoadError();
        });
      return pending;
    },
  };
}
