// POC / EXPERIMENT / NOT FOR PRODUCTION
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin, type UserConfig } from 'vite';

import providerAssetConfig from '../../styling/provider-assets/vite.provider.config.ts';

const experimentRoot = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(experimentRoot, '../../..');
const inheritedBuild = providerAssetConfig.build ?? {};
const inheritedRollup = inheritedBuild.rollupOptions ?? {};
const inheritedOutput = Array.isArray(inheritedRollup.output) ? inheritedRollup.output[0] : inheritedRollup.output;

function providerEmotionNonceTransform(): Plugin {
  return {
    enforce: 'pre',
    name: 'strict-csp-provider-emotion-nonce',
    transform(code, id) {
      if (!id.replaceAll('\\', '/').endsWith('/experiments/styling/portal-focus-zindex/providerRuntime.tsx')) return;
      const original = "const providerCache = createCache({ key: 'grsdk-provider' });";
      if (!code.includes(original)) throw new Error('Pinned provider Emotion cache seam changed.');
      return code.replace(
        original,
        "const providerCache = createCache({ key: 'grsdk-provider', nonce: globalThis.__STRICT_CSP_PROVIDER_CONFIG__!.nonce });"
      );
    },
  };
}

export default defineConfig({
  ...(providerAssetConfig as UserConfig),
  base: './',
  root: experimentRoot,
  build: {
    ...inheritedBuild,
    emptyOutDir: true,
    outDir: resolve(repositoryRoot, 'artifacts/experiments/strict-csp/provider'),
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
  plugins: [providerEmotionNonceTransform(), ...(providerAssetConfig.plugins ?? [])],
});
