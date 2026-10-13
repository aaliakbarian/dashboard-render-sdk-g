declare module 'grafana-experiment-text-baseline' {
  import type { PanelPlugin } from '@grafana/data';

  export const plugin: PanelPlugin;
}

declare module 'grafana-experiment-text-renderer' {
  import type { ComponentType } from 'react';

  export const TextPanel: ComponentType<any>;
}

declare module 'grafana-experiment-ui-scroll-container' {
  export const ScrollContainer: typeof import('@grafana/ui').ScrollContainer;
}

declare module 'grafana-experiment-ui-theme-context' {
  export const useStyles2: typeof import('@grafana/ui').useStyles2;
}

declare module 'grafana-experiment-data-markdown' {
  export const renderTextPanelMarkdown: typeof import('@grafana/data').renderTextPanelMarkdown;
}

declare module 'grafana-experiment-data-panel-plugin' {
  export const PanelPlugin: typeof import('@grafana/data').PanelPlugin;
}

declare module 'grafana-experiment-data-sanitize' {
  export const textUtil: typeof import('@grafana/data').textUtil;
}

declare module 'grafana-experiment-runtime-config' {
  export const config: typeof import('@grafana/runtime').config;
}
