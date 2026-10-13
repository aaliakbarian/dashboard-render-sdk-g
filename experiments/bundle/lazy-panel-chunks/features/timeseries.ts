// POC / EXPERIMENT / NOT FOR PRODUCTION
import { PanelPlugin } from '@grafana/data';

import { configurePocTimeSeriesPlugin } from '../../../../packages/poc-grafana-bridge/src/panels/timeseriesConfig.ts';
import type { ComponentType } from 'react';
import 'uplot/dist/uPlot.min.css';

interface TimeSeriesRendererModule {
  readonly TimeSeriesPanel: ComponentType<any>;
}

const module = (await import('grafana-experiment-timeseries-renderer')) as TimeSeriesRendererModule;
export const plugin = configurePocTimeSeriesPlugin(new PanelPlugin(module.TimeSeriesPanel));
