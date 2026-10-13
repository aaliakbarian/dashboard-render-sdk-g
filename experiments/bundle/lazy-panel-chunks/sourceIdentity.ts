// POC / EXPERIMENT / NOT FOR PRODUCTION

export const GRAFANA_SOURCE_COMMIT = '6193dc03311b631b9727b560d24369e683dc396e' as const;
export const GRAFANA_SOURCE_VERSION = '13.2.3' as const;

export const PANEL_APPLICATION_SOURCES = {
  text: [
    'public/app/plugins/panel/text/panelcfg.gen.ts',
    'public/app/plugins/panel/text/v1/TextPanel.tsx',
  ],
  stat: [
    'public/app/plugins/panel/stat/StatPanel.tsx',
  ],
  timeseries: [
    'public/app/core/components/GraphNG/GraphNG.tsx',
    'public/app/core/components/GraphNG/utils.ts',
    'public/app/core/components/TimeSeries/TimeSeries.tsx',
    'public/app/core/components/TimeSeries/utils.ts',
    'public/app/plugins/panel/timeseries/TimeSeriesPanel.tsx',
    'public/app/plugins/panel/timeseries/TimeSeriesTooltip.tsx',
    'public/app/plugins/panel/timeseries/plugins/OutsideRangePlugin.tsx',
    'public/app/plugins/panel/timeseries/utils.ts',
  ],
} as const;

// Audited direct/transitive source boundary. Rollup may tree-shake these
// option/default helpers from the renderer artifact, but the source resolver
// must still admit and report their static-import provenance.
export const REVIEWED_APPLICATION_SOURCES = [
  ...Object.values(PANEL_APPLICATION_SOURCES).flat(),
  'public/app/core/components/GraphNG/types.ts',
  'public/app/plugins/panel/stat/panelcfg.gen.ts',
  'public/app/plugins/panel/timeseries/panelcfg.gen.ts',
] as const;

// The fresh baseline deliberately measures the pre-experiment provider path:
// renderer-only Text, the full Stat registration module, and the Phase 0 P2
// Time series renderer. Keep this list exact so rebuilding the baseline cannot
// silently admit another application subtree.
export const BASELINE_REVIEWED_APPLICATION_SOURCES = [
  'public/app/features/panel/suggestions/utils.ts',
  ...PANEL_APPLICATION_SOURCES.text,
  'public/app/plugins/panel/stat/StatMigrations.ts',
  'public/app/plugins/panel/stat/StatPanel.tsx',
  'public/app/plugins/panel/stat/common.ts',
  'public/app/plugins/panel/stat/module.tsx',
  'public/app/plugins/panel/stat/panelcfg.gen.ts',
  'public/app/plugins/panel/stat/presets.ts',
  'public/app/plugins/panel/stat/suggestions.ts',
  ...PANEL_APPLICATION_SOURCES.timeseries,
  'public/app/core/components/GraphNG/types.ts',
  'public/app/plugins/panel/timeseries/panelcfg.gen.ts',
] as const;

export const STAT_RENDERER_ALIAS = 'grafana-experiment-stat-renderer' as const;
