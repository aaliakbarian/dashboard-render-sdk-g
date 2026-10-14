// POC / EXPERIMENT / NOT FOR PRODUCTION
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, esmExternalRequirePlugin, type UserConfig } from 'vite';

import sharedCohortConfig from '../../bundle/shared-grafana-cohort/vite.config.ts';

const experimentRoot = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(experimentRoot, '../../..');
const sharedBuild = sharedCohortConfig.build ?? {};
const sharedRollup = sharedBuild.rollupOptions ?? {};
const { external: _experimentDExternal, ...providerRollup } = sharedRollup;
const sharedOutput = Array.isArray(sharedRollup.output) ? sharedRollup.output[0] : sharedRollup.output;

export default defineConfig({
  ...(sharedCohortConfig as UserConfig),
  root: experimentRoot,
  build: {
    ...sharedBuild,
    emptyOutDir: true,
    modulePreload: false,
    outDir: resolve(repositoryRoot, 'artifacts/experiments/react-externalized-provider/provider'),
    rollupOptions: {
      ...providerRollup,
      input: { provider: resolve(experimentRoot, 'entry.ts') },
      output: {
        ...sharedOutput,
        assetFileNames: 'assets/[name]-[hash][extname]',
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: '[name].js',
      },
    },
  },
  plugins: [
    esmExternalRequirePlugin({
      external: [/^react(?:-dom)?(?:\/|$)/],
    }),
    ...(sharedCohortConfig.plugins ?? []),
  ],
});
