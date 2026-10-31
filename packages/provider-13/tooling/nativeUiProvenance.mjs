export const GRAFANA_13_NATIVE_UI_SOURCES = Object.freeze([
  'RadialGauge.tsx', 'RadialBar.tsx', 'RadialBarSegmented.tsx', 'RadialArcPath.tsx',
  'RadialArcPathEndpointMarks.tsx', 'RadialScaleLabels.tsx', 'RadialSparkline.tsx',
  'RadialText.tsx', 'ThresholdsBar.tsx', 'colors.ts', 'constants.ts', 'effects.tsx', 'utils.ts',
].map(file => `packages/grafana-ui/src/components/RadialGauge/${file}`));
export const GRAFANA_13_TABLE_UI_SOURCES = Object.freeze([
  'Cells/AutoCell.tsx', 'TableDataGrid.tsx', 'TableFlat.tsx',
  'components/EmptyTablePlaceholder.tsx', 'components/HeaderCell.tsx', 'components/SummaryCell.tsx',
  'constants.ts', 'hooks.ts', 'render-hooks.tsx', 'styles.ts', 'types.ts', 'utils.ts',
].map(file => `packages/grafana-ui/src/components/Table/TableNG/${file}`));

const sourcePrefix = '<grafana-source>/';
const uiPrefix = `${sourcePrefix}packages/grafana-ui/`;
const gaugeSource = `${sourcePrefix}public/app/plugins/panel/gauge/GaugePanel.tsx`;
const tableSource = `${sourcePrefix}public/app/plugins/panel/table/TablePanel.tsx`;
const foldedConstant = `${sourcePrefix}packages/grafana-ui/src/components/RadialGauge/constants.ts`;
const tableTypeOnly = `${sourcePrefix}packages/grafana-ui/src/components/Table/TableNG/types.ts`;

export function inspectNativeUiProvenance(report) {
  const allModules = [...new Set([...(report.moduleIds ?? []), ...report.chunks.flatMap(chunk => chunk.modules)])];
  const gaugeRequired = allModules.includes(gaugeSource);
  const tableRequired = allModules.includes(tableSource);
  const gaugeSources = gaugeRequired ? GRAFANA_13_NATIVE_UI_SOURCES.map(file => `${sourcePrefix}${file}`).sort() : [];
  const tableSources = tableRequired ? GRAFANA_13_TABLE_UI_SOURCES.map(file => `${sourcePrefix}${file}`).sort() : [];
  const expectedSources = [...gaugeSources, ...tableSources].sort();
  const expectedLoadedSources = expectedSources.filter(id => id !== tableTypeOnly);
  const loadedSources = allModules.filter(id => id.startsWith(uiPrefix)).sort();
  const byFile = new Map(report.chunks.map(chunk => [chunk.fileName, chunk]));
  const staticClosure = roots => {
    const files = new Set();
    const visit = file => {
      if (files.has(file)) return;
      files.add(file);
      for (const imported of byFile.get(file)?.imports ?? []) visit(imported);
    };
    roots.forEach(chunk => visit(chunk.fileName));
    return files;
  };
  const gaugeRoots = report.chunks.filter(chunk => chunk.modules.includes(gaugeSource));
  const gaugeFiles = staticClosure(gaugeRoots);
  const tableRoots = report.chunks.filter(chunk => chunk.modules.includes(tableSource));
  const tableFiles = staticClosure(tableRoots);
  const owners = new Map();
  for (const chunk of report.chunks) {
    for (const id of chunk.modules.filter(id => id.startsWith(uiPrefix))) {
      owners.set(id, [...(owners.get(id) ?? []), chunk.fileName]);
    }
  }
  const emittedSources = [...owners.keys()].sort();
  // The pinned build folds this constants-only module. Renderer functions must
  // still appear in emitted chunks, regardless of the loaded module inventory.
  const missingSources = expectedSources.filter(id => id !== foldedConstant && id !== tableTypeOnly && !owners.has(id));
  const duplicateSources = [...owners].filter(([, files]) => files.length !== 1).map(([id]) => id);
  const misplacedSources = [...owners].filter(([id, files]) => {
    const allowed = gaugeSources.includes(id) ? gaugeFiles : tableFiles;
    return files.some(file => !allowed.has(file));
  }).map(([id]) => id);
  const siblingStaticReach = Object.fromEntries(['text', 'stat', 'timeseries', 'bargauge', 'piechart', 'barchart', 'bootstrap'].map(feature => {
    const roots = report.chunks.filter(chunk => feature === 'bootstrap' ? chunk.isEntry
      : chunk.modules.some(id => id.startsWith(`${sourcePrefix}public/app/plugins/panel/${feature}/`)));
    const files = staticClosure(roots);
    return [feature, emittedSources.filter(id => owners.get(id).some(file => files.has(file)))];
  }));
  const crossFeatureReach = {
    gaugeToTable: tableSources.filter(id => owners.get(id)?.some(file => gaugeFiles.has(file))),
    tableToGauge: gaugeSources.filter(id => owners.get(id)?.some(file => tableFiles.has(file))),
  };
  if (loadedSources.join('\n') !== expectedLoadedSources.join('\n') ||
      (gaugeRequired && gaugeRoots.length !== 1) || (tableRequired && tableRoots.length !== 1) || missingSources.length || duplicateSources.length ||
      misplacedSources.length || Object.values(siblingStaticReach).some(sources => sources.length)) {
    throw new Error(`Native UI bundle boundary did not match the isolated Gauge/Table emitted provenance. ${JSON.stringify({ missingSources, duplicateSources, misplacedSources, siblingStaticReach, crossFeatureReach })}`);
  }
  if (crossFeatureReach.gaugeToTable.length || crossFeatureReach.tableToGauge.length) {
    throw new Error(`Native UI sources crossed feature chunks. ${JSON.stringify(crossFeatureReach)}`);
  }
  return { loadedSources, emittedSources, foldedSources: expectedSources.filter(id => !owners.has(id)), siblingStaticReach, crossFeatureReach };
}
