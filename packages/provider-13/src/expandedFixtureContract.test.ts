import { describe, expect, it } from 'vitest';
import { validateProviderCompatibilityManifest } from '@dashboard-render-sdk-g/provider-contract';

import { classifyGrafana13PanelProfile } from './preflightProfiles';
import { partialPreflightGrafana13DashboardV1 } from './partialPreflight';
import { grafana13Provider } from './provider';
import { preflightGrafana13DashboardV1 } from './staticPreflight';
import { canonicalManifest, fixtureDashboard } from './testFixtures.test';

export function expandedManifest() {
  return canonicalManifest((m) => { m.capabilities.panels = ['text', 'stat', 'timeseries', 'table', 'gauge', 'bargauge', 'piechart', 'barchart']; });
}

describe('all-eight private fixture contract', () => {
  it('pins eight unique nonoverlapping grids and the same cloned bounded pulse target', () => {
    const fixture = fixtureDashboard('drsdk-g-phase2-visualizations');
    expect(fixture.spec.panels.map((p) => [p.id, p.type, p.gridPos])).toEqual([
      [1, 'text', { h: 6, w: 6, x: 0, y: 0 }], [2, 'stat', { h: 6, w: 6, x: 6, y: 0 }],
      [3, 'timeseries', { h: 9, w: 12, x: 0, y: 6 }], [4, 'table', { h: 9, w: 12, x: 12, y: 6 }],
      [5, 'gauge', { h: 6, w: 6, x: 12, y: 0 }], [6, 'bargauge', { h: 6, w: 6, x: 18, y: 0 }],
      [7, 'piechart', { h: 9, w: 12, x: 0, y: 15 }], [8, 'barchart', { h: 9, w: 12, x: 12, y: 15 }],
    ]);
    for (const p of fixture.spec.panels.slice(1)) {
      expect(p.targets).toEqual(fixture.spec.panels[1]!.targets);
      if (p !== fixture.spec.panels[1]) expect(p.targets).not.toBe(fixture.spec.panels[1]!.targets);
      expect(classifyGrafana13PanelProfile(p).kind).toBe('supported');
    }
    expect(preflightGrafana13DashboardV1(fixture, expandedManifest()).kind).toBe('match');
  });

  it('keeps active rendering and the shipped manifest Text-only even under a broader test manifest', () => {
    expect(grafana13Provider.manifest.capabilities).toEqual({ datasources: [], panels: ['text'], transformations: { allowEmptyPipeline: true, ids: [], maxChainLength: 0 } });
    const validated = validateProviderCompatibilityManifest(grafana13Provider.manifest);
    if (!validated.valid) throw new Error('Invalid shipped manifest');
    const dashboard = fixtureDashboard('drsdk-g-phase2-visualizations');
    expect(preflightGrafana13DashboardV1(dashboard, validated).kind).toBe('unsupported');
    for (const manifest of [validated, expandedManifest()]) {
      const result = partialPreflightGrafana13DashboardV1(dashboard, manifest);
      expect(result).toMatchObject({ kind: 'renderable', supportedPanelCount: 1, unsupportedPanelCount: 7 });
      if (result.kind !== 'renderable') throw new Error('Expected safe dashboard');
      for (const p of result.panels.slice(1)) {
        expect(p.kind).toBe('unsupported');
        expect(p).not.toHaveProperty('model');
        expect(JSON.stringify(p)).not.toMatch(/predictable_pulse|grsdk-testdata|renameByRegex/);
      }
    }
  });

  it('preserves strict whole-dashboard rejection and per-panel Text fallback independently', () => {
    const dashboard: any = structuredClone(fixtureDashboard('drsdk-g-phase2-visualizations'));
    dashboard.spec.panels[0].options.mode = 'html';
    expect(preflightGrafana13DashboardV1(dashboard, expandedManifest()).kind).toBe('unsupported');
    const result = partialPreflightGrafana13DashboardV1(dashboard, expandedManifest());
    expect(result).toMatchObject({ kind: 'renderable', supportedPanelCount: 0, unsupportedPanelCount: 8 });
    if (result.kind !== 'renderable') throw new Error('Expected safe fallback');
    expect(result.panels[0]).toMatchObject({ id: 1, grid: { x: 0, y: 0, width: 6, height: 6 }, kind: 'unsupported' });
  });

  it('rejects only the offending private profile while keeping all other safe panels and active Text', () => {
    const dashboard: any = structuredClone(fixtureDashboard('drsdk-g-phase2-visualizations'));
    dashboard.spec.panels[3].targets[0].scenarioId = 'table_static';
    expect(dashboard.spec.panels.map((p: unknown) => classifyGrafana13PanelProfile(p).kind)).toEqual([
      'supported', 'supported', 'supported', 'unsupported', 'supported', 'supported', 'supported', 'supported',
    ]);
    const strict = preflightGrafana13DashboardV1(dashboard, expandedManifest());
    expect(strict.kind).toBe('unsupported');
    expect(strict.inventory.panelCount).toBe(8);
    const partial = partialPreflightGrafana13DashboardV1(dashboard, expandedManifest());
    expect(partial).toMatchObject({ kind: 'renderable', supportedPanelCount: 1, unsupportedPanelCount: 7 });
    if (partial.kind !== 'renderable') throw new Error('Expected safe fallback');
    expect(partial.panels[0]).toMatchObject({ id: 1, kind: 'supported' });
    expect(partial.panels[3]).toMatchObject({ id: 4, kind: 'unsupported', grid: { x: 12, y: 6, width: 12, height: 9 } });
  });

  it('leaves the original table_static fixture unsupported by the same classifier', () => {
    const original = fixtureDashboard('grsdk-phase0-poc');
    expect(original.spec.panels[3]).toMatchObject({ type: 'table', targets: [{ scenarioId: 'table_static' }] });
    expect(classifyGrafana13PanelProfile(original.spec.panels[3]).kind).toBe('unsupported');
    expect(preflightGrafana13DashboardV1(original, expandedManifest()).kind).toBe('unsupported');
  });

});
