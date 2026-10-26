import { describe, expect, it, vi } from 'vitest';

import type { HostTransportCapability } from '@dashboard-render-sdk-g/provider-contract';

import type { Grafana13DashboardLoadInput } from './contracts';
import { retrieveAndPreflightGrafana13DashboardV1 } from './dashboardApi';
import { preflightGrafana13DashboardV1 } from './staticPreflight';
import { canonicalManifest, fixtureDashboard } from './testFixtures.test';

function mutableDashboard(uid: 'grsdk-phase0-poc' | 'grsdk-phase0-poc-alt' = 'grsdk-phase0-poc'): any {
  return structuredClone(fixtureDashboard(uid));
}

describe('provider-13 static preflight', () => {
  it('accepts the alternate Text fixture with detached immutable inventory', () => {
    const dashboard = fixtureDashboard('grsdk-phase0-poc-alt');
    const result = preflightGrafana13DashboardV1(dashboard, canonicalManifest());
    expect(result).toEqual({
      inventory: {
        annotationPolicy: 'none', datasourceTypes: [], layout: 'flat-grid', panelCount: 1,
        panels: [{ id: 1, index: 0, type: 'text' }], panelTypes: ['text'],
        transformationIds: [], variableKinds: ['constant'],
      },
      kind: 'match',
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.inventory.panels)).toBe(true);
  });

  it('accepts Grafana DTO canonicalization that omits semantically empty Text fieldConfig', () => {
    const dashboard = mutableDashboard('grsdk-phase0-poc-alt');
    delete dashboard.spec.panels[0].fieldConfig;
    expect(preflightGrafana13DashboardV1(dashboard, canonicalManifest()).kind).toBe('match');
  });

  it('accepts the verified Text/Stat/Time-series subset and inventories every capability', () => {
    const dashboard = mutableDashboard();
    dashboard.spec.panels.splice(3, 1);
    const result = preflightGrafana13DashboardV1(dashboard, canonicalManifest());
    expect(result.kind).toBe('match');
    expect(result.inventory).toMatchObject({
      panelCount: 3,
      panels: [
        { id: 1, index: 0, type: 'text' },
        { id: 2, index: 1, type: 'stat' },
        { id: 3, index: 2, type: 'timeseries' },
      ],
      panelTypes: ['stat', 'text', 'timeseries'],
      datasourceTypes: ['grafana-testdata-datasource'],
      transformationIds: ['renameByRegex'],
    });
  });

  it('rejects the complete primary fixture without filtering its Table', () => {
    const result = preflightGrafana13DashboardV1(fixtureDashboard('grsdk-phase0-poc'), canonicalManifest());
    expect(result.kind).toBe('unsupported');
    expect(result.inventory.panelCount).toBe(4);
    expect(result.inventory.panels.at(-1)).toEqual({ id: 4, index: 3, type: 'table' });
    if (result.kind === 'unsupported') {
      expect(result.diagnostics.map(({ code }) => code)).toContain('panel.unsupported');
      expect(result.diagnostics.map(({ code }) => code)).toContain('datasource.profile-unsupported');
    }
  });

  it.each([
    ['dashboard link', (d: any) => { d.spec.links = [{ title: 'x', url: 'https://example.invalid' }]; }],
    ['live mode', (d: any) => { d.spec.liveNow = true; }],
    ['preload', (d: any) => { d.spec.preload = true; }],
    ['unknown dashboard key', (d: any) => { d.spec.unknownMaterial = true; }],
    ['query variable', (d: any) => { d.spec.templating.list[0].type = 'query'; }],
    ['overlapping layout', (d: any) => { d.spec.panels[1].gridPos.x = 0; }],
    ['duplicate panel id', (d: any) => { d.spec.panels[1].id = 1; }],
    ['panel repeat', (d: any) => { d.spec.panels[0].repeat = 'environment'; }],
    ['library panel', (d: any) => { d.spec.panels[0].libraryPanel = { uid: 'x' }; }],
    ['material annotation', (d: any) => { d.spec.annotations.list.push({ name: 'custom' }); }],
    ['unknown panel option', (d: any) => { d.spec.panels[1].options.unknown = true; }],
    ['changed Stat option value', (d: any) => { d.spec.panels[1].options.colorMode = 'unknown-mode'; }],
    ['changed Stat thresholds', (d: any) => { d.spec.panels[1].fieldConfig.defaults.thresholds.steps[1].value = 51; }],
    ['changed Time series nested value', (d: any) => { d.spec.panels[2].fieldConfig.defaults.custom.hideFrom.viz = true; }],
    ['unknown field setting', (d: any) => { d.spec.panels[1].fieldConfig.defaults.unknown = true; }],
    ['field link', (d: any) => { d.spec.panels[1].fieldConfig.defaults.links = [{ url: 'https://example.invalid' }]; }],
    ['target extension', (d: any) => { d.spec.panels[1].targets[0].unknown = true; }],
    ['HTML text mode', (d: any) => { d.spec.panels[0].options.mode = 'html'; }],
    ['plugin mismatch', (d: any) => { d.spec.panels[0].pluginVersion = '13.2.2'; }],
    ['wrong datasource', (d: any) => { d.spec.panels[1].datasource.uid = 'other'; }],
    ['wrong scenario', (d: any) => { d.spec.panels[1].targets[0].scenarioId = 'random_walk'; }],
    ['unknown transformation', (d: any) => { d.spec.panels[2].transformations[0].id = 'organize'; }],
    ['transformation option extension', (d: any) => { d.spec.panels[2].transformations[0].options.unknown = true; }],
    ['transformation option value', (d: any) => { d.spec.panels[2].transformations[0].options.regex = '/Other/'; }],
    ['long transformation chain', (d: any) => { d.spec.panels[2].transformations.push(structuredClone(d.spec.panels[2].transformations[0])); }],
    ['Stat transformation', (d: any) => { d.spec.panels[1].transformations = structuredClone(d.spec.panels[2].transformations); }],
    ['changed constant current', (d: any) => { d.spec.templating.list[0].current.value = 'other'; }],
    ['duplicate canonical variable', (d: any) => { d.spec.templating.list.push(structuredClone(d.spec.templating.list[0])); }],
  ])('fails closed for %s', (_name, mutate) => {
    const dashboard = mutableDashboard();
    dashboard.spec.panels.splice(3, 1);
    mutate(dashboard);
    expect(preflightGrafana13DashboardV1(dashboard, canonicalManifest()).kind).toBe('unsupported');
  });

  it.each([
    ['panel', (m: any) => { m.capabilities.panels.splice(0); }],
    ['datasource', (m: any) => { m.capabilities.datasources.splice(0); }],
    ['transformation', (m: any) => { m.capabilities.transformations.ids.splice(0); m.capabilities.transformations.maxChainLength = 0; }],
    ['schema', (m: any) => { m.dashboards.schemas[0] = { family: 'v1', schemaVersion: 41 }; }],
    ['api', (m: any) => { m.dashboards.apis[0] = { group: 'dashboard.grafana.app', version: 'v2' }; }],
  ])('separates the manifest %s declaration from the fixed profile', (_name, mutate) => {
    const dashboard = mutableDashboard();
    dashboard.spec.panels.splice(3, 1);
    const result = preflightGrafana13DashboardV1(dashboard, canonicalManifest(mutate));
    expect(result.kind).toBe('unsupported');
    if (result.kind === 'unsupported') {
      expect(result.diagnostics.some(({ code }) => code === 'dashboard.manifest-declaration-missing')).toBe(true);
    }
  });

  it('caps real diagnostics without inventing an input-validation outcome', () => {
    const dashboard = mutableDashboard('grsdk-phase0-poc-alt');
    dashboard.spec.panels.splice(0, 1, ...Array.from({ length: 101 }, (_, index) => ({
      fieldConfig: { defaults: {}, overrides: [] }, gridPos: { h: 1, w: 1, x: index % 24, y: Math.floor(index / 24) },
      id: index + 1, options: {}, pluginVersion: '13.2.3', title: `private-${index}`, type: `unsupported-${String(index).padStart(3, '0')}`,
    })));
    const result = preflightGrafana13DashboardV1(dashboard, canonicalManifest());
    expect(result.kind).toBe('unsupported');
    if (result.kind === 'unsupported') {
      expect(result.diagnostics).toHaveLength(100);
      expect(result.diagnosticsTruncated).toBe(true);
      expect(result.diagnostics.every(({ code }) => code !== ('invalid-observation' as never))).toBe(true);
      expect(result.diagnostics).toEqual([...result.diagnostics].sort((a, b) =>
        a.path.localeCompare(b.path) || a.code.localeCompare(b.code) || (a.capabilityId ?? '').localeCompare(b.capabilityId ?? '')
      ));
    }
  });

  it('requires the exact canonical built-in annotation shape', () => {
    const dashboard = mutableDashboard('grsdk-phase0-poc-alt');
    dashboard.spec.annotations.list = [{
      builtIn: 1, datasource: { type: 'grafana', uid: '-- Grafana --' }, enable: true,
      hide: true, iconColor: 'rgba(0, 211, 255, 1)', name: 'Annotations & Alerts', type: 'dashboard',
    }];
    expect(preflightGrafana13DashboardV1(dashboard, canonicalManifest()).kind).toBe('match');
    dashboard.spec.annotations.list[0].datasource = { type: 'prometheus', uid: 'token=secret' };
    expect(preflightGrafana13DashboardV1(dashboard, canonicalManifest()).kind).toBe('unsupported');
  });

  it('sanitizes dashboard-controlled identifiers and unknown property names', () => {
    const dashboard = mutableDashboard('grsdk-phase0-poc-alt');
    dashboard.spec['password=secret-key'] = true;
    dashboard.spec.panels[0].type = 'privateToken123';
    const result = preflightGrafana13DashboardV1(dashboard, canonicalManifest());
    expect(result.kind).toBe('unsupported');
    expect(JSON.stringify(result)).not.toMatch(/password=secret-key|privateToken123/);
  });

  it('bounds the aggregate transformation inventory at 256 entries', () => {
    const dashboard = mutableDashboard();
    const panel = dashboard.spec.panels[2];
    dashboard.spec.panels = Array.from({ length: 256 }, (_unused, index) => ({
      ...structuredClone(panel), id: index + 1,
      gridPos: { h: 1, w: 1, x: index % 24, y: Math.floor(index / 24) },
    }));
    expect(preflightGrafana13DashboardV1(dashboard, canonicalManifest()).inventory.transformationIds).toEqual(['renameByRegex']);
    dashboard.spec.panels[255].transformations.push(structuredClone(panel.transformations[0]));
    const over = preflightGrafana13DashboardV1(dashboard, canonicalManifest());
    expect(over.kind).toBe('unsupported');
    expect(over.inventory.transformationIds).toEqual(['renameByRegex']);
  });
});

describe('public retrieval and preflight facade', () => {
  it('returns static ready evidence without claiming runtime admission or renderability', async () => {
    const dashboard = fixtureDashboard('grsdk-phase0-poc-alt');
    const execute = vi.fn()
      .mockResolvedValueOnce({ kind: 'response', response: { body: JSON.stringify({
        kind: 'APIGroup', name: 'dashboard.grafana.app', preferredVersion: { groupVersion: 'dashboard.grafana.app/v1', version: 'v1' },
        versions: [{ groupVersion: 'dashboard.grafana.app/v1', version: 'v1' }],
      }), headers: [], status: 200 } })
      .mockResolvedValueOnce({ kind: 'response', response: { body: JSON.stringify(dashboard), headers: [], status: 200 } });
    const { family: _family, ...wireDashboard } = dashboard;
    execute.mockReset().mockResolvedValueOnce({ kind: 'response', response: { body: JSON.stringify({
      kind: 'APIGroup', name: 'dashboard.grafana.app', preferredVersion: { groupVersion: 'dashboard.grafana.app/v1', version: 'v1' },
      versions: [{ groupVersion: 'dashboard.grafana.app/v1', version: 'v1' }],
    }), headers: [], status: 200 } }).mockResolvedValueOnce({ kind: 'response', response: { body: JSON.stringify(wireDashboard), headers: [], status: 200 } });
    const result = await retrieveAndPreflightGrafana13DashboardV1({
      manifest: canonicalManifest(), namespace: 'default', requestIds: { dashboard: 'd', discovery: 'a' },
      signal: new AbortController().signal, transport: { descriptor: {} as never, execute } as HostTransportCapability,
      uid: 'grsdk-phase0-poc-alt',
    });
    expect(result.kind).toBe('ready');
    if (result.kind === 'ready') {
      expect(result.staticPreflight.outcome).toBe('declared-requirements-match');
      expect(result.staticPreflight).not.toHaveProperty('runtimeAdmission');
      expect(result.staticPreflight).not.toHaveProperty('renderable');
    }
  });

  it('constructs ready request IDs explicitly without invoking extra caller getters', async () => {
    const dashboard = fixtureDashboard('grsdk-phase0-poc-alt');
    const { family: _family, ...wireDashboard } = dashboard;
    const execute = vi.fn()
      .mockResolvedValueOnce({ kind: 'response', response: { body: JSON.stringify({ kind: 'APIGroup', name: 'dashboard.grafana.app', preferredVersion: { groupVersion: 'dashboard.grafana.app/v1', version: 'v1' }, versions: [{ groupVersion: 'dashboard.grafana.app/v1', version: 'v1' }] }), headers: [], status: 200 } })
      .mockResolvedValueOnce({ kind: 'response', response: { body: JSON.stringify(wireDashboard), headers: [], status: 200 } });
    const requestIds = { dashboard: 'd', discovery: 'a' } as Record<string, string>;
    Object.defineProperty(requestIds, 'secret', { enumerable: true, get: () => { throw new Error('secret-request-id'); } });
    const input = { manifest: canonicalManifest(), namespace: 'default', requestIds, signal: new AbortController().signal, transport: { descriptor: {} as never, execute } as HostTransportCapability, uid: 'grsdk-phase0-poc-alt' } as never;
    await expect(retrieveAndPreflightGrafana13DashboardV1(input)).resolves.toMatchObject({ kind: 'ready', requestIds: { dashboard: 'd', discovery: 'a' } });
  });

  it('snapshots validated UID, namespace, signal and request IDs without re-reading caller getters', async () => {
    const dashboard = fixtureDashboard('grsdk-phase0-poc-alt');
    const { family: _family, ...wireDashboard } = dashboard;
    const execute = vi.fn()
      .mockResolvedValueOnce({ kind: 'response', response: { body: JSON.stringify({ kind: 'APIGroup', name: 'dashboard.grafana.app', preferredVersion: { groupVersion: 'dashboard.grafana.app/v1', version: 'v1' }, versions: [{ groupVersion: 'dashboard.grafana.app/v1', version: 'v1' }] }), headers: [], status: 200 } })
      .mockResolvedValueOnce({ kind: 'response', response: { body: JSON.stringify(wireDashboard), headers: [], status: 200 } });
    const once = <T>(value: T) => {
      let reads = 0;
      return () => {
        reads += 1;
        if (reads > 1) throw new Error('caller getter was read again');
        return value;
      };
    };
    const signal = new AbortController().signal;
    const requestIds = {} as Record<string, string>;
    Object.defineProperties(requestIds, {
      dashboard: { enumerable: true, get: once('d') },
      discovery: { enumerable: true, get: once('a') },
    });
    const input = {} as Grafana13DashboardLoadInput;
    Object.defineProperties(input, {
      manifest: { enumerable: true, value: canonicalManifest() },
      namespace: { enumerable: true, get: once('default') },
      requestIds: { enumerable: true, value: requestIds },
      signal: { enumerable: true, get: once(signal) },
      transport: { enumerable: true, value: { descriptor: {} as never, execute } as HostTransportCapability },
      uid: { enumerable: true, get: once('grsdk-phase0-poc-alt') },
    });
    await expect(retrieveAndPreflightGrafana13DashboardV1(input)).resolves.toMatchObject({
      kind: 'ready', requestIds: { dashboard: 'd', discovery: 'a' },
    });
    expect(execute.mock.calls[1]?.[0].path).toContain('/namespaces/default/dashboards/grsdk-phase0-poc-alt/dto');
  });
});
