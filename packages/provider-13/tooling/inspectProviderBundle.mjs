import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { inspectNativeUiProvenance } from './nativeUiProvenance.mjs';

const reportPath = path.resolve(
  process.argv[2] ?? 'artifacts/sdk/provider-13/evidence/bundle-evidence.json'
);
const report = JSON.parse(await readFile(reportPath, 'utf8'));
const nativeUiProvenance = inspectNativeUiProvenance(report);
const modules = [...new Set([
  ...(Array.isArray(report.moduleIds) ? report.moduleIds : []),
  ...report.chunks.flatMap((chunk) => chunk.modules),
])];
const applicationSources = modules
  .filter((id) => id.startsWith('<grafana-source>/public/app/'))
  .map((id) => id.slice('<grafana-source>/'.length))
  .sort();
const expectedSources = [
  'public/app/plugins/panel/text/panelcfg.gen.ts',
  'public/app/plugins/panel/text/v1/TextPanel.tsx',
  'public/app/plugins/panel/stat/StatPanel.tsx',
  'public/app/plugins/panel/gauge/GaugePanel.tsx',
  'public/app/plugins/panel/bargauge/BarGaugePanel.tsx',
  'public/app/plugins/panel/bargauge/BarGaugeLegend.tsx',
  'public/app/plugins/panel/bargauge/panelcfg.gen.ts',
  'public/app/plugins/panel/barchart/BarChartPanel.tsx',
  'public/app/plugins/panel/barchart/BarChartLegend.tsx',
  'public/app/plugins/panel/barchart/bars.ts',
  'public/app/plugins/panel/barchart/distribute.ts',
  'public/app/plugins/panel/barchart/panelcfg.gen.ts',
  'public/app/plugins/panel/barchart/quadtree.ts',
  'public/app/plugins/panel/barchart/utils.ts',
  'public/app/plugins/panel/timeseries/TimeSeriesPanel.tsx',
  'public/app/plugins/panel/timeseries/TimeSeriesTooltip.tsx',
  'public/app/plugins/panel/timeseries/plugins/OutsideRangePlugin.tsx',
  'public/app/plugins/panel/timeseries/utils.ts',
  'public/app/core/components/TimeSeries/TimeSeries.tsx',
  'public/app/core/components/TimeSeries/utils.ts',
  'public/app/core/components/GraphNG/GraphNG.tsx',
  'public/app/core/components/GraphNG/utils.ts',
  ...['LogIpsum.ts', 'constants.ts', 'dataquery.ts', 'datasource.ts', 'metricTree.ts', 'nodeGraphUtils.ts', 'runStreams.ts',
    'testData/flameGraphResponse.ts', 'testData/serviceMapResponse.ts', 'testData/serviceMapResponseMedium.ts', 'variables.ts']
    .map(file => `public/app/plugins/datasource/grafana-testdata-datasource/${file}`),
].sort();
const implementationCounts = {
  jsxDevRuntime: modules.filter((id) => /node_modules\/react\/(?:cjs\/)?react-jsx-dev-runtime/.test(id)).length,
  jsxRuntime: modules.filter((id) => /node_modules\/react\/(?:cjs\/)?react-jsx-runtime/.test(id)).length,
  react: modules.filter((id) => /node_modules\/react\//.test(id)).length,
  reactDom: modules.filter((id) => /node_modules\/react-dom\//.test(id)).length,
};
const forbidden = modules.filter((id) =>
  !/\/node_modules\/@grafana\/data\/dist\/esm\/field\/standardFieldConfigEditorRegistry\.mjs$/.test(id) &&
  /(?:monaco|codicon|systemjs|(?:^|\/)[^/]*editor[^/]*(?:\/|$)|public\/app\/(?:routes|core\/navigation|core\/components\/AppChrome))/i.test(id)
);
const executableQueryModules = modules.filter((id) =>
  /\/querying\/(?:SceneQueryRunner|RuntimeDataSource)\.(?:m?js)$/.test(id) && !applicationSources.includes('public/app/plugins/panel/stat/StatPanel.tsx')
);
const inertEntryGrafanaModules = report.chunks
  .filter((chunk) => chunk.isEntry)
  .flatMap((chunk) => chunk.modules)
  .filter((id) => /(?:\/node_modules\/@grafana\/|<grafana-source>\/)/.test(id));
const owners = new Map();
for (const chunk of report.chunks) {
  for (const moduleId of chunk.modules) {
    owners.set(moduleId, [...(owners.get(moduleId) ?? []), chunk.fileName]);
  }
}
const duplicateCohortOwners = [...owners]
  .filter(([moduleId, chunkOwners]) =>
    /\/node_modules\/(?:@grafana\/|@emotion\/|rxjs\/|uplot\/)/.test(moduleId) &&
    new Set(chunkOwners).size > 1
  )
  .map(([moduleId]) => moduleId);
const cohortPackages = new Set([
  '@emotion/css',
  '@emotion/react',
  '@grafana/data',
  '@grafana/e2e-selectors',
  '@grafana/i18n',
  '@grafana/runtime',
  '@grafana/scenes',
  '@grafana/schema',
  '@grafana/ui',
  'rxjs',
  'uplot',
]);
const physicalOwners = new Map();
for (const moduleId of modules) {
  const normalized = moduleId.replaceAll('\\', '/');
  const marker = '/node_modules/';
  const index = normalized.lastIndexOf(marker);
  if (index < 0) continue;
  const packagePath = normalized.slice(index + marker.length).split('/');
  const packageName = packagePath[0]?.startsWith('@')
    ? `${packagePath[0]}/${packagePath[1] ?? ''}`
    : packagePath[0];
  if (!packageName || !cohortPackages.has(packageName)) continue;
  const roots = physicalOwners.get(packageName) ?? new Set();
  roots.add(normalized.slice(0, index + marker.length) + packageName);
  physicalOwners.set(packageName, roots);
}
for (const [packageName, roots] of physicalOwners) {
  if (roots.size > 1) duplicateCohortOwners.push(packageName);
}

if (
  applicationSources.join('\n') !== expectedSources.join('\n') ||
  Object.values(implementationCounts).some((count) => count !== 0) ||
  forbidden.length > 0 ||
  executableQueryModules.length > 0 ||
  inertEntryGrafanaModules.length > 0 ||
  duplicateCohortOwners.length > 0
) {
  throw new Error('Provider-13 artifact does not satisfy the exact bundle boundary.');
}

const sizes = Object.fromEntries(
  report.chunks.map((chunk) => [chunk.fileName, { gzipSize: chunk.gzipSize, rawSize: chunk.rawSize }])
);
console.log(JSON.stringify({
  applicationSources,
  nativeUiProvenance,
  externalReactReferences: [...new Set(report.chunks.flatMap((chunk) => chunk.imports))]
    .filter((id) => /^react(?:-dom)?(?:\/|$)/.test(id))
    .sort(),
  forbiddenModuleCount: forbidden.length,
  inertEntryGrafanaModuleCount: inertEntryGrafanaModules.length,
  duplicateCohortOwnerCount: duplicateCohortOwners.length,
  forbiddenQueryModuleCount: executableQueryModules.length,
  admittedQueryModuleCount: modules.filter(id => /\/querying\/(?:SceneQueryRunner|RuntimeDataSource)\.(?:m?js)$/.test(id)).length,
  implementationCounts,
  sizes,
}, null, 2));
