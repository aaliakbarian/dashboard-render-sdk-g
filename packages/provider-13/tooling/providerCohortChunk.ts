export function providerCohortChunk(id: string): string | undefined {
  const normalized = id.replaceAll('\\', '/');
  if (/native:public\/app\/plugins\/panel\/timeseries\/(?:TimeSeriesTooltip\.tsx|utils\.ts)(?:\.js)?$/.test(normalized)) return 'provider-timeseries-shared';
  if (/\/(?:src\/panels\/gaugePlugin|tooling\/viewOnly\/gaugeUiInternal)\.ts$/.test(normalized) || normalized.includes('native:public/app/plugins/panel/gauge/') || normalized.includes('native:packages/grafana-ui/src/components/RadialGauge/')) return 'provider-gauge';
  if (/\/(?:src\/panels\/barGaugePlugin|tooling\/viewOnly\/barGaugeUiInternal)\.ts$/.test(normalized) || normalized.includes('native:public/app/plugins/panel/bargauge/')) return 'provider-bargauge';
  if (normalized.includes('native:public/app/plugins/panel/piechart/')) return 'provider-piechart';
  if (
    /\/tooling\/viewOnly\/controlledVisxPortal\.tsx$/.test(normalized) ||
    /\/node_modules\/(?:@visx\/|react-use-measure\/|debounce\/|classnames\/|d3-path\/|d3-shape\/)/.test(normalized)
  ) return 'provider-piechart-dependencies';
  if (/\/src\/panels\/barChartPlugin\.ts$/.test(normalized) || normalized.includes('native:public/app/plugins/panel/barchart/')) return 'provider-barchart';
  if (/\/src\/panels\/statPlugin\.ts$/.test(normalized) || normalized.includes('native:public/app/plugins/panel/stat/')) return 'provider-stat';
  if (/\/src\/panels\/timeSeries(?:Plugin|Config)\.ts$/.test(normalized) || /native:public\/app\/(?:plugins\/panel\/timeseries\/|core\/components\/(?:TimeSeries|GraphNG)\/)/.test(normalized)) return 'provider-timeseries';
  if (/\/viewOnly\/native(?:Inert|UiInternal)\.tsx?$/.test(normalized)) return 'provider-native-visualization';
  if (normalized.includes('native:packages/grafana-data/')) return 'provider-grafana';
  if (/\/viewOnly\/nativeDataInternal\.ts$/.test(normalized)) return 'provider-grafana';
  if (/\/viewOnly\/nativeUi\.ts$/.test(normalized)) return 'provider-native-visualization';
  if (/\/node_modules\/@grafana\/ui\/dist\/esm\/(?:components\/(?:BigValue|BarGauge|Sparkline|VizRepeater|uPlot|VizLegend|VizLayout|VizTooltip|ColorPicker|ColorSwatch)\/|graveyard\/GraphNG\/|utils\/measureText\.mjs)/.test(normalized)) return 'provider-native-visualization';
  if (/\/node_modules\/(?:react-aria|react-stately|react-colorful)\//.test(normalized)) return 'provider-visualization-dependencies';
  if (normalized.includes('builtin:esm-external-require-react-dom')) return 'provider-react-dom-external';
  if (normalized.includes('builtin:esm-external-require-react')) return 'provider-react-external';
  if (normalized.includes('/node_modules/tslib/')) return 'provider-tslib';
  if (normalized.includes('/node_modules/uuid/')) return 'provider-uuid';
  if (/\/node_modules\/(?:@openfeature\/|d3-random\/)/.test(normalized)) return 'provider-query-dependencies';
  if (/\/node_modules\/(?:clsx|fast-equals|prop-types|react-draggable|react-grid-layout|react-resizable|react-use|resize-observer-polyfill)\//.test(normalized)) return 'provider-scenes-dependencies';
  if (normalized.includes('/node_modules/@grafana/scenes/')) return 'provider-scenes';
  if (/\/node_modules\/@grafana\/(?:data|ui|runtime|schema|i18n|e2e-selectors)\//.test(normalized)) return 'provider-grafana';
  if (normalized.includes('/node_modules/rxjs/')) return 'provider-rxjs';
  if (normalized.includes('/node_modules/@emotion/') || normalized.includes('/node_modules/stylis/') || normalized.includes('/node_modules/hoist-non-react-statics/') || normalized.includes('/node_modules/react-is/')) return 'provider-emotion';
  if (normalized.includes('/node_modules/uplot/')) return 'provider-visualization';
  return undefined;
}
