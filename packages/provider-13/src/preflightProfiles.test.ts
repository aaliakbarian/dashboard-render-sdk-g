import { describe, expect, it, vi } from 'vitest';

import { classifyGrafana13PanelProfile } from './preflightProfiles';
import { fixtureDashboard } from './testFixtures.test';
import { isGrafana13PulseTarget } from './datasource/contracts';

function panel(index = 3): any {
  return structuredClone(fixtureDashboard('drsdk-g-phase2-visualizations').spec.panels[index]);
}

function frozenTree(value: unknown): void {
  if (value === null || typeof value !== 'object') return;
  expect(Object.isFrozen(value)).toBe(true);
  Object.values(value).forEach(frozenTree);
}

describe('provider-private exact panel profiles', () => {
  it.each(['stat', 'timeseries', 'gauge', 'bargauge'])('accepts the V1 DTO omitted base threshold value only for %s and returns the exact canonical field profile', type => {
    const raw: any = structuredClone(fixtureDashboard('drsdk-g-phase2-visualizations').spec.panels.find(p => p.type === type));
    const expected = structuredClone(raw.fieldConfig);
    delete raw.fieldConfig.defaults.thresholds.steps[0].value;
    const result = classifyGrafana13PanelProfile(raw);
    expect(result.kind).toBe('supported');
    if (result.kind === 'supported') expect(result.model.fieldConfig).toEqual(expected);
    expect(raw.fieldConfig.defaults.thresholds.steps[0]).not.toHaveProperty('value');
    raw.fieldConfig.defaults.thresholds.steps[0].value = 0;
    expect(classifyGrafana13PanelProfile(raw).kind).toBe('unsupported');
    delete raw.fieldConfig.defaults.thresholds.steps[0].value;
    delete raw.fieldConfig.defaults.thresholds.steps[1].value;
    expect(classifyGrafana13PanelProfile(raw).kind).toBe('unsupported');
  });
  const aliases: Array<[string, string, boolean]> = [
    ['plain', 'plain', true], ['empty', '', true], ['256 printable ASCII', '~'.repeat(256), true],
    ['257 characters', 'a'.repeat(257), false], ['dollar template', '$environment', false],
    ['literal dollar', 'price$', false], ['bracket template', '[[environment]]', false],
    ['opening bracket syntax', 'plain[[', false], ['Unicode', 'مرحله', false],
    ['newline', 'plain\n', false], ['tab', 'plain\t', false], ['NUL', '\u0000', false], ['DEL', '\u007f', false],
  ];
  it.each(aliases)('uses the exact runtime alias contract for %s in every query-panel model', (_label, alias, admitted) => {
    for (let index = 1; index <= 7; index++) {
      const raw = panel(index); raw.targets[0].alias = alias;
      const result = classifyGrafana13PanelProfile(raw);
      expect(result.kind).toBe(admitted ? 'supported' : 'unsupported');
      if (result.kind === 'supported' && result.model.type !== 'text') {
        expect(result.model.query.targets.every(target => isGrafana13PulseTarget(target))).toBe(true);
        expect(result.model.query.targets[0].alias).toBe(alias);
      }
    }
  });
  it.each(['text', 'stat', 'timeseries', 'table', 'gauge', 'bargauge', 'piechart', 'barchart'])('detaches and deeply freezes the verified %s model', (type) => {
    const raw: any = structuredClone(fixtureDashboard('drsdk-g-phase2-visualizations').spec.panels.find((p) => p.type === type));
    const result = classifyGrafana13PanelProfile(raw);
    expect(result.kind).toBe('supported');
    if (result.kind !== 'supported') throw new Error('Expected private profile');
    expect(result.model).toMatchObject({ id: raw.id, type, pluginVersion: '13.2.3', options: raw.options, fieldConfig: raw.fieldConfig });
    expect(result.model).not.toBe(raw);
    expect(result.model.options).not.toBe(raw.options);
    frozenTree(result);
    raw.options.changed = true;
    expect(result.model.options).not.toHaveProperty('changed');
    if (result.model.type !== 'text') {
      expect(result.model.query.targets.every(target => isGrafana13PulseTarget(target))).toBe(true);
      expect(result.model.query).toEqual({ datasource: { type: 'grafana-testdata-datasource', uid: 'grsdk-testdata' }, targets: [{
        alias: 'Phase 2 Pulse Raw', refId: 'A', scenarioId: 'predictable_pulse',
        pulseWave: { offCount: 5, offValue: 10, onCount: 5, onValue: 90, timeStep: 1 },
      }] });
      expect(result.model.query.targets).not.toBe(raw.targets);
      expect(result.model.transformations).toEqual(type === 'timeseries' ? [{ id: 'renameByRegex', options: { regex: '/Raw/', renamePattern: 'Signal' } }] : []);
    }
  });

  it('classifies both Table profiles by their full DTO rather than type alone', () => {
    expect(classifyGrafana13PanelProfile(panel()).kind).toBe('supported');
    expect(classifyGrafana13PanelProfile(fixtureDashboard('grsdk-phase0-poc').spec.panels[3]).kind).toBe('unsupported');
  });

  const mutations: Array<[string, (p: any) => void]> = [
    ['sort', p => { p.options.sortBy = [{ displayName: 'Time', desc: true }]; }],
    ['pagination', p => { p.options.enablePagination = true; }],
    ['cell actions', p => { p.fieldConfig.defaults.actions = [{ type: 'fetch' }]; }],
    ['cell links', p => { p.fieldConfig.defaults.links = [{ url: '/target' }]; }],
    ['cell filtering', p => { p.fieldConfig.defaults.custom.filterable = true; }],
    ['inspection', p => { p.fieldConfig.defaults.custom.inspect = true; }],
    ['frame selection', p => { p.options.frameIndex = 1; }],
    ['unknown option', (p) => { p.options.secret = true; }],
    ['changed option', (p) => { p.options.showHeader = false; }],
    ['unknown field', (p) => { p.fieldConfig.defaults.secret = true; }],
    ['nested field option', (p) => { p.fieldConfig.defaults.custom.cellOptions.type = 'json-view'; }],
    ['override', (p) => { p.fieldConfig.overrides = [{ matcher: { id: 'byName', options: 'x' }, properties: [] }]; }],
    ['field extension', (p) => { p.fieldConfig.secret = true; }],
    ['wrong UID', (p) => { p.datasource.uid = 'secret'; }],
    ['wrong type', (p) => { p.datasource.type = 'secret'; }],
    ['target wrong UID', (p) => { p.targets[0].datasource.uid = 'secret'; }],
    ['target wrong type', (p) => { p.targets[0].datasource.type = 'secret'; }],
    ['scenario', (p) => { p.targets[0].scenarioId = 'table_static'; }],
    ['pulse value', (p) => { p.targets[0].pulseWave.onValue = 91; }],
    ['pulse extension', (p) => { p.targets[0].pulseWave.secret = 1; }],
    ['refId', (p) => { p.targets[0].refId = 'B'; }],
    ['hidden target', (p) => { p.targets[0].hide = true; }],
    ['explicit unhidden target', (p) => { p.targets[0].hide = false; }],
    ['extra target', (p) => { p.targets.push(structuredClone(p.targets[0])); }],
    ['missing target', (p) => { p.targets = []; }],
    ['target object', (p) => { p.targets = { 0: p.targets[0], length: 1 }; }],
    ['target extension', (p) => { p.targets[0].secret = true; }],
    ['alias bound', (p) => { p.targets[0].alias = 'x'.repeat(257); }],
    ['alias control', (p) => { p.targets[0].alias = 'secret\n'; }],
    ['forbidden transform', (p) => { p.transformations = [{ id: 'renameByRegex', options: { regex: '/Raw/', renamePattern: 'Signal' } }]; }],
    ['unknown transform', (p) => { p.transformations = [{ id: 'secret', options: {} }]; }],
    ['transform object', (p) => { p.transformations = {}; }],
    ['transform null', (p) => { p.transformations = null; }],
    ['plugin version', (p) => { p.pluginVersion = '13.2.4'; }],
    ['unknown panel field', (p) => { p.secret = true; }],
    ['unsafe id', (p) => { p.id = 0; }],
    ['title bound', (p) => { p.title = 'x'.repeat(1025); }],
    ['title control', (p) => { p.title = 'secret\n'; }],
    ['grid column', (p) => { p.gridPos.x = 24; }],
    ['grid fraction', (p) => { p.gridPos.h = 0.5; }],
    ['grid overflow', (p) => { p.gridPos.y = Number.MAX_SAFE_INTEGER; }],
    ['grid extension', (p) => { p.gridPos.secret = true; }],
  ];
  it.each(mutations)('rejects the same Table type with %s and sanitizes its result', (_name, mutate) => {
    const raw = panel(); mutate(raw);
    const result = classifyGrafana13PanelProfile(raw);
    expect(result.kind).toBe('unsupported');
    expect(JSON.stringify(result)).not.toMatch(/secret|table_static|predictable_pulse|grsdk-testdata/);
    expect(result).toEqual(classifyGrafana13PanelProfile(raw));
    frozenTree(result);
  });

  it.each([1, 2, 3, 4, 5, 6, 7])('rejects an option or field change for query panel %i', (index) => {
    const raw = panel(index);
    raw.options.extra = true;
    expect(classifyGrafana13PanelProfile(raw).kind).toBe('unsupported');
    delete raw.options.extra;
    raw.fieldConfig.defaults.extra = true;
    expect(classifyGrafana13PanelProfile(raw).kind).toBe('unsupported');
  });

  it.each(['gauge', 'bargauge'])('keeps every unverified %s option, datasource, target and transformation profile inert', type => {
    const changes: Array<(panel: any) => void> = [
      p => { p.options.reduceOptions.calcs = ['mean']; },
      p => { p.options.reduceOptions.values = true; },
      p => { p.options.orientation = 'horizontal'; },
      p => { p.options.sizing = 'manual'; },
      p => { p.options.extra = true; },
      p => { p.fieldConfig.defaults.links = [{ url: '/target' }]; },
      p => { p.fieldConfig.defaults.actions = [{ type: 'fetch' }]; },
      p => { p.fieldConfig.defaults.min = -1; },
      p => { p.fieldConfig.defaults.max = 200; },
      p => { p.fieldConfig.defaults.thresholds.steps[1].value = 49; },
      p => { p.fieldConfig.overrides = [{ matcher: { id: 'byName' }, properties: [] }]; },
      p => { p.datasource.uid = 'other'; },
      p => { p.datasource.type = 'other'; },
      p => { p.targets[0].scenarioId = 'table_static'; },
      p => { p.targets.push(structuredClone(p.targets[0])); },
      p => { p.transformations = [{ id: 'renameByRegex', options: { regex: '/Raw/', renamePattern: 'Signal' } }]; },
    ];
    for (const mutate of changes) {
      const raw: any = structuredClone(fixtureDashboard('drsdk-g-phase2-visualizations').spec.panels.find(p => p.type === type));
      mutate(raw);
      expect(classifyGrafana13PanelProfile(raw)).toMatchObject({ kind: 'unsupported' });
    }
  });

  it('admits an empty Time series pipeline and only the exact one-step rename', () => {
    const raw = panel(2);
    raw.transformations = [];
    expect(classifyGrafana13PanelProfile(raw).kind).toBe('supported');
    delete raw.transformations;
    expect(classifyGrafana13PanelProfile(raw).kind).toBe('supported');
    raw.transformations = [{ id: 'renameByRegex', options: { regex: '/Other/', renamePattern: 'Signal' } }];
    expect(classifyGrafana13PanelProfile(raw).kind).toBe('unsupported');
    raw.transformations = [{ id: 'renameByRegex', options: { regex: '/Raw/', renamePattern: 'Signal', extra: true } }];
    expect(classifyGrafana13PanelProfile(raw).kind).toBe('unsupported');
    raw.transformations = Array(2).fill({ id: 'renameByRegex', options: { regex: '/Raw/', renamePattern: 'Signal' } });
    expect(classifyGrafana13PanelProfile(raw).kind).toBe('unsupported');
  });

  it.each([
    [4, (p: any) => { p.options.shape = 'circle'; }],
    [5, (p: any) => { p.options.displayMode = 'basic'; }],
    [6, (p: any) => { p.options.pieType = 'donut'; }],
    [6, (p: any) => { p.options.reduceOptions.values = true; }],
    [7, (p: any) => { p.options.stacking = 'normal'; }],
    [7, (p: any) => { p.options.xField = 'other'; }],
  ])('rejects renderer profile extensions at index %i', (index, mutate) => {
    const raw = panel(index as number);
    (mutate as (p: any) => void)(raw);
    expect(classifyGrafana13PanelProfile(raw).kind).toBe('unsupported');
  });

  it.each([
    ['Pie extra target', 6, (p: any) => { p.targets.push(structuredClone(p.targets[0])); }],
    ['Pie values mode', 6, (p: any) => { p.options.reduceOptions.values = true; }],
    ['Pie persisted visibility override', 6, (p: any) => { p.fieldConfig.overrides = [{ matcher: { id: 'byName', options: 'Value' }, properties: [{ id: 'custom.hideFrom', value: { viz: true } }] }]; }],
    ['Pie data link', 6, (p: any) => { p.fieldConfig.defaults.links = [{ title: 'outside', url: '/outside' }]; }],
    ['Bar extra target', 7, (p: any) => { p.targets.push(structuredClone(p.targets[0])); }],
    ['Bar categorical x field', 7, (p: any) => { p.options.xField = 'Category'; }],
    ['Bar grouping', 7, (p: any) => { p.options.groupWidth = 0.5; }],
    ['Bar stacking', 7, (p: any) => { p.options.stacking = 'normal'; }],
    ['Bar action', 7, (p: any) => { p.fieldConfig.defaults.actions = [{ type: 'fetch' }]; }],
  ])('keeps the bounded one-series graph profile inert for %s', (_name, index, mutate) => {
    const raw = panel(index as number);
    (mutate as (p: any) => void)(raw);
    expect(classifyGrafana13PanelProfile(raw)).toMatchObject({ kind: 'unsupported' });
  });

  it('accepts explicitly empty query pipelines and bounds query aliases', () => {
    const raw = panel();
    raw.transformations = [];
    raw.targets[0].alias = 'a'.repeat(256);
    expect(classifyGrafana13PanelProfile(raw).kind).toBe('supported');
  });

  it.each(['sparse', 'array property', 'symbol', 'accessor', 'reflection', 'revoked', 'depth', 'array limit', 'property limit', 'node limit', 'cycle'])('fails closed for hostile %s input', (kind) => {
    let raw = panel();
    const getter = vi.fn(() => { throw new Error('secret'); });
    if (kind === 'sparse') delete raw.targets[0];
    if (kind === 'array property') raw.targets.secret = true;
    if (kind === 'symbol') raw[Symbol('secret')] = true;
    if (kind === 'accessor') Object.defineProperty(raw.options, 'secret', { enumerable: true, get: getter });
    if (kind === 'reflection') raw = new Proxy(raw, { ownKeys: getter });
    if (kind === 'revoked') { const proxy = Proxy.revocable(raw, {}); proxy.revoke(); raw = proxy.proxy; }
    if (kind === 'depth') { let nested: any = {}; raw.extra = nested; for (let i = 0; i < 33; i++) { nested.extra = {}; nested = nested.extra; } }
    if (kind === 'array limit') raw.extra = Array(1025).fill(0);
    if (kind === 'property limit') raw.extra = Object.fromEntries(Array.from({ length: 1025 }, (_, i) => [`k${i}`, 0]));
    if (kind === 'node limit') raw.extra = Array.from({ length: 20 }, () => Array(1024).fill(0));
    if (kind === 'cycle') raw.extra = raw;
    expect(classifyGrafana13PanelProfile(raw).kind).toBe('unsupported');
    if (kind === 'accessor') expect(getter).not.toHaveBeenCalled();
  });
});
