import { PanelPlugin } from 'grafana-provider13-data-panel-plugin';
import { PieChartPanel } from 'grafana-provider13-piechart-renderer';

export const grafana13PieChartPanelPlugin = new PanelPlugin(PieChartPanel).useFieldConfig({});
