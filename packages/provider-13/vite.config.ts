import react from '@vitejs/plugin-react';
import { execFileSync } from 'node:child_process';
import { statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, esmExternalRequirePlugin } from 'vite';

import { bundleEvidencePlugin } from './tooling/bundleEvidencePlugin.ts';
import { forbiddenGrafanaImportPlugin } from './tooling/forbiddenGrafanaImportPlugin.ts';
import { pinnedGrafanaSourcePlugin } from './tooling/pinnedGrafanaSourcePlugin.ts';
import { runtimeViewOnlyBarrelsPlugin } from './tooling/runtimeViewOnlyBarrelsPlugin.ts';
import {
  GRAFANA_13_APPLICATION_SOURCES,
  GRAFANA_13_TESTDATA_SOURCE_FILES,
  GRAFANA_13_TESTDATA_SOURCES,
  assertGrafana13SourceIdentity,
} from './tooling/sourceIdentity.ts';
import { textRendererOnlyImportsPlugin } from './tooling/textRendererOnlyImportsPlugin.ts';
import { queryRuntimeImportsPlugin } from './tooling/queryRuntimeImportsPlugin.ts';
import { rendererOnlyImportsPlugin } from './tooling/rendererOnlyImportsPlugin.ts';
import { GRAFANA_13_NATIVE_SOURCES, GRAFANA_13_NATIVE_UI_SOURCES } from './tooling/sourceIdentity.ts';

const providerRoot = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(providerRoot, '../..');
const grafanaSourceRoot = process.env.GRAFANA_SOURCE_DIR
  ? resolve(process.env.GRAFANA_SOURCE_DIR)
  : undefined;

if (!grafanaSourceRoot) {
  throw new Error('Provider-13 build requires GRAFANA_SOURCE_DIR.');
}

for (const source of [...GRAFANA_13_APPLICATION_SOURCES, ...GRAFANA_13_TESTDATA_SOURCES, ...GRAFANA_13_NATIVE_SOURCES, ...GRAFANA_13_NATIVE_UI_SOURCES]) {
  statSync(resolve(grafanaSourceRoot, source));
}
assertGrafana13SourceIdentity({
  dirty:
    execFileSync('git', ['-C', grafanaSourceRoot, 'status', '--porcelain'], {
      encoding: 'utf8',
    }).trim().length > 0,
  revision: execFileSync('git', ['-C', grafanaSourceRoot, 'rev-parse', 'HEAD'], {
    encoding: 'utf8',
  }).trim(),
});

const textSourceRoot = resolve(grafanaSourceRoot, 'public/app/plugins/panel/text');

function providerCohortChunk(id: string): string | undefined {
  const normalized = id.replaceAll('\\', '/');
  if (/native:public\/app\/plugins\/panel\/timeseries\/(?:TimeSeriesTooltip\.tsx|utils\.ts)(?:\.js)?$/.test(normalized)) return 'provider-timeseries-shared';
  if (/\/(?:src\/panels\/gaugePlugin|tooling\/viewOnly\/gaugeUiInternal)\.ts$/.test(normalized) || normalized.includes('native:public/app/plugins/panel/gauge/') || normalized.includes('native:packages/grafana-ui/src/components/RadialGauge/')) return 'provider-gauge';
  if (/\/(?:src\/panels\/barGaugePlugin|tooling\/viewOnly\/barGaugeUiInternal)\.ts$/.test(normalized) || normalized.includes('native:public/app/plugins/panel/bargauge/')) return 'provider-bargauge';
  if (/\/src\/panels\/barChartPlugin\.ts$/.test(normalized) || normalized.includes('native:public/app/plugins/panel/barchart/')) return 'provider-barchart';
  if (/\/src\/panels\/statPlugin\.ts$/.test(normalized) || normalized.includes('native:public/app/plugins/panel/stat/')) return 'provider-stat';
  if (/\/src\/panels\/timeSeries(?:Plugin|Config)\.ts$/.test(normalized) || /native:public\/app\/(?:plugins\/panel\/timeseries\/|core\/components\/(?:TimeSeries|GraphNG)\/)/.test(normalized)) return 'provider-timeseries';
  if (/\/viewOnly\/native(?:Inert|UiInternal)\.tsx?$/.test(normalized)) return 'provider-native-visualization';
  if (normalized.includes('native:packages/grafana-data/')) return 'provider-grafana';
  if (/\/viewOnly\/nativeDataInternal\.ts$/.test(normalized)) return 'provider-grafana';
  if (/\/viewOnly\/nativeUi\.ts$/.test(normalized)) return 'provider-native-visualization';
  if (/\/node_modules\/@grafana\/ui\/dist\/esm\/(?:components\/(?:BigValue|BarGauge|Sparkline|VizRepeater|uPlot|VizLegend|VizLayout|VizTooltip|ColorPicker|ColorSwatch)\/|graveyard\/GraphNG\/|utils\/measureText\.mjs)/.test(normalized)) return 'provider-native-visualization';
  if (/\/node_modules\/(?:react-aria|react-stately|react-colorful)\//.test(normalized)) return 'provider-visualization-dependencies';
  if (normalized.includes('builtin:esm-external-require-react-dom')) {
    return 'provider-react-dom-external';
  }
  if (normalized.includes('builtin:esm-external-require-react')) {
    return 'provider-react-external';
  }
  if (normalized.includes('/node_modules/tslib/')) return 'provider-tslib';
  if (normalized.includes('/node_modules/uuid/')) return 'provider-uuid';
  // Keep generic query dependencies out of the lazy application-source chunk.
  // Otherwise the shared Runtime cohort gains a static edge into TestData.
  if (/\/node_modules\/(?:@openfeature\/|d3-random\/)/.test(normalized)) return 'provider-query-dependencies';
  if (
    /\/node_modules\/(?:clsx|fast-equals|prop-types|react-draggable|react-grid-layout|react-resizable|react-use|resize-observer-polyfill)\//.test(
      normalized
    )
  ) {
    return 'provider-scenes-dependencies';
  }
  if (normalized.includes('/node_modules/@grafana/scenes/')) return 'provider-scenes';
  if (
    /\/node_modules\/@grafana\/(?:data|ui|runtime|schema|i18n|e2e-selectors)\//.test(normalized)
  ) {
    return 'provider-grafana';
  }
  if (normalized.includes('/node_modules/rxjs/')) return 'provider-rxjs';
  if (
    normalized.includes('/node_modules/@emotion/') ||
    normalized.includes('/node_modules/stylis/') ||
    normalized.includes('/node_modules/hoist-non-react-statics/') ||
    normalized.includes('/node_modules/react-is/')
  ) {
    return 'provider-emotion';
  }
  if (normalized.includes('/node_modules/uplot/')) return 'provider-visualization';
  return undefined;
}

export default defineConfig({
  root: repositoryRoot,
  build: {
    emptyOutDir: true,
    modulePreload: false,
    outDir: resolve(repositoryRoot, 'artifacts/sdk/provider-13'),
    rollupOptions: {
      input: { provider: resolve(providerRoot, 'src/artifactEntry.ts') },
      output: {
        assetFileNames: 'assets/[name]-[hash][extname]',
        chunkFileNames: 'assets/[name]-[hash].js',
        codeSplitting: {
          groups: [
            {
              debugName: 'provider-grafana-cohort-ownership',
              name: providerCohortChunk,
              test: (id: string) => providerCohortChunk(id) !== undefined,
            },
          ],
          includeDependenciesRecursively: false,
        },
        entryFileNames: '[name].js',
      },
      preserveEntrySignatures: 'allow-extension',
    },
  },
  plugins: [
    esmExternalRequirePlugin({ external: [/^react(?:-dom)?(?:\/|$)/] }),
    runtimeViewOnlyBarrelsPlugin({ providerRoot, repositoryRoot }),
    queryRuntimeImportsPlugin({ providerRoot, repositoryRoot }),
    rendererOnlyImportsPlugin({ providerRoot, repositoryRoot, sourceRoot: grafanaSourceRoot }),
    textRendererOnlyImportsPlugin({ providerRoot, sourceRoot: textSourceRoot }),
    forbiddenGrafanaImportPlugin(),
    ...[
      ['grafana-provider13-stat-renderer', 'public/app/plugins/panel/stat/StatPanel.tsx'],
      ['grafana-provider13-timeseries-renderer', 'public/app/plugins/panel/timeseries/TimeSeriesPanel.tsx'],
      ['grafana-provider13-gauge-renderer', 'public/app/plugins/panel/gauge/GaugePanel.tsx'],
      ['grafana-provider13-bargauge-renderer', 'public/app/plugins/panel/bargauge/BarGaugePanel.tsx'],
      ['grafana-provider13-barchart-renderer', 'public/app/plugins/panel/barchart/BarChartPanel.tsx'],
      ['grafana-provider13-native-null-to-undef', 'packages/grafana-data/src/transformations/transformers/nulls/nullToUndefThreshold.ts'],
    ].map(([entryAlias, entrypoint]) => pinnedGrafanaSourcePlugin({
      feature: 'native', entryAlias: entryAlias!, entrypoint: entrypoint!, sourceRoot: grafanaSourceRoot,
      reviewedFiles: [...GRAFANA_13_NATIVE_SOURCES, ...GRAFANA_13_NATIVE_UI_SOURCES, 'packages/grafana-data/src/transformations/transformers/nulls/nullToUndefThreshold.ts'],
    })),
    pinnedGrafanaSourcePlugin({
      feature: 'testdata', entryAlias: 'grafana-provider13-testdata-runtime', entrypoint: 'datasource.ts',
      sourceRoot: resolve(grafanaSourceRoot, 'public/app/plugins/datasource/grafana-testdata-datasource'),
      reviewedFiles: GRAFANA_13_TESTDATA_SOURCE_FILES,
    }),
    pinnedGrafanaSourcePlugin({
      entryAlias: 'grafana-provider13-text-renderer',
      entrypoint: 'v1/TextPanel.tsx',
      sourceRoot: textSourceRoot,
    }),
    react(),
    bundleEvidencePlugin({ grafanaSourceRoot, repositoryRoot }),
  ],
  resolve: {
    dedupe: [
      'react',
      'react-dom',
      '@emotion/css',
      '@emotion/react',
      '@grafana/data',
      '@grafana/i18n',
      '@grafana/runtime',
      '@grafana/scenes',
      '@grafana/schema',
      '@grafana/ui',
      'rxjs',
      'uplot',
    ],
  },
});
