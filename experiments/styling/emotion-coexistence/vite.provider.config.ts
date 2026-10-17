// POC / EXPERIMENT / NOT FOR PRODUCTION
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type UserConfig } from 'vite';

import reactExternalizedConfig from '../../provider/react-externalized/vite.provider.config.ts';

const experimentRoot = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(experimentRoot, '../../..');
const inheritedBuild = reactExternalizedConfig.build ?? {};
const inheritedRollup = inheritedBuild.rollupOptions ?? {};
const inheritedOutput = Array.isArray(inheritedRollup.output) ? inheritedRollup.output[0] : inheritedRollup.output;

export default defineConfig({
  ...(reactExternalizedConfig as UserConfig),
  root: experimentRoot,
  build: {
    ...inheritedBuild,
    emptyOutDir: true,
    outDir: resolve(repositoryRoot, 'artifacts/experiments/emotion-coexistence/provider'),
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
});
