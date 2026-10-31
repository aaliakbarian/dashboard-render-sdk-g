import { validateProviderCompatibilityManifest } from '@dashboard-render-sdk-g/provider-contract';
import { describe, expect, it } from 'vitest';

import * as provider from './index';
import { classifyGrafana13PanelProfile } from './preflightProfiles';
import { canonicalManifest, fixtureDashboard } from './testFixtures.test';

function changed(mutate: (dashboard: any) => void): any {
  const dashboard = structuredClone(fixtureDashboard('grsdk-phase0-poc'));
  mutate(dashboard);
  return dashboard;
}

function manifest() {
  const result = validateProviderCompatibilityManifest(provider.grafana13Provider?.manifest);
  if (!result.valid) throw new Error('Concrete provider manifest must validate');
  return result;
}

describe('closed native partial preflight', () => {
  it.each(['gauge', 'bargauge'])('describes a rejected %s profile without misidentifying it as Text', (type) => {
    const dashboard: any = structuredClone(fixtureDashboard('drsdk-g-phase2-visualizations'));
    const panel = dashboard.spec.panels.find((panel: any) => panel.type === type);
    if (!panel) throw new Error('Expected native single-value fixture panel');
    panel.options.unsupported = true;
    const result = provider.partialPreflightGrafana13DashboardV1(dashboard, manifest());
    if (result.kind !== 'renderable') throw new Error('Expected panel-only fallback');
    expect(result.panels.find(panel => panel.panelType === type)).toMatchObject({
      kind: 'unsupported',
      diagnostics: [{ code: 'panel.unsupported', message: 'The panel is outside the verified view profile.' }],
    });
    expect(result.supportedPanelCount).toBe(6);
    expect(result.unsupportedPanelCount).toBe(2);
  });
  it('admits only the exact executable barchart profile and keeps a changed profile query-free', () => {
    const type = 'barchart';
    const dashboard: any = structuredClone(fixtureDashboard('drsdk-g-phase2-visualizations'));
    const exact = provider.partialPreflightGrafana13DashboardV1(dashboard, manifest());
    if (exact.kind !== 'renderable') throw new Error('Expected exact profile');
    expect(exact.panels.find(panel => panel.panelType === type)).toMatchObject({ kind: 'supported', panelType: type, model: { type } });
    const changed = dashboard.spec.panels.find((panel: any) => panel.type === type);
    changed.options.stacking = 'normal';
    const rejected = provider.partialPreflightGrafana13DashboardV1(dashboard, manifest());
    if (rejected.kind !== 'renderable') throw new Error('Expected panel fallback');
    const panel = rejected.panels.find(panel => panel.panelType === type);
    expect(panel).toMatchObject({ kind: 'unsupported', panelType: type });
    expect(JSON.stringify(panel)).not.toMatch(/query|targets|datasource|transformations/);
  });
  it('admits only the exact executable Pie profile and keeps a changed profile query-free', () => {
    const dashboard = fixtureDashboard('drsdk-g-phase2-visualizations');
    expect(classifyGrafana13PanelProfile(dashboard.spec.panels.find(panel => panel.type === 'piechart'))).toMatchObject({ kind: 'supported' });
    const result = provider.partialPreflightGrafana13DashboardV1(dashboard, manifest());
    if (result.kind !== 'renderable') throw new Error('Expected exact profile');
    const pie = result.panels.find(panel => panel.panelType === 'piechart');
    expect(pie).toMatchObject({ kind: 'supported', panelType: 'piechart', model: { type: 'piechart' } });
    const changed: any = structuredClone(dashboard);
    changed.spec.panels.find((panel: any) => panel.type === 'piechart').options.pieType = 'donut';
    const rejected = provider.partialPreflightGrafana13DashboardV1(changed, manifest());
    if (rejected.kind !== 'renderable') throw new Error('Expected panel fallback');
    const rejectedPie = rejected.panels.find(panel => panel.panelType === 'piechart');
    expect(rejectedPie).toMatchObject({ kind: 'unsupported', panelType: 'piechart' });
    expect(JSON.stringify(rejectedPie)).not.toMatch(/query|targets|datasource|transformations/);
  });
  it('admits only native Stat/Time series candidate profiles with explicit manifest coverage', () => {
    const candidate = validateProviderCompatibilityManifest({ ...provider.grafana13Provider.manifest, capabilities: {
      panels: ['text', 'stat', 'timeseries'], datasources: ['grafana-testdata-datasource'],
      transformations: { allowEmptyPipeline: true, ids: ['renameByRegex'], maxChainLength: 1 },
    } });
    if (!candidate.valid) throw new Error('Expected candidate manifest');
    const result = provider.partialPreflightGrafana13DashboardV1(fixtureDashboard('drsdk-g-phase2-visualizations'), candidate);
    expect(result.kind).toBe('renderable');
    if (result.kind !== 'renderable') throw new Error('Expected renderable');
    expect(result.panels.filter(p => p.kind === 'supported').map(p => p.panelType)).toEqual(['text', 'stat', 'timeseries']);
    expect(result.panels.filter(p => p.kind === 'unsupported').map(p => p.panelType)).toEqual(['table', 'gauge', 'bargauge', 'piechart', 'barchart']);
    for (const panel of result.panels.filter(p => p.kind === 'unsupported')) expect(JSON.stringify(panel)).not.toMatch(/query|targets|datasource|transformations/);
  });
  it('keeps all four real fixture panels in order with their exact layout and closed native capabilities', () => {
    expect(provider.grafana13Provider).toBeDefined();
    const result = provider.partialPreflightGrafana13DashboardV1(fixtureDashboard('grsdk-phase0-poc'), manifest());
    expect(result.kind).toBe('renderable');
    if (result.kind !== 'renderable') throw new Error('Expected renderable fixture');
    expect(result).toMatchObject({
      constantVariables: [{ label: 'Environment', name: 'environment', value: 'phase0' }],
      supportedPanelCount: 3, unsupportedPanelCount: 1,
      timeRange: { from: 'now-1h', to: 'now' }, timezone: 'browser',
      title: 'Dashboard Render SDK G Phase 0 POC', uid: 'grsdk-phase0-poc',
    });
    expect(result.panels.map(({ id, index, kind, panelType, grid }) => ({ id, index, kind, panelType, grid }))).toEqual([
      { grid: { height: 6, width: 8, x: 0, y: 0 }, id: 1, index: 0, kind: 'supported', panelType: 'text' },
      { grid: { height: 6, width: 8, x: 8, y: 0 }, id: 2, index: 1, kind: 'supported', panelType: 'stat' },
      { grid: { height: 10, width: 16, x: 0, y: 6 }, id: 3, index: 2, kind: 'supported', panelType: 'timeseries' },
      { grid: { height: 10, width: 8, x: 16, y: 0 }, id: 4, index: 3, kind: 'unsupported', panelType: 'table' },
    ]);
    expect(provider.grafana13Provider.manifest.capabilities).toEqual({
      datasources: ['grafana-testdata-datasource'], panels: ['text', 'stat', 'timeseries', 'gauge', 'bargauge', 'piechart', 'barchart'], transformations: { allowEmptyPipeline: true, ids: ['renameByRegex'], maxChainLength: 1 },
    });
    for (const panel of result.panels.filter(p => p.kind === 'unsupported')) {
      expect(Object.keys(panel).sort()).toEqual(['diagnostics', 'grid', 'id', 'index', 'kind', 'panelType', 'title']);
      expect(JSON.stringify(panel)).not.toMatch(/predictable_pulse|renameByRegex|table_static|grsdk-testdata/);
    }
    const text = result.panels[0];
    expect(text).toMatchObject({ kind: 'supported', profile: 'text-markdown-view-v1', model: {
      id: 1, type: 'text', options: { mode: 'markdown', content: expect.stringContaining('Native **phase0**') },
    } });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(text?.grid)).toBe(true);
    expect(Object.isFrozen(text?.kind === 'supported' && text.model.options)).toBe(true);
    expect(Object.isFrozen(provider.grafana13Provider.manifest.target.cells)).toBe(true);
  });

  it('accepts the alternate committed fixture as one supported Text panel', () => {
    const result = provider.partialPreflightGrafana13DashboardV1(fixtureDashboard('grsdk-phase0-poc-alt'), manifest());
    expect(result).toMatchObject({ kind: 'renderable', supportedPanelCount: 1, unsupportedPanelCount: 0,
      panels: [{ grid: { height: 8, width: 24, x: 0, y: 0 }, id: 1, kind: 'supported', title: 'Alternate Text sentinel' }],
    });
  });

  it.each([
    ['grsdk-phase0-poc', 3, 1], ['grsdk-phase0-poc-alt', 1, 0],
  ] as const)('uses canonical metadata identity when %s omits spec.uid', (uid, supportedPanelCount, unsupportedPanelCount) => {
    const dashboard = structuredClone(fixtureDashboard(uid));
    const { uid: _uid, ...spec } = dashboard.spec;
    const result = provider.partialPreflightGrafana13DashboardV1({ ...dashboard, spec }, manifest());
    expect(result).toMatchObject({ kind: 'renderable', uid, supportedPanelCount, unsupportedPanelCount });
  });

  it.each([
    ['mode', (panel: any) => { panel.options.mode = 'html'; }],
    ['options', (panel: any) => { panel.options.unsafe = true; }],
    ['code', (panel: any) => { panel.options.code.showMiniMap = true; }],
    ['field config', (panel: any) => { panel.fieldConfig.defaults.unit = 'percent'; }],
    ['datasource', (panel: any) => { panel.datasource = { type: 'secret-datasource', uid: 'secret-uid' }; }],
    ['targets', (panel: any) => { panel.targets = [{ secret: 'secret-query' }]; }],
    ['transformations', (panel: any) => { panel.transformations = [{ id: 'secret-transform' }]; }],
    ['plugin version', (panel: any) => { panel.pluginVersion = '13.2.4'; }],
    ['unknown panel feature', (panel: any) => { panel.unknown = 'secret-value'; }],
  ] as const)('retains a placeholder for Text with unsupported %s', (_label, mutate) => {
    const result = provider.partialPreflightGrafana13DashboardV1(changed((dashboard) => mutate(dashboard.spec.panels[0])), manifest());
    expect(result).toMatchObject({ kind: 'renderable', supportedPanelCount: 2, unsupportedPanelCount: 2 });
    if (result.kind !== 'renderable') throw new Error('Expected panel fallback');
    expect(result.panels[0]).toMatchObject({ grid: { height: 6, width: 8, x: 0, y: 0 }, id: 1, kind: 'unsupported', title: 'Text — $environment' });
    expect(JSON.stringify(result)).not.toContain('secret-');
  });

  it('preserves both a supported Text and unsupported Table, with no executable placeholder payload', () => {
    const result = provider.partialPreflightGrafana13DashboardV1(changed((dashboard) => {
      dashboard.spec.panels = [dashboard.spec.panels[0], dashboard.spec.panels[3]];
    }), manifest());
    expect(result).toMatchObject({ kind: 'renderable', supportedPanelCount: 1, unsupportedPanelCount: 1,
      panels: [{ id: 1, kind: 'supported' }, { id: 4, kind: 'unsupported' }],
    });
  });

  it.each([
    ['duplicate IDs', (d: any) => { d.spec.panels[3].id = 1; }],
    ['non-positive ID', (d: any) => { d.spec.panels[3].id = 0; }],
    ['fractional ID', (d: any) => { d.spec.panels[3].id = 1.5; }],
    ['missing grid', (d: any) => { delete d.spec.panels[3].gridPos; }],
    ['fractional grid', (d: any) => { d.spec.panels[3].gridPos.x = 0.5; }],
    ['overlapping grid', (d: any) => { d.spec.panels[3].gridPos.x = 0; }],
    ['wide grid', (d: any) => { d.spec.panels[3].gridPos.w = 25; }],
    ['negative grid', (d: any) => { d.spec.panels[3].gridPos.y = -1; }],
    ['overflowing grid', (d: any) => { d.spec.panels[3].gridPos.y = Number.MAX_SAFE_INTEGER; }],
    ['unknown grid key', (d: any) => { d.spec.panels[3].gridPos.unknown = 1; }],
    ['missing type', (d: any) => { delete d.spec.panels[3].type; }],
    ['unsafe type', (d: any) => { d.spec.panels[3].type = '<secret-script>'; }],
    ['missing title', (d: any) => { delete d.spec.panels[3].title; }],
    ['unsafe title', (d: any) => { d.spec.panels[3].title = 'bad\nsecret'; }],
    ['missing dashboard title', (d: any) => { delete d.spec.title; }],
    ['mismatched UID', (d: any) => { d.spec.uid = 'different'; }],
    ['empty time range', (d: any) => { d.spec.time.from = ''; }],
    ['rows', (d: any) => { d.spec.panels[3].type = 'row'; }],
    ['tabs', (d: any) => { d.spec.panels[3].tabs = []; }],
    ['nested panels', (d: any) => { d.spec.panels[3].panels = []; }],
    ['library panels', (d: any) => { d.spec.panels[3].libraryPanel = { uid: 'library' }; }],
    ['repeat', (d: any) => { d.spec.panels[3].repeat = 'environment'; }],
    ['repeat direction', (d: any) => { d.spec.panels[3].repeatDirection = 'h'; }],
    ['dashboard feature', (d: any) => { d.spec.tabs = []; }],
    ['dashboard interaction', (d: any) => { d.spec.links = [{ url: 'secret-link' }]; }],
    ['auto refresh', (d: any) => { d.spec.refresh = '5s'; }],
    ['time picker interaction', (d: any) => { d.spec.timepicker = { refresh_intervals: ['5s'] }; }],
    ['shared tooltip interaction', (d: any) => { d.spec.graphTooltip = 1; }],
    ['variable profile', (d: any) => { d.spec.templating.list[0].type = 'query'; }],
    ['timezone', (d: any) => { d.spec.timezone = 'utc'; }],
    ['annotations', (d: any) => { d.spec.annotations.list = [{ query: 'secret-query' }]; }],
    ['decoder bound', (d: any) => { d.spec.tags = Array(1025).fill('secret'); }],
    ['cyclic JSON', (d: any) => { d.spec.loop = d; }],
    ['accessor JSON', (d: any) => { Object.defineProperty(d.spec.panels[3], 'secret', { enumerable: true, get() { throw new Error('secret'); } }); }],
  ] as const)('rejects dashboard-wide invalid %s before panel fallback', (_label, mutate) => {
    const result = provider.partialPreflightGrafana13DashboardV1(changed(mutate), manifest());
    expect(result.kind).toBe('unsupported-dashboard');
    expect(JSON.stringify(result)).not.toContain('secret');
  });

  it('classifies unsupported schema separately', () => {
    expect(provider.partialPreflightGrafana13DashboardV1(changed((d) => { d.spec.schemaVersion = 43; }), manifest()))
      .toMatchObject({ kind: 'unsupported-dashboard', reason: 'dashboard-schema' });
  });

  it('does not upgrade unadmitted Table profiles when a broader valid manifest declares their capabilities', () => {
    expect(provider.partialPreflightGrafana13DashboardV1(fixtureDashboard('grsdk-phase0-poc'), canonicalManifest()))
      .toMatchObject({ kind: 'renderable', supportedPanelCount: 3, unsupportedPanelCount: 1 });
  });

  it('cannot lose a fatal final layout failure after many panel diagnostics', () => {
    const result = provider.partialPreflightGrafana13DashboardV1(changed((d) => {
      const panel = d.spec.panels[3];
      d.spec.panels = Array.from({ length: 150 }, (_, index) => ({ ...panel, id: index + 1, gridPos: { h: 1, w: 1, x: 0, y: index } }));
      d.spec.panels[149].id = 1;
    }), manifest());
    expect(result.kind).toBe('unsupported-dashboard');
  });

  it('detaches every retained model from the caller', () => {
    const dashboard = changed(() => {});
    const result = provider.partialPreflightGrafana13DashboardV1(dashboard, manifest());
    dashboard.spec.panels[0].options.content = 'changed';
    dashboard.spec.panels[0].gridPos.w = 1;
    if (result.kind !== 'renderable') throw new Error('Expected renderable');
    expect(result.panels[0]).toMatchObject({ grid: { width: 8 }, model: { options: { content: expect.stringContaining('Native **phase0**') } } });
  });
});
