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
import { textRendererOnlyImportsPlugin } from '../../../apps/poc-host/build/textRendererOnlyImportsPlugin.ts';
import {
  BASELINE_APPLICATION_SOURCES,
  GRAFANA_SOURCE_COMMIT,
  RENDERER_ONLY_APPLICATION_SOURCES,
  TEXT_BASELINE_ALIAS,
  TEXT_RENDERER_ALIAS,
} from './sourceIdentity.ts';

const experimentRoot = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(experimentRoot, '../../..');
const grafanaSourceDir = process.env.GRAFANA_SOURCE_DIR
  ? resolve(process.env.GRAFANA_SOURCE_DIR)
  : undefined;
const variant = process.env.TEXT_RENDERER_VARIANT ?? 'baseline';
if (variant !== 'baseline' && variant !== 'renderer-only') {
  throw new Error(`Unknown Text renderer experiment variant: ${variant}`);
}
const outputDirectory = process.env.TEXT_RENDERER_OUTPUT_DIR
  ? resolve(process.env.TEXT_RENDERER_OUTPUT_DIR)
  : resolve(repositoryRoot, `artifacts/experiments/text-renderer-only/${variant}`);

if (!grafanaSourceDir) {
  throw new Error('The Text renderer-only experiment requires GRAFANA_SOURCE_DIR.');
}

const applicationSources =
  variant === 'baseline' ? BASELINE_APPLICATION_SOURCES : RENDERER_ONLY_APPLICATION_SOURCES;
for (const source of applicationSources) {
  statSync(resolve(grafanaSourceDir, source));
}

const observedCommit = execFileSync('git', ['-C', grafanaSourceDir, 'rev-parse', 'HEAD'], {
  encoding: 'utf8',
}).trim();
const dirty = execFileSync('git', ['-C', grafanaSourceDir, 'status', '--porcelain'], {
  encoding: 'utf8',
}).trim();
if (observedCommit !== GRAFANA_SOURCE_COMMIT || dirty) {
  throw new Error('The Text renderer-only experiment requires the exact clean Grafana v13.2.3 source checkout.');
}

const textSourceRoot = resolve(grafanaSourceDir, 'public/app/plugins/panel/text');
const normalizedExperimentRoot = experimentRoot.replaceAll('\\', '/').replace(/\/$/, '');
const reviewedSourceFiles = applicationSources.flatMap((source) => {
  const absolute = resolve(grafanaSourceDir, source);
  return source === 'public/app/core/config.ts'
    ? [absolute, absolute.replace(/\.ts$/, '')]
    : [absolute];
});
if (variant === 'renderer-only') {
  // The guard sees the original specifier before the view-only resolver maps
  // this exact TextPanel dependency to runtimeConfigViewOnly.ts. Admitting the
  // resolution identity does not admit the file into the emitted graph; the
  // bundle assertions below enforce the exact two-file application closure.
  reviewedSourceFiles.push(
    resolve(grafanaSourceDir, 'public/app/core/config'),
    resolve(grafanaSourceDir, 'public/app/core/config.ts')
  );
}

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
        [variant === 'baseline' ? 'textBaseline' : 'textRendererOnly']: resolve(
          experimentRoot,
          variant === 'baseline' ? 'baseline.ts' : 'rendererOnly.ts'
        ),
      },
      ...(variant === 'renderer-only'
        ? {
            output: {
              manualChunks(id: string) {
                const normalized = id.replaceAll('\\', '/');
                if (
                  normalized.includes('poc-pinned-grafana-source:text-renderer-only:') ||
                  normalized === normalizedExperimentRoot ||
                  normalized.startsWith(`${normalizedExperimentRoot}/`)
                ) {
                  return 'text-renderer';
                }
                if (normalized.includes('/node_modules/')) {
                  return 'shared-dependencies';
                }
                return undefined;
              },
            },
          }
        : {}),
      preserveEntrySignatures: 'strict',
    },
  },
  plugins: [
    ...(variant === 'renderer-only'
      ? [textRendererOnlyImportsPlugin({ experimentRoot, repositoryRoot, sourceRoot: textSourceRoot })]
      : []),
    forbiddenGrafanaImportPlugin({
      repositoryRoot,
      sourceBridgeFiles: reviewedSourceFiles,
      sourceBridgeRoots: [experimentRoot],
      textRendererExperimentRoot: experimentRoot,
    }),
    pinnedGrafanaSourceTransformPlugin({
      entryAlias: variant === 'baseline' ? TEXT_BASELINE_ALIAS : TEXT_RENDERER_ALIAS,
      entrypoint: variant === 'baseline' ? 'v1/module.tsx' : 'v1/TextPanel.tsx',
      sourceRoot: textSourceRoot,
      virtualNamespace: variant === 'baseline' ? 'text-baseline' : 'text-renderer-only',
    }),
    react(),
    bundleEvidencePlugin({ repositoryRoot }),
  ],
  resolve: {
    alias:
      variant === 'baseline'
        ? [{ find: 'app', replacement: resolve(grafanaSourceDir, 'public/app') }]
        : [],
    dedupe: [
      'react',
      'react-dom',
      '@emotion/css',
      '@emotion/react',
      '@grafana/data',
      '@grafana/i18n',
      '@grafana/runtime',
      '@grafana/ui',
    ],
  },
});
