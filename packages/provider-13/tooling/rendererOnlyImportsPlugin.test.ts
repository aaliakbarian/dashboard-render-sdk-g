import { describe, expect, it } from 'vitest';
import { rendererOnlyImportsPlugin } from './rendererOnlyImportsPlugin';

describe('native renderer import closure', () => {
  const plugin = rendererOnlyImportsPlugin({ providerRoot: '/repo/packages/provider-13', repositoryRoot: '/repo', sourceRoot: '/grafana' });
  const resolve = (source: string, importer = '\0provider-13-pinned-grafana-source:native:public/app/plugins/panel/timeseries/TimeSeriesPanel.tsx.js') => (plugin.resolveId as Function)(source, importer);
  it('routes only fixed application view entries and inert absent integrations', () => {
    expect(resolve('app/core/components/TimeSeries/TimeSeries')).toContain('native:public/app/core/components/TimeSeries/TimeSeries.tsx.js');
    expect(resolve('./suggestions')).toBe('/repo/packages/provider-13/tooling/viewOnly/nativeInert.tsx');
    expect(resolve('app/routes')).toBeNull();
    expect(resolve('app/core/components/TimeSeries/TimeSeries', '/unrelated.ts')).toBeNull();
  });
  it('resolves PanelPlugin and internal package APIs to exact renderer leaves', () => {
    expect(resolve('@grafana/data/internal')).toContain('/viewOnly/nativeDataInternal.ts');
    expect(resolve('@grafana/ui/internal')).toContain('/viewOnly/nativeUiInternal.ts');
    expect(resolve('grafana-provider13-data-panel-plugin', '/repo/packages/provider-13/src/panels/statPlugin.ts')).toContain('/panel/PanelPlugin.mjs');
    expect(resolve('grafana-provider13-data-panel-plugin', '/repo/packages/provider-13/src/panels/pieChartPlugin.ts')).toContain('/panel/PanelPlugin.mjs');
  });

  it('routes only the Visx tooltip portal dependency into the controlled provider root adapter', () => {
    expect(resolve('../Portal', '/repo/node_modules/@visx/tooltip/esm/hooks/useTooltipInPortal.js'))
      .toContain('/viewOnly/controlledVisxPortal.tsx');
    expect(resolve('../Portal', '/repo/node_modules/@visx/tooltip/esm/tooltips/Tooltip.js')).toBeNull();
    expect(resolve('../Portal', '/repo/node_modules/another-package/esm/hooks/useTooltipInPortal.js')).toBeNull();
  });
  it('keeps unadmitted drilldown and variable authoring outside the real runner closure', () => {
    expect(resolve('../variables/adhoc/AdHocFiltersVariable.js', '/repo/node_modules/@grafana/scenes/dist/esm/querying/SceneQueryRunner.js')).toContain('/viewOnly/queryInert.ts');
    expect(resolve('../variables/DrilldownDependenciesManager.js', '/repo/node_modules/@grafana/scenes/dist/esm/querying/SceneQueryRunner.js')).toContain('/viewOnly/queryInert.ts');
    expect(resolve('../variables/DrilldownDependenciesManager.js', '/unrelated.ts')).toBeNull();
  });
  it('resolves single-value renderers to exact leaves without making Time series their dependency', () => {
    const gauge = '\0provider-13-pinned-grafana-source:native:public/app/plugins/panel/gauge/GaugePanel.tsx.js';
    expect(resolve('@grafana/ui/internal', gauge)).toContain('/viewOnly/gaugeUiInternal.ts');
    expect(resolve('grafana-provider13-native-radial-gauge', '/repo/packages/provider-13/tooling/viewOnly/gaugeUiInternal.ts')).toBe('\0provider-13-pinned-grafana-source:native:packages/grafana-ui/src/components/RadialGauge/RadialGauge.tsx.js');
    expect(resolve('grafana-provider13-data-panel-plugin', '/repo/packages/provider-13/src/panels/gaugePlugin.ts')).toContain('/panel/PanelPlugin.mjs');
    expect(resolve('grafana-provider13-data-panel-plugin', '/repo/packages/provider-13/src/panels/barGaugePlugin.ts')).toContain('/panel/PanelPlugin.mjs');
    expect(resolve('app/features/table/hooks', gauge)).toBeNull();
  });
});
