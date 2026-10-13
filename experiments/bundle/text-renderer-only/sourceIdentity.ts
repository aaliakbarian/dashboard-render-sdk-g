// POC / EXPERIMENT / NOT FOR PRODUCTION

export const GRAFANA_SOURCE_COMMIT = '6193dc03311b631b9727b560d24369e683dc396e' as const;
export const GRAFANA_SOURCE_VERSION = '13.2.3' as const;

export const BASELINE_APPLICATION_SOURCES = [
  'public/app/core/config.ts',
  'public/app/plugins/panel/text/panelcfg.gen.ts',
  'public/app/plugins/panel/text/v1/TextPanel.tsx',
  'public/app/plugins/panel/text/v1/TextPanelEditor.tsx',
  'public/app/plugins/panel/text/v1/module.tsx',
  'public/app/plugins/panel/text/v1/textPanelMigrationHandler.ts',
] as const;

export const RENDERER_ONLY_APPLICATION_SOURCES = [
  'public/app/plugins/panel/text/panelcfg.gen.ts',
  'public/app/plugins/panel/text/v1/TextPanel.tsx',
] as const;

export const TEXT_BASELINE_ALIAS = 'grafana-experiment-text-baseline' as const;
export const TEXT_RENDERER_ALIAS = 'grafana-experiment-text-renderer' as const;
