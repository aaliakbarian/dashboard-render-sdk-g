import { TablePanel } from 'grafana-provider13-table-renderer';
import { PanelPlugin } from 'grafana-provider13-data-panel-plugin';

export const grafana13TablePanelPlugin = new PanelPlugin(TablePanel).useFieldConfig({});
