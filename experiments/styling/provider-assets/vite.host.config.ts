// POC / EXPERIMENT / NOT FOR PRODUCTION
import react from '@vitejs/plugin-react';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';

import { bundleEvidencePlugin } from '../../../apps/poc-host/build/bundleEvidencePlugin.ts';

const experimentRoot = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(experimentRoot, '../../..');
const providerRoot = resolve(repositoryRoot, 'artifacts/experiments/provider-assets/provider');
const providerEntry = resolve(providerRoot, 'provider.js');
statSync(providerEntry);
const providerArtifactAssets = readdirSync(resolve(providerRoot, 'assets'));
const providerRuntimeStyle = providerArtifactAssets.find((name) => /^providerRuntime-.*\.css$/.test(name));
const providerSharedStyles = providerArtifactAssets.filter((name) => /^(?:lib|provider-visualization)-.*\.css$/.test(name));
const providerFonts = providerArtifactAssets.filter((name) => /^Inter-(?:Regular|Medium)-.*\.woff2$/.test(name));
if (!providerRuntimeStyle || providerSharedStyles.length !== 2 || providerFonts.length !== 2) {
  throw new Error('The exact provider view asset closure was not emitted.');
}
const providerRuntimeStyleName = providerRuntimeStyle;
const iconSource = resolve(repositoryRoot, '.grafana-source/grafana-v13.2.3/public/img/icons/unicons/times.svg');

function emitAuditedProviderAssets(): Plugin {
  return {
    name: 'provider-assets-audited-static-closure',
    generateBundle() {
      for (const name of providerSharedStyles) {
        this.emitFile({ fileName: `assets/${name}`, source: readFileSync(resolve(providerRoot, 'assets', name)), type: 'asset' });
      }
      this.emitFile({
        fileName: `assets/assets/${providerRuntimeStyleName}`,
        source: readFileSync(resolve(providerRoot, 'assets', providerRuntimeStyleName)),
        type: 'asset',
      });
      for (const name of providerFonts) {
        this.emitFile({ fileName: `assets/assets/${name}`, source: readFileSync(resolve(providerRoot, 'assets', name)), type: 'asset' });
      }
      this.emitFile({
        fileName: 'provider-assets/build/img/icons/unicons/times.svg',
        source: readFileSync(iconSource),
        type: 'asset',
      });
    },
  };
}

function hostReactChunk(id: string): string | undefined {
  const normalized = id.replaceAll('\\', '/');
  if (normalized.includes('/node_modules/react/') || normalized.includes('/node_modules/react-dom/') || normalized.includes('/node_modules/scheduler/')) return 'host-react';
  return undefined;
}

export default defineConfig(() => {
  const profile = process.env.PROVIDER_ASSET_PROFILE === 'nested' ? 'nested' : 'root';
  const base = profile === 'nested' ? '/app/sdk/' : '/';
  const port = profile === 'nested' ? 5189 : 5188;
  return {
    base,
    define: { __PROVIDER_ASSET_PROFILE__: JSON.stringify(profile) },
    root: resolve(experimentRoot, 'host'),
    build: {
      emptyOutDir: true,
      outDir: resolve(repositoryRoot, `artifacts/experiments/provider-assets/${profile}`),
      rollupOptions: {
        input: resolve(experimentRoot, 'host/index.html'),
        output: {
          codeSplitting: { groups: [{ debugName: 'host-owned-react', name: hostReactChunk, test: (id: string) => hostReactChunk(id) !== undefined }], includeDependenciesRecursively: false },
        },
      },
    },
    plugins: [react(), emitAuditedProviderAssets(), bundleEvidencePlugin({ repositoryRoot })],
    preview: {
      host: process.env.POC_VITE_HOST ?? 'localhost',
      port,
      proxy: { '/grafana': { changeOrigin: false, target: process.env.POC_GRAFANA_PROXY_TARGET ?? 'http://grafana:3000' } },
      strictPort: true,
    },
    resolve: {
      alias: [
        { find: 'provider-assets-artifact', replacement: providerEntry },
      ],
      dedupe: ['react', 'react-dom'],
    },
  };
});
