declare module 'grafana-provider13-text-renderer' {
  import type { ComponentType } from 'react';

  export const TextPanel: ComponentType<any>;
}
declare module 'uplot/dist/uPlot.min.css';
declare module 'uplot/dist/uPlot.min.css?inline' { const css: string; export default css; }
declare module 'grafana-provider13-stat-renderer' {
  export const StatPanel: import('react').ComponentType<any>;
}
declare module 'grafana-provider13-timeseries-renderer' {
  export const TimeSeriesPanel: import('react').ComponentType<any>;
}
declare module 'grafana-provider13-gauge-renderer' {
  export const GaugePanel: import('react').ComponentType<any>;
}
declare module 'grafana-provider13-bargauge-renderer' {
  export const BarGaugePanel: import('react').ComponentType<any>;
}
declare module 'grafana-provider13-query-scenes' {
  export const SceneQueryRunner: new (state: Record<string, unknown>) => any;
  export const SceneDataTransformer: new (state: Record<string, unknown>) => any;
}

declare module 'grafana-provider13-data-panel-plugin' {
  export const PanelPlugin: typeof import('@grafana/data').PanelPlugin;
}

declare module 'grafana-provider13-data-markdown' {
  export const renderTextPanelMarkdown: typeof import('@grafana/data').renderTextPanelMarkdown;
}

declare module 'grafana-provider13-data-sanitize' {
  export const textUtil: typeof import('@grafana/data').textUtil;
}

declare module 'grafana-provider13-runtime-config' {
  export const config: typeof import('@grafana/runtime').config;
}

declare module 'grafana-provider13-ui-scroll-container' {
  export const ScrollContainer: typeof import('@grafana/ui').ScrollContainer;
}

declare module 'grafana-provider13-ui-theme-context' {
  export const useStyles2: typeof import('@grafana/ui').useStyles2;
}
