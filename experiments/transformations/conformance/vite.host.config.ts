// POC / EXPERIMENT / NOT FOR PRODUCTION
import react from '@vitejs/plugin-react';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';

import { bundleEvidencePlugin } from '../../../apps/poc-host/build/bundleEvidencePlugin.ts';

const experimentRoot = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(experimentRoot, '../../..');
const providerRoot = resolve(repositoryRoot, 'artifacts/experiments/transformation-conformance/provider');
const providerEntry = resolve(providerRoot, 'provider.js');
statSync(providerEntry);
const providerAssets = readdirSync(resolve(providerRoot, 'assets'));
const runtimeStyle = providerAssets.find((name) => /^providerRuntime-.*\.css$/.test(name));
const sharedStyles = providerAssets.filter((name) => /^(?:lib|provider-visualization)-.*\.css$/.test(name));
const fonts = providerAssets.filter((name) => /^Inter-(?:Regular|Medium)-.*\.woff2$/.test(name));
if (!runtimeStyle || sharedStyles.length !== 2 || fonts.length !== 2) {
  throw new Error('The exact transformation provider view asset closure was not emitted.');
}
const runtimeStyleName = runtimeStyle;
const preludeSource = resolve(repositoryRoot, 'experiments/security/strict-csp/host/csp-prelude.js');
const iconSource = resolve(repositoryRoot, '.grafana-source/grafana-v13.2.3/public/img/icons/unicons/times.svg');

function emitProviderAssets(): Plugin {
  return {
    name: 'transformation-conformance-audited-assets',
    generateBundle() {
      this.emitFile({ fileName: 'csp-prelude.js', source: readFileSync(preludeSource), type: 'asset' });
      for (const name of sharedStyles) {
        this.emitFile({ fileName: `assets/${name}`, source: readFileSync(resolve(providerRoot, 'assets', name)), type: 'asset' });
        this.emitFile({ fileName: `assets/assets/${name}`, source: readFileSync(resolve(providerRoot, 'assets', name)), type: 'asset' });
      }
      this.emitFile({ fileName: `assets/assets/${runtimeStyleName}`, source: readFileSync(resolve(providerRoot, 'assets', runtimeStyleName)), type: 'asset' });
      for (const name of fonts) {
        this.emitFile({ fileName: `assets/assets/${name}`, source: readFileSync(resolve(providerRoot, 'assets', name)), type: 'asset' });
      }
      this.emitFile({
        fileName: 'transformation-conformance-provider/build/img/icons/unicons/times.svg',
        source: readFileSync(iconSource),
        type: 'asset',
      });
    },
  };
}

function hostReactChunk(id: string): string | undefined {
  const normalized = id.replaceAll('\\', '/');
  return normalized.includes('/node_modules/react/') || normalized.includes('/node_modules/react-dom/') || normalized.includes('/node_modules/scheduler/')
    ? 'host-react'
    : undefined;
}

export default defineConfig({
  base: '/',
  root: resolve(experimentRoot, 'host'),
  build: {
    emptyOutDir: true,
    outDir: resolve(repositoryRoot, 'artifacts/experiments/transformation-conformance/root'),
    rollupOptions: {
      input: resolve(experimentRoot, 'host/index.html'),
      output: {
        codeSplitting: {
          groups: [{ debugName: 'host-owned-react', name: hostReactChunk, test: (id: string) => hostReactChunk(id) !== undefined }],
          includeDependenciesRecursively: false,
        },
      },
    },
  },
  plugins: [react(), emitProviderAssets(), bundleEvidencePlugin({ repositoryRoot })],
  resolve: {
    alias: [{ find: 'transformation-conformance-provider-artifact', replacement: providerEntry }],
    dedupe: ['react', 'react-dom'],
  },
});
