import { describe, expect, it } from 'vitest';

import {
  assertNoBrowserReactRuntimeRequires,
  inspectProviderBundleEvidence,
  type ProviderBundleEvidence,
} from './bundleEvidencePlugin';
import { GRAFANA_13_APPLICATION_SOURCES, GRAFANA_13_NATIVE_SOURCES, GRAFANA_13_TESTDATA_SOURCES } from './sourceIdentity';

describe('provider-13 emitted browser chunks', () => {
  it('rejects a browser-time CommonJS React require in a non-runtime chunk', () => {
    expect(() =>
      assertNoBrowserReactRuntimeRequires([
        {
          code: 'import{i as loadExternal,t as wrap}from"./rolldown-runtime-abc.js";const React=loadExternal(`react`);',
          fileName: 'assets/provider-scenes-abc.js',
        },
      ])
    ).toThrow(/browser-time React require/i);
  });

  it('accepts explicit external ESM React imports and the runtime helper implementation', () => {
    expect(() =>
      assertNoBrowserReactRuntimeRequires([
        {
          code: 'import * as React from "react";import { createRoot } from "react-dom/client";',
          fileName: 'assets/provider-scenes-abc.js',
        },
        {
          code: 'const runtimeRequire = (id) => { throw new Error(`Calling require for ${id}`); };',
          fileName: 'assets/rolldown-runtime-abc.js',
        },
      ])
    ).not.toThrow();
  });
});

describe('provider-13 bundle evidence inspection', () => {
  it('admits exact independent native closures and query scenes only when native provenance exists', () => {
    const chunk = (fileName: string, modules: string[]) => ({ fileName, modules, dynamicImports: [], imports: [], gzipSize: 1, rawSize: 1, isEntry: false });
    const report: ProviderBundleEvidence = { assets: [], moduleIds: [], chunks: [
      chunk('assets/text.js', GRAFANA_13_APPLICATION_SOURCES.map(f => `<grafana-source>/${f}`)),
      chunk('assets/statPlugin.js', GRAFANA_13_NATIVE_SOURCES.filter(f => f.includes('/stat/')).map(f => `<grafana-source>/${f}`)),
      chunk('assets/timeSeriesPlugin.js', GRAFANA_13_NATIVE_SOURCES.filter(f => !f.includes('/stat/')).map(f => `<grafana-source>/${f}`)),
      chunk('assets/query.js', [...GRAFANA_13_TESTDATA_SOURCES.map(f => `<grafana-source>/${f}`), '<repo>/node_modules/@grafana/scenes/dist/esm/querying/SceneQueryRunner.js']),
    ] };
    expect(() => inspectProviderBundleEvidence(report)).not.toThrow();
    expect(() => inspectProviderBundleEvidence({ ...report, chunks: [...report.chunks, chunk('assets/unreviewed.js', ['<grafana-source>/public/app/plugins/panel/stat/module.tsx'])] })).toThrow();
    expect(() => inspectProviderBundleEvidence({ ...report, chunks: report.chunks.map(c => c.fileName.includes('statPlugin') ? { ...c, imports: ['assets/timeSeriesPlugin.js'] } : c) })).toThrow();
  });
  it('admits the complete lazy runtime-only TestData closure but keeps scene query activation forbidden', () => {
    const testdata = ['LogIpsum.ts', 'constants.ts', 'dataquery.ts', 'datasource.ts', 'metricTree.ts', 'nodeGraphUtils.ts',
      'runStreams.ts', 'testData/flameGraphResponse.ts', 'testData/serviceMapResponse.ts', 'testData/serviceMapResponseMedium.ts', 'variables.ts'];
    const report: ProviderBundleEvidence = { assets: [], moduleIds: [], chunks: [{
      fileName: 'assets/query.js', dynamicImports: [], imports: [], gzipSize: 1, rawSize: 1, isEntry: false,
      modules: ['<grafana-source>/public/app/plugins/panel/text/panelcfg.gen.ts', '<grafana-source>/public/app/plugins/panel/text/v1/TextPanel.tsx',
        ...testdata.map(file => `<grafana-source>/public/app/plugins/datasource/grafana-testdata-datasource/${file}`),
        '<repo>/node_modules/@grafana/runtime/dist/esm/services/dataSourceSrv.mjs'],
    }] };
    expect(() => inspectProviderBundleEvidence(report)).not.toThrow();
    expect(() => inspectProviderBundleEvidence({ ...report, moduleIds: ['<repo>/node_modules/@grafana/scenes/dist/esm/querying/SceneQueryRunner.js'] })).toThrow();
    const pulledIntoText = { ...report, chunks: [...report.chunks, {
      fileName: 'assets/text-runtime.js', dynamicImports: [], imports: ['assets/query.js'], gzipSize: 1, rawSize: 1, isEntry: false,
      modules: ['<repo>/packages/provider-13/src/runtime/cohort.ts'],
    }] };
    expect(() => inspectProviderBundleEvidence(pulledIntoText)).toThrow();
  });
  it('accepts exact Text source provenance and external React references', () => {
    const report: ProviderBundleEvidence = {
      assets: [],
      chunks: [
        {
          dynamicImports: ['assets/text.js'],
          fileName: 'provider.js',
          gzipSize: 10,
          imports: ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime', 'react/jsx-dev-runtime'],
          isEntry: true,
          modules: ['<repo>/packages/provider-13/src/index.ts'],
          rawSize: 20,
        },
        {
          dynamicImports: [],
          fileName: 'assets/text.js',
          gzipSize: 100,
          imports: ['react'],
          isEntry: false,
          modules: [
            '<grafana-source>/public/app/plugins/panel/text/panelcfg.gen.ts',
            '<grafana-source>/public/app/plugins/panel/text/v1/TextPanel.tsx',
          ],
          rawSize: 200,
        },
      ],
      moduleIds: [],
    };

    expect(inspectProviderBundleEvidence(report)).toMatchObject({
      applicationSources: [
        'public/app/plugins/panel/text/panelcfg.gen.ts',
        'public/app/plugins/panel/text/v1/TextPanel.tsx',
      ],
      bundledImplementations: {
        jsxDevRuntime: 0,
        jsxRuntime: 0,
        react: 0,
        reactDom: 0,
      },
    });
  });

  it('rejects bundled React implementations and source provenance drift', () => {
    const report: ProviderBundleEvidence = {
      assets: [],
      chunks: [{
        dynamicImports: [], fileName: 'provider.js', gzipSize: 1, imports: [], isEntry: true,
        modules: [
          '<repo>/node_modules/react/index.js',
          '<grafana-source>/public/app/plugins/panel/text/module.tsx',
        ], rawSize: 1,
      }],
      moduleIds: [],
    };

    expect(() => inspectProviderBundleEvidence(report)).toThrow(/bundle boundary/i);
  });

  it('rejects Grafana modules in the inert entry and duplicate cohort ownership', () => {
    const sourceModules = [
      '<grafana-source>/public/app/plugins/panel/text/panelcfg.gen.ts',
      '<grafana-source>/public/app/plugins/panel/text/v1/TextPanel.tsx',
    ];
    const report: ProviderBundleEvidence = {
      assets: [],
      chunks: [
        {
          dynamicImports: ['assets/text.js'], fileName: 'provider.js', gzipSize: 1,
          imports: [], isEntry: true,
          modules: ['<repo>/node_modules/@grafana/runtime/dist/esm/index.mjs'], rawSize: 1,
        },
        {
          dynamicImports: [], fileName: 'assets/text.js', gzipSize: 1,
          imports: [], isEntry: false,
          modules: [...sourceModules, '<repo>/node_modules/@grafana/data/dist/esm/panel/PanelPlugin.mjs'], rawSize: 1,
        },
        {
          dynamicImports: [], fileName: 'assets/duplicate.js', gzipSize: 1,
          imports: [], isEntry: false,
          modules: ['<repo>/node_modules/@grafana/data/dist/esm/panel/PanelPlugin.mjs'], rawSize: 1,
        },
      ],
      moduleIds: [],
    };

    expect(() => inspectProviderBundleEvidence(report)).toThrow(/bundle boundary/i);
  });

  it('rejects deferred panel/runtime modules folded into the inert browser entry', () => {
    const report: ProviderBundleEvidence = {
      assets: [],
      chunks: [
        {
          dynamicImports: ['assets/implementation.js', 'assets/text.js'],
          fileName: 'provider.js',
          gzipSize: 1,
          imports: ['react'],
          isEntry: true,
          modules: [
            '<repo>/packages/provider-13/src/artifactEntry.ts',
            '<repo>/packages/provider-13/src/panels/catalog.ts',
          ],
          rawSize: 1,
        },
        {
          dynamicImports: [],
          fileName: 'assets/text.js',
          gzipSize: 1,
          imports: ['react'],
          isEntry: false,
          modules: [
            '<grafana-source>/public/app/plugins/panel/text/panelcfg.gen.ts',
            '<grafana-source>/public/app/plugins/panel/text/v1/TextPanel.tsx',
          ],
          rawSize: 1,
        },
      ],
      moduleIds: [],
    };

    expect(() => inspectProviderBundleEvidence(report)).toThrow(/bundle boundary/i);
  });

  it('rejects tslib ownership inside the dynamic implementation chunk', () => {
    const report: ProviderBundleEvidence = {
      assets: [],
      chunks: [
        {
          dynamicImports: ['assets/implementation.js', 'assets/text.js'],
          fileName: 'provider.js',
          gzipSize: 1,
          imports: ['react'],
          isEntry: true,
          modules: ['<repo>/packages/provider-13/src/artifactEntry.ts'],
          rawSize: 1,
        },
        {
          dynamicImports: [],
          fileName: 'assets/implementation.js',
          gzipSize: 1,
          imports: [],
          isEntry: false,
          modules: ['<repo>/node_modules/tslib/tslib.es6.mjs'],
          rawSize: 1,
        },
        {
          dynamicImports: [],
          fileName: 'assets/text.js',
          gzipSize: 1,
          imports: ['react'],
          isEntry: false,
          modules: [
            '<grafana-source>/public/app/plugins/panel/text/panelcfg.gen.ts',
            '<grafana-source>/public/app/plugins/panel/text/v1/TextPanel.tsx',
          ],
          rawSize: 1,
        },
      ],
      moduleIds: [],
    };

    expect(() => inspectProviderBundleEvidence(report)).toThrow(/bundle boundary/i);
  });

  it('rejects UUID ownership inside the cyclic Scenes facade chunk', () => {
    const report: ProviderBundleEvidence = {
      assets: [],
      chunks: [
        {
          dynamicImports: ['assets/esm.js', 'assets/text.js'],
          fileName: 'provider.js',
          gzipSize: 1,
          imports: ['react'],
          isEntry: true,
          modules: ['<repo>/packages/provider-13/src/artifactEntry.ts'],
          rawSize: 1,
        },
        {
          dynamicImports: [],
          fileName: 'assets/esm.js',
          gzipSize: 1,
          imports: ['assets/provider-scenes.js'],
          isEntry: false,
          modules: ['<repo>/node_modules/uuid/dist/esm-browser/v4.js'],
          rawSize: 1,
        },
        {
          dynamicImports: [],
          fileName: 'assets/text.js',
          gzipSize: 1,
          imports: ['react'],
          isEntry: false,
          modules: [
            '<grafana-source>/public/app/plugins/panel/text/panelcfg.gen.ts',
            '<grafana-source>/public/app/plugins/panel/text/v1/TextPanel.tsx',
          ],
          rawSize: 1,
        },
      ],
      moduleIds: [],
    };

    expect(() => inspectProviderBundleEvidence(report)).toThrow(/bundle boundary/i);
  });

  it('rejects react-grid-layout ownership inside the cyclic Scenes facade chunk', () => {
    const report: ProviderBundleEvidence = {
      assets: [],
      chunks: [
        {
          dynamicImports: ['assets/esm.js', 'assets/text.js'],
          fileName: 'provider.js',
          gzipSize: 1,
          imports: ['react'],
          isEntry: true,
          modules: ['<repo>/packages/provider-13/src/artifactEntry.ts'],
          rawSize: 1,
        },
        {
          dynamicImports: [],
          fileName: 'assets/esm.js',
          gzipSize: 1,
          imports: ['assets/provider-scenes.js'],
          isEntry: false,
          modules: ['<repo>/node_modules/react-grid-layout/build/ReactGridLayout.js'],
          rawSize: 1,
        },
        {
          dynamicImports: [],
          fileName: 'assets/text.js',
          gzipSize: 1,
          imports: ['react'],
          isEntry: false,
          modules: [
            '<grafana-source>/public/app/plugins/panel/text/panelcfg.gen.ts',
            '<grafana-source>/public/app/plugins/panel/text/v1/TextPanel.tsx',
          ],
          rawSize: 1,
        },
      ],
      moduleIds: [],
    };

    expect(() => inspectProviderBundleEvidence(report)).toThrow(/bundle boundary/i);
  });

  it('rejects a ReactDOM external wrapper that is merged with the Scenes facade', () => {
    const report: ProviderBundleEvidence = {
      assets: [],
      chunks: [
        {
          dynamicImports: ['assets/implementation.js', 'assets/text.js'],
          fileName: 'provider.js',
          gzipSize: 1,
          imports: ['react'],
          isEntry: true,
          modules: ['<repo>/packages/provider-13/src/artifactEntry.ts'],
          rawSize: 1,
        },
        {
          dynamicImports: [],
          fileName: 'assets/esm.js',
          gzipSize: 1,
          imports: ['assets/provider-scenes.js', 'react-dom'],
          isEntry: false,
          modules: ['builtin:esm-external-require-react-dom'],
          rawSize: 1,
        },
        {
          dynamicImports: [],
          fileName: 'assets/text.js',
          gzipSize: 1,
          imports: ['react'],
          isEntry: false,
          modules: [
            '<grafana-source>/public/app/plugins/panel/text/panelcfg.gen.ts',
            '<grafana-source>/public/app/plugins/panel/text/v1/TextPanel.tsx',
          ],
          rawSize: 1,
        },
      ],
      moduleIds: [],
    };

    expect(() => inspectProviderBundleEvidence(report)).toThrow(/bundle boundary/i);
  });

  it.each([
    [
      '<repo>/node_modules/@grafana/data/dist/esm/a.mjs',
      '<repo>/node_modules/transitive/node_modules/@grafana/data/dist/esm/b.mjs',
    ],
    [
      '<repo>/node_modules/.pnpm/@grafana+data@13.2.3/node_modules/@grafana/data/dist/esm/a.mjs',
      '<repo>/node_modules/.pnpm/@grafana+data@13.2.4/node_modules/@grafana/data/dist/esm/b.mjs',
    ],
  ])('rejects distinct physical roots for one logical cohort package', (first, second) => {
    const report: ProviderBundleEvidence = {
      assets: [],
      chunks: [
        {
          dynamicImports: ['assets/text.js'],
          fileName: 'provider.js',
          gzipSize: 1,
          imports: [],
          isEntry: true,
          modules: ['<repo>/packages/provider-13/src/index.ts'],
          rawSize: 1,
        },
        {
          dynamicImports: [],
          fileName: 'assets/text.js',
          gzipSize: 1,
          imports: [],
          isEntry: false,
          modules: [
            '<grafana-source>/public/app/plugins/panel/text/panelcfg.gen.ts',
            '<grafana-source>/public/app/plugins/panel/text/v1/TextPanel.tsx',
            first,
            second,
          ],
          rawSize: 1,
        },
      ],
      moduleIds: [],
    };

    expect(() => inspectProviderBundleEvidence(report)).toThrow(/bundle boundary/i);
  });

  it('rejects a generic editor leaf in generated bundle evidence', () => {
    const report: ProviderBundleEvidence = {
      assets: [],
      chunks: [
        {
          dynamicImports: ['assets/text.js'],
          fileName: 'provider.js',
          gzipSize: 1,
          imports: [],
          isEntry: true,
          modules: ['<repo>/packages/provider-13/src/index.ts'],
          rawSize: 1,
        },
        {
          dynamicImports: [],
          fileName: 'assets/text.js',
          gzipSize: 1,
          imports: [],
          isEntry: false,
          modules: [
            '<grafana-source>/public/app/plugins/panel/text/panelcfg.gen.ts',
            '<grafana-source>/public/app/plugins/panel/text/v1/TextPanel.tsx',
            '<repo>/node_modules/@grafana/ui/dist/esm/components/DataLinks/DataLinksInlineEditor.mjs',
          ],
          rawSize: 1,
        },
      ],
      moduleIds: [],
    };

    expect(() => inspectProviderBundleEvidence(report)).toThrow(/bundle boundary/i);
  });

  it.each([
    '<repo>/node_modules/@grafana/scenes/dist/esm/querying/SceneQueryRunner.js',
    '<repo>/node_modules/@grafana/runtime/dist/esm/services/dataSourceSrv.mjs',
    '<repo>/node_modules/@grafana/scenes/dist/esm/querying/RuntimeDataSource.js',
  ])('rejects executable query or datasource service %s', (moduleId) => {
    const report: ProviderBundleEvidence = {
      assets: [],
      chunks: [
        {
          dynamicImports: ['assets/runtime.js'], fileName: 'provider.js', gzipSize: 1,
          imports: [], isEntry: true,
          modules: ['<repo>/packages/provider-13/src/index.ts'], rawSize: 1,
        },
        {
          dynamicImports: [], fileName: 'assets/runtime.js', gzipSize: 1,
          imports: [], isEntry: false,
          modules: [
            '<grafana-source>/public/app/plugins/panel/text/panelcfg.gen.ts',
            '<grafana-source>/public/app/plugins/panel/text/v1/TextPanel.tsx',
            moduleId,
          ], rawSize: 1,
        },
      ],
      moduleIds: [],
    };

    expect(() => inspectProviderBundleEvidence(report)).toThrow(/bundle boundary/i);
  });
});
