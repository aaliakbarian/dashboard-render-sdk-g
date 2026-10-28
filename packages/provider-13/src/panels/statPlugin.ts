import { PanelPlugin } from 'grafana-provider13-data-panel-plugin';
import { StatPanel } from 'grafana-provider13-stat-renderer';

export const grafana13StatPanelPlugin = new PanelPlugin(StatPanel).useFieldConfig({}).setNoPadding();
