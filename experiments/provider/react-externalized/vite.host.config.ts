// POC / EXPERIMENT / NOT FOR PRODUCTION
import react from '@vitejs/plugin-react';
import { statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

import { bundleEvidencePlugin } from '../../../apps/poc-host/build/bundleEvidencePlugin.ts';

const experimentRoot = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(experimentRoot, '../../..');
const providerEntry = resolve(repositoryRoot, 'artifacts/experiments/react-externalized-provider/provider/provider.js');
statSync(providerEntry);

function hostChunk(id: string): string | undefined {
  const normalized = id.replaceAll('\\', '/');
  if (
    normalized.includes('/node_modules/react/') ||
    normalized.includes('/node_modules/react-dom/') ||
    normalized.includes('/node_modules/scheduler/')
  ) return 'host-react';
  return undefined;
}

export default defineConfig({
  root: resolve(experimentRoot, 'host'),
  build: {
    emptyOutDir: true,
    outDir: resolve(repositoryRoot, 'artifacts/experiments/react-externalized-provider/host'),
    rollupOptions: {
      input: resolve(experimentRoot, 'host/index.html'),
      output: {
        codeSplitting: {
          groups: [{
            debugName: 'host-owned-react',
            name: hostChunk,
            test: (id: string) => hostChunk(id) !== undefined,
          }],
          includeDependenciesRecursively: false,
        },
      },
      preserveEntrySignatures: 'allow-extension',
    },
  },
  plugins: [react(), bundleEvidencePlugin({ repositoryRoot })],
  preview: {
    host: process.env.POC_VITE_HOST ?? 'localhost',
    port: 5182,
    proxy: {
      '/grafana': {
        changeOrigin: false,
        target: process.env.POC_GRAFANA_PROXY_TARGET ?? 'http://grafana:3000',
      },
    },
    strictPort: true,
  },
  resolve: {
    alias: [{ find: 'react-externalized-provider-artifact', replacement: providerEntry }],
    dedupe: ['react', 'react-dom'],
  },
});
