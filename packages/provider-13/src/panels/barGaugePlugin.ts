import { PanelPlugin } from 'grafana-provider13-data-panel-plugin';
import { BarGaugePanel } from 'grafana-provider13-bargauge-renderer';

export const grafana13BarGaugePanelPlugin = new PanelPlugin(BarGaugePanel).useFieldConfig({});
