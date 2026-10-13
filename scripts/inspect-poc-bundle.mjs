import { readFileSync } from 'node:fs';

const evidenceRoot = 'apps/poc-host/dist/evidence';
const boundary = JSON.parse(
  readFileSync(`${evidenceRoot}/forbidden-import-report.json`, 'utf8')
);
const bundle = JSON.parse(readFileSync(`${evidenceRoot}/bundle-evidence.json`, 'utf8'));

const task8TextSources = [
  '<grafana-source>/public/app/core/config.ts',
  '<grafana-source>/public/app/plugins/panel/text/panelcfg.gen.ts',
  '<grafana-source>/public/app/plugins/panel/text/v1/TextPanel.tsx',
  '<grafana-source>/public/app/plugins/panel/text/v1/TextPanelEditor.tsx',
  '<grafana-source>/public/app/plugins/panel/text/v1/module.tsx',
  '<grafana-source>/public/app/plugins/panel/text/v1/textPanelMigrationHandler.ts',
];

const gateBStatSources = [
  '<grafana-source>/public/app/features/panel/suggestions/utils.ts',
  '<grafana-source>/public/app/plugins/panel/stat/StatMigrations.ts',
  '<grafana-source>/public/app/plugins/panel/stat/StatPanel.tsx',
  '<grafana-source>/public/app/plugins/panel/stat/common.ts',
  '<grafana-source>/public/app/plugins/panel/stat/module.tsx',
  '<grafana-source>/public/app/plugins/panel/stat/panelcfg.gen.ts',
  '<grafana-source>/public/app/plugins/panel/stat/presets.ts',
  '<grafana-source>/public/app/plugins/panel/stat/suggestions.ts',
];

// Gate C P2 exact-version source-built compatibility artifact. These are the
// complete reviewed application-owned Time series/GraphNG renderer sources;
// every addition requires a new source and licensing checkpoint.
const gateCTimeSeriesSources = [
  '<grafana-source>/public/app/core/components/GraphNG/GraphNG.tsx',
  '<grafana-source>/public/app/core/components/GraphNG/utils.ts',
  '<grafana-source>/public/app/core/components/TimeSeries/TimeSeries.tsx',
  '<grafana-source>/public/app/core/components/TimeSeries/utils.ts',
  '<grafana-source>/public/app/plugins/panel/timeseries/TimeSeriesPanel.tsx',
  '<grafana-source>/public/app/plugins/panel/timeseries/TimeSeriesTooltip.tsx',
  '<grafana-source>/public/app/plugins/panel/timeseries/plugins/OutsideRangePlugin.tsx',
  '<grafana-source>/public/app/plugins/panel/timeseries/utils.ts',
];

// This list is deliberately exhaustive. A new application-source module must
// fail inspection until its source and licensing provenance have been reviewed.
const task10TestDataSources = [
  '<grafana-source>/public/app/plugins/datasource/grafana-testdata-datasource/ConfigEditor.tsx',
  '<grafana-source>/public/app/plugins/datasource/grafana-testdata-datasource/LogIpsum.ts',
  '<grafana-source>/public/app/plugins/datasource/grafana-testdata-datasource/MetaDataInspector.tsx',
  '<grafana-source>/public/app/plugins/datasource/grafana-testdata-datasource/QueryEditor.tsx',
  '<grafana-source>/public/app/plugins/datasource/grafana-testdata-datasource/TestInfoTab.tsx',
  '<grafana-source>/public/app/plugins/datasource/grafana-testdata-datasource/components/CSVContentEditor.tsx',
  '<grafana-source>/public/app/plugins/datasource/grafana-testdata-datasource/components/CSVFileEditor.tsx',
  '<grafana-source>/public/app/plugins/datasource/grafana-testdata-datasource/components/CSVWaveEditor.tsx',
  '<grafana-source>/public/app/plugins/datasource/grafana-testdata-datasource/components/ErrorEditor.tsx',
  '<grafana-source>/public/app/plugins/datasource/grafana-testdata-datasource/components/ErrorWithSourceEditor.tsx',
  '<grafana-source>/public/app/plugins/datasource/grafana-testdata-datasource/components/ExemplarLabelsEditor.tsx',
  '<grafana-source>/public/app/plugins/datasource/grafana-testdata-datasource/components/ExemplarsEditor.tsx',
  '<grafana-source>/public/app/plugins/datasource/grafana-testdata-datasource/components/FlakyQueryEditor.tsx',
  '<grafana-source>/public/app/plugins/datasource/grafana-testdata-datasource/components/GrafanaLiveEditor.tsx',
  '<grafana-source>/public/app/plugins/datasource/grafana-testdata-datasource/components/NodeGraphEditor.tsx',
  '<grafana-source>/public/app/plugins/datasource/grafana-testdata-datasource/components/PredictablePulseEditor.tsx',
  '<grafana-source>/public/app/plugins/datasource/grafana-testdata-datasource/components/RandomWalkEditor.tsx',
  '<grafana-source>/public/app/plugins/datasource/grafana-testdata-datasource/components/RawFrameEditor.tsx',
  '<grafana-source>/public/app/plugins/datasource/grafana-testdata-datasource/components/SimulationQueryEditor.tsx',
  '<grafana-source>/public/app/plugins/datasource/grafana-testdata-datasource/components/SimulationSchemaForm.tsx',
  '<grafana-source>/public/app/plugins/datasource/grafana-testdata-datasource/components/StreamingClientEditor.tsx',
  '<grafana-source>/public/app/plugins/datasource/grafana-testdata-datasource/components/USAQueryEditor.tsx',
  '<grafana-source>/public/app/plugins/datasource/grafana-testdata-datasource/constants.ts',
  '<grafana-source>/public/app/plugins/datasource/grafana-testdata-datasource/dataquery.ts',
  '<grafana-source>/public/app/plugins/datasource/grafana-testdata-datasource/datasource.ts',
  '<grafana-source>/public/app/plugins/datasource/grafana-testdata-datasource/metricTree.ts',
  '<grafana-source>/public/app/plugins/datasource/grafana-testdata-datasource/module.tsx',
  '<grafana-source>/public/app/plugins/datasource/grafana-testdata-datasource/nodeGraphUtils.ts',
  '<grafana-source>/public/app/plugins/datasource/grafana-testdata-datasource/runStreams.ts',
  '<grafana-source>/public/app/plugins/datasource/grafana-testdata-datasource/testData/flameGraphResponse.ts',
  '<grafana-source>/public/app/plugins/datasource/grafana-testdata-datasource/testData/serviceMapResponse.ts',
  '<grafana-source>/public/app/plugins/datasource/grafana-testdata-datasource/testData/serviceMapResponseMedium.ts',
  '<grafana-source>/public/app/plugins/datasource/grafana-testdata-datasource/variables.ts',
];

// POC / EXPERIMENT / NOT FOR PRODUCTION. The runtime-only TestData provider
// deliberately omits the module registration and all authoring UI. Keep this
// list exact so an accidental source-closure expansion fails inspection.
const task10TestDataRuntimeSources = [
  '<grafana-source>/public/app/plugins/datasource/grafana-testdata-datasource/LogIpsum.ts',
  '<grafana-source>/public/app/plugins/datasource/grafana-testdata-datasource/constants.ts',
  '<grafana-source>/public/app/plugins/datasource/grafana-testdata-datasource/dataquery.ts',
  '<grafana-source>/public/app/plugins/datasource/grafana-testdata-datasource/datasource.ts',
  '<grafana-source>/public/app/plugins/datasource/grafana-testdata-datasource/metricTree.ts',
  '<grafana-source>/public/app/plugins/datasource/grafana-testdata-datasource/nodeGraphUtils.ts',
  '<grafana-source>/public/app/plugins/datasource/grafana-testdata-datasource/runStreams.ts',
  '<grafana-source>/public/app/plugins/datasource/grafana-testdata-datasource/testData/flameGraphResponse.ts',
  '<grafana-source>/public/app/plugins/datasource/grafana-testdata-datasource/testData/serviceMapResponse.ts',
  '<grafana-source>/public/app/plugins/datasource/grafana-testdata-datasource/testData/serviceMapResponseMedium.ts',
  '<grafana-source>/public/app/plugins/datasource/grafana-testdata-datasource/variables.ts',
];

if (boundary.violations.length > 0) {
  console.error(JSON.stringify(boundary.violations, null, 2));
  process.exit(1);
}

const allowedApplicationSources = new Set([
  ...(process.env.POC_TEXT_PANEL_EXPERIMENT === '1' ? task8TextSources : []),
  ...(process.env.POC_TEXT_PANEL_EXPERIMENT === '1' ? gateBStatSources : []),
  ...(process.env.POC_TEXT_PANEL_EXPERIMENT === '1' ? gateCTimeSeriesSources : []),
  ...(process.env.POC_TESTDATA_DATASOURCE_EXPERIMENT === '1'
    ? process.env.POC_TESTDATA_RUNTIME_ONLY_EXPERIMENT === '1'
      ? task10TestDataRuntimeSources
      : task10TestDataSources
    : []),
]);
const applicationSources = new Set(bundle.categories.grafanaApplication);
const unauthorizedApplicationSources = [...applicationSources].filter(
  (id) => !allowedApplicationSources.has(id)
);
const missingRequiredSources = [...allowedApplicationSources].filter(
  (id) => !applicationSources.has(id)
);
const forbidden = [
  ...unauthorizedApplicationSources,
  ...bundle.categories.grafanaInternal,
  ...bundle.categories.systemJs,
];

if (forbidden.length > 0 || missingRequiredSources.length > 0) {
  if (forbidden.length > 0) {
    console.error(`Forbidden bundle modules:\n${forbidden.join('\n')}`);
  }
  if (missingRequiredSources.length > 0) {
    console.error(`Required reviewed modules missing:\n${missingRequiredSources.join('\n')}`);
  }
  process.exit(1);
}

console.log(
  [
    `Dependency graph clean: ${boundary.inspectedModuleIds.length} imports inspected`,
    `${bundle.moduleIds.length} modules bundled`,
    `${bundle.chunks.length} chunks emitted`,
    `${applicationSources.size} exact reviewed application modules`,
    '0 Grafana internal modules',
    '0 SystemJS modules',
  ].join('; ') + '.'
);
