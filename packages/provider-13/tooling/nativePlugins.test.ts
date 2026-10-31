import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GRAFANA_13_NATIVE_SOURCES, GRAFANA_13_NATIVE_UI_SOURCES } from './sourceIdentity';

describe('pinned native renderer-only entries', () => {
  it('pins the exact view closure and excludes full modules and authoring integrations', () => {
    expect(GRAFANA_13_NATIVE_SOURCES).toContain('public/app/plugins/panel/stat/StatPanel.tsx');
    expect(GRAFANA_13_NATIVE_SOURCES).toContain('public/app/plugins/panel/timeseries/TimeSeriesPanel.tsx');
    expect(GRAFANA_13_NATIVE_SOURCES).toContain('public/app/core/components/GraphNG/GraphNG.tsx');
    expect(GRAFANA_13_NATIVE_SOURCES).toContain('public/app/plugins/panel/gauge/GaugePanel.tsx');
    expect(GRAFANA_13_NATIVE_SOURCES).toContain('public/app/plugins/panel/bargauge/BarGaugePanel.tsx');
    expect(GRAFANA_13_NATIVE_SOURCES).toContain('public/app/plugins/panel/bargauge/BarGaugeLegend.tsx');
    expect(GRAFANA_13_NATIVE_SOURCES).toContain('public/app/plugins/panel/bargauge/panelcfg.gen.ts');
    expect(GRAFANA_13_NATIVE_SOURCES).toContain('public/app/plugins/panel/barchart/BarChartPanel.tsx');
    expect(GRAFANA_13_NATIVE_SOURCES).toContain('public/app/plugins/panel/barchart/BarChartLegend.tsx');
    expect(GRAFANA_13_NATIVE_SOURCES).toContain('public/app/plugins/panel/barchart/utils.ts');
    expect(GRAFANA_13_NATIVE_SOURCES).toContain('public/app/plugins/panel/barchart/bars.ts');
    expect(GRAFANA_13_NATIVE_SOURCES).toContain('public/app/plugins/panel/barchart/distribute.ts');
    expect(GRAFANA_13_NATIVE_SOURCES).toContain('public/app/plugins/panel/barchart/quadtree.ts');
    expect(GRAFANA_13_NATIVE_SOURCES).toContain('public/app/plugins/panel/barchart/panelcfg.gen.ts');
    expect(GRAFANA_13_NATIVE_SOURCES).toContain('public/app/plugins/panel/piechart/PieChartPanel.tsx');
    expect(GRAFANA_13_NATIVE_SOURCES).toContain('public/app/plugins/panel/piechart/PieChart.tsx');
    expect(GRAFANA_13_NATIVE_SOURCES).toContain('public/app/plugins/panel/piechart/panelcfg.gen.ts');
    expect(GRAFANA_13_NATIVE_SOURCES).toContain('public/app/plugins/panel/piechart/utils.ts');
    expect(GRAFANA_13_NATIVE_UI_SOURCES).toEqual([
      'RadialGauge.tsx', 'RadialBar.tsx', 'RadialBarSegmented.tsx', 'RadialArcPath.tsx',
      'RadialArcPathEndpointMarks.tsx', 'RadialScaleLabels.tsx', 'RadialSparkline.tsx',
      'RadialText.tsx', 'ThresholdsBar.tsx', 'colors.ts', 'constants.ts', 'effects.tsx', 'utils.ts',
    ].map(file => `packages/grafana-ui/src/components/RadialGauge/${file}`));
    expect(GRAFANA_13_NATIVE_SOURCES.join('\n')).not.toMatch(/module\.tsx|[Ee]ditor|[Mm]igration|presets|suggestions|routes|System/);
    for (const [file, alias, symbol] of [
      ['statPlugin.ts', 'grafana-provider13-stat-renderer', 'StatPanel'],
      ['timeSeriesPlugin.ts', 'grafana-provider13-timeseries-renderer', 'TimeSeriesPanel'],
      ['gaugePlugin.ts', 'grafana-provider13-gauge-renderer', 'GaugePanel'],
      ['barGaugePlugin.ts', 'grafana-provider13-bargauge-renderer', 'BarGaugePanel'],
      ['pieChartPlugin.ts', 'grafana-provider13-piechart-renderer', 'PieChartPanel'],
      ['barChartPlugin.ts', 'grafana-provider13-barchart-renderer', 'BarChartPanel'],
    ]) {
      const source = readFileSync(`packages/provider-13/src/panels/${file}`, 'utf8');
      expect(source).toContain(alias);
      expect(source).toContain(symbol);
      expect(source).toContain('useFieldConfig');
      expect(source).not.toMatch(/module\.tsx|setPanelOptions|setMigrationHandler|setSuggestionsSupplier/);
    }
    const pie = readFileSync('.grafana-source/grafana-v13.2.3/public/app/plugins/panel/piechart/PieChart.tsx', 'utf8');
    expect([...pie.matchAll(/from ['"](@visx\/[^'"]+)['"]/g)].map(match => match[1]).sort()).toEqual([
      '@visx/event', '@visx/gradient', '@visx/group', '@visx/shape/lib/shapes/Pie',
      '@visx/tooltip', '@visx/tooltip/lib/hooks/useTooltip',
    ]);
    expect(GRAFANA_13_NATIVE_SOURCES.filter(source => source.includes('/piechart/'))).toEqual([
      'public/app/plugins/panel/piechart/PieChartPanel.tsx',
      'public/app/plugins/panel/piechart/PieChart.tsx',
      'public/app/plugins/panel/piechart/panelcfg.gen.ts',
      'public/app/plugins/panel/piechart/utils.ts',
    ]);
  });
});
