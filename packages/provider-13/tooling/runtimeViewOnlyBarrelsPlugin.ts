import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

import type { Plugin } from 'vite';

type GrafanaRuntimeBarrel = 'data' | 'i18n' | 'runtime' | 'scenes' | 'ui';

type GrafanaRuntimeViewSource =
  | GrafanaRuntimeBarrel
  | 'plugin-singleton'
  | 'scene-graph'
  | 'scene-variable-set'
  | 'viz-panel'
  | 'variable-utils';

const pinnedSourceHashes: Readonly<Record<GrafanaRuntimeViewSource, string>> = {
  data: 'ad7d332593acb8060252b49073b2e4cdc072b9efee75f073fd675d880953f671',
  i18n: '05d86ca63a9ed3484f1793f64587821d820821420b6ca16668afd10c541b5dc4',
  runtime: '036ca2d726f4452f3c272b9251da02dedeb7981915bd822e73b9448fe625bdac',
  scenes: '4f66ba54445d9c4df0911d07d8d5010e4c41146a1a242a8db550206128a55701',
  ui: '34e04f2c3b9d0b25460c3e48c7d4ccaff6f98924693ce7e12b264772d866577a',
  'plugin-singleton': '25a18df1c62d980d5877f48fcae4c40a559cd1431fa93782510c4b760696407f',
  'scene-graph': 'fc28e7214d5daf6968c8ad942e55ec793a98d62e101acf235317fe70c82506d4',
  'scene-variable-set': '9e9994fd7a5d2aa87ecca66a41d513569415d0d1572fda4aadf71eab7ed49d88',
  'viz-panel': 'e4e618533d95a714a0169a71e884f392ec3cecb30c4ce728dda2f134f2033f2a',
  'variable-utils': '39be8d56486094849db1b9f6c4c7d7ff87566aa64f7d329d1f52a60d1d5c6218',
};

function assertPinnedSourceIdentity(identity: GrafanaRuntimeViewSource, source: string): void {
  const actual = createHash('sha256').update(source).digest('hex');
  if (actual !== pinnedSourceHashes[identity]) {
    throw new Error(`The pinned Grafana 13.2.3 ${identity} source identity changed.`);
  }
}

const requiredExports: Readonly<Record<GrafanaRuntimeBarrel, readonly string[]>> = {
  data: [
    'alignTimeRangeCompareData', 'shouldAlignTimeCompare', 'DataFrameType', 'useDataLinksContext',
    'getDisplayValueAlignmentFactors', 'getFieldDisplayValues', 'getFieldColorModeForField', 'getFieldSeriesColor',
    'cacheFieldDisplayNames', 'getLinksSupplier', 'outerJoinDataFrames', 'applyNullInsertThreshold', 'roundDecimals',
    'isBooleanUnit', 'nullToValue',
    'VizOrientation', 'DataHoverEvent', 'DataHoverClearEvent', 'LegacyGraphHoverEvent', 'FALLBACK_COLOR', 'usePluginContext',
    'DataSourceApi', 'extractFacetedLabels', 'resolveFacetedFilterNames', 'DefaultTimeZone', 'colorManipulator', 'ThresholdsMode',
    'reduceField', 'fieldReducers', 'ReducerID', 'FIELD_NAME_FACET_KEY', 'InternalTimeZones', 'guessBrowserTimeZone',
    'guessDecimals', 'incrRoundDn', 'incrRoundUp', 'isLikelyAscendingVector', 'sortDataFrame', 'fieldColorModeRegistry', 'locale',
    'AlertState',
    'applyFieldOverrides',
    'availableIconsIndex',
    'BusEventBase',
    'BusEventWithPayload',
    'ByNamesMatcherMode',
    'compareArrayValues',
    'compareDataFrameStructures',
    'CoreApp',
    'DataFrameView',
    'DashboardCursorSync',
    'dateMath',
    'dateTime',
    'dateTimeFormat',
    'dateTimeParse',
    'DataLinkBuiltInVars',
    'DataTopic',
    'EventBusSrv',
    'escapeRegex',
    'deprecationWarning',
    'FieldColorModeId',
    'fieldMatchers',
    'FieldMatcherID',
    'FieldType',
    'formatLabels',
    'formattedValueToString',
    'getDefaultTimeRange',
    'getDisplayProcessor',
    'getFieldDisplayName',
    'getFieldDisplayValuesProxy',
    'getFrameDisplayName',
    'getPanelOptionsWithDefaults',
    'getThemeById',
    'getTimeZone',
    'getZone',
    'isSystemOverrideWithRef',
    'isIconName',
    'isDateTime',
    'LoadingState',
    'PanelPlugin',
    'preProcessPanelData',
    'PluginContextProvider',
    'PluginType',
    'rangeUtil',
    'Registry',
    'renderMarkdown',
    'SetPanelAttentionEvent',
    'setWeekStart',
    'store',
    'systemDateFormats',
    'ThemeContext',
    'textUtil',
    'toIconName',
    'toOption',
    'toUtc',
    'transformDataFrame',
    'urlUtil',
    'VariableRefresh',
  ],
  i18n: ['initPluginTranslations', 'LANGUAGES', 't', 'Trans'],
  runtime: [
    'PanelDataErrorView',
    'getRunRequest', 'toDataQueryError', 'isExpressionReference', 'getDataSourceSrv', 'getTemplateSrv',
    'config',
    'getAppEvents',
    'getBackendSrv',
    'getPluginImportUtils',
    'locationService',
    'RefreshEvent',
    'setAppEvents',
    'setBackendSrv',
    'setPluginImportUtils',
    'useLocationService',
  ],
  scenes: [
    'ConstantVariable',
    'loadResources',
    'SceneGridItem',
    'SceneGridLayout',
    'SceneObjectBase',
    'SceneReactObject',
    'SceneTimeRange',
    'SceneVariableSet',
    'VizPanel',
  ],
  ui: [
    'usePanelContext', 'ClickOutsideWrapper', 'Stack', 'Text', 'Popover', 'Spinner',
    'attachDebugger',
    'Button',
    'createLogger',
    'Field',
    'Icon',
    'IconButton',
    'MultiSelect',
    'PanelChrome',
    'PanelContextProvider',
    'SeriesVisibilityChangeMode',
    'Select',
    'Tooltip',
    'useStyles2',
    'useTheme2',
  ],
};

function projectNamedExport(line: string, symbols: readonly string[]): string | undefined {
  const match = /^(\s*export\s*\{)([^}]+)(\}\s*(?:from\s*['"][^'"]+['"])?;?\s*)$/.exec(line);
  if (!match) return undefined;
  const selected = (match[2] ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter((item) => {
      const exported = item.split(/\s+as\s+/).at(-1);
      return exported !== undefined && symbols.includes(exported);
    });
  return selected.length > 0 ? `${match[1]} ${selected.join(', ')} ${match[3]}` : undefined;
}

export function projectGrafana13RuntimeBarrel(
  barrel: GrafanaRuntimeBarrel,
  source: string
): string {
  assertPinnedSourceIdentity(barrel, source);
  const symbols = requiredExports[barrel];
  const selected = source.split(/\r?\n/).flatMap((line) => {
    if (barrel === 'data' && /^import \* as (?:datemath|rangeutil)\b/.test(line)) return [line];
    const projected = projectNamedExport(line, symbols);
    return projected ? [projected] : [];
  });
  const projected = `${selected.join('\n')}\n`;
  for (const symbol of symbols) {
    if (!new RegExp(`\\b${symbol}\\b`).test(projected)) {
      throw new Error(
        `The pinned Grafana 13.2.3 ${barrel === 'runtime' ? 'Runtime' : barrel} barrel no longer exports ${symbol}.`
      );
    }
  }
  return projected;
}

export function projectGrafana13ConstantVariableSet(source: string): string {
  assertPinnedSourceIdentity('scene-variable-set', source);
  const importLine = "import { AdHocFiltersVariable } from '../adhoc/AdHocFiltersVariable.js';\n";
  const adHocBranch = /      } else if \(localVar\) \{\n        if \(!\(variable instanceof AdHocFiltersVariable\)[\s\S]*?\n          return;\n        }\n      }/;
  if (!source.includes(importLine) || !adHocBranch.test(source)) {
    throw new Error('The pinned Grafana 13.2.3 SceneVariableSet source drifted.');
  }
  return source
    .replace(importLine, '')
    .replace(adHocBranch, '      } else if (localVar) {\n          return;\n        }');
}

export function projectGrafana13SceneGraph(source: string): string {
  assertPinnedSourceIdentity('scene-graph', source);
  const scopesImport = "import { ScopesVariable } from '../../variables/variants/ScopesVariable.js';\n";
  const scopesConstant = "import { SCOPES_VARIABLE_NAME } from '../../variables/constants.js';\n";
  const getScopes = /function getScopes\(sceneObject\) \{\n[\s\S]*?\n\}/;
  if (!source.includes(scopesImport) || !source.includes(scopesConstant) || !getScopes.test(source)) {
    throw new Error('The pinned Grafana 13.2.3 sceneGraph source drifted.');
  }
  return source
    .replace(scopesImport, '')
    .replace(scopesConstant, '')
    .replace(getScopes, 'function getScopes(_sceneObject) {\n  return void 0;\n}');
}

export function projectGrafana13PluginSingleton(source: string): string {
  assertPinnedSourceIdentity('plugin-singleton', source);
  if (
    !source.includes('function setPluginImportUtils') ||
    !source.includes('function getPluginImportUtils') ||
    !source.includes('window.System.import')
  ) {
    throw new Error('The pinned Grafana 13.2.3 Runtime plugin singleton source drifted.');
  }
  return `${source.slice(source.indexOf('let pluginImportUtils;'), source.indexOf('export {'))}\nexport { getPluginImportUtils, setPluginImportUtils };\n`;
}

export function projectGrafana13ViewOnlyVizPanel(source: string): string {
  assertPinnedSourceIdentity('viz-panel', source);
  const queryImports = [
    "import { wrapPromiseInStateObservable, registerQueryWithController } from '../../querying/registerQueryWithController.js';\n",
    "import { SceneDataTransformer } from '../../querying/SceneDataTransformer.js';\n",
    "import { SceneQueryRunner } from '../../querying/SceneQueryRunner.js';\n",
  ];
  const profiling = `        const queryControler = sceneGraph.getQueryController(this);
        if (queryControler && queryControler.state.enableProfiling) {
          wrapPromiseInStateObservable(panelPromise).pipe(registerQueryWithController({ type: \`VizPanel/loadPlugin/\${pluginId}\`, origin: this })).subscribe(() => {
          });
        }
`;
  const transformations = `    if (panel.transformations && $data) {
      if ($data instanceof SceneDataTransformer) {
        $data.setState({ transformations: panel.transformations });
      } else if ($data instanceof SceneQueryRunner) {
        $data.clearParent();
        $data = new SceneDataTransformer({
          transformations: panel.transformations,
          $data
        });
      }
    }
`;
  if (
    queryImports.some((line) => !source.includes(line)) ||
    !source.includes(profiling) ||
    !source.includes(transformations)
  ) {
    throw new Error('The pinned Grafana 13.2.3 VizPanel source drifted.');
  }
  let projected = source;
  for (const line of queryImports) projected = projected.replace(line, '');
  return projected.replace(profiling, '').replace(transformations, '');
}

export function projectGrafana13ViewOnlyVariableUtils(source: string): string {
  assertPinnedSourceIdentity('variable-utils', source);
  const sceneGraphImport = "import { sceneGraph } from '../core/sceneGraph/index.js';\n";
  const queryRunnerImport = "import { SceneQueryRunner } from '../querying/SceneQueryRunner.js';\n";
  const queryHelpers = /function getQueriesForVariables\(sourceObject\) \{[\s\S]*?\n\}\nfunction filterOutInactiveRunnerDuplicates\(runners\) \{[\s\S]*?\n\}\n/;
  const exportedQueryHelper = 'getQueriesForVariables, ';
  if (
    !source.includes(sceneGraphImport) ||
    !source.includes(queryRunnerImport) ||
    !queryHelpers.test(source) ||
    !source.includes(exportedQueryHelper)
  ) {
    throw new Error('The pinned Grafana 13.2.3 variable utilities source drifted.');
  }
  return source
    .replace(sceneGraphImport, '')
    .replace(queryRunnerImport, '')
    .replace(queryHelpers, '')
    .replace(exportedQueryHelper, '');
}

export function runtimeViewOnlyBarrelsPlugin(options: {
  readonly providerRoot: string;
  readonly repositoryRoot: string;
}): Plugin {
  const roots: Readonly<Record<GrafanaRuntimeBarrel, string>> = {
    data: resolve(options.repositoryRoot, 'node_modules/@grafana/data/dist/esm/index.mjs'),
    i18n: resolve(options.repositoryRoot, 'node_modules/@grafana/i18n/dist/esm/index.mjs'),
    runtime: resolve(options.repositoryRoot, 'node_modules/@grafana/runtime/dist/esm/index.mjs'),
    scenes: resolve(options.repositoryRoot, 'node_modules/@grafana/scenes/dist/esm/index.js'),
    ui: resolve(options.repositoryRoot, 'node_modules/@grafana/ui/dist/esm/index.mjs'),
  };
  const byPath = new Map(
    Object.entries(roots).map(([barrel, path]) => [path.replaceAll('\\', '/'), barrel as GrafanaRuntimeBarrel])
  );
  const pluginSingleton = resolve(
    options.repositoryRoot,
    'node_modules/@grafana/runtime/dist/esm/utils/plugin.mjs'
  ).replaceAll('\\', '/');
  const errorBoundaryShim = resolve(
    options.providerRoot,
    'tooling/viewOnly/runtimeUi.tsx'
  ).replaceAll('\\', '/');
  const sceneVariableSet = resolve(
    options.repositoryRoot,
    'node_modules/@grafana/scenes/dist/esm/variables/sets/SceneVariableSet.js'
  ).replaceAll('\\', '/');
  const sceneGraph = resolve(
    options.repositoryRoot,
    'node_modules/@grafana/scenes/dist/esm/core/sceneGraph/sceneGraph.js'
  ).replaceAll('\\', '/');
  const vizPanel = resolve(
    options.repositoryRoot,
    'node_modules/@grafana/scenes/dist/esm/components/VizPanel/VizPanel.js'
  ).replaceAll('\\', '/');
  const variableUtils = resolve(
    options.repositoryRoot,
    'node_modules/@grafana/scenes/dist/esm/variables/utils.js'
  ).replaceAll('\\', '/');

  return {
    name: 'provider-13-runtime-view-only-barrels',
    enforce: 'pre',
    transform(source, id) {
      const normalized = id.replaceAll('\\', '/').split('?')[0] ?? id;
      if (normalized === pluginSingleton) {
        return {
          code: projectGrafana13PluginSingleton(source),
          map: null,
        };
      }
      if (normalized === sceneVariableSet) {
        return { code: projectGrafana13ConstantVariableSet(source), map: null };
      }
      if (normalized === sceneGraph) {
        return { code: projectGrafana13SceneGraph(source), map: null };
      }
      if (normalized === vizPanel) {
        return { code: projectGrafana13ViewOnlyVizPanel(source), map: null };
      }
      if (normalized === variableUtils) {
        return { code: projectGrafana13ViewOnlyVariableUtils(source), map: null };
      }
      const barrel = byPath.get(normalized);
      if (!barrel) return null;
      const projected = projectGrafana13RuntimeBarrel(barrel, source);
      return {
        code: barrel === 'ui'
          ? `${projected}export { Grafana13ErrorBoundaryAlert as ErrorBoundaryAlert } from ${JSON.stringify(errorBoundaryShim)};\n`
          : projected,
        map: null,
      };
    },
  };
}
