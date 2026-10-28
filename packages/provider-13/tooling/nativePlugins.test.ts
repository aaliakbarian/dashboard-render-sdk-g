import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GRAFANA_13_NATIVE_SOURCES } from './sourceIdentity';

describe('pinned native renderer-only entries', () => {
  it('pins the exact view closure and excludes full modules and authoring integrations', () => {
    expect(GRAFANA_13_NATIVE_SOURCES).toContain('public/app/plugins/panel/stat/StatPanel.tsx');
    expect(GRAFANA_13_NATIVE_SOURCES).toContain('public/app/plugins/panel/timeseries/TimeSeriesPanel.tsx');
    expect(GRAFANA_13_NATIVE_SOURCES).toContain('public/app/core/components/GraphNG/GraphNG.tsx');
    expect(GRAFANA_13_NATIVE_SOURCES.join('\n')).not.toMatch(/module\.tsx|[Ee]ditor|[Mm]igration|presets|suggestions|routes|System/);
    for (const [file, alias, symbol] of [
      ['statPlugin.ts', 'grafana-provider13-stat-renderer', 'StatPanel'],
      ['timeSeriesPlugin.ts', 'grafana-provider13-timeseries-renderer', 'TimeSeriesPanel'],
    ]) {
      const source = readFileSync(`packages/provider-13/src/panels/${file}`, 'utf8');
      expect(source).toContain(alias);
      expect(source).toContain(symbol);
      expect(source).toContain('useFieldConfig');
      expect(source).not.toMatch(/module\.tsx|setPanelOptions|setMigrationHandler|setSuggestionsSupplier/);
    }
  });
});
