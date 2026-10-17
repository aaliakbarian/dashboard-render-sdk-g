// POC / EXPERIMENT / NOT FOR PRODUCTION
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin, type UserConfig } from 'vite';

import portalProviderConfig from '../portal-focus-zindex/vite.provider.config.ts';

const experimentRoot = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(experimentRoot, '../../..');
const inheritedBuild = portalProviderConfig.build ?? {};
const inheritedRollup = inheritedBuild.rollupOptions ?? {};
const inheritedOutput = Array.isArray(inheritedRollup.output) ? inheritedRollup.output[0] : inheritedRollup.output;

function providerAssetBaseTransform(): Plugin {
  return {
    enforce: 'pre',
    name: 'provider-assets-runtime-base',
    transform(code, id) {
      if (!id.replaceAll('\\', '/').endsWith('/experiments/styling/portal-focus-zindex/providerRuntime.tsx')) return;
      const original = "assetBasePath: '/grafana/public/',";
      if (!code.includes(original)) throw new Error('Pinned portal runtime asset-base seam changed.');
      const withAssetBase = code.replace(
        original,
        'assetBasePath: globalThis.__PROVIDER_ASSET_EXPERIMENT_CONFIG__!.assetBasePath,'
      );
      const catalog = "panelIds: ['text', 'stat', 'timeseries'] as const,";
      const preload = "Promise.all(['text', 'stat', 'timeseries'].map((id) => provider.panels.importPanelPlugin(id)))";
      if (!withAssetBase.includes(catalog) || !withAssetBase.includes(preload)) {
        throw new Error('Pinned portal runtime panel-selection seams changed.');
      }
      return withAssetBase
        .replace(catalog, 'panelIds: globalThis.__PROVIDER_ASSET_EXPERIMENT_CONFIG__!.panelIds,')
        .replace(preload, 'Promise.all(globalThis.__PROVIDER_ASSET_EXPERIMENT_CONFIG__!.panelIds.map((id) => provider.panels.importPanelPlugin(id)))');
    },
  };
}

export default defineConfig({
  ...(portalProviderConfig as UserConfig),
  base: './',
  root: experimentRoot,
  build: {
    ...inheritedBuild,
    emptyOutDir: true,
    outDir: resolve(repositoryRoot, 'artifacts/experiments/provider-assets/provider'),
    rollupOptions: {
      ...inheritedRollup,
      input: { provider: resolve(experimentRoot, 'providerEntry.ts') },
      output: {
        ...inheritedOutput,
        assetFileNames: 'assets/[name]-[hash][extname]',
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: '[name].js',
      },
    },
  },
  plugins: [providerAssetBaseTransform(), ...(portalProviderConfig.plugins ?? [])],
});
