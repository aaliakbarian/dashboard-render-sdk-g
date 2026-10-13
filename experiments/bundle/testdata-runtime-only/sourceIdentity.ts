// POC / EXPERIMENT / NOT FOR PRODUCTION

export const GRAFANA_SOURCE_COMMIT = '6193dc03311b631b9727b560d24369e683dc396e' as const;
export const GRAFANA_SOURCE_VERSION = '13.2.3' as const;

export const BASELINE_APPLICATION_SOURCES = [
  'public/app/plugins/datasource/grafana-testdata-datasource/ConfigEditor.tsx',
  'public/app/plugins/datasource/grafana-testdata-datasource/LogIpsum.ts',
  'public/app/plugins/datasource/grafana-testdata-datasource/MetaDataInspector.tsx',
  'public/app/plugins/datasource/grafana-testdata-datasource/QueryEditor.tsx',
  'public/app/plugins/datasource/grafana-testdata-datasource/TestInfoTab.tsx',
  'public/app/plugins/datasource/grafana-testdata-datasource/components/CSVContentEditor.tsx',
  'public/app/plugins/datasource/grafana-testdata-datasource/components/CSVFileEditor.tsx',
  'public/app/plugins/datasource/grafana-testdata-datasource/components/CSVWaveEditor.tsx',
  'public/app/plugins/datasource/grafana-testdata-datasource/components/ErrorEditor.tsx',
  'public/app/plugins/datasource/grafana-testdata-datasource/components/ErrorWithSourceEditor.tsx',
  'public/app/plugins/datasource/grafana-testdata-datasource/components/ExemplarLabelsEditor.tsx',
  'public/app/plugins/datasource/grafana-testdata-datasource/components/ExemplarsEditor.tsx',
  'public/app/plugins/datasource/grafana-testdata-datasource/components/FlakyQueryEditor.tsx',
  'public/app/plugins/datasource/grafana-testdata-datasource/components/GrafanaLiveEditor.tsx',
  'public/app/plugins/datasource/grafana-testdata-datasource/components/NodeGraphEditor.tsx',
  'public/app/plugins/datasource/grafana-testdata-datasource/components/PredictablePulseEditor.tsx',
  'public/app/plugins/datasource/grafana-testdata-datasource/components/RandomWalkEditor.tsx',
  'public/app/plugins/datasource/grafana-testdata-datasource/components/RawFrameEditor.tsx',
  'public/app/plugins/datasource/grafana-testdata-datasource/components/SimulationQueryEditor.tsx',
  'public/app/plugins/datasource/grafana-testdata-datasource/components/SimulationSchemaForm.tsx',
  'public/app/plugins/datasource/grafana-testdata-datasource/components/StreamingClientEditor.tsx',
  'public/app/plugins/datasource/grafana-testdata-datasource/components/USAQueryEditor.tsx',
  'public/app/plugins/datasource/grafana-testdata-datasource/constants.ts',
  'public/app/plugins/datasource/grafana-testdata-datasource/dataquery.ts',
  'public/app/plugins/datasource/grafana-testdata-datasource/datasource.ts',
  'public/app/plugins/datasource/grafana-testdata-datasource/metricTree.ts',
  'public/app/plugins/datasource/grafana-testdata-datasource/module.tsx',
  'public/app/plugins/datasource/grafana-testdata-datasource/nodeGraphUtils.ts',
  'public/app/plugins/datasource/grafana-testdata-datasource/runStreams.ts',
  'public/app/plugins/datasource/grafana-testdata-datasource/testData/flameGraphResponse.ts',
  'public/app/plugins/datasource/grafana-testdata-datasource/testData/serviceMapResponse.ts',
  'public/app/plugins/datasource/grafana-testdata-datasource/testData/serviceMapResponseMedium.ts',
  'public/app/plugins/datasource/grafana-testdata-datasource/variables.ts',
] as const;

export const RUNTIME_ONLY_APPLICATION_SOURCES = [
  'public/app/plugins/datasource/grafana-testdata-datasource/LogIpsum.ts',
  'public/app/plugins/datasource/grafana-testdata-datasource/constants.ts',
  'public/app/plugins/datasource/grafana-testdata-datasource/dataquery.ts',
  'public/app/plugins/datasource/grafana-testdata-datasource/datasource.ts',
  'public/app/plugins/datasource/grafana-testdata-datasource/metricTree.ts',
  'public/app/plugins/datasource/grafana-testdata-datasource/nodeGraphUtils.ts',
  'public/app/plugins/datasource/grafana-testdata-datasource/runStreams.ts',
  'public/app/plugins/datasource/grafana-testdata-datasource/testData/flameGraphResponse.ts',
  'public/app/plugins/datasource/grafana-testdata-datasource/testData/serviceMapResponse.ts',
  'public/app/plugins/datasource/grafana-testdata-datasource/testData/serviceMapResponseMedium.ts',
  'public/app/plugins/datasource/grafana-testdata-datasource/variables.ts',
] as const;

export const TESTDATA_BASELINE_ALIAS = 'grafana-experiment-testdata-baseline' as const;
export const TESTDATA_RUNTIME_SOURCE_ALIAS = 'grafana-experiment-testdata-runtime-source' as const;
