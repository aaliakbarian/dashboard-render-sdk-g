import { validateProviderCompatibilityManifest, type HostTransportCapability, type TransportRequest, type TransportResult } from '@dashboard-render-sdk-g/provider-contract';
import { describe, expect, it, vi } from 'vitest';

import type { Grafana13PartialDashboardLoadInput } from './partialContracts';
import * as provider from './index';
import { fixtureDashboard } from './testFixtures.test';

const discovery = { kind: 'APIGroup', name: 'dashboard.grafana.app',
  preferredVersion: { groupVersion: 'dashboard.grafana.app/v2', version: 'v2' },
  versions: [{ groupVersion: 'dashboard.grafana.app/v1', version: 'v1' }, { groupVersion: 'dashboard.grafana.app/v2', version: 'v2' }],
};

function response(body: unknown, status = 200): TransportResult {
  return { kind: 'response', requestId: 'ignored-transport-id', response: {
    body: typeof body === 'string' ? body : JSON.stringify(body), headers: [['x-secret', 'secret-header']], status,
  } };
}

function dto(uid: 'grsdk-phase0-poc' | 'grsdk-phase0-poc-alt' = 'grsdk-phase0-poc') {
  const { family: _family, ...value } = structuredClone(fixtureDashboard(uid));
  return value;
}

function setup(overrides: Partial<Record<'health' | 'discovery' | 'dashboard-v1', TransportResult | (() => Promise<TransportResult>)>> = {}) {
  const controller = new AbortController();
  const requests: TransportRequest[] = [];
  const execute = vi.fn(async (request: TransportRequest): Promise<TransportResult> => {
    requests.push(request);
    const stage = request.path === '/api/health' ? 'health' : request.path.endsWith('/dto') ? 'dashboard-v1' : 'discovery';
    const override = overrides[stage];
    if (override) return typeof override === 'function' ? await override() : override;
    return stage === 'health' ? response({ commit: 'Docker-BuildCommit-is-not-source-revision', database: 'ok', version: '13.2.3' })
      : stage === 'discovery' ? response(discovery) : response(dto());
  });
  const transport: HostTransportCapability = { descriptor: {
    basePath: '/grafana', requestPolicyId: 'test-policy', schemaVersion: 1, securityScopeId: 'test-scope', targetOrigin: 'https://grafana.example.test',
  }, execute };
  const validation = validateProviderCompatibilityManifest(provider.grafana13Provider.manifest);
  if (!validation.valid) throw new Error('valid concrete manifest required');
  const input: Grafana13PartialDashboardLoadInput = {
    manifest: validation, namespace: 'default', requestIds: { dashboard: 'dashboard-id', discovery: 'discovery-id', health: 'health-id' },
    signal: controller.signal, transport, uid: 'grsdk-phase0-poc',
  };
  return { controller, execute, input, requests };
}

describe('partial dashboard load facade', () => {
  it('uses host transport health, stable discovery, and UID DTO stages with exact IDs/signals', async () => {
    const { input, requests } = setup();
    const result = await provider.retrieveAndClassifyGrafana13DashboardV1(input);
    expect(result).toMatchObject({ kind: 'renderable', requestIds: input.requestIds,
      dashboard: { supportedPanelCount: 3, unsupportedPanelCount: 1, uid: 'grsdk-phase0-poc' } });
    expect(requests).toEqual([
      { headers: [['Accept', 'application/json']], method: 'GET', path: '/api/health', requestId: 'health-id', signal: input.signal },
      { headers: [['Accept', 'application/json']], method: 'GET', path: '/apis/dashboard.grafana.app/', requestId: 'discovery-id', signal: input.signal },
      { headers: [['Accept', 'application/json']], method: 'GET', path: '/apis/dashboard.grafana.app/v1/namespaces/default/dashboards/grsdk-phase0-poc/dto', requestId: 'dashboard-id', signal: input.signal },
    ]);
    expect(JSON.stringify(result)).not.toMatch(/secret-header|Docker-BuildCommit|table_static/);
    if (result.kind === 'renderable') expect(JSON.stringify(result.dashboard.panels.filter(p => p.kind === 'unsupported'))).not.toMatch(/predictable_pulse|renameByRegex/);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.kind === 'renderable' && result.requestIds)).toBe(true);
  });

  it('loads the alternate fixture without requesting a datasource or plugin', async () => {
    const { input, requests } = setup({ 'dashboard-v1': response(dto('grsdk-phase0-poc-alt')) });
    const result = await provider.retrieveAndClassifyGrafana13DashboardV1({ ...input, uid: 'grsdk-phase0-poc-alt' });
    expect(result).toMatchObject({ kind: 'renderable', dashboard: { supportedPanelCount: 1, unsupportedPanelCount: 0 } });
    expect(requests).toHaveLength(3);
  });

  it.each([
    ['grsdk-phase0-poc', 3, 1], ['grsdk-phase0-poc-alt', 1, 0],
  ] as const)('loads canonical metadata identity when %s omits spec.uid', async (uid, supportedPanelCount, unsupportedPanelCount) => {
    const body = dto(uid);
    const { uid: _uid, ...spec } = body.spec;
    const { input } = setup({ 'dashboard-v1': response({ ...body, spec }) });
    expect(await provider.retrieveAndClassifyGrafana13DashboardV1({ ...input, uid })).toMatchObject({
      kind: 'renderable', dashboard: { uid, supportedPanelCount, unsupportedPanelCount },
    });
  });

  it('rejects present spec.uid that conflicts with canonical metadata identity', async () => {
    const body = dto();
    const { input } = setup({ 'dashboard-v1': response({ ...body, spec: { ...body.spec, uid: 'different' } }) });
    expect(await provider.retrieveAndClassifyGrafana13DashboardV1(input)).toMatchObject({
      kind: 'unsupported-dashboard', reason: 'dashboard-profile',
    });
  });

  it.each(['13.2.4', '14.0.0', '13.2.3-beta.1', '13.2.3+build.1'])('returns unsupported dashboard for well-formed health version %s', async (version) => {
    const { input, requests } = setup({ health: response({ commit: 'secret-commit', version }) });
    const result = await provider.retrieveAndClassifyGrafana13DashboardV1(input);
    expect(result).toMatchObject({ kind: 'unsupported-dashboard', reason: 'target-version', diagnosticsTruncated: false });
    expect(requests).toHaveLength(1);
    expect(JSON.stringify(result)).not.toContain('secret');
  });

  it.each(['not-json', 'null', '[]', '{}', '{"version":null}', '{"version":13}', '{"version":"latest"}', '{"version":"01.2.3"}', '{"version":"13.2.3\\nsecret"}', 'x'.repeat(1_048_577)])('rejects malformed health response %#', async (body) => {
    const { input, requests } = setup({ health: response(body) });
    expect(await provider.retrieveAndClassifyGrafana13DashboardV1(input)).toMatchObject({ kind: 'failure', error: {
      code: 'dashboard.response-malformed', requestId: 'health-id', stage: 'health',
    } });
    expect(requests).toHaveLength(1);
  });

  it.each(['health', 'discovery', 'dashboard-v1'] as const)('sanitizes HTTP and transport failures during %s', async (stage) => {
    for (const [value, code, status] of [
      [response('secret-body', 401), 'dashboard.unauthorized', 401],
      [response('secret-body', 403), 'dashboard.forbidden', 403],
      [response('secret-body', 500), 'dashboard.http-error', 500],
      [{ kind: 'network-error', requestId: 'secret-id', cause: 'secret-cause' } as TransportResult, 'dashboard.network-error', undefined],
      [{ code: 'invalid-response', kind: 'policy-error', requestId: 'secret-id' } as TransportResult, 'dashboard.transport-policy-error', undefined],
      [async () => { throw new Error('secret-cause'); }, 'dashboard.network-error', undefined],
    ] as const) {
      const { input } = setup({ [stage]: value });
      const result = await provider.retrieveAndClassifyGrafana13DashboardV1(input);
      expect(result).toMatchObject({ kind: 'failure', error: { code, stage, ...(status === undefined ? {} : { status }) } });
      expect(JSON.stringify(result)).not.toContain('secret');
    }
  });

  it('keeps dashboard 404 as an operational not-found failure', async () => {
    const { input } = setup({ 'dashboard-v1': response('secret-body', 404) });
    expect(await provider.retrieveAndClassifyGrafana13DashboardV1(input)).toMatchObject({ kind: 'failure', error: { code: 'dashboard.not-found', stage: 'dashboard-v1', status: 404 } });
  });

  it('keeps discovery 404 as unsupported dashboard', async () => {
    const { input, requests } = setup({ discovery: response('secret-body', 404) });
    expect(await provider.retrieveAndClassifyGrafana13DashboardV1(input)).toMatchObject({ kind: 'unsupported-dashboard', reason: 'dashboard-profile' });
    expect(requests).toHaveLength(2);
  });

  it.each([
    ['malformed', 'not-json', 'failure', undefined],
    ['bounded', { ...dto(), spec: { ...dto().spec, panels: Array(257).fill(dto().spec.panels[0]) } }, 'failure', undefined],
    ['identity', { ...dto(), metadata: { name: 'wrong', namespace: 'default' } }, 'failure', undefined],
    ['schema', { ...dto(), spec: { ...dto().spec, schemaVersion: 43 } }, 'unsupported-dashboard', 'dashboard-schema'],
    ['conversion', { ...dto(), status: { conversion: { failed: true } } }, 'unsupported-dashboard', 'dashboard-profile'],
  ])('maps %s DTO outcome without rendering', async (_label, body, kind, reason) => {
    const { input } = setup({ 'dashboard-v1': response(body) });
    expect(await provider.retrieveAndClassifyGrafana13DashboardV1(input)).toMatchObject({ kind, ...(reason ? { reason } : {}) });
  });

  it.each([
    { dashboard: 'dashboard-id', discovery: 'discovery-id', health: '' },
    { dashboard: 'dashboard-id', discovery: 'discovery-id', health: 'health\nsecret' },
    { dashboard: 'dashboard-id', discovery: 'discovery-id', health: 'x'.repeat(257) },
    { dashboard: 'dashboard-id', discovery: 'discovery-id', health: 'dashboard-id' },
    { dashboard: 'dashboard-id', discovery: 'discovery-id', health: 'discovery-id' },
  ])('rejects invalid three-stage request IDs %# before transport', async (requestIds) => {
    const { input, requests } = setup();
    expect(await provider.retrieveAndClassifyGrafana13DashboardV1({ ...input, requestIds })).toMatchObject({ kind: 'failure', error: { code: 'dashboard.input-invalid', stage: 'input' } });
    expect(requests).toHaveLength(0);
  });

  it.each(['../admin', 'bad/uid'])('reuses strict UID validation for %s', async (uid) => {
    const { input, requests } = setup();
    expect(await provider.retrieveAndClassifyGrafana13DashboardV1({ ...input, uid })).toMatchObject({ kind: 'failure', error: { code: 'dashboard.input-invalid' } });
    expect(requests).toHaveLength(0);
  });

  it('sanitizes throwing input access and rejects non-native signals', async () => {
    const { input, requests } = setup();
    for (const value of [new Proxy(input, { get() { throw new Error('secret-input'); } }), { ...input, signal: { aborted: false } as AbortSignal }]) {
      const result = await provider.retrieveAndClassifyGrafana13DashboardV1(value);
      expect(result).toMatchObject({ kind: 'failure', error: { code: 'dashboard.input-invalid' } });
      expect(JSON.stringify(result)).not.toContain('secret');
    }
    expect(requests).toHaveLength(0);
  });
});

describe('partial load cancellation ownership', () => {
  it('validates all three request IDs even on pre-aborted input', async () => {
    const { controller, input, requests } = setup();
    controller.abort();
    expect(await provider.retrieveAndClassifyGrafana13DashboardV1({ ...input, requestIds: { ...input.requestIds, health: 'dashboard-id' } }))
      .toMatchObject({ kind: 'failure', error: { code: 'dashboard.input-invalid' } });
    expect(requests).toHaveLength(0);
  });

  it('returns pre-abort at health without transport', async () => {
    const { controller, input, requests } = setup();
    controller.abort();
    expect(await provider.retrieveAndClassifyGrafana13DashboardV1(input)).toEqual({ kind: 'cancelled', requestId: 'health-id', stage: 'health' });
    expect(requests).toHaveLength(0);
  });

  it.each(['health', 'discovery', 'dashboard-v1'] as const)('honors transport cancellation at %s', async (stage) => {
    const { input } = setup({ [stage]: { kind: 'cancelled', requestId: 'ignored-host-id' } });
    expect(await provider.retrieveAndClassifyGrafana13DashboardV1(input)).toEqual({ kind: 'cancelled',
      requestId: stage === 'health' ? 'health-id' : stage === 'discovery' ? 'discovery-id' : 'dashboard-id', stage });
  });

  for (const stage of ['health', 'discovery', 'dashboard-v1'] as const) {
    it.each(['resolve', 'reject'] as const)(`settles promptly on abort at ${stage} and consumes late %s`, async (settlement) => {
      let settle!: (value: TransportResult) => void;
      let reject!: (error: Error) => void;
      let entered!: () => void;
      const started = new Promise<void>((resolve) => { entered = resolve; });
      const pending = new Promise<TransportResult>((resolve, rejectPromise) => { settle = resolve; reject = rejectPromise; });
      const { controller, input, requests } = setup({ [stage]: () => { entered(); return pending; } });
      const added = vi.spyOn(input.signal, 'addEventListener');
      const removed = vi.spyOn(input.signal, 'removeEventListener');
      const load = provider.retrieveAndClassifyGrafana13DashboardV1(input);
      await started;
      controller.abort();
      const result = await Promise.race([load, new Promise((resolve) => { setTimeout(() => resolve('still-pending'), 25); })]);
      expect(result).toEqual({ kind: 'cancelled', requestId: stage === 'health' ? 'health-id' : stage === 'discovery' ? 'discovery-id' : 'dashboard-id', stage });
      const requestCount = requests.length;
      if (settlement === 'reject') reject(new Error('secret-late-rejection'));
      else settle(stage === 'health' ? response({ version: '13.2.3' }) : stage === 'discovery' ? response(discovery) : response(dto()));
      await Promise.resolve();
      await Promise.resolve();
      expect(await load).toEqual(result);
      expect(requests).toHaveLength(requestCount);
      expect(added.mock.calls.filter(([event]) => event === 'abort').length).toBeGreaterThan(0);
      expect(removed.mock.calls.filter(([event]) => event === 'abort')).toHaveLength(added.mock.calls.filter(([event]) => event === 'abort').length);
      added.mockRestore();
      removed.mockRestore();
    });

    it(`lets abort win a successful response race at ${stage}`, async () => {
      const fixture = setup({ [stage]: async () => {
        fixture.controller.abort();
        return stage === 'health' ? response({ version: '13.2.3' }) : stage === 'discovery' ? response(discovery) : response(dto());
      } });
      expect(await provider.retrieveAndClassifyGrafana13DashboardV1(fixture.input)).toEqual({
        kind: 'cancelled', requestId: stage === 'health' ? 'health-id' : stage === 'discovery' ? 'discovery-id' : 'dashboard-id', stage,
      });
      expect(fixture.requests).toHaveLength(stage === 'health' ? 1 : stage === 'discovery' ? 2 : 3);
    });
  }

  it('removes every stage abort listener after successful completion', async () => {
    const { input } = setup();
    const added = vi.spyOn(input.signal, 'addEventListener');
    const removed = vi.spyOn(input.signal, 'removeEventListener');
    expect((await provider.retrieveAndClassifyGrafana13DashboardV1(input)).kind).toBe('renderable');
    expect(added.mock.calls.filter(([event]) => event === 'abort')).toHaveLength(3);
    expect(removed.mock.calls.filter(([event]) => event === 'abort')).toHaveLength(3);
    added.mockRestore();
    removed.mockRestore();
  });

  it.each(['health', 'discovery', 'dashboard-v1'] as const)('removes every listener after an operational failure at %s', async (stage) => {
    const { input } = setup({ [stage]: response('secret-body', 401) });
    const added = vi.spyOn(input.signal, 'addEventListener');
    const removed = vi.spyOn(input.signal, 'removeEventListener');
    expect((await provider.retrieveAndClassifyGrafana13DashboardV1(input)).kind).toBe('failure');
    expect(removed.mock.calls.filter(([event]) => event === 'abort')).toHaveLength(added.mock.calls.filter(([event]) => event === 'abort').length);
    added.mockRestore();
    removed.mockRestore();
  });
});
