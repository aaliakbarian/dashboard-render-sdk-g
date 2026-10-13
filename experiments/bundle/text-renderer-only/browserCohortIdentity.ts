// POC / EXPERIMENT / NOT FOR PRODUCTION
import { PanelPlugin as cohortPanelPlugin } from '@grafana/data';
import { config as cohortConfig } from '@grafana/runtime';
import { useStyles2 as cohortUseStyles2 } from '@grafana/ui';

import { PanelPlugin as rendererPanelPlugin } from 'grafana-experiment-data-panel-plugin';
import { config as rendererConfig } from 'grafana-experiment-runtime-config';
import { useStyles2 as rendererUseStyles2 } from 'grafana-experiment-ui-theme-context';

export interface TextRendererCohortIdentity {
  readonly config: boolean;
  readonly panelPlugin: boolean;
  readonly useStyles2: boolean;
}

export function inspectTextRendererCohortIdentity(): TextRendererCohortIdentity {
  return {
    config: cohortConfig === rendererConfig,
    panelPlugin: cohortPanelPlugin === rendererPanelPlugin,
    useStyles2: cohortUseStyles2 === rendererUseStyles2,
  };
}
