import react from '@vitejs/plugin-react';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

import { hostBundleEvidencePlugin } from './tooling/hostBundleEvidencePlugin.ts';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const grafanaProxy = {
  '/grafana': {
    target: process.env.POC_GRAFANA_PROXY_TARGET ?? 'http://127.0.0.1:3000',
    changeOrigin: false,
    secure: false,
    ws: true,
  },
};

function hostReactChunk(id: string): string | undefined {
  const normalized = id.replaceAll('\\', '/');
  if (
    normalized.includes('/node_modules/react/') ||
    normalized.includes('/node_modules/react-dom/') ||
    normalized.includes('/node_modules/scheduler/')
  ) return 'host-react';
  return undefined;
}

const providerArtifactChunkPrefixes = Object.freeze([
  ['provider-gauge-', 'feature-gauge'],
  ['provider-bargauge-', 'feature-bargauge'],
  ['provider-stat-', 'feature-stat'],
  ['provider-barchart-', 'feature-barchart'],
  ['provider-timeseries-shared-', 'provider-timeseries-shared'],
  ['provider-timeseries-', 'feature-timeseries'],
  ['provider-native-visualization-', 'provider-native-visualization'],
  ['provider-visualization-dependencies-', 'provider-visualization-dependencies'],
  ['queryScenes-', 'provider-query-scenes'],
  ['index.esm-', 'provider-ui-dependencies'],
  ['provider-react-dom-external-', 'provider-react-dom-external'],
  ['provider-react-external-', 'provider-react-external'],
  ['provider-scenes-dependencies-', 'provider-scenes-dependencies'],
  ['provider-scenes-', 'provider-scenes'],
  ['provider-grafana-', 'provider-grafana'],
  ['provider-rxjs-', 'provider-rxjs'],
  ['provider-emotion-', 'provider-emotion'],
  ['provider-visualization-', 'provider-visualization'],
  ['provider-tslib-', 'provider-tslib'],
  ['provider-uuid-', 'provider-uuid'],
  ['rolldown-runtime-', 'provider-rolldown-runtime'],
  ['esm-', 'provider-scenes-facade'],
  ['history-', 'provider-history'],
  ['micro-memoize-', 'provider-memoize'],
  ['runtimeUi-', 'provider-runtime-ui'],
  ['schemas-', 'provider-schemas'],
  ['string-hash-', 'provider-visualization-support'],
  ['Trans-', 'provider-i18n'],
  ['implementation-', 'provider-implementation'],
  ['textPlugin-', 'feature-text'],
  ['testDataPlugin-', 'feature-testdata-runtime'],
  ['installQueryRuntime-', 'provider-query-runtime'],
  ['queryServices-', 'provider-query-services'],
  ['queryData-', 'provider-query-data'],
  ['queryMonitoring-', 'provider-query-monitoring'],
  ['provider-query-dependencies-', 'provider-query-dependencies'],
] as const);

export function providerArtifactChunk(id: string): string | undefined {
  const normalized = id.replaceAll('\\', '/').split('?')[0] ?? '';
  const marker = '/artifacts/sdk/provider-13/assets/';
  const markerIndex = normalized.lastIndexOf(marker);
  if (markerIndex < 0) return undefined;
  const fileName = normalized.slice(markerIndex + marker.length);
  return providerArtifactChunkPrefixes.find(([prefix]) => fileName.startsWith(prefix))?.[1];
}

export default defineConfig({
  root: resolve(repositoryRoot, 'apps/sdk-host'),
  plugins: [react(), hostBundleEvidencePlugin(repositoryRoot)],
  resolve: {
    alias: [
      {
        find: /^@dashboard-render-sdk-g\/provider-13$/,
        replacement: resolve(repositoryRoot, 'artifacts/sdk/provider-13/provider.js'),
      },
    ],
    dedupe: ['react', 'react-dom'],
  },
  server: {
    allowedHosts: ['dev'],
    host: process.env.POC_VITE_HOST ?? 'localhost',
    port: 5173,
    strictPort: true,
    proxy: grafanaProxy,
  },
  preview: {
    allowedHosts: ['dev'],
    host: process.env.POC_VITE_HOST ?? 'localhost',
    port: 5173,
    strictPort: true,
    proxy: grafanaProxy,
  },
  build: {
    outDir: resolve(repositoryRoot, 'artifacts/sdk/host'),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        codeSplitting: {
          groups: [{
            debugName: 'host-owned-react',
            name: hostReactChunk,
            test: (id: string) => hostReactChunk(id) !== undefined,
          }, {
            debugName: 'provider-artifact-cohort-ownership',
            name: providerArtifactChunk,
            test: (id: string) => providerArtifactChunk(id) !== undefined,
          }],
          includeDependenciesRecursively: false,
        },
      },
      preserveEntrySignatures: 'allow-extension',
    },
  },
});
