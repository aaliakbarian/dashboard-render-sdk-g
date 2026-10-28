import { PanelPlugin } from 'grafana-provider13-data-panel-plugin';
import { TimeSeriesPanel } from 'grafana-provider13-timeseries-renderer';
import { configureGrafana13TimeSeriesPlugin } from './timeSeriesConfig';

export const grafana13TimeSeriesPanelPlugin = configureGrafana13TimeSeriesPlugin(new PanelPlugin(TimeSeriesPanel));
// useFieldConfig installs only the admitted custom view properties.
