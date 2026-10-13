// POC / EXPERIMENT / NOT FOR PRODUCTION
import { resolve } from 'node:path';

import type { Plugin } from 'vite';

const SOURCE_NAMESPACE = '\0poc-pinned-grafana-source:testdata-runtime-only:';

export interface TestDataRuntimeOnlyImportsOptions {
  readonly experimentRoot: string;
  readonly publishedImportMode?: 'cohort' | 'leaf';
  readonly repositoryRoot: string;
}

function normalized(id: string | undefined): string {
  return (id ?? '').replaceAll('\\', '/').split('?')[0] ?? '';
}

function isExperimentImporter(importer: string | undefined, experimentRoot: string): boolean {
  const id = normalized(importer);
  const root = resolve(experimentRoot).replaceAll('\\', '/').replace(/\/$/, '');
  return id === root || id.startsWith(`${root}/`);
}

function isTestDataSourceImporter(importer: string | undefined): boolean {
  return normalized(importer).startsWith(SOURCE_NAMESPACE);
}

function isRuntimeImplementationImporter(importer: string | undefined): boolean {
  return /\/node_modules\/@grafana\/runtime\/dist\/esm\//.test(normalized(importer));
}

export function testDataRuntimeOnlyImportsPlugin({
  experimentRoot,
  publishedImportMode = 'leaf',
  repositoryRoot,
}: TestDataRuntimeOnlyImportsOptions): Plugin {
  const dataFacade = resolve(experimentRoot, publishedImportMode === 'cohort' ? 'browserCohortData.ts' : 'dataRuntimeOnly.ts');
  const runtimeFacade = resolve(experimentRoot, publishedImportMode === 'cohort' ? 'browserCohortRuntime.ts' : 'runtimeRuntimeOnly.ts');
  const uiFacade = resolve(experimentRoot, 'uiRuntimeOnly.ts');
  const leaves: Readonly<Record<string, string>> = {
    'grafana-experiment-data-array-frame': 'node_modules/@grafana/data/dist/esm/dataframe/ArrayDataFrame.mjs',
    'grafana-experiment-data-circular-frame': 'node_modules/@grafana/data/dist/esm/dataframe/CircularDataFrame.mjs',
    'grafana-experiment-data-csv': 'node_modules/@grafana/data/dist/esm/utils/csv.mjs',
    'grafana-experiment-data-dataframe-json': 'node_modules/@grafana/data/dist/esm/dataframe/DataFrameJSON.mjs',
    'grafana-experiment-data-datasource': 'node_modules/@grafana/data/dist/esm/types/datasource.mjs',
    'grafana-experiment-data-datasource-utils': 'node_modules/@grafana/data/dist/esm/utils/datasource.mjs',
    'grafana-experiment-data-deprecation': 'node_modules/@grafana/data/dist/esm/utils/deprecationWarning.mjs',
    'grafana-experiment-data-display': 'node_modules/@grafana/data/dist/esm/field/displayProcessor.mjs',
    'grafana-experiment-data-field-color': 'node_modules/@grafana/data/dist/esm/types/fieldColor.mjs',
    'grafana-experiment-data-frame-types': 'node_modules/@grafana/data/dist/esm/types/dataFrame.mjs',
    'grafana-experiment-data-frame-utils': 'node_modules/@grafana/data/dist/esm/dataframe/utils.mjs',
    'grafana-experiment-data-live': 'node_modules/@grafana/data/dist/esm/types/live.mjs',
    'grafana-experiment-data-match-plugin': 'node_modules/@grafana/data/dist/esm/utils/matchPluginId.mjs',
    'grafana-experiment-data-mutable-frame': 'node_modules/@grafana/data/dist/esm/dataframe/MutableDataFrame.mjs',
    'grafana-experiment-data-node-graph': 'node_modules/@grafana/data/dist/esm/utils/nodeGraph.mjs',
    'grafana-experiment-data-process-frame': 'node_modules/@grafana/data/dist/esm/dataframe/processDataFrame.mjs',
    'grafana-experiment-data-query': 'node_modules/@grafana/data/dist/esm/types/query.mjs',
    'grafana-experiment-data-runtime-types': 'node_modules/@grafana/data/dist/esm/types/data.mjs',
    'grafana-experiment-data-streaming-frame': 'node_modules/@grafana/data/dist/esm/dataframe/StreamingDataFrame.mjs',
    'grafana-experiment-data-store': 'node_modules/@grafana/data/dist/esm/utils/store.mjs',
    'grafana-experiment-data-theme': 'node_modules/@grafana/data/dist/esm/themes/createTheme.mjs',
    'grafana-experiment-data-theme-registry': 'node_modules/@grafana/data/dist/esm/themes/registry.mjs',
    'grafana-experiment-data-time-formats': 'node_modules/@grafana/data/dist/esm/datetime/formats.mjs',
    'grafana-experiment-data-use-plugin-context': 'node_modules/@grafana/data/dist/esm/context/plugins/usePluginContext.mjs',
    'grafana-experiment-data-url': 'node_modules/@grafana/data/dist/esm/utils/url.mjs',
    'grafana-experiment-data-uuid': 'node_modules/@grafana/data/dist/esm/utils/uuid.mjs',
    'grafana-experiment-data-variable-types': 'node_modules/@grafana/data/dist/esm/types/variables.mjs',
    'grafana-experiment-data-variable-utils': 'node_modules/@grafana/data/dist/esm/utils/variables.mjs',
    'grafana-experiment-data-make-class': 'node_modules/@grafana/data/dist/esm/utils/makeClassES5Compatible.mjs',
    'grafana-experiment-runtime-backend': 'node_modules/@grafana/runtime/dist/esm/services/backendSrv.mjs',
    'grafana-experiment-runtime-datasource-backend': 'node_modules/@grafana/runtime/dist/esm/utils/DataSourceWithBackend.mjs',
    'grafana-experiment-runtime-live': 'node_modules/@grafana/runtime/dist/esm/services/live.mjs',
    'grafana-experiment-runtime-template': 'node_modules/@grafana/runtime/dist/esm/services/templateSrv.mjs',
    'grafana-experiment-ui-debug': 'node_modules/@grafana/ui/dist/esm/utils/debug.mjs',
    'grafana-experiment-ui-logger': 'node_modules/@grafana/ui/dist/esm/utils/logger.mjs',
  };

  return {
    name: 'testdata-runtime-only-import-boundary',
    enforce: 'pre',
    resolveId(source, importer) {
      const leaf = leaves[source];
      if (leaf && isExperimentImporter(importer, experimentRoot)) {
        return resolve(repositoryRoot, leaf);
      }
      if (
        source === '@grafana/data' &&
        (isTestDataSourceImporter(importer) ||
          (publishedImportMode === 'leaf' && isRuntimeImplementationImporter(importer)))
      ) {
        return dataFacade;
      }
      if (source === '@grafana/runtime' && isTestDataSourceImporter(importer)) {
        return runtimeFacade;
      }
      if (
        publishedImportMode === 'leaf' &&
        source === '@grafana/ui' &&
        isRuntimeImplementationImporter(importer)
      ) {
        return uiFacade;
      }
      if (
        publishedImportMode === 'leaf' &&
        source === '../services/index.mjs' &&
        isRuntimeImplementationImporter(importer)
      ) {
        return resolve(experimentRoot, 'runtimeServicesAlreadyInstalled.ts');
      }
      return null;
    },
  };
}
