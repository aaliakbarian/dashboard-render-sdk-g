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
import { providerCohortChunk } from './tooling/providerCohortChunk.ts';

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
      ['grafana-provider13-piechart-renderer', 'public/app/plugins/panel/piechart/PieChartPanel.tsx'],
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
      '@visx/event',
      '@visx/gradient',
      '@visx/group',
      '@visx/shape',
      '@visx/tooltip',
      'rxjs',
      'uplot',
    ],
  },
});
