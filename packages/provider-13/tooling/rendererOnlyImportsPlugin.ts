import { posix, resolve } from 'node:path';
import type { Plugin } from 'vite';
import { GRAFANA_13_NATIVE_SOURCES, GRAFANA_13_TABLE_UI_SOURCES } from './sourceIdentity.ts';

const prefix = '\0provider-13-pinned-grafana-source:native:';
const leaves: Readonly<Record<string, string>> = {
  'ui-bar-gauge': '@grafana/ui/dist/esm/components/BarGauge/BarGauge.mjs',
  'ui-viz-legend': '@grafana/ui/dist/esm/components/VizLegend/VizLegend.mjs',
  'ui-viz-legend-types': '@grafana/ui/dist/esm/components/VizLegend/types.mjs',
  'ui-series-table': '@grafana/ui/dist/esm/components/VizTooltip/SeriesTable.mjs',
  'ui-big-value': '@grafana/ui/dist/esm/components/BigValue/BigValue.mjs',
  'ui-data-links-menu': '@grafana/ui/dist/esm/components/DataLinks/DataLinksContextMenu.mjs',
  'ui-repeater': '@grafana/ui/dist/esm/components/VizRepeater/VizRepeater.mjs',
  'ui-layout': '@grafana/ui/dist/esm/components/VizLayout/VizLayout.mjs',
  'ui-event-bus': '@grafana/ui/dist/esm/components/uPlot/plugins/EventBusPlugin.mjs',
  'ui-keyboard': '@grafana/ui/dist/esm/components/uPlot/plugins/KeyboardPlugin.mjs',
  'ui-xaxis': '@grafana/ui/dist/esm/components/uPlot/plugins/XAxisInteractionAreaPlugin.mjs',
  'ui-tooltip-content': '@grafana/ui/dist/esm/components/VizTooltip/VizTooltipContent.mjs',
  'ui-tooltip-footer': '@grafana/ui/dist/esm/components/VizTooltip/VizTooltipFooter.mjs',
  'ui-tooltip-header': '@grafana/ui/dist/esm/components/VizTooltip/VizTooltipHeader.mjs',
  'ui-tooltip-wrapper': '@grafana/ui/dist/esm/components/VizTooltip/VizTooltipWrapper.mjs',
  'ui-tooltip-utils': '@grafana/ui/dist/esm/components/VizTooltip/utils.mjs',
  'ui-measure-text': '@grafana/ui/dist/esm/utils/measureText.mjs',
  'ui-uplot-axis': '@grafana/ui/dist/esm/components/uPlot/config/UPlotAxisBuilder.mjs',
  'ui-uplot-types': '@grafana/ui/dist/esm/components/uPlot/types.mjs',
  'ui-theme-mixins': '@grafana/ui/dist/esm/themes/mixins.mjs',
  'query-runner': '@grafana/scenes/dist/esm/querying/SceneQueryRunner.js',
  'data-transformer': '@grafana/scenes/dist/esm/querying/SceneDataTransformer.js',
  'convert-field': '@grafana/data/dist/esm/transformations/transformers/convertFieldType.mjs',
  'join-frames': '@grafana/data/dist/esm/transformations/transformers/joinDataFrames.mjs',
  'field-overrides': '@grafana/data/dist/esm/field/fieldOverrides.mjs',
  'plot-legend': '@grafana/ui/dist/esm/components/uPlot/PlotLegend.mjs',
  'uplot-chart': '@grafana/ui/dist/esm/components/uPlot/Plot.mjs',
  'uplot-config': '@grafana/ui/dist/esm/components/uPlot/config/UPlotConfigBuilder.mjs',
  'scale-key': '@grafana/ui/dist/esm/graveyard/GraphNG/utils.mjs',
  'gradient-fills': '@grafana/ui/dist/esm/components/uPlot/config/gradientFills.mjs',
  'tooltip-plugin': '@grafana/ui/dist/esm/components/uPlot/plugins/TooltipPlugin2.mjs',
  'uplot-utils': '@grafana/ui/dist/esm/components/uPlot/utils.mjs',
};
const absentIntegrations = new Set([
  './plugins/AnnotationsPlugin', './plugins/ExemplarsPlugin', './plugins/utils', '../status-history/utils', './suggestions',
  '../../../plugins/panel/timeseries/plugins/utils',
  'app/core/components/TimelineChart/utils',
  'app/core/components/AssistantTooltip/AssistantTooltipButton', 'app/core/components/AssistantTooltip/buildAssistantContext',
  'app/features/panel/filters/adhoc',
]);
export function rendererOnlyImportsPlugin(options: { readonly providerRoot: string; readonly repositoryRoot: string; readonly sourceRoot: string }): Plugin {
  const provider = resolve(options.providerRoot).replaceAll('\\', '/');
  const view = (name: string) => resolve(provider, 'tooling/viewOnly', name);
  const tableView = (name: string) => resolve(provider, 'src/runtime/viewOnly', name);
  return { name: 'provider-13-native-renderer-only-imports', enforce: 'pre', resolveId(source, importer) {
    const id = importer?.replaceAll('\\', '/').split('?')[0] ?? '';
    if (source === '../Portal' && /\/node_modules\/@visx\/tooltip\/(?:esm|lib)\/hooks\/useTooltipInPortal\.js$/.test(id)) {
      return view('controlledVisxPortal.tsx');
    }
    if (source === 'uplot/dist/uPlot.min.css' && id === resolve(options.repositoryRoot, 'node_modules/@grafana/ui/dist/esm/components/uPlot/Plot.mjs').replaceAll('\\', '/')) return '\0provider-13-native-css-owned-by-scene';
    if (id === resolve(options.repositoryRoot, 'node_modules/@grafana/scenes/dist/esm/querying/SceneQueryRunner.js').replaceAll('\\', '/') && [
      '../variables/adhoc/AdHocFiltersVariable.js', '../variables/groupby/GroupByVariable.js', '../variables/DrilldownDependenciesManager.js',
    ].includes(source)) return view('queryInert.ts');
    if (source === 'grafana-provider13-data-panel-plugin' && /^.+\/src\/panels\/(?:statPlugin|timeSeriesPlugin|gaugePlugin|barGaugePlugin|pieChartPlugin|barChartPlugin|tablePlugin)\.ts$/.test(id) && id.startsWith(`${provider}/`)) return resolve(options.repositoryRoot, 'node_modules/@grafana/data/dist/esm/panel/PanelPlugin.mjs');
    if (source === 'grafana-provider13-query-scenes' && id === `${provider}/src/runtime/implementation.tsx`) return view('queryScenes.ts');
    if (id.startsWith(`${provider}/tooling/viewOnly/`)) {
      if (source === 'grafana-provider13-native-radial-gauge') return `${prefix}packages/grafana-ui/src/components/RadialGauge/RadialGauge.tsx.js`;
      const leaf = leaves[source.replace(/^grafana-provider13-native-/, '')];
      if (source.startsWith('grafana-provider13-native-') && leaf) return resolve(options.repositoryRoot, 'node_modules', leaf);
    }
    if (!id.startsWith(prefix)) return null;
    const tablePanel = id === `${prefix}public/app/plugins/panel/table/TablePanel.tsx.js`;
    const tableUi = id.startsWith(`${prefix}packages/grafana-ui/src/components/Table/TableNG/`);
    if (tablePanel) {
      if (source === '@grafana/ui') return tableView('tablePanelUi.tsx');
      if (source === '@grafana/ui/unstable') return tableView('tableUiUnstable.ts');
      if (source === 'app/features/table/hooks') return tableView('tablePanelHooks.ts');
      if (source === 'app/features/table/utils') return tableView('tablePanelUtils.ts');
      if (source === './migrations') return tableView('tableMigrations.ts');
    }
    if (tableUi) {
      const current = id.slice(prefix.length).replace(/\.js$/, '');
      if (source.startsWith('.')) {
        const requested = posix.normalize(posix.join(posix.dirname(current), source));
        const reviewed = GRAFANA_13_TABLE_UI_SOURCES.find((file) => file.replace(/\.tsx?$/, '') === requested);
        if (reviewed) return `${prefix}${reviewed}.js`;
      }
      if (source === '@grafana/react-data-grid/lib/styles.css') return '\0provider-13-table-data-grid-css-owned-by-scene';
      if (source === './Cells/renderers') return tableView('tableBasicCellRegistry.tsx');
      if (source === '../components/MaybeWrapWithLink') return tableView('tableOptional.tsx');
      if (['../../Pagination/Pagination', '../DataLinksActionsTooltip', '../TableCellInspector', './components/TableCellActions', './components/TableCellTooltip', '../Filter/Filter', '../geo'].includes(source)) return tableView('tableOptional.tsx');
      if (source === '../../PanelChrome') return tableView('tablePanelContext.ts');
      const tableLeaves: Readonly<Record<string, string>> = {
        '../../../themes/ThemeContext': '@grafana/ui/dist/esm/themes/ThemeContext.mjs',
        '../../../../themes/ThemeContext': '@grafana/ui/dist/esm/themes/ThemeContext.mjs',
        '../../../utils/colors': '@grafana/ui/dist/esm/utils/colors.mjs',
        '../../../../types/icon': '@grafana/ui/dist/esm/types/icon.mjs',
        '../../../Icon/Icon': '@grafana/ui/dist/esm/components/Icon/Icon.mjs',
        '../../../Layout/Stack/Stack': '@grafana/ui/dist/esm/components/Layout/Stack/Stack.mjs',
        '../cellUtils': '@grafana/ui/dist/esm/components/Table/cellUtils.mjs',
        '../types': '@grafana/ui/dist/esm/components/Table/types.mjs',
      };
      if (tableLeaves[source]) return resolve(options.repositoryRoot, 'node_modules', tableLeaves[source]);
    }
    if (id.startsWith(`${prefix}packages/grafana-ui/src/components/RadialGauge/`)) {
      const packageLeaves: Readonly<Record<string, string>> = {
        '../../themes/ThemeContext': '@grafana/ui/dist/esm/themes/ThemeContext.mjs',
        '../../utils/measureText': '@grafana/ui/dist/esm/utils/measureText.mjs',
        '../Layout/Box/Box': '@grafana/ui/dist/esm/components/Layout/Box/Box.mjs',
        '../Sparkline/Sparkline': '@grafana/ui/dist/esm/components/Sparkline/Sparkline.mjs',
      };
      if (packageLeaves[source]) return resolve(options.repositoryRoot, 'node_modules', packageLeaves[source]);
    }
    if (absentIntegrations.has(source)) return view('nativeInert.tsx');
    if (source === '@grafana/data/internal') return view('nativeDataInternal.ts');
    if (source === '@grafana/ui/internal') {
      if (id.includes('native:public/app/plugins/panel/gauge/')) return view('gaugeUiInternal.ts');
      if (id.includes('native:public/app/plugins/panel/bargauge/')) return view('barGaugeUiInternal.ts');
      return view('nativeUiInternal.ts');
    }
    if (source === '@grafana/ui') return view('nativeUi.ts');
    if (source.startsWith('app/')) {
      const file = GRAFANA_13_NATIVE_SOURCES.find(file => file.replace(/^public\//, '').replace(/\.tsx?$/, '') === source);
      if (file) return `${prefix}${file}.js`;
    }
    return null;
  }, load(id) {
    return id === '\0provider-13-native-css-owned-by-scene' || id === '\0provider-13-table-data-grid-css-owned-by-scene'
      ? 'export {};'
      : null;
  } };
}
