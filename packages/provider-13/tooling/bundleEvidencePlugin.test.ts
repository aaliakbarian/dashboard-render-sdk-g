import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import {
  assertNoBrowserReactRuntimeRequires,
  inspectProviderBundleEvidence,
  type ProviderBundleEvidence,
} from './bundleEvidencePlugin';
import { GRAFANA_13_APPLICATION_SOURCES, GRAFANA_13_NATIVE_SOURCES, GRAFANA_13_NATIVE_UI_SOURCES, GRAFANA_13_TESTDATA_SOURCES } from './sourceIdentity';

const radialPrefix = '<grafana-source>/packages/grafana-ui/src/components/RadialGauge/';

function nativeBundleEvidence(): ProviderBundleEvidence {
  const chunk = (fileName: string, modules: string[]) => ({ fileName, modules, dynamicImports: [], imports: [] as string[], gzipSize: 1, rawSize: 1, isEntry: false });
  const sharedTimeSeries = GRAFANA_13_NATIVE_SOURCES.filter(file => /\/timeseries\/(?:TimeSeriesTooltip\.tsx|utils\.ts)$/.test(file));
  const timeSeriesOnly = GRAFANA_13_NATIVE_SOURCES.filter(file =>
    (file.includes('/timeseries/') || file.includes('/core/components/')) && !sharedTimeSeries.includes(file));
  return { assets: [], moduleIds: [
    ...GRAFANA_13_APPLICATION_SOURCES, ...GRAFANA_13_NATIVE_SOURCES,
    ...GRAFANA_13_TESTDATA_SOURCES, ...GRAFANA_13_NATIVE_UI_SOURCES,
  ].map(file => `<grafana-source>/${file}`), chunks: [
    { ...chunk('provider.js', ['<repo>/packages/provider-13/src/artifactEntry.ts']), isEntry: true },
    chunk('assets/text.js', GRAFANA_13_APPLICATION_SOURCES.map(file => `<grafana-source>/${file}`)),
    chunk('assets/stat.js', GRAFANA_13_NATIVE_SOURCES.filter(file => file.includes('/stat/')).map(file => `<grafana-source>/${file}`)),
    { ...chunk('assets/timeseries.js', timeSeriesOnly.map(file => `<grafana-source>/${file}`)), imports: ['assets/timeseries-shared.js'] },
    chunk('assets/gauge.js', [...GRAFANA_13_NATIVE_SOURCES.filter(file => file.includes('/gauge/')),
      ...GRAFANA_13_NATIVE_UI_SOURCES.filter(file => !file.endsWith('/constants.ts'))].map(file => `<grafana-source>/${file}`)),
    chunk('assets/bargauge.js', GRAFANA_13_NATIVE_SOURCES.filter(file => file.includes('/bargauge/')).map(file => `<grafana-source>/${file}`)),
    { ...chunk('assets/barchart.js', GRAFANA_13_NATIVE_SOURCES.filter(file => file.includes('/barchart/')).map(file => `<grafana-source>/${file}`)), imports: ['assets/timeseries-shared.js'] },
    chunk('assets/timeseries-shared.js', sharedTimeSeries.map(file => `<grafana-source>/${file}`)),
    chunk('assets/query.js', GRAFANA_13_TESTDATA_SOURCES.map(file => `<grafana-source>/${file}`)),
  ] };
}

function standaloneInspection(report: ProviderBundleEvidence) {
  const directory = mkdtempSync(join(tmpdir(), 'provider13-provenance-'));
  try {
    const file = join(directory, 'evidence.json');
    writeFileSync(file, JSON.stringify(report));
    return spawnSync(process.execPath, [resolve('packages/provider-13/tooling/inspectProviderBundle.mjs'), file], { encoding: 'utf8' });
  } finally { rmSync(directory, { force: true, recursive: true }); }
}

describe.each(['build', 'standalone'] as const)('%s emitted radial provenance', inspector => {
  function inspect(report: ProviderBundleEvidence) {
    if (inspector === 'build') return inspectProviderBundleEvidence(report);
    const result = standaloneInspection(report);
    if (result.status !== 0) throw new Error(result.stderr);
    return JSON.parse(result.stdout);
  }
  it('accepts 13 loaded sources with 12 emitted and only constants folded away', () => {
    expect(() => inspect(nativeBundleEvidence())).not.toThrow();
  });
  it.each(['stat', 'timeseries', 'bargauge'])('rejects radial source in a shared chunk statically reached by %s', sibling => {
    const report = nativeBundleEvidence();
    const gauge = report.chunks.find(chunk => chunk.fileName === 'assets/gauge.js')!;
    const radial = gauge.modules.filter(id => id.startsWith(radialPrefix));
    const changed = { ...report, chunks: [
      ...report.chunks.map(chunk => chunk === gauge ? { ...chunk, modules: chunk.modules.filter(id => !id.startsWith(radialPrefix)), imports: ['assets/shared-radial.js'] }
        : chunk.fileName === `assets/${sibling}.js` ? { ...chunk, imports: ['assets/shared-radial.js'] } : chunk),
      { ...gauge, fileName: 'assets/shared-radial.js', modules: radial },
    ] };
    expect(() => inspect(changed)).toThrow();
  });
  it('rejects duplicate emitted radial owners even when both are Gauge-reachable', () => {
    const report = nativeBundleEvidence();
    const gauge = report.chunks.find(chunk => chunk.fileName === 'assets/gauge.js')!;
    expect(() => inspect({ ...report, chunks: [
      ...report.chunks.map(chunk => chunk === gauge ? { ...chunk, imports: ['assets/radial-copy.js'] } : chunk),
      { ...gauge, fileName: 'assets/radial-copy.js', modules: gauge.modules.filter(id => id.startsWith(radialPrefix)) },
    ] })).toThrow();
  });
  it('requires emitted RadialBar even when the loaded module inventory retains it', () => {
    const report = nativeBundleEvidence();
    expect(report.moduleIds).toContain(`${radialPrefix}RadialBar.tsx`);
    expect(() => inspect({ ...report, chunks: report.chunks.map(chunk => ({
      ...chunk, modules: chunk.modules.filter(id => id !== `${radialPrefix}RadialBar.tsx`),
    })) })).toThrow();
  });
  it('rejects loaded-only radial provenance with no emitted renderer', () => {
    const report = nativeBundleEvidence();
    expect(() => inspect({ ...report, chunks: report.chunks.map(chunk => ({
      ...chunk, modules: chunk.modules.filter(id => !id.startsWith(radialPrefix)),
    })) })).toThrow();
  });
  it('rejects missing native UI provenance in both emitted and loaded inventories', () => {
    const report = nativeBundleEvidence();
    expect(() => inspect({ ...report, moduleIds: report.moduleIds.filter(id => !id.startsWith(radialPrefix)),
      chunks: report.chunks.map(chunk => ({ ...chunk, modules: chunk.modules.filter(id => !id.startsWith(radialPrefix)) })),
    })).toThrow();
  });
});

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
    const sharedTimeSeries = GRAFANA_13_NATIVE_SOURCES.filter(file => /\/timeseries\/(?:TimeSeriesTooltip\.tsx|utils\.ts)$/.test(file));
    const timeSeriesOnly = GRAFANA_13_NATIVE_SOURCES.filter(file =>
      (file.includes('/timeseries/') || file.includes('/core/components/')) && !sharedTimeSeries.includes(file));
    const report: ProviderBundleEvidence = { assets: [], moduleIds: [], chunks: [
      chunk('assets/text.js', GRAFANA_13_APPLICATION_SOURCES.map(f => `<grafana-source>/${f}`)),
      chunk('assets/statPlugin.js', GRAFANA_13_NATIVE_SOURCES.filter(f => f.includes('/stat/')).map(f => `<grafana-source>/${f}`)),
      { ...chunk('assets/timeSeriesPlugin.js', timeSeriesOnly.map(f => `<grafana-source>/${f}`)), imports: ['assets/timeSeriesShared.js'] },
      chunk('assets/gaugePlugin.js', [...GRAFANA_13_NATIVE_SOURCES.filter(f => f.includes('/gauge/')), ...GRAFANA_13_NATIVE_UI_SOURCES].map(f => `<grafana-source>/${f}`)),
      chunk('assets/barGaugePlugin.js', GRAFANA_13_NATIVE_SOURCES.filter(f => f.includes('/bargauge/')).map(f => `<grafana-source>/${f}`)),
      { ...chunk('assets/barChartPlugin.js', GRAFANA_13_NATIVE_SOURCES.filter(f => f.includes('/barchart/')).map(f => `<grafana-source>/${f}`)), imports: ['assets/timeSeriesShared.js'] },
      chunk('assets/timeSeriesShared.js', sharedTimeSeries.map(f => `<grafana-source>/${f}`)),
      chunk('assets/query.js', [...GRAFANA_13_TESTDATA_SOURCES.map(f => `<grafana-source>/${f}`), '<repo>/node_modules/@grafana/scenes/dist/esm/querying/SceneQueryRunner.js']),
    ] };
    expect(() => inspectProviderBundleEvidence(report)).not.toThrow();
    expect(() => inspectProviderBundleEvidence({ ...report, chunks: [...report.chunks, chunk('assets/unreviewed.js', ['<grafana-source>/public/app/plugins/panel/stat/module.tsx'])] })).toThrow();
    expect(() => inspectProviderBundleEvidence({ ...report, chunks: report.chunks.map(c => c.fileName.includes('statPlugin') ? { ...c, imports: ['assets/timeSeriesPlugin.js'] } : c) })).toThrow();
    expect(() => inspectProviderBundleEvidence({ ...report, chunks: report.chunks.map(c => c.fileName.includes('gaugePlugin') ? { ...c, imports: ['assets/barGaugePlugin.js'] } : c) })).toThrow();
    expect(() => inspectProviderBundleEvidence({ ...report, chunks: report.chunks.map(c => c.fileName.includes('gaugePlugin') ? { ...c, modules: c.modules.filter(id => !id.endsWith('/RadialBar.tsx')) } : c) })).toThrow();
    const movedRadialRenderer: ProviderBundleEvidence = { ...report, chunks: [
      ...report.chunks.map(c => c.fileName.includes('gaugePlugin') ? { ...c, modules: c.modules.filter(id => !id.includes('/packages/grafana-ui/')) } : c),
      { ...chunk('provider.js', GRAFANA_13_NATIVE_UI_SOURCES.map(file => `<grafana-source>/${file}`)), isEntry: true },
    ] };
    expect(() => inspectProviderBundleEvidence(movedRadialRenderer)).toThrow();
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
