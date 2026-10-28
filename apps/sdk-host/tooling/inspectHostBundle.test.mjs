import { describe, expect, it } from 'vitest';

import { inspectHostBundleFiles } from './inspectHostBundle.mjs';

function validBundle() {
  return new Map([
    ['index.html', '<script type="module" src="/assets/index-entry.js"></script>'],
    ['assets/index-entry.js', 'import "./host-react-runtime.js"; import("./provider-implementation-runtime.js");'],
    ['assets/host-react-runtime.js', '/* one host-owned React and ReactDOM implementation */'],
    ['assets/provider-react-external-runtime.js', 'import "./host-react-runtime.js";'],
    ['assets/provider-react-dom-external-runtime.js', 'import "./host-react-runtime.js";'],
    ['assets/provider-implementation-runtime.js', 'import("./feature-text-runtime.js");'],
    ['assets/feature-text-runtime.js', 'import "./provider-react-external-runtime.js";'],
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
  it('accepts the controlled endpoint only in reviewed host/cohort chunks alongside a lazy datasource entry', () => {
    const bundle = validBundle();
    bundle.set('assets/index-entry.js', bundle.get('assets/index-entry.js') + 'const policyPath="/api/ds/query";');
    bundle.set('assets/provider-grafana-runtime.js', 'const path="/api/ds/query";');
    bundle.set('assets/provider-implementation-runtime.js', bundle.get('assets/provider-implementation-runtime.js') + 'import("./provider-query-runtime-runtime.js");');
    bundle.set('assets/provider-query-runtime-runtime.js', 'import("./feature-testdata-runtime-runtime.js");');
    bundle.set('assets/feature-testdata-runtime-runtime.js', '/* exact datasource.ts */');
    expect(() => inspectHostBundleFiles(bundle, validModuleEvidence())).not.toThrow();
  });
  it('accepts the closed production-shaped Text bundle', () => {
    expect(inspectHostBundleFiles(validBundle(), validModuleEvidence())).toEqual({
      featureTextChunks: 1,
      hostReactChunks: 1,
      providerImplementationChunks: 1,
      providerReactDomWrappers: 1,
      providerReactWrappers: 1,
      reactDomPhysicalRoots: 1,
      reactPhysicalRoots: 1,
    });
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
