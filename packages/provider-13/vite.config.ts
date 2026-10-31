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
import { GRAFANA_13_NATIVE_SOURCES, GRAFANA_13_NATIVE_UI_SOURCES, GRAFANA_13_TABLE_UI_SOURCES } from './tooling/sourceIdentity.ts';
import { providerCohortChunk } from './tooling/providerCohortChunk.ts';

const providerRoot = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(providerRoot, '../..');
const grafanaSourceRoot = process.env.GRAFANA_SOURCE_DIR
  ? resolve(process.env.GRAFANA_SOURCE_DIR)
  : undefined;

if (!grafanaSourceRoot) {
  throw new Error('Provider-13 build requires GRAFANA_SOURCE_DIR.');
}

for (const source of [...GRAFANA_13_APPLICATION_SOURCES, ...GRAFANA_13_TESTDATA_SOURCES, ...GRAFANA_13_NATIVE_SOURCES, ...GRAFANA_13_NATIVE_UI_SOURCES, ...GRAFANA_13_TABLE_UI_SOURCES]) {
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
      ['grafana-provider13-stat-renderer', 'public/app/plugins/panel/stat/StatPanel.tsx', 'src/panels/statPlugin.ts'],
      ['grafana-provider13-timeseries-renderer', 'public/app/plugins/panel/timeseries/TimeSeriesPanel.tsx', 'src/panels/timeSeriesPlugin.ts'],
      ['grafana-provider13-gauge-renderer', 'public/app/plugins/panel/gauge/GaugePanel.tsx', 'src/panels/gaugePlugin.ts'],
      ['grafana-provider13-bargauge-renderer', 'public/app/plugins/panel/bargauge/BarGaugePanel.tsx', 'src/panels/barGaugePlugin.ts'],
      ['grafana-provider13-piechart-renderer', 'public/app/plugins/panel/piechart/PieChartPanel.tsx', 'src/panels/pieChartPlugin.ts'],
      ['grafana-provider13-barchart-renderer', 'public/app/plugins/panel/barchart/BarChartPanel.tsx', 'src/panels/barChartPlugin.ts'],
      ['grafana-provider13-table-renderer', 'public/app/plugins/panel/table/TablePanel.tsx', 'src/panels/tablePlugin.ts'],
      ['grafana-provider13-native-table-flat', 'packages/grafana-ui/src/components/Table/TableNG/TableFlat.tsx', 'src/runtime/viewOnly/tableUiUnstable.ts'],
      ['grafana-provider13-native-table-auto-cell', 'packages/grafana-ui/src/components/Table/TableNG/Cells/AutoCell.tsx', 'src/runtime/viewOnly/tableBasicCellRegistry.tsx'],
      ['grafana-provider13-native-null-to-undef', 'packages/grafana-data/src/transformations/transformers/nulls/nullToUndefThreshold.ts', 'tooling/viewOnly/nativeDataInternal.ts'],
    ].map(([entryAlias, entrypoint, allowedEntryImporter]) => pinnedGrafanaSourcePlugin({
      allowedEntryImporters: [resolve(providerRoot, allowedEntryImporter!)],
      feature: 'native', entryAlias: entryAlias!, entrypoint: entrypoint!, sourceRoot: grafanaSourceRoot,
      reviewedFiles: [...GRAFANA_13_NATIVE_SOURCES, ...GRAFANA_13_NATIVE_UI_SOURCES, ...GRAFANA_13_TABLE_UI_SOURCES, 'packages/grafana-data/src/transformations/transformers/nulls/nullToUndefThreshold.ts'],
    })),
    pinnedGrafanaSourcePlugin({
      allowedEntryImporters: [resolve(providerRoot, 'src/datasource/testDataPlugin.ts')],
      feature: 'testdata', entryAlias: 'grafana-provider13-testdata-runtime', entrypoint: 'datasource.ts',
      sourceRoot: resolve(grafanaSourceRoot, 'public/app/plugins/datasource/grafana-testdata-datasource'),
      reviewedFiles: GRAFANA_13_TESTDATA_SOURCE_FILES,
    }),
    pinnedGrafanaSourcePlugin({
      allowedEntryImporters: [resolve(providerRoot, 'src/panels/textPlugin.ts')],
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
