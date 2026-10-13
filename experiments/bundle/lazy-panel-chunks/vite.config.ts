// POC / EXPERIMENT / NOT FOR PRODUCTION
import react from '@vitejs/plugin-react';
import { execFileSync } from 'node:child_process';
import { statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

import { bundleEvidencePlugin } from '../../../apps/poc-host/build/bundleEvidencePlugin.ts';
import { forbiddenGrafanaImportPlugin } from '../../../apps/poc-host/build/forbiddenGrafanaImportPlugin.ts';
import { pinnedGrafanaSourceTransformPlugin } from '../../../apps/poc-host/build/pinnedGrafanaSourceTransformPlugin.ts';
import { testDataRuntimeOnlyImportsPlugin } from '../../../apps/poc-host/build/testDataRuntimeOnlyImportsPlugin.ts';
import { textRendererOnlyImportsPlugin } from '../../../apps/poc-host/build/textRendererOnlyImportsPlugin.ts';
import { RUNTIME_ONLY_APPLICATION_SOURCES } from '../testdata-runtime-only/sourceIdentity.ts';
import {
  BASELINE_REVIEWED_APPLICATION_SOURCES,
  GRAFANA_SOURCE_COMMIT,
  REVIEWED_APPLICATION_SOURCES,
  STAT_RENDERER_ALIAS,
} from './sourceIdentity.ts';

const experimentRoot = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(experimentRoot, '../../..');
const grafanaSourceDir = process.env.GRAFANA_SOURCE_DIR
  ? resolve(process.env.GRAFANA_SOURCE_DIR)
  : undefined;
const variant = process.env.LAZY_PANEL_VARIANT ?? 'artifact';
if (variant !== 'artifact' && variant !== 'baseline' && variant !== 'browser') {
  throw new Error(`Unknown lazy-panel variant: ${variant}`);
}
if (!grafanaSourceDir) throw new Error('The lazy-panel experiment requires GRAFANA_SOURCE_DIR.');

const allSources = [
  ...REVIEWED_APPLICATION_SOURCES,
  ...(variant === 'browser' ? RUNTIME_ONLY_APPLICATION_SOURCES : []),
];
for (const source of allSources) statSync(resolve(grafanaSourceDir, source));
const observedCommit = execFileSync('git', ['-C', grafanaSourceDir, 'rev-parse', 'HEAD'], {
  encoding: 'utf8',
}).trim();
const dirty = execFileSync('git', ['-C', grafanaSourceDir, 'status', '--porcelain'], {
  encoding: 'utf8',
}).trim();
if (observedCommit !== GRAFANA_SOURCE_COMMIT || dirty) {
  throw new Error('The lazy-panel experiment requires the exact clean Grafana v13.2.3 checkout.');
}

const outputDirectory = process.env.LAZY_PANEL_OUTPUT_DIR
  ? resolve(process.env.LAZY_PANEL_OUTPUT_DIR)
  : resolve(repositoryRoot, `artifacts/experiments/lazy-panel-chunks/${variant}`);
const textSourceRoot = resolve(grafanaSourceDir, 'public/app/plugins/panel/text');
const statSourceRoot = resolve(grafanaSourceDir, 'public/app/plugins/panel/stat');
const timeSeriesSourceRoot = resolve(grafanaSourceDir, 'public/app/plugins/panel/timeseries');
const testDataSourceRoot = resolve(
  grafanaSourceDir,
  'public/app/plugins/datasource/grafana-testdata-datasource'
);
const testDataExperimentRoot = resolve(repositoryRoot, 'experiments/bundle/testdata-runtime-only');
const textRendererExperimentRoot = resolve(
  repositoryRoot,
  'experiments/bundle/text-renderer-only'
);
const baselineApplicationSources =
  variant === 'baseline' ? BASELINE_REVIEWED_APPLICATION_SOURCES : [];
const reviewedSourceFiles = allSources.flatMap((source) => {
  const absolute = resolve(grafanaSourceDir, source);
  return [absolute, absolute.replace(/\.[^.]+$/, '')];
});
reviewedSourceFiles.push(
  ...baselineApplicationSources.flatMap((source) => {
    const absolute = resolve(grafanaSourceDir, source);
    return [absolute, absolute.replace(/\.[^.]+$/, '')];
  }),
  resolve(grafanaSourceDir, 'public/app/core/config'),
  resolve(grafanaSourceDir, 'public/app/core/config.ts')
);

export default defineConfig({
  root: experimentRoot,
  build: {
    emptyOutDir: true,
    outDir: outputDirectory,
    rollupOptions: {
      ...(variant === 'browser'
        ? {}
        : { external: (id: string) => /^react(?:-dom)?(?:\/|$)/.test(id) }),
      input: {
        [variant === 'baseline'
          ? 'currentProviderBaseline'
          : variant === 'browser'
            ? 'index'
            : 'lazyPanelProvider']:
          resolve(
            experimentRoot,
            variant === 'baseline'
              ? 'baseline.ts'
              : variant === 'browser'
                ? 'index.html'
                : 'providerBootstrap.ts'
          ),
      },
      preserveEntrySignatures: 'strict',
    },
  },
  plugins: [
    ...(variant === 'browser'
      ? [
          testDataRuntimeOnlyImportsPlugin({
            experimentRoot: testDataExperimentRoot,
            publishedImportMode: 'cohort',
            repositoryRoot,
          }),
        ]
      : []),
    textRendererOnlyImportsPlugin({
      experimentRoot,
      publishedImportMode: variant === 'browser' ? 'cohort' : 'leaf',
      repositoryRoot,
      sourceRoot: textSourceRoot,
    }),
    ...(variant === 'baseline'
      ? [
          textRendererOnlyImportsPlugin({
            experimentRoot: textRendererExperimentRoot,
            publishedImportMode: 'cohort',
            repositoryRoot,
            sourceRoot: textSourceRoot,
          }),
        ]
      : []),
    forbiddenGrafanaImportPlugin({
      lazyPanelExperimentRoot: experimentRoot,
      repositoryRoot,
      sourceBridgeFiles: reviewedSourceFiles,
      sourceBridgeRoots: [
        experimentRoot,
        ...(variant === 'baseline' ? [textRendererExperimentRoot] : []),
        ...(variant === 'browser' ? [testDataExperimentRoot] : []),
      ],
      ...(variant === 'browser' ? { testDataRuntimeExperimentRoot: testDataExperimentRoot } : {}),
      textRendererExperimentRoot:
        variant === 'baseline' ? textRendererExperimentRoot : experimentRoot,
    }),
    ...(variant === 'browser'
      ? [
          pinnedGrafanaSourceTransformPlugin({
            entryAlias: 'grafana-experiment-testdata-runtime-source',
            entrypoint: 'datasource.ts',
            sourceRoot: testDataSourceRoot,
            virtualNamespace: 'testdata-runtime-only',
          }),
        ]
      : []),
    pinnedGrafanaSourceTransformPlugin({
      entryAlias: 'grafana-experiment-text-renderer',
      entrypoint: 'v1/TextPanel.tsx',
      sourceRoot: textSourceRoot,
      virtualNamespace: 'text-renderer-only',
    }),
    pinnedGrafanaSourceTransformPlugin({
      entryAlias: STAT_RENDERER_ALIAS,
      entrypoint: 'StatPanel.tsx',
      sourceRoot: statSourceRoot,
      virtualNamespace: 'stat',
    }),
    pinnedGrafanaSourceTransformPlugin({
      entryAlias: 'grafana-experiment-timeseries-renderer',
      entrypoint: 'TimeSeriesPanel.tsx',
      importReplacements: {
        './plugins/AnnotationsPlugin': resolve(repositoryRoot, 'packages/poc-grafana-bridge/src/panels/timeseriesAdapters.tsx'),
        './plugins/ExemplarsPlugin': resolve(repositoryRoot, 'packages/poc-grafana-bridge/src/panels/timeseriesAdapters.tsx'),
        './plugins/utils': resolve(repositoryRoot, 'packages/poc-grafana-bridge/src/panels/timeseriesAdapters.tsx'),
        '../status-history/utils': resolve(repositoryRoot, 'packages/poc-grafana-bridge/src/panels/timeseriesAdapters.tsx'),
        './suggestions': resolve(repositoryRoot, 'packages/poc-grafana-bridge/src/panels/timeseriesAdapters.tsx'),
      },
      sourceRoot: timeSeriesSourceRoot,
      virtualNamespace: 'timeseries',
    }),
    ...(variant === 'baseline'
      ? [
          pinnedGrafanaSourceTransformPlugin({
            entryAlias: 'grafana-poc-stat-panel',
            entrypoint: 'module.tsx',
            sourceRoot: statSourceRoot,
            virtualNamespace: 'stat',
          }),
          pinnedGrafanaSourceTransformPlugin({
            entryAlias: 'grafana-poc-timeseries-panel',
            entrypoint: 'TimeSeriesPanel.tsx',
            importReplacements: {
              './plugins/AnnotationsPlugin': resolve(
                repositoryRoot,
                'packages/poc-grafana-bridge/src/panels/timeseriesAdapters.tsx'
              ),
              './plugins/ExemplarsPlugin': resolve(
                repositoryRoot,
                'packages/poc-grafana-bridge/src/panels/timeseriesAdapters.tsx'
              ),
              './plugins/utils': resolve(
                repositoryRoot,
                'packages/poc-grafana-bridge/src/panels/timeseriesAdapters.tsx'
              ),
              '../status-history/utils': resolve(
                repositoryRoot,
                'packages/poc-grafana-bridge/src/panels/timeseriesAdapters.tsx'
              ),
              './suggestions': resolve(
                repositoryRoot,
                'packages/poc-grafana-bridge/src/panels/timeseriesAdapters.tsx'
              ),
            },
            sourceRoot: timeSeriesSourceRoot,
            virtualNamespace: 'timeseries',
          }),
        ]
      : []),
    react(),
    bundleEvidencePlugin({ repositoryRoot }),
  ],
  resolve: {
    alias: [
      {
        find: /^app\/core\/config$/,
        replacement: resolve(experimentRoot, 'runtimeConfigViewOnly.ts'),
      },
      ...(variant === 'baseline'
        ? [
            {
              find: 'grafana-poc-text-panel',
              replacement: resolve(textRendererExperimentRoot, 'rendererOnly.ts'),
            },
          ]
        : []),
      {
        find: /^@grafana\/data\/internal$/,
        replacement: resolve(repositoryRoot, 'packages/poc-grafana-bridge/src/internal/grafanaDataInternal.ts'),
      },
      {
        find: /^@grafana\/ui\/internal$/,
        replacement: resolve(repositoryRoot, 'packages/poc-grafana-bridge/src/internal/grafanaUiInternal.ts'),
      },
      {
        find: /^app\/core\/components\/AssistantTooltip\/(?:AssistantTooltipButton|buildAssistantContext)$/,
        replacement: resolve(repositoryRoot, 'packages/poc-grafana-bridge/src/panels/timeseriesAdapters.tsx'),
      },
      {
        find: /^app\/features\/panel\/filters\/adhoc$/,
        replacement: resolve(repositoryRoot, 'packages/poc-grafana-bridge/src/panels/timeseriesAdapters.tsx'),
      },
      {
        find: /^app\/plugins\/panel\/(?:status-history\/utils|timeseries\/plugins\/utils)$/,
        replacement: resolve(repositoryRoot, 'packages/poc-grafana-bridge/src/panels/timeseriesAdapters.tsx'),
      },
      {
        find: '../../../plugins/panel/timeseries/plugins/utils',
        replacement: resolve(repositoryRoot, 'packages/poc-grafana-bridge/src/panels/timeseriesAdapters.tsx'),
      },
      { find: 'grafana-poc-ui-uplot-utils', replacement: resolve(repositoryRoot, 'node_modules/@grafana/ui/dist/esm/components/uPlot/utils.mjs') },
      { find: 'grafana-poc-ui-gradient-fills', replacement: resolve(repositoryRoot, 'node_modules/@grafana/ui/dist/esm/components/uPlot/config/gradientFills.mjs') },
      { find: 'grafana-poc-ui-plot-legend', replacement: resolve(repositoryRoot, 'node_modules/@grafana/ui/dist/esm/components/uPlot/PlotLegend.mjs') },
      { find: 'grafana-poc-ui-tooltip-plugin', replacement: resolve(repositoryRoot, 'node_modules/@grafana/ui/dist/esm/components/uPlot/plugins/TooltipPlugin2.mjs') },
      { find: 'grafana-poc-data-convert-field-type', replacement: resolve(repositoryRoot, 'node_modules/@grafana/data/dist/esm/transformations/transformers/convertFieldType.mjs') },
      { find: 'grafana-poc-data-join-frames', replacement: resolve(repositoryRoot, 'node_modules/@grafana/data/dist/esm/transformations/transformers/joinDataFrames.mjs') },
      { find: 'grafana-poc-data-field-overrides', replacement: resolve(repositoryRoot, 'node_modules/@grafana/data/dist/esm/field/fieldOverrides.mjs') },
      { find: 'grafana-poc-data-null-to-undef', replacement: resolve(grafanaSourceDir, 'packages/grafana-data/src/transformations/transformers/nulls/nullToUndefThreshold.ts') },
      { find: 'app', replacement: resolve(grafanaSourceDir, 'public/app') },
    ],
    dedupe: [
      'react', 'react-dom', '@emotion/css', '@emotion/react', 'rxjs', '@grafana/data',
      '@grafana/i18n', '@grafana/runtime', '@grafana/scenes', '@grafana/schema', '@grafana/ui',
    ],
  },
  server: {
    host: process.env.POC_VITE_HOST ?? 'localhost',
    port: Number(process.env.LAZY_PANEL_PORT ?? 5180),
    strictPort: true,
    proxy: {
      '/grafana': {
        changeOrigin: false,
        target: process.env.POC_GRAFANA_PROXY_TARGET ?? 'http://grafana:3000',
      },
    },
  },
  preview: {
    host: process.env.POC_VITE_HOST ?? 'localhost',
    port: Number(process.env.LAZY_PANEL_PORT ?? 5180),
    strictPort: true,
    proxy: {
      '/grafana': {
        changeOrigin: false,
        target: process.env.POC_GRAFANA_PROXY_TARGET ?? 'http://grafana:3000',
      },
    },
  },
});
