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
  assertGrafana13SourceIdentity,
} from './tooling/sourceIdentity.ts';
import { textRendererOnlyImportsPlugin } from './tooling/textRendererOnlyImportsPlugin.ts';

const providerRoot = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(providerRoot, '../..');
const grafanaSourceRoot = process.env.GRAFANA_SOURCE_DIR
  ? resolve(process.env.GRAFANA_SOURCE_DIR)
  : undefined;

if (!grafanaSourceRoot) {
  throw new Error('Provider-13 build requires GRAFANA_SOURCE_DIR.');
}

for (const source of GRAFANA_13_APPLICATION_SOURCES) {
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
  if (normalized.includes('builtin:esm-external-require-react-dom')) {
    return 'provider-react-dom-external';
  }
  if (normalized.includes('builtin:esm-external-require-react')) {
    return 'provider-react-external';
  }
  if (normalized.includes('/node_modules/tslib/')) return 'provider-tslib';
  if (normalized.includes('/node_modules/uuid/')) return 'provider-uuid';
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
    textRendererOnlyImportsPlugin({ providerRoot, sourceRoot: textSourceRoot }),
    forbiddenGrafanaImportPlugin(),
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
