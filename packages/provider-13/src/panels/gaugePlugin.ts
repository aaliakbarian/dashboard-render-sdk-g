import { PanelPlugin } from 'grafana-provider13-data-panel-plugin';
import { GaugePanel } from 'grafana-provider13-gauge-renderer';

export const grafana13GaugePanelPlugin = new PanelPlugin(GaugePanel).useFieldConfig({});
