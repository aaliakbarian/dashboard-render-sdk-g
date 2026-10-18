// POC / EXPERIMENT / NOT FOR PRODUCTION
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin, type UserConfig } from 'vite';

import styleLifecycleConfig from '../../styling/style-lifecycle/vite.provider.config.ts';

const experimentRoot = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(experimentRoot, '../../..');
const inheritedBuild = styleLifecycleConfig.build ?? {};
const inheritedRollup = inheritedBuild.rollupOptions ?? {};
const inheritedOutput = Array.isArray(inheritedRollup.output) ? inheritedRollup.output[0] : inheritedRollup.output;
const operatorPath = resolve(repositoryRoot, 'node_modules/@grafana/data/dist/esm/transformations/transformers/renameByRegex.mjs');
const registryPath = resolve(repositoryRoot, 'node_modules/@grafana/data/dist/esm/transformations/standardTransformersRegistry.mjs');
const transformDataFramePath = resolve(repositoryRoot, 'node_modules/@grafana/data/dist/esm/transformations/transformDataFrame.mjs');

function transformationConformanceRuntimeTransform(): Plugin {
  return {
    enforce: 'pre',
    name: 'transformation-conformance-runtime-adapter',
    transform(code, id) {
      if (!id.replaceAll('\\', '/').endsWith('/experiments/styling/portal-focus-zindex/providerRuntime.tsx')) return;
      const runtimeSeam = 'setRuntime(acquired);';
      if (!code.includes(runtimeSeam)) {
        throw new Error('Pinned transformation provider runtime seam changed.');
      }
      return `import { prepareTransformationConformanceRuntime, withTransformationConformance } from 'transformation-conformance-provider-adapter';\n${code}`
        .replace(runtimeSeam, 'await prepareTransformationConformanceRuntime(acquired);\n        setRuntime(withTransformationConformance(acquired));');
    },
  };
}

const inheritedAliases = Array.isArray(styleLifecycleConfig.resolve?.alias)
  ? styleLifecycleConfig.resolve.alias
  : Object.entries(styleLifecycleConfig.resolve?.alias ?? {}).map(([find, replacement]) => ({ find, replacement }));

export default defineConfig({
  ...(styleLifecycleConfig as UserConfig),
  base: './',
  root: experimentRoot,
  build: {
    ...inheritedBuild,
    emptyOutDir: true,
    outDir: resolve(repositoryRoot, 'artifacts/experiments/transformation-conformance/provider'),
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
  plugins: [...(styleLifecycleConfig.plugins ?? []), transformationConformanceRuntimeTransform()],
  resolve: {
    ...(styleLifecycleConfig.resolve ?? {}),
    alias: [
      ...inheritedAliases,
      { find: 'transformation-conformance-provider-adapter', replacement: resolve(experimentRoot, 'providerAdapter.ts') },
      { find: 'transformation-conformance-rename-by-regex', replacement: operatorPath },
      { find: 'transformation-conformance-registry', replacement: registryPath },
      { find: 'transformation-conformance-transform-data-frame', replacement: transformDataFramePath },
    ],
    dedupe: [...new Set([...(styleLifecycleConfig.resolve?.dedupe ?? []), '@grafana/data', 'react', 'react-dom', 'rxjs'])],
  },
});
