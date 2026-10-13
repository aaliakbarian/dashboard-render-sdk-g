// POC / EXPERIMENT / NOT FOR PRODUCTION
// This constructs only the PanelPlugin handle Scenes needs for view rendering.
// The panel component itself is the exact Grafana OSS 13.2.3 TextPanel source.
import { PanelPlugin } from 'grafana-experiment-data-panel-plugin';

import { TextPanel } from 'grafana-experiment-text-renderer';

export const plugin = new PanelPlugin(TextPanel);
