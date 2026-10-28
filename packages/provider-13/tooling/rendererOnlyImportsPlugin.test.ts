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
  });
  it('keeps unadmitted drilldown and variable authoring outside the real runner closure', () => {
    expect(resolve('../variables/adhoc/AdHocFiltersVariable.js', '/repo/node_modules/@grafana/scenes/dist/esm/querying/SceneQueryRunner.js')).toContain('/viewOnly/queryInert.ts');
    expect(resolve('../variables/DrilldownDependenciesManager.js', '/repo/node_modules/@grafana/scenes/dist/esm/querying/SceneQueryRunner.js')).toContain('/viewOnly/queryInert.ts');
    expect(resolve('../variables/DrilldownDependenciesManager.js', '/unrelated.ts')).toBeNull();
  });
});
