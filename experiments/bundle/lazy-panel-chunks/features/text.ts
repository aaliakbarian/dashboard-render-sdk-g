// POC / EXPERIMENT / NOT FOR PRODUCTION
/// <reference path="../grafana-source-modules.d.ts" />
import { PanelPlugin } from 'grafana-experiment-data-panel-plugin';

import { TextPanel } from 'grafana-experiment-text-renderer';

export const plugin = new PanelPlugin(TextPanel);
