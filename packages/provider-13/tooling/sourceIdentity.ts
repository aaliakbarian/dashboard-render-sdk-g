export const GRAFANA_13_SOURCE_REVISION =
  '6193dc03311b631b9727b560d24369e683dc396e' as const;

export const GRAFANA_13_APPLICATION_SOURCES = Object.freeze([
  'public/app/plugins/panel/text/panelcfg.gen.ts',
  'public/app/plugins/panel/text/v1/TextPanel.tsx',
] as const);
export const GRAFANA_13_NATIVE_SOURCES = Object.freeze([
  'public/app/plugins/panel/stat/StatPanel.tsx',
  'public/app/plugins/panel/timeseries/TimeSeriesPanel.tsx',
  'public/app/plugins/panel/timeseries/TimeSeriesTooltip.tsx',
  'public/app/plugins/panel/timeseries/plugins/OutsideRangePlugin.tsx',
  'public/app/plugins/panel/timeseries/utils.ts',
  'public/app/core/components/TimeSeries/TimeSeries.tsx',
  'public/app/core/components/TimeSeries/utils.ts',
  'public/app/core/components/GraphNG/GraphNG.tsx',
  'public/app/core/components/GraphNG/utils.ts',
] as const);

export const GRAFANA_13_TESTDATA_SOURCE_FILES = Object.freeze([
  'LogIpsum.ts', 'constants.ts', 'dataquery.ts', 'datasource.ts', 'metricTree.ts',
  'nodeGraphUtils.ts', 'runStreams.ts', 'testData/flameGraphResponse.ts',
  'testData/serviceMapResponse.ts', 'testData/serviceMapResponseMedium.ts', 'variables.ts',
] as const);
export const GRAFANA_13_TESTDATA_SOURCES = Object.freeze(GRAFANA_13_TESTDATA_SOURCE_FILES.map(
  file => `public/app/plugins/datasource/grafana-testdata-datasource/${file}`
));

export class Grafana13SourceIdentityError extends Error {
  override readonly name = 'Grafana13SourceIdentityError';
  readonly code = 'grafana-source-identity-invalid' as const;
}

export function assertGrafana13SourceIdentity(identity: {
  readonly dirty: boolean;
  readonly revision: string;
}): void {
  if (identity.revision !== GRAFANA_13_SOURCE_REVISION) {
    throw new Grafana13SourceIdentityError(
      'The provider build requires the exact pinned Grafana OSS source revision.'
    );
  }
  if (identity.dirty) {
    throw new Grafana13SourceIdentityError(
      'The provider build requires a clean pinned Grafana OSS source checkout.'
    );
  }
}
