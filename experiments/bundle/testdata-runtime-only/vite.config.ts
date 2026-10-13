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
import {
  BASELINE_APPLICATION_SOURCES,
  GRAFANA_SOURCE_COMMIT,
  RUNTIME_ONLY_APPLICATION_SOURCES,
  TESTDATA_BASELINE_ALIAS,
  TESTDATA_RUNTIME_SOURCE_ALIAS,
} from './sourceIdentity.ts';

const experimentRoot = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(experimentRoot, '../../..');
const grafanaSourceDir = process.env.GRAFANA_SOURCE_DIR
  ? resolve(process.env.GRAFANA_SOURCE_DIR)
  : undefined;
const variant = process.env.TESTDATA_RUNTIME_VARIANT ?? 'baseline';
if (variant !== 'baseline' && variant !== 'runtime-only') {
  throw new Error(`Unknown TestData runtime experiment variant: ${variant}`);
}
if (!grafanaSourceDir) {
  throw new Error('The TestData runtime-only experiment requires GRAFANA_SOURCE_DIR.');
}

const outputDirectory = process.env.TESTDATA_RUNTIME_OUTPUT_DIR
  ? resolve(process.env.TESTDATA_RUNTIME_OUTPUT_DIR)
  : resolve(repositoryRoot, `artifacts/experiments/testdata-runtime-only/${variant}`);
const applicationSources =
  variant === 'baseline' ? BASELINE_APPLICATION_SOURCES : RUNTIME_ONLY_APPLICATION_SOURCES;
for (const source of applicationSources) statSync(resolve(grafanaSourceDir, source));

const observedCommit = execFileSync('git', ['-C', grafanaSourceDir, 'rev-parse', 'HEAD'], {
  encoding: 'utf8',
}).trim();
const dirty = execFileSync('git', ['-C', grafanaSourceDir, 'status', '--porcelain'], {
  encoding: 'utf8',
}).trim();
if (observedCommit !== GRAFANA_SOURCE_COMMIT || dirty) {
  throw new Error(
    'The TestData runtime-only experiment requires the exact clean Grafana v13.2.3 source checkout.'
  );
}

const sourceRoot = resolve(
  grafanaSourceDir,
  'public/app/plugins/datasource/grafana-testdata-datasource'
);
const reviewedSourceFiles = applicationSources.map((source) => resolve(grafanaSourceDir, source));
const normalizedExperimentRoot = experimentRoot.replaceAll('\\', '/').replace(/\/$/, '');

export default defineConfig({
  build: {
    emptyOutDir: true,
    outDir: outputDirectory,
    rollupOptions: {
      external: [
        'react',
        'react-dom',
        'react-dom/client',
        'react/jsx-runtime',
        'react/jsx-dev-runtime',
      ],
      input: {
        [variant === 'baseline' ? 'testdataBaseline' : 'testdataRuntimeOnly']: resolve(
          experimentRoot,
          variant === 'baseline' ? 'baseline.ts' : 'runtimeOnlyEntry.ts'
        ),
      },
      ...(variant === 'runtime-only'
        ? {
            output: {
              manualChunks(id: string) {
                const normalized = id.replaceAll('\\', '/');
                if (
                  normalized.includes('poc-pinned-grafana-source:testdata-runtime-only:') ||
                  normalized === `${normalizedExperimentRoot}/providerMetadata.ts` ||
                  normalized === `${normalizedExperimentRoot}/runtimeRuntimeOnly.ts`
                ) {
                  return 'testdata-runtime-provider';
                }
                if (normalized.includes('/node_modules/')) return 'shared-dependencies';
                return undefined;
              },
            },
          }
        : {}),
      preserveEntrySignatures: 'strict',
    },
  },
  plugins: [
    ...(variant === 'runtime-only'
      ? [testDataRuntimeOnlyImportsPlugin({ experimentRoot, repositoryRoot })]
      : []),
    forbiddenGrafanaImportPlugin({
      repositoryRoot,
      sourceBridgeFiles: reviewedSourceFiles,
      sourceBridgeRoots: [experimentRoot],
      testDataRuntimeExperimentRoot: experimentRoot,
    }),
    pinnedGrafanaSourceTransformPlugin({
      entryAlias:
        variant === 'baseline' ? TESTDATA_BASELINE_ALIAS : TESTDATA_RUNTIME_SOURCE_ALIAS,
      entrypoint: variant === 'baseline' ? 'module.tsx' : 'datasource.ts',
      sourceRoot,
      virtualNamespace: variant === 'baseline' ? 'testdata-baseline' : 'testdata-runtime-only',
    }),
    react(),
    bundleEvidencePlugin({ repositoryRoot }),
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
      '@grafana/schema',
      '@grafana/ui',
      'rxjs',
    ],
  },
});
