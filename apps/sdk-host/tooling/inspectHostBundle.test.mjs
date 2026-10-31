import { describe, expect, it } from 'vitest';

import { inspectHostBundleFiles } from './inspectHostBundle.mjs';

function validBundle() {
  return new Map([
    ['index.html', '<script type="module" src="/assets/index-entry.js"></script>'],
    ['assets/index-entry.js', 'import "./host-react-runtime.js"; import("./provider-implementation-runtime.js");'],
    ['assets/host-react-runtime.js', '/* one host-owned React and ReactDOM implementation */'],
    ['assets/provider-react-external-runtime.js', 'import "./host-react-runtime.js";'],
    ['assets/provider-react-dom-external-runtime.js', 'import "./host-react-runtime.js";'],
    ['assets/provider-implementation-runtime.js', 'import("./feature-text-runtime.js");import("./feature-stat-runtime.js");import("./feature-timeseries-runtime.js");import("./feature-gauge-runtime.js");import("./feature-bargauge-runtime.js");import("./feature-piechart-runtime.js");import("./feature-barchart-runtime.js");'],
    ['assets/feature-text-runtime.js', 'import "./provider-react-external-runtime.js";'],
    ['assets/feature-stat-runtime.js', '/* pinned Stat renderer */'],
    ['assets/feature-timeseries-runtime.js', '/* pinned Time series renderer */'],
    ['assets/feature-gauge-runtime.js', '/* pinned Gauge renderer */'],
    ['assets/feature-bargauge-runtime.js', '/* pinned Bar gauge renderer */'],
    ['assets/feature-barchart-runtime.js', '/* pinned Bar chart renderer */'],
    ['assets/feature-piechart-runtime.js', 'import "./provider-piechart-source-runtime.js";'],
    ['assets/provider-piechart-source-runtime.js', 'import "./provider-piechart-dependencies-runtime.js";'],
    ['assets/provider-piechart-dependencies-runtime.js', '/* exact Visx 3.12.0 cohort */'],
  ]);
}

function validModuleEvidence() {
  return {
    chunks: [
      {
        fileName: 'assets/host-react-runtime.js',
        modules: [
          '<repo>/node_modules/react/index.js',
          '<repo>/node_modules/react/cjs/react.production.js',
          '<repo>/node_modules/react-dom/index.js',
          '<repo>/node_modules/react-dom/cjs/react-dom.production.js',
        ],
      },
    ],
    moduleIds: [],
  };
}

describe('SDK host post-build inspection', () => {
  it.each(['stat', 'timeseries', 'gauge', 'bargauge', 'piechart', 'barchart'])('rejects the missing admitted %s renderer chunk', (id) => {
    const bundle = validBundle();
    bundle.delete(`assets/feature-${id}-runtime.js`);

    expect(() => inspectHostBundleFiles(bundle, validModuleEvidence())).toThrow(
      'SDK host bundle boundary'
    );
  });
  it.each(['stat', 'timeseries', 'gauge', 'bargauge', 'piechart', 'barchart'])('rejects duplicate %s chunks even when both have explicit lazy edges', (id) => {
    const bundle = validBundle();
    bundle.set(`assets/feature-${id}-copy.js`, '/* duplicate native renderer */');
    bundle.set('assets/provider-implementation-runtime.js', bundle.get('assets/provider-implementation-runtime.js') + `import("./feature-${id}-copy.js");`);

    expect(() => inspectHostBundleFiles(bundle, validModuleEvidence())).toThrow(
      'SDK host bundle boundary'
    );
  });
  it('accepts independent native chunks only behind explicit lazy catalogue edges', () => {
    const bundle = validBundle();
    bundle.set('assets/provider-implementation-runtime.js', bundle.get('assets/provider-implementation-runtime.js') + 'import("./feature-stat-runtime.js");import("./feature-timeseries-runtime.js");');
    bundle.set('assets/feature-stat-runtime.js', '/* pinned Stat renderer */');
    bundle.set('assets/feature-timeseries-runtime.js', '/* pinned Time series renderer */');
    expect(() => inspectHostBundleFiles(bundle, validModuleEvidence())).not.toThrow();
    bundle.set('assets/feature-table-runtime.js', '/* still unadmitted */');
    expect(() => inspectHostBundleFiles(bundle, validModuleEvidence())).toThrow();
  });
  it('accepts the controlled endpoint only in reviewed host/cohort chunks alongside a lazy datasource entry', () => {
    const bundle = validBundle();
    bundle.set('assets/index-entry.js', bundle.get('assets/index-entry.js') + 'const policyPath="/api/ds/query";');
    bundle.set('assets/provider-grafana-runtime.js', 'const path="/api/ds/query";');
    bundle.set('assets/provider-implementation-runtime.js', bundle.get('assets/provider-implementation-runtime.js') + 'import("./provider-query-runtime-runtime.js");');
    bundle.set('assets/provider-query-runtime-runtime.js', 'import("./feature-testdata-runtime-runtime.js");');
    bundle.set('assets/feature-testdata-runtime-runtime.js', '/* exact datasource.ts */');
    expect(() => inspectHostBundleFiles(bundle, validModuleEvidence())).not.toThrow();
  });
  it('accepts the closed production-shaped admitted renderer bundle', () => {
    expect(inspectHostBundleFiles(validBundle(), validModuleEvidence())).toEqual({
      featureTextChunks: 1,
      featurePieChunks: 1,
      hostReactChunks: 1,
      providerImplementationChunks: 1,
      providerPieChartChunks: 1,
      providerPieChartDependencyChunks: 1,
      providerReactDomWrappers: 1,
      providerReactWrappers: 1,
      reactDomPhysicalRoots: 1,
      reactPhysicalRoots: 1,
    });
  });

  it('rejects a severed Pie feature-to-source edge even when all exact chunks exist', () => {
    const bundle = validBundle();
    bundle.set('assets/feature-piechart-runtime.js', 'import "./feature-stat-runtime.js";');

    expect(() => inspectHostBundleFiles(bundle, validModuleEvidence())).toThrow(
      'SDK host bundle boundary'
    );
  });

  it('rejects a severed or reversed Pie source-to-dependencies edge', () => {
    const severed = validBundle();
    severed.set('assets/provider-piechart-source-runtime.js', '/* missing exact Visx dependency edge */');
    expect(() => inspectHostBundleFiles(severed, validModuleEvidence())).toThrow(
      'SDK host bundle boundary'
    );

    const reversed = validBundle();
    reversed.set('assets/provider-piechart-source-runtime.js', '/* reversed edge */');
    reversed.set('assets/provider-piechart-dependencies-runtime.js', 'import "./provider-piechart-source-runtime.js";');
    expect(() => inspectHostBundleFiles(reversed, validModuleEvidence())).toThrow(
      'SDK host bundle boundary'
    );
  });

  it('rejects eager or sibling Pie ownership that bypasses the exact lazy DAG', () => {
    const eager = validBundle();
    eager.set(
      'assets/provider-implementation-runtime.js',
      `${eager.get('assets/provider-implementation-runtime.js')}import "./provider-piechart-source-runtime.js";`
    );
    expect(() => inspectHostBundleFiles(eager, validModuleEvidence())).toThrow(
      'SDK host bundle boundary'
    );

    const sibling = validBundle();
    sibling.set(
      'assets/feature-piechart-runtime.js',
      'import "./provider-piechart-source-runtime.js";import "./provider-piechart-dependencies-runtime.js";'
    );
    expect(() => inspectHostBundleFiles(sibling, validModuleEvidence())).toThrow(
      'SDK host bundle boundary'
    );
  });

  it('rejects Pie DAG bypass and reverse edges expressed as static re-exports', () => {
    const eager = validBundle();
    eager.set(
      'assets/provider-implementation-runtime.js',
      `${eager.get('assets/provider-implementation-runtime.js')}export * from "./provider-piechart-source-runtime.js";`
    );
    expect(() => inspectHostBundleFiles(eager, validModuleEvidence())).toThrow(
      'SDK host bundle boundary'
    );

    const sibling = validBundle();
    sibling.set(
      'assets/feature-piechart-runtime.js',
      `${sibling.get('assets/feature-piechart-runtime.js')}export { cohort } from "./provider-piechart-dependencies-runtime.js";`
    );
    expect(() => inspectHostBundleFiles(sibling, validModuleEvidence())).toThrow(
      'SDK host bundle boundary'
    );

    const reverse = validBundle();
    reverse.set(
      'assets/provider-piechart-dependencies-runtime.js',
      'export * from "./provider-piechart-source-runtime.js";'
    );
    expect(() => inspectHostBundleFiles(reverse, validModuleEvidence())).toThrow(
      'SDK host bundle boundary'
    );
  });

  it.each([
    ['eager implementation-to-source', (bundle) => bundle.set(
      'assets/provider-implementation-runtime.js',
      `${bundle.get('assets/provider-implementation-runtime.js')}export*from"./provider-piechart-source-runtime.js";`
    )],
    ['feature-to-dependencies sibling', (bundle) => bundle.set(
      'assets/feature-piechart-runtime.js',
      `${bundle.get('assets/feature-piechart-runtime.js')}export{cohort}from"./provider-piechart-dependencies-runtime.js";`
    )],
    ['dependencies-to-source reverse', (bundle) => bundle.set(
      'assets/provider-piechart-dependencies-runtime.js',
      'export*from"./provider-piechart-source-runtime.js";'
    )],
  ])('rejects a minified %s re-export edge', (_label, mutate) => {
    const bundle = validBundle();
    mutate(bundle);

    expect(() => inspectHostBundleFiles(bundle, validModuleEvidence())).toThrow(
      'SDK host bundle boundary'
    );
  });

  it('rejects an eager implementation-to-feature edge alongside the required lazy edge', () => {
    const bundle = validBundle();
    bundle.set(
      'assets/provider-implementation-runtime.js',
      `${bundle.get('assets/provider-implementation-runtime.js')}import"./feature-piechart-runtime.js";`
    );

    expect(() => inspectHostBundleFiles(bundle, validModuleEvidence())).toThrow(
      'SDK host bundle boundary'
    );
  });

  it.each([
    ['feature-to-implementation', 'assets/feature-piechart-runtime.js'],
    ['source-to-implementation', 'assets/provider-piechart-source-runtime.js'],
    ['dependencies-to-implementation', 'assets/provider-piechart-dependencies-runtime.js'],
  ])('rejects a %s reverse edge', (_label, owner) => {
    const bundle = validBundle();
    bundle.set(owner, `${bundle.get(owner)}import"./provider-implementation-runtime.js";`);

    expect(() => inspectHostBundleFiles(bundle, validModuleEvidence())).toThrow(
      'SDK host bundle boundary'
    );
  });

  it.each([
    ['an ASI newline', 'const x=1\nimport"./provider-piechart-source-runtime.js";'],
    ['comments between tokens', 'import/* edge */"./provider-piechart-source-runtime.js";'],
    ['a commented minified re-export', 'export/* edge */*from"./provider-piechart-source-runtime.js";'],
  ])('rejects implementation-to-source bypass after %s', (_label, bypass) => {
    const bundle = validBundle();
    bundle.set(
      'assets/provider-implementation-runtime.js',
      `${bundle.get('assets/provider-implementation-runtime.js')}\n${bypass}`
    );

    expect(() => inspectHostBundleFiles(bundle, validModuleEvidence())).toThrow(
      'SDK host bundle boundary'
    );
  });

  it.each([
    ['feature-to-source', 'assets/feature-piechart-runtime.js', 'assets/provider-piechart-source-runtime.js'],
    ['source-to-dependencies', 'assets/provider-piechart-source-runtime.js', 'assets/provider-piechart-dependencies-runtime.js'],
  ])('rejects a dynamic-import/re-export sequence masquerading as the required %s static edge', (_label, owner, target) => {
    const bundle = validBundle();
    bundle.set(owner, `import("./unrelated-runtime.js")\nexport{x}from"./${target.slice('assets/'.length)}";`);

    expect(() => inspectHostBundleFiles(bundle, validModuleEvidence())).toThrow(
      'SDK host bundle boundary'
    );
  });

  it.each([
    ['implementation-to-source', 'assets/provider-implementation-runtime.js', 'assets/provider-piechart-source-runtime.js'],
    ['implementation-to-dependencies', 'assets/provider-implementation-runtime.js', 'assets/provider-piechart-dependencies-runtime.js'],
    ['feature-to-implementation', 'assets/feature-piechart-runtime.js', 'assets/provider-implementation-runtime.js'],
    ['feature-to-dependencies', 'assets/feature-piechart-runtime.js', 'assets/provider-piechart-dependencies-runtime.js'],
    ['source-to-implementation', 'assets/provider-piechart-source-runtime.js', 'assets/provider-implementation-runtime.js'],
    ['source-to-feature', 'assets/provider-piechart-source-runtime.js', 'assets/feature-piechart-runtime.js'],
    ['dependencies-to-implementation', 'assets/provider-piechart-dependencies-runtime.js', 'assets/provider-implementation-runtime.js'],
    ['dependencies-to-feature', 'assets/provider-piechart-dependencies-runtime.js', 'assets/feature-piechart-runtime.js'],
    ['dependencies-to-source', 'assets/provider-piechart-dependencies-runtime.js', 'assets/provider-piechart-source-runtime.js'],
  ])('rejects a two-argument dynamic %s edge', (_label, owner, target) => {
    const bundle = validBundle();
    bundle.set(owner, `${bundle.get(owner)}import("./${target.slice('assets/'.length)}",{});`);

    expect(() => inspectHostBundleFiles(bundle, validModuleEvidence())).toThrow(
      'SDK host bundle boundary'
    );
  });

  it.each([
    ['a duplicate host React implementation', 'assets/host-react-copy.js', 'React implementation'],
    ['an executable query endpoint', 'assets/unexpected.js', '/api/ds/query'],
    ['a Grafana shell bootstrap', 'assets/unexpected.js', 'GrafanaApp.init()'],
    ['SystemJS loading', 'assets/unexpected.js', 'System.import("plugin")'],
    ['an iframe', 'assets/unexpected.js', 'document.createElement("iframe")'],
    ['Grafana application navigation', 'assets/unexpected.js', 'public/app/core/navigation/AppChrome'],
  ])('rejects %s', (_label, fileName, source) => {
    const bundle = validBundle();
    bundle.set(fileName, source);

    expect(() => inspectHostBundleFiles(bundle, validModuleEvidence())).toThrow(
      'SDK host bundle boundary'
    );
  });

  it('rejects wrappers that do not resolve to the host-owned React chunk', () => {
    const bundle = validBundle();
    bundle.set('assets/provider-react-external-runtime.js', 'export const react = {};');

    expect(() => inspectHostBundleFiles(bundle, validModuleEvidence())).toThrow(
      'SDK host bundle boundary'
    );
  });

  it('rejects implementation and Text chunks that are no longer lazy', () => {
    const bundle = validBundle();
    bundle.set(
      'assets/index-entry.js',
      'import "./host-react-runtime.js"; import "./provider-implementation-runtime.js";'
    );

    expect(() => inspectHostBundleFiles(bundle, validModuleEvidence())).toThrow(
      'SDK host bundle boundary'
    );
  });

  it.each([
    'assets/provider-implementation-runtime.js',
    'assets/feature-text-runtime.js',
  ])('rejects a missing lazy boundary %s', (fileName) => {
    const bundle = validBundle();
    bundle.delete(fileName);

    expect(() => inspectHostBundleFiles(bundle, validModuleEvidence())).toThrow(
      'SDK host bundle boundary'
    );
  });

  it('rejects a second physical React package root even when chunk names look valid', () => {
    const evidence = validModuleEvidence();
    evidence.moduleIds.push(
      '<repo>/node_modules/transitive/node_modules/react/cjs/react.production.js'
    );

    expect(() => inspectHostBundleFiles(validBundle(), evidence)).toThrow(
      'SDK host bundle boundary'
    );
  });

  it('rejects forbidden implementation modules even when their strings are minified away', () => {
    const evidence = validModuleEvidence();
    evidence.moduleIds.push('<repo>/node_modules/@grafana/scenes/dist/esm/querying/SceneQueryRunner.js');

    expect(() => inspectHostBundleFiles(validBundle(), evidence)).toThrow(
      'SDK host bundle boundary'
    );
  });
});
