import react from '@vitejs/plugin-react';
import { execFileSync } from 'node:child_process';
import { statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

import { bundleEvidencePlugin } from './build/bundleEvidencePlugin.ts';
import { forbiddenGrafanaImportPlugin } from './build/forbiddenGrafanaImportPlugin.ts';
import { pinnedGrafanaSourceTransformPlugin } from './build/pinnedGrafanaSourceTransformPlugin.ts';
import { textRendererOnlyImportsPlugin } from './build/textRendererOnlyImportsPlugin.ts';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const grafanaSourceDir = process.env.GRAFANA_SOURCE_DIR
  ? resolve(process.env.GRAFANA_SOURCE_DIR)
  : undefined;
const textExperimentEnabled = process.env.POC_TEXT_PANEL_EXPERIMENT === '1';
const textRendererOnlyExperimentEnabled =
  process.env.POC_TEXT_RENDERER_ONLY_EXPERIMENT === '1';
const testDataExperimentEnabled = process.env.POC_TESTDATA_DATASOURCE_EXPERIMENT === '1';
const expectedGrafanaCommit = '6193dc03311b631b9727b560d24369e683dc396e';
const reviewedTestDataSourceFiles = [
  'ConfigEditor.tsx',
  'LogIpsum.ts',
  'MetaDataInspector.tsx',
  'QueryEditor.tsx',
  'TestInfoTab.tsx',
  'components/CSVContentEditor.tsx',
  'components/CSVFileEditor.tsx',
  'components/CSVWaveEditor.tsx',
  'components/ErrorEditor.tsx',
  'components/ErrorWithSourceEditor.tsx',
  'components/ExemplarLabelsEditor.tsx',
  'components/ExemplarsEditor.tsx',
  'components/FlakyQueryEditor.tsx',
  'components/GrafanaLiveEditor.tsx',
  'components/NodeGraphEditor.tsx',
  'components/PredictablePulseEditor.tsx',
  'components/RandomWalkEditor.tsx',
  'components/RawFrameEditor.tsx',
  'components/SimulationQueryEditor.tsx',
  'components/SimulationSchemaForm.tsx',
  'components/StreamingClientEditor.tsx',
  'components/USAQueryEditor.tsx',
  'constants.ts',
  'dataquery.ts',
  'datasource.ts',
  'metricTree.ts',
  'module.tsx',
  'nodeGraphUtils.ts',
  'runStreams.ts',
  'testData/flameGraphResponse.ts',
  'testData/serviceMapResponse.ts',
  'testData/serviceMapResponseMedium.ts',
  'variables.ts',
] as const;
const reviewedStatSourceFiles = [
  'StatMigrations.ts',
  'StatPanel.tsx',
  'common.ts',
  'module.tsx',
  'panelcfg.gen.ts',
  'presets.ts',
  'suggestions.ts',
] as const;
const reviewedTimeSeriesSourceFiles = [
  'TimeSeriesPanel.tsx',
  'TimeSeriesTooltip.tsx',
  'panelcfg.gen.ts',
  'plugins/OutsideRangePlugin.tsx',
  'utils.ts',
] as const;
const reviewedCurrentTimeSeriesFiles = [
  'core/components/GraphNG/GraphNG.tsx',
  'core/components/GraphNG/types.ts',
  'core/components/GraphNG/utils.ts',
  'core/components/TimeSeries/TimeSeries.tsx',
  'core/components/TimeSeries/utils.ts',
] as const;

function verifyGrafanaSourceCheckout(sourceDir: string): void {
  statSync(resolve(sourceDir, 'public/app/plugins/panel/text/module.tsx'));
  if (testDataExperimentEnabled) {
    statSync(
      resolve(
        sourceDir,
        'public/app/plugins/datasource/grafana-testdata-datasource/module.tsx'
      )
    );
  }
  statSync(resolve(sourceDir, 'public/app/plugins/panel/stat/module.tsx'));
  const commit = execFileSync('git', ['-C', sourceDir, 'rev-parse', 'HEAD'], {
    encoding: 'utf8',
  }).trim();
  const dirty = execFileSync('git', ['-C', sourceDir, 'status', '--porcelain'], {
    encoding: 'utf8',
  }).trim();
  if (commit !== expectedGrafanaCommit) {
    throw new Error(
      `Task 8 requires Grafana source ${expectedGrafanaCommit}; observed ${commit || '<missing>'}.`
    );
  }
  if (dirty) {
    throw new Error('Task 8 P1 requires a clean Grafana source checkout.');
  }
}

if (textExperimentEnabled && !grafanaSourceDir) {
  throw new Error('POC_TEXT_PANEL_EXPERIMENT=1 requires GRAFANA_SOURCE_DIR.');
}
if (grafanaSourceDir) {
  verifyGrafanaSourceCheckout(grafanaSourceDir);
}

const reviewedSourceRoots = grafanaSourceDir
  ? [resolve(grafanaSourceDir, 'public/app/plugins/panel/text')]
  : [];
const reviewedSourceFiles = grafanaSourceDir
  ? [
      resolve(grafanaSourceDir, 'public/app/core/config'),
      resolve(grafanaSourceDir, 'public/app/core/config.ts'),
      resolve(grafanaSourceDir, 'public/app/features/panel/suggestions/utils'),
      resolve(grafanaSourceDir, 'public/app/features/panel/suggestions/utils.ts'),
      ...(textRendererOnlyExperimentEnabled
        ? [
            resolve(
              grafanaSourceDir,
              'public/app/plugins/panel/text/v1/TextPanel.tsx'
            ),
          ]
        : []),
      ...reviewedStatSourceFiles.map((file) =>
        resolve(grafanaSourceDir, 'public/app/plugins/panel/stat', file)
      ),
      ...reviewedTimeSeriesSourceFiles.map((file) =>
        resolve(grafanaSourceDir, 'public/app/plugins/panel/timeseries', file)
      ),
      ...reviewedCurrentTimeSeriesFiles.flatMap((file) => {
        const resolved = resolve(grafanaSourceDir, 'public/app', file);
        return [resolved, resolved.replace(/\.[^.]+$/, '')];
      }),
      ...(testDataExperimentEnabled
        ? reviewedTestDataSourceFiles.map((file) =>
            resolve(
              grafanaSourceDir,
              'public/app/plugins/datasource/grafana-testdata-datasource',
              file
            )
          )
        : []),
    ]
  : [];
const testDataSourceRoot =
  grafanaSourceDir && testDataExperimentEnabled
    ? resolve(grafanaSourceDir, 'public/app/plugins/datasource/grafana-testdata-datasource')
    : undefined;
const statSourceRoot = grafanaSourceDir
  ? resolve(grafanaSourceDir, 'public/app/plugins/panel/stat')
  : undefined;
const timeSeriesSourceRoot = grafanaSourceDir
  ? resolve(grafanaSourceDir, 'public/app/plugins/panel/timeseries')
  : undefined;
const textSourceRoot = grafanaSourceDir
  ? resolve(grafanaSourceDir, 'public/app/plugins/panel/text')
  : undefined;
const textRendererExperimentRoot = resolve(
  repositoryRoot,
  'experiments/bundle/text-renderer-only'
);

export default defineConfig({
  // This is the Task 5 dynamic Grafana cohort plus Task 6's direct RxJS boundary.
  // Pre-bundling this list prevents optimizer reloads during browser probes.
  optimizeDeps: {
    include: [
      '@grafana/data',
      '@grafana/i18n',
      '@grafana/runtime',
      '@grafana/runtime/unstable',
      '@grafana/scenes',
      '@grafana/schema',
      '@grafana/ui',
      // Task 6's BackendSrv adapter imports Observable directly. Declaring it
      // prevents Vite from discovering RxJS mid-probe and reloading the page.
      'rxjs',
      // Task 10 exact-source TestData direct imports. Declaring only these
      // bare imports avoids a mid-probe optimizer reload.
      'd3-random',
      'lodash',
      'react-use',
    ],
  },
  plugins: [
    ...(textRendererOnlyExperimentEnabled && textSourceRoot
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
      repositoryRoot,
      sourceBridgeFiles: reviewedSourceFiles,
      sourceBridgeRoots: [
        ...reviewedSourceRoots,
        ...(textRendererOnlyExperimentEnabled ? [textRendererExperimentRoot] : []),
      ],
      ...(textRendererOnlyExperimentEnabled
        ? { textRendererExperimentRoot }
        : {}),
    }),
    ...(testDataSourceRoot
      ? [
          pinnedGrafanaSourceTransformPlugin({
            entryAlias: 'grafana-poc-testdata-datasource',
            entrypoint: 'module.tsx',
            sourceRoot: testDataSourceRoot,
            virtualNamespace: 'testdata',
          }),
        ]
      : []),
    ...(textRendererOnlyExperimentEnabled && textSourceRoot
      ? [
          pinnedGrafanaSourceTransformPlugin({
            entryAlias: 'grafana-experiment-text-renderer',
            entrypoint: 'v1/TextPanel.tsx',
            sourceRoot: textSourceRoot,
            virtualNamespace: 'text-renderer-only',
          }),
        ]
      : []),
    ...(statSourceRoot
      ? [
          pinnedGrafanaSourceTransformPlugin({
            entryAlias: 'grafana-poc-stat-panel',
            entrypoint: 'module.tsx',
            sourceRoot: statSourceRoot,
            virtualNamespace: 'stat',
          }),
        ]
      : []),
    ...(timeSeriesSourceRoot
      ? [
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
    alias: grafanaSourceDir
      ? [
          {
            find: /^@grafana\/data\/internal$/,
            replacement: resolve(
              repositoryRoot,
              'packages/poc-grafana-bridge/src/internal/grafanaDataInternal.ts'
            ),
          },
          {
            find: /^@grafana\/ui\/internal$/,
            replacement: resolve(
              repositoryRoot,
              'packages/poc-grafana-bridge/src/internal/grafanaUiInternal.ts'
            ),
          },
          {
            find: /^app\/core\/components\/AssistantTooltip\/(?:AssistantTooltipButton|buildAssistantContext)$/,
            replacement: resolve(
              repositoryRoot,
              'packages/poc-grafana-bridge/src/panels/timeseriesAdapters.tsx'
            ),
          },
          {
            find: /^app\/features\/panel\/filters\/adhoc$/,
            replacement: resolve(
              repositoryRoot,
              'packages/poc-grafana-bridge/src/panels/timeseriesAdapters.tsx'
            ),
          },
          {
            find: /^app\/plugins\/panel\/(?:status-history\/utils|timeseries\/plugins\/utils)$/,
            replacement: resolve(
              repositoryRoot,
              'packages/poc-grafana-bridge/src/panels/timeseriesAdapters.tsx'
            ),
          },
          {
            find: '../../../plugins/panel/timeseries/plugins/utils',
            replacement: resolve(
              repositoryRoot,
              'packages/poc-grafana-bridge/src/panels/timeseriesAdapters.tsx'
            ),
          },
          {
            find: 'grafana-poc-ui-uplot-utils',
            replacement: resolve(
              repositoryRoot,
              'node_modules/@grafana/ui/dist/esm/components/uPlot/utils.mjs'
            ),
          },
          {
            find: 'grafana-poc-ui-gradient-fills',
            replacement: resolve(
              repositoryRoot,
              'node_modules/@grafana/ui/dist/esm/components/uPlot/config/gradientFills.mjs'
            ),
          },
          {
            find: 'grafana-poc-ui-plot-legend',
            replacement: resolve(
              repositoryRoot,
              'node_modules/@grafana/ui/dist/esm/components/uPlot/PlotLegend.mjs'
            ),
          },
          {
            find: 'grafana-poc-ui-tooltip-plugin',
            replacement: resolve(
              repositoryRoot,
              'node_modules/@grafana/ui/dist/esm/components/uPlot/plugins/TooltipPlugin2.mjs'
            ),
          },
          {
            find: 'grafana-poc-data-convert-field-type',
            replacement: resolve(
              repositoryRoot,
              'node_modules/@grafana/data/dist/esm/transformations/transformers/convertFieldType.mjs'
            ),
          },
          {
            find: 'grafana-poc-data-join-frames',
            replacement: resolve(
              repositoryRoot,
              'node_modules/@grafana/data/dist/esm/transformations/transformers/joinDataFrames.mjs'
            ),
          },
          {
            find: 'grafana-poc-data-field-overrides',
            replacement: resolve(
              repositoryRoot,
              'node_modules/@grafana/data/dist/esm/field/fieldOverrides.mjs'
            ),
          },
          {
            find: 'grafana-poc-data-null-to-undef',
            replacement: resolve(
              grafanaSourceDir,
              'packages/grafana-data/src/transformations/transformers/nulls/nullToUndefThreshold.ts'
            ),
          },
          ...(textRendererOnlyExperimentEnabled
            ? [
                {
                  find: /^app\/core\/config$/,
                  replacement: resolve(textRendererExperimentRoot, 'runtimeConfigViewOnly.ts'),
                },
              ]
            : []),
          { find: 'app', replacement: resolve(grafanaSourceDir, 'public/app') },
          {
            find: 'grafana-poc-text-panel',
            replacement: resolve(
              textRendererOnlyExperimentEnabled
                ? textRendererExperimentRoot
                : grafanaSourceDir,
              textRendererOnlyExperimentEnabled
                ? 'rendererOnly.ts'
                : 'public/app/plugins/panel/text/v1/module.tsx'
            ),
          },
        ]
      : undefined,
    dedupe: [
      'react',
      'react-dom',
      '@emotion/css',
      '@emotion/react',
      'rxjs',
      '@grafana/data',
      '@grafana/e2e-selectors',
      '@grafana/i18n',
      '@grafana/runtime',
      '@grafana/scenes',
      '@grafana/schema',
      '@grafana/ui',
    ],
  },
  build: textExperimentEnabled
    ? {
        rollupOptions: {
          input: {
            index: resolve(repositoryRoot, 'apps/poc-host/index.html'),
            task8Catalog: resolve(
              repositoryRoot,
              'packages/poc-grafana-bridge/src/panels/catalog.ts'
            ),
            task8Text: resolve(repositoryRoot, 'packages/poc-grafana-bridge/src/panels/text.ts'),
            task11Stat: resolve(repositoryRoot, 'packages/poc-grafana-bridge/src/panels/stat.ts'),
            task12TimeSeries: resolve(
              repositoryRoot,
              'packages/poc-grafana-bridge/src/panels/timeseries.ts'
            ),
            ...(testDataExperimentEnabled
              ? {
                  task10TestData: resolve(
                    repositoryRoot,
                    'packages/poc-grafana-bridge/src/datasources/testdata.ts'
                  ),
                }
              : {}),
          },
          preserveEntrySignatures: 'strict',
        },
      }
    : undefined,
  server: {
    allowedHosts: ['dev'],
    host: process.env.POC_VITE_HOST ?? 'localhost',
    port: 5173,
    strictPort: true,
    proxy: {
      '/grafana': {
        target: process.env.POC_GRAFANA_PROXY_TARGET ?? 'http://127.0.0.1:3000',
        changeOrigin: false,
        secure: false,
        ws: true,
      },
    },
  },
});
