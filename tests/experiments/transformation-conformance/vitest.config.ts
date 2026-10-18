// POC / EXPERIMENT / NOT FOR PRODUCTION
import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

const repositoryRoot = resolve(import.meta.dirname, '../../..');

export default defineConfig({
  resolve: {
    alias: {
      'transformation-conformance-rename-by-regex': resolve(
        repositoryRoot,
        'node_modules/@grafana/data/dist/esm/transformations/transformers/renameByRegex.mjs'
      ),
      'transformation-conformance-registry': resolve(
        repositoryRoot,
        'node_modules/@grafana/data/dist/esm/transformations/standardTransformersRegistry.mjs'
      ),
      'transformation-conformance-transform-data-frame': resolve(
        repositoryRoot,
        'node_modules/@grafana/data/dist/esm/transformations/transformDataFrame.mjs'
      ),
    },
    dedupe: ['@grafana/data', 'rxjs'],
  },
  test: {
    deps: { interopDefault: true },
    environment: 'node',
    exclude: ['tests/experiments/transformation-conformance/browser.spec.ts'],
    include: ['tests/experiments/transformation-conformance/*.spec.ts'],
    pool: 'vmThreads',
    setupFiles: ['tests/experiments/transformation-conformance/setup.ts'],
  },
});
