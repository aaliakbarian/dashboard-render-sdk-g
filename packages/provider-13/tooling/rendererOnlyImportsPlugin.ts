import { resolve } from 'node:path';
import type { Plugin } from 'vite';
import { GRAFANA_13_NATIVE_SOURCES } from './sourceIdentity.ts';

const prefix = '\0provider-13-pinned-grafana-source:native:';
const leaves: Readonly<Record<string, string>> = {
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
  'app/core/components/AssistantTooltip/AssistantTooltipButton', 'app/core/components/AssistantTooltip/buildAssistantContext',
  'app/features/panel/filters/adhoc',
]);
export function rendererOnlyImportsPlugin(options: { readonly providerRoot: string; readonly repositoryRoot: string; readonly sourceRoot: string }): Plugin {
  const provider = resolve(options.providerRoot).replaceAll('\\', '/');
  const view = (name: string) => resolve(provider, 'tooling/viewOnly', name);
  return { name: 'provider-13-native-renderer-only-imports', enforce: 'pre', resolveId(source, importer) {
    const id = importer?.replaceAll('\\', '/').split('?')[0] ?? '';
    if (source === 'uplot/dist/uPlot.min.css' && id === resolve(options.repositoryRoot, 'node_modules/@grafana/ui/dist/esm/components/uPlot/Plot.mjs').replaceAll('\\', '/')) return '\0provider-13-native-css-owned-by-scene';
    if (id === resolve(options.repositoryRoot, 'node_modules/@grafana/scenes/dist/esm/querying/SceneQueryRunner.js').replaceAll('\\', '/') && [
      '../variables/adhoc/AdHocFiltersVariable.js', '../variables/groupby/GroupByVariable.js', '../variables/DrilldownDependenciesManager.js',
    ].includes(source)) return view('queryInert.ts');
    if (source === 'grafana-provider13-data-panel-plugin' && /^.+\/src\/panels\/(?:statPlugin|timeSeriesPlugin)\.ts$/.test(id) && id.startsWith(`${provider}/`)) return resolve(options.repositoryRoot, 'node_modules/@grafana/data/dist/esm/panel/PanelPlugin.mjs');
    if (source === 'grafana-provider13-query-scenes' && id === `${provider}/src/runtime/implementation.tsx`) return view('queryScenes.ts');
    if (id.startsWith(`${provider}/tooling/viewOnly/`)) {
      const leaf = leaves[source.replace(/^grafana-provider13-native-/, '')];
      if (source.startsWith('grafana-provider13-native-') && leaf) return resolve(options.repositoryRoot, 'node_modules', leaf);
    }
    if (!id.startsWith(prefix)) return null;
    if (absentIntegrations.has(source)) return view('nativeInert.tsx');
    if (source === '@grafana/data/internal') return view('nativeDataInternal.ts');
    if (source === '@grafana/ui/internal') return view('nativeUiInternal.ts');
    if (source === '@grafana/ui') return view('nativeUi.ts');
    if (source.startsWith('app/')) {
      const file = GRAFANA_13_NATIVE_SOURCES.find(file => file.replace(/^public\//, '').replace(/\.tsx?$/, '') === source);
      if (file) return `${prefix}${file}.js`;
    }
    return null;
  }, load(id) { return id === '\0provider-13-native-css-owned-by-scene' ? 'export {};' : null; } };
}
