// POC / EXPERIMENT / NOT FOR PRODUCTION
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin, type Rolldown } from 'vite';

import { bundleEvidencePlugin } from '../../../apps/poc-host/build/bundleEvidencePlugin.ts';

const experimentRoot = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(experimentRoot, '../../..');
const operatorPath = resolve(
  repositoryRoot,
  'node_modules/@grafana/data/dist/esm/transformations/transformers/renameByRegex.mjs'
);

function provenancePlugin(): Plugin {
  return {
    name: 'transformation-conformance-provenance',
    generateBundle(_options, bundle) {
      const chunks = Object.values(bundle).filter(
        (entry): entry is Rolldown.OutputChunk => entry.type === 'chunk'
      );
      const operatorChunk = chunks.find((chunk) => operatorPath in chunk.modules);
      if (!operatorChunk) throw new Error('The exact renameByRegex module was not emitted.');
      this.emitFile({
        fileName: 'evidence/provenance.json',
        source: `${JSON.stringify(
          {
            emittedChunk: operatorChunk.fileName,
            emittedChunkSha256: createHash('sha256').update(operatorChunk.code).digest('hex'),
            grafanaDataVersion: '13.2.3',
            operatorSourceSha256: '0b8d1926d4da5e14e7812993f4ffcd10cdd63634af3a9f0d70c783816f1b9c35',
            providerExperimentIdentity: 'transformation-conformance-v1',
            sourceCommit: '6193dc03311b631b9727b560d24369e683dc396e',
            sourcePath: 'packages/grafana-data/src/transformations/transformers/renameByRegex.ts',
            transformId: 'renameByRegex',
          },
          null,
          2
        )}\n`,
        type: 'asset',
      });
    },
  };
}

export default defineConfig({
  build: {
    emptyOutDir: true,
    lib: {
      entry: resolve(experimentRoot, 'capabilityArtifact.ts'),
      formats: ['es'],
      fileName: () => 'capability.js',
    },
    outDir: resolve(repositoryRoot, 'artifacts/experiments/transformation-conformance/capability'),
    rollupOptions: {
      output: {
        assetFileNames: 'assets/[name]-[hash][extname]',
        chunkFileNames: 'assets/[name]-[hash].js',
      },
    },
  },
  plugins: [bundleEvidencePlugin({ repositoryRoot }), provenancePlugin()],
  resolve: {
    alias: {
      'transformation-conformance-rename-by-regex': operatorPath,
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
});
