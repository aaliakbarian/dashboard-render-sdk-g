// POC / EXPERIMENT / NOT FOR PRODUCTION
import react from '@vitejs/plugin-react';
import { execFileSync } from 'node:child_process';
import { statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin, type Rolldown } from 'vite';

import { bundleEvidencePlugin } from '../../../apps/poc-host/build/bundleEvidencePlugin.ts';
import { forbiddenGrafanaImportPlugin } from '../../../apps/poc-host/build/forbiddenGrafanaImportPlugin.ts';
import { pinnedGrafanaSourceTransformPlugin } from '../../../apps/poc-host/build/pinnedGrafanaSourceTransformPlugin.ts';
import { testDataRuntimeOnlyImportsPlugin } from '../../../apps/poc-host/build/testDataRuntimeOnlyImportsPlugin.ts';
import { textRendererOnlyImportsPlugin } from '../../../apps/poc-host/build/textRendererOnlyImportsPlugin.ts';
import { STAT_RENDERER_ALIAS } from '../lazy-panel-chunks/sourceIdentity.ts';
import { GRAFANA_SOURCE_COMMIT, REVIEWED_APPLICATION_SOURCES } from './sourceIdentity.ts';

const experimentRoot = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(experimentRoot, '../../..');
const lazyPanelRoot = resolve(repositoryRoot, 'experiments/bundle/lazy-panel-chunks');
const testDataRoot = resolve(repositoryRoot, 'experiments/bundle/testdata-runtime-only');
const grafanaSourceDir = process.env.GRAFANA_SOURCE_DIR
  ? resolve(process.env.GRAFANA_SOURCE_DIR)
  : undefined;
const variant = process.env.SHARED_COHORT_VARIANT ?? 'artifact';
if (variant !== 'artifact' && variant !== 'browser') {
  throw new Error(`Unknown shared-cohort variant: ${variant}`);
}
if (!grafanaSourceDir) throw new Error('The shared-cohort experiment requires GRAFANA_SOURCE_DIR.');

for (const source of REVIEWED_APPLICATION_SOURCES) statSync(resolve(grafanaSourceDir, source));
const observedCommit = execFileSync('git', ['-C', grafanaSourceDir, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const dirty = execFileSync('git', ['-C', grafanaSourceDir, 'status', '--porcelain'], { encoding: 'utf8' }).trim();
if (observedCommit !== GRAFANA_SOURCE_COMMIT || dirty) {
  throw new Error('The shared-cohort experiment requires the exact clean Grafana v13.2.3 checkout.');
}

const outputDirectory = process.env.SHARED_COHORT_OUTPUT_DIR
  ? resolve(process.env.SHARED_COHORT_OUTPUT_DIR)
  : resolve(repositoryRoot, `artifacts/experiments/shared-grafana-cohort/${variant}`);
const textSourceRoot = resolve(grafanaSourceDir, 'public/app/plugins/panel/text');
const statSourceRoot = resolve(grafanaSourceDir, 'public/app/plugins/panel/stat');
const timeSeriesSourceRoot = resolve(grafanaSourceDir, 'public/app/plugins/panel/timeseries');
const testDataSourceRoot = resolve(grafanaSourceDir, 'public/app/plugins/datasource/grafana-testdata-datasource');
const reviewedSourceFiles = REVIEWED_APPLICATION_SOURCES.flatMap((source) => {
  const absolute = resolve(grafanaSourceDir, source);
  return [absolute, absolute.replace(/\.[^.]+$/, '')];
});
reviewedSourceFiles.push(resolve(grafanaSourceDir, 'public/app/core/config'), resolve(grafanaSourceDir, 'public/app/core/config.ts'));

const editorOnlyModule = /(?:[\\/]monaco-editor[\\/]|[\\/]@monaco-editor[\\/]|[\\/]@codemirror[\\/]|[\\/]@uiw[\\/]react-codemirror[\\/]|[\\/]@grafana[\\/]ui[\\/]dist[\\/]esm[\\/]components[\\/](?:Monaco|CodeMirror)[\\/]|[\\/]@grafana[\\/]ui[\\/]dist[\\/]esm[\\/]themes[\\/]GlobalStyles[\\/]queryEditor\.mjs)/i;
const grafanaUiEsmModule = /[\\/]node_modules[\\/]@grafana[\\/]ui[\\/]dist[\\/]esm[\\/]/;
const grafanaUiBarrel = resolve(repositoryRoot, 'node_modules/@grafana/ui/dist/esm/index.mjs').replaceAll('\\', '/');

function viewOnlyGrafanaUiBarrel(): Plugin {
  let transformedUiBarrel = false;
  return {
    name: 'view-only-grafana-ui-barrel',
    enforce: 'pre',
    transform(code, id) {
      if (id.replaceAll('\\', '/').split('?')[0] !== grafanaUiBarrel) return null;
      transformedUiBarrel = true;
      const transformed = code.replace(
        /export\s*\{[^;]*?\}\s*from\s*['"]\.\/components\/(?:Monaco|CodeMirror)\/[^'"]+['"];?/g,
        ''
      )
        .replace(/import\s*['"]\.\/components\/Table\/Table\.mjs['"];?/g, '')
        .replace(
          /export\s*\{\s*GlobalStyles\s*\}\s*from\s*['"]\.\/themes\/GlobalStyles\/GlobalStyles\.mjs['"];?/g,
          ''
        )
        .replace(
          /export\s*\{[^;]*?\}\s*from\s*['"]\.\/components\/(?:QueryField\/QueryField|QueryInput\/QueryInput|DataLinks\/DataLinkInput|DataLinks\/DataLinksInlineEditor\/DataLinksInlineEditor(?:Base)?|Table\/TableCellInspector|Table\/TableRT\/Table)\.mjs['"];?/g,
          ''
        );
      if (transformed === code) {
        throw new Error('The pinned @grafana/ui barrel no longer contains the reviewed editor exports.');
      }
      return { code: transformed, map: null };
    },
    buildEnd() {
      if (!transformedUiBarrel) {
        throw new Error(`The reviewed @grafana/ui barrel was not transformed at ${grafanaUiBarrel}.`);
      }
    },
  };
}

function pruneUnreferencedEditorAssets(): Plugin {
  return {
    name: 'prune-unreferenced-editor-assets',
    generateBundle(_options, bundle) {
      const editorAssets = Object.values(bundle).filter(
        (entry): entry is Rolldown.OutputAsset =>
          entry.type === 'asset' && /(?:^|[\\/-])codicon[^/]*\.ttf$/i.test(entry.fileName)
      );
      for (const asset of editorAssets) {
        const references = Object.values(bundle).filter((entry) => {
          if (entry === asset) return false;
          const content = entry.type === 'chunk' ? entry.code : String(entry.source);
          return content.includes(asset.fileName) || content.includes(asset.fileName.split('/').at(-1) ?? asset.fileName);
        });
        if (references.length > 0) {
          throw new Error(`Editor asset unexpectedly remains reachable: ${asset.fileName} from ${references.map(({ fileName }) => fileName).join(', ')}`);
        }
        delete bundle[asset.fileName];
      }
    },
  };
}

function featureChunk(id: string): string | undefined {
  const normalized = id.replaceAll('\\', '/');
  if (normalized.includes('/shared-grafana-cohort/features/text.ts')) return 'feature-text';
  if (normalized.includes('/shared-grafana-cohort/features/stat.ts')) return 'feature-stat';
  if (normalized.includes('/shared-grafana-cohort/features/timeseries.ts')) return 'feature-timeseries';
  if (normalized.includes('/shared-grafana-cohort/features/testdata.ts')) return 'feature-testdata';
  return undefined;
}

function manualChunks(id: string): string | undefined {
  const feature = featureChunk(id);
  if (feature) return feature;
  const normalized = id.replaceAll('\\', '/');
  if (normalized.endsWith('/shared-grafana-cohort/sharedIdentity.ts')) return 'provider-cohort-identity';
  if (
    normalized.includes('/node_modules/react/') ||
    normalized.includes('/node_modules/react-dom/') ||
    normalized.includes('/node_modules/scheduler/')
  ) return 'host-react';
  if (normalized.includes('/node_modules/@grafana/scenes/')) return 'provider-scenes';
  if (/\/node_modules\/@grafana\/(?:data|ui|runtime|schema|i18n|e2e-selectors)\//.test(normalized)) return 'provider-grafana';
  if (normalized.includes('/node_modules/rxjs/')) return 'provider-rxjs';
  if (
    normalized.includes('/node_modules/@emotion/') ||
    normalized.includes('/node_modules/stylis/') ||
    normalized.includes('/node_modules/hoist-non-react-statics/') ||
    normalized.includes('/node_modules/react-is/')
  ) return 'provider-emotion';
  if (normalized.includes('/node_modules/uplot/')) return 'provider-visualization';
  return undefined;
}

export default defineConfig({
  root: experimentRoot,
  build: {
    emptyOutDir: true,
    outDir: outputDirectory,
    rollupOptions: {
      ...(variant === 'artifact'
        ? { external: (id: string) => /^react(?:-dom)?(?:\/|$)/.test(id) }
        : {}),
      input: {
        [variant === 'browser' ? 'index' : 'sharedGrafanaCohort']:
          resolve(experimentRoot, variant === 'browser' ? 'index.html' : 'providerBootstrap.ts'),
      },
      treeshake: {
        moduleSideEffects: (id: string) =>
          !editorOnlyModule.test(id) && !grafanaUiEsmModule.test(id),
      },
      output: {
        codeSplitting: {
          groups: [{
            debugName: 'shared-grafana-cohort-ownership',
            name: manualChunks,
            test: (id: string) => manualChunks(id) !== undefined,
          }],
          includeDependenciesRecursively: false,
        },
      },
      preserveEntrySignatures: 'allow-extension',
    },
  },
  plugins: [
    viewOnlyGrafanaUiBarrel(),
    testDataRuntimeOnlyImportsPlugin({
      experimentRoot: testDataRoot,
      publishedImportMode: 'cohort',
      repositoryRoot,
    }),
    textRendererOnlyImportsPlugin({
      experimentRoot: lazyPanelRoot,
      publishedImportMode: 'cohort',
      repositoryRoot,
      sourceRoot: textSourceRoot,
    }),
    forbiddenGrafanaImportPlugin({
      lazyPanelExperimentRoot: lazyPanelRoot,
      repositoryRoot,
      sourceBridgeFiles: reviewedSourceFiles,
      sourceBridgeRoots: [experimentRoot, lazyPanelRoot, testDataRoot],
      testDataRuntimeExperimentRoot: testDataRoot,
      textRendererExperimentRoot: lazyPanelRoot,
    }),
    pinnedGrafanaSourceTransformPlugin({
      entryAlias: 'grafana-experiment-testdata-runtime-source',
      entrypoint: 'datasource.ts',
      sourceRoot: testDataSourceRoot,
      virtualNamespace: 'testdata-runtime-only',
    }),
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
    react(),
    pruneUnreferencedEditorAssets(),
    bundleEvidencePlugin({ repositoryRoot }),
  ],
  resolve: {
    alias: [
      { find: /^app\/core\/config$/, replacement: resolve(lazyPanelRoot, 'runtimeConfigViewOnly.ts') },
      { find: /^@grafana\/data\/internal$/, replacement: resolve(repositoryRoot, 'packages/poc-grafana-bridge/src/internal/grafanaDataInternal.ts') },
      { find: /^@grafana\/ui\/internal$/, replacement: resolve(repositoryRoot, 'packages/poc-grafana-bridge/src/internal/grafanaUiInternal.ts') },
      { find: /^app\/core\/components\/AssistantTooltip\/(?:AssistantTooltipButton|buildAssistantContext)$/, replacement: resolve(repositoryRoot, 'packages/poc-grafana-bridge/src/panels/timeseriesAdapters.tsx') },
      { find: /^app\/features\/panel\/filters\/adhoc$/, replacement: resolve(repositoryRoot, 'packages/poc-grafana-bridge/src/panels/timeseriesAdapters.tsx') },
      { find: /^app\/plugins\/panel\/(?:status-history\/utils|timeseries\/plugins\/utils)$/, replacement: resolve(repositoryRoot, 'packages/poc-grafana-bridge/src/panels/timeseriesAdapters.tsx') },
      { find: '../../../plugins/panel/timeseries/plugins/utils', replacement: resolve(repositoryRoot, 'packages/poc-grafana-bridge/src/panels/timeseriesAdapters.tsx') },
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
    dedupe: ['react', 'react-dom', '@emotion/css', '@emotion/react', '@grafana/data', '@grafana/i18n', '@grafana/runtime', '@grafana/scenes', '@grafana/schema', '@grafana/ui', 'rxjs', 'uplot'],
  },
  server: {
    host: process.env.POC_VITE_HOST ?? 'localhost',
    port: Number(process.env.SHARED_COHORT_PORT ?? 5181),
    strictPort: true,
    proxy: { '/grafana': { changeOrigin: false, target: process.env.POC_GRAFANA_PROXY_TARGET ?? 'http://grafana:3000' } },
  },
  preview: {
    host: process.env.POC_VITE_HOST ?? 'localhost',
    port: Number(process.env.SHARED_COHORT_PORT ?? 5181),
    strictPort: true,
    proxy: { '/grafana': { changeOrigin: false, target: process.env.POC_GRAFANA_PROXY_TARGET ?? 'http://grafana:3000' } },
  },
});
