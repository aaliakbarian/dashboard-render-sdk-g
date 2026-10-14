// POC / EXPERIMENT / NOT FOR PRODUCTION
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type UserConfig } from 'vite';

import sharedConfig from '../../bundle/shared-grafana-cohort/vite.config.ts';

const experimentRoot = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(experimentRoot, '../../..');
const port = Number(process.env.HOST_CSS_CONTAINMENT_PORT ?? 5184);
const base = sharedConfig as UserConfig;
const rollupOptions = typeof base.build?.rollupOptions === 'object' ? base.build.rollupOptions : {};

export default defineConfig({
  ...base,
  root: experimentRoot,
  build: {
    ...base.build,
    emptyOutDir: true,
    outDir: resolve(repositoryRoot, 'artifacts/experiments/host-css-containment/browser'),
    rollupOptions: {
      ...rollupOptions,
      input: { index: resolve(experimentRoot, 'index.html') },
    },
  },
  server: {
    ...base.server,
    port,
    strictPort: true,
  },
  preview: {
    ...base.preview,
    port,
    strictPort: true,
  },
});
