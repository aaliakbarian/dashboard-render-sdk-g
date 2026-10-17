// POC / EXPERIMENT / NOT FOR PRODUCTION
import react from '@vitejs/plugin-react';
import { readdirSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

import { bundleEvidencePlugin } from '../../../apps/poc-host/build/bundleEvidencePlugin.ts';

const experimentRoot = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(experimentRoot, '../../..');
const providerRoot = resolve(repositoryRoot, 'artifacts/experiments/portal-focus-zindex/provider');
const providerEntry = resolve(providerRoot, 'provider.js');
statSync(providerEntry);
const providerStyleName = readdirSync(resolve(providerRoot, 'assets')).find((name) => /^providerRuntime-.*\.css$/.test(name));
if (!providerStyleName) throw new Error('Portal provider stylesheet was not emitted.');
const providerStyle = resolve(providerRoot, 'assets', providerStyleName);

function hostReactChunk(id: string): string | undefined {
  const normalized = id.replaceAll('\\', '/');
  if (normalized.includes('/node_modules/react/') || normalized.includes('/node_modules/react-dom/') || normalized.includes('/node_modules/scheduler/')) return 'host-react';
  return undefined;
}

export default defineConfig({
  root: resolve(experimentRoot, 'host'),
  build: {
    emptyOutDir: true,
    outDir: resolve(repositoryRoot, 'artifacts/experiments/portal-focus-zindex/host'),
    rollupOptions: {
      input: resolve(experimentRoot, 'host/index.html'),
      output: {
        codeSplitting: { groups: [{ debugName: 'host-owned-react', name: hostReactChunk, test: (id: string) => hostReactChunk(id) !== undefined }], includeDependenciesRecursively: false },
      },
    },
  },
  plugins: [react(), bundleEvidencePlugin({ repositoryRoot })],
  preview: {
    host: process.env.POC_VITE_HOST ?? 'localhost',
    port: 5187,
    proxy: { '/grafana': { changeOrigin: false, target: process.env.POC_GRAFANA_PROXY_TARGET ?? 'http://grafana:3000' } },
    strictPort: true,
  },
  resolve: {
    alias: [
      { find: 'portal-focus-provider-artifact', replacement: providerEntry },
      { find: 'portal-focus-provider-style', replacement: providerStyle },
    ],
    dedupe: ['react', 'react-dom'],
  },
});
