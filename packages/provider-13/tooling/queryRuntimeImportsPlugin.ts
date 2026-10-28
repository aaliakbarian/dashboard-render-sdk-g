import { resolve } from 'node:path';
import type { Plugin } from 'vite';
const leaves: Readonly<Record<string, string>> = {
  'runtime-backend': '@grafana/runtime/dist/esm/utils/DataSourceWithBackend.mjs',
  backend: '@grafana/runtime/dist/esm/services/backendSrv.mjs',
  template: '@grafana/runtime/dist/esm/services/templateSrv.mjs',
  live: '@grafana/runtime/dist/esm/services/live.mjs',
  plugin: '@grafana/runtime/dist/esm/utils/plugin.mjs',
  'datasource-service': '@grafana/runtime/dist/esm/services/dataSourceSrv.mjs',
  runner: '@grafana/runtime/dist/esm/services/QueryRunner.mjs',
  logger: '@grafana/runtime/dist/esm/services/logging/registry.mjs',
  registration: '@grafana/runtime/dist/esm/services/dataSource/dataSource.mjs',
  fields: '@grafana/data/dist/esm/field/standardFieldConfigEditorRegistry.mjs',
  transformers: '@grafana/data/dist/esm/transformations/standardTransformersRegistry.mjs',
  rename: '@grafana/data/dist/esm/transformations/transformers/renameByRegex.mjs',
  processors: '@grafana/data/dist/esm/field/overrides/processors.mjs',
  'data-array': '@grafana/data/dist/esm/dataframe/ArrayDataFrame.mjs',
  'data-circular': '@grafana/data/dist/esm/dataframe/CircularDataFrame.mjs',
  'data-csv': '@grafana/data/dist/esm/utils/csv.mjs',
  'data-json': '@grafana/data/dist/esm/dataframe/DataFrameJSON.mjs',
  'data-datasource': '@grafana/data/dist/esm/types/datasource.mjs',
  'data-datasource-ref': '@grafana/data/dist/esm/utils/datasource.mjs',
  'data-utils': '@grafana/data/dist/esm/dataframe/utils.mjs',
  'data-live': '@grafana/data/dist/esm/types/live.mjs',
  'data-match': '@grafana/data/dist/esm/utils/matchPluginId.mjs',
  'data-mutable': '@grafana/data/dist/esm/dataframe/MutableDataFrame.mjs',
  'data-node-graph': '@grafana/data/dist/esm/utils/nodeGraph.mjs',
  'data-process': '@grafana/data/dist/esm/dataframe/processDataFrame.mjs',
  'data-types': '@grafana/data/dist/esm/types/data.mjs',
  'data-streaming': '@grafana/data/dist/esm/dataframe/StreamingDataFrame.mjs',
  'data-uuid': '@grafana/data/dist/esm/utils/uuid.mjs',
  'data-variable-types': '@grafana/data/dist/esm/types/variables.mjs',
  'data-variable-utils': '@grafana/data/dist/esm/utils/variables.mjs',
  'data-make-class': '@grafana/data/dist/esm/utils/makeClassES5Compatible.mjs',
  'data-plugin-context': '@grafana/data/dist/esm/context/plugins/usePluginContext.mjs',
  'data-theme': '@grafana/data/dist/esm/themes/createTheme.mjs',
  'data-extensions': '@grafana/data/dist/esm/types/pluginExtensions.mjs',
};
export function queryRuntimeImportsPlugin(options: { readonly providerRoot: string; readonly repositoryRoot: string }): Plugin {
  const provider = resolve(options.providerRoot).replaceAll('\\', '/');
  const view = (name: string) => resolve(provider, 'tooling/viewOnly', name);
  return { name: 'provider-13-query-runtime-imports', enforce: 'pre', resolveId(source, importer) {
    const id = importer?.replaceAll('\\', '/').split('?')[0] ?? '';
    if (source === 'grafana-provider13-query-services' && id === `${provider}/src/runtime/installQueryRuntime.ts`) return view('queryServices.ts');
    if (id.startsWith(`${provider}/tooling/viewOnly/`)) {
      const leaf = leaves[source.replace(/^grafana-provider13-query-/, '')];
      if (source.startsWith('grafana-provider13-query-') && leaf) return resolve(options.repositoryRoot, 'node_modules', leaf);
    }
    const testdata = id.startsWith('\0provider-13-pinned-grafana-source:testdata:');
    const runtime = /\/node_modules\/@grafana\/runtime\/dist\/esm\//.test(id);
    if (runtime && source.endsWith('/utils/logging.mjs')) return view('queryMonitoring.ts');
    if (source === '@grafana/runtime' && testdata) return view('queryRuntime.ts');
    if (source === '@grafana/data' && (testdata || runtime)) return view('queryData.ts');
    if (source === '../services/index.mjs' && id.endsWith('/@grafana/runtime/dist/esm/utils/DataSourceWithBackend.mjs')) return view('queryServicesInstalled.ts');
    return null;
  } };
}
