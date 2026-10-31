import { PanelPlugin } from 'grafana-provider13-data-panel-plugin';
import { BarChartPanel } from 'grafana-provider13-barchart-renderer';

export const grafana13BarChartPanelPlugin = new PanelPlugin(BarChartPanel).useFieldConfig({});
