import {
  validateProviderCompatibilityManifest,
  type HostTransportCapability,
  type ManifestValidationSuccess,
  type TransportRequest,
  type TransportResult,
} from '@dashboard-render-sdk-g/provider-contract';
import { describe, expect, it, vi } from 'vitest';

import type { Grafana13DashboardLoadInput } from './contracts';
import {
  decodeGrafana13DiscoveryBody,
  decodeGrafana13DiscoveryValue,
  discoverStableGrafana13DashboardV1,
  validateDashboardLoadInput,
} from './dashboardApi';

function manifest(): ManifestValidationSuccess {
  const result = validateProviderCompatibilityManifest({
    capabilities: {
      datasources: ['grafana-testdata-datasource'],
      panels: ['text', 'stat', 'timeseries'],
      transformations: { allowEmptyPipeline: true, ids: ['renameByRegex'], maxChainLength: 1 },
    },
    dashboards: {
      apis: [{ group: 'dashboard.grafana.app', version: 'v1' }],
      lookup: 'uid',
      schemas: [{ family: 'v1', schemaVersion: 42 }],
    },
    host: { reactDomVersion: '19.2.8', reactVersion: '19.2.8' },
    provenance: { recordId: 'provider-13-test' },
    provider: { buildId: 'test-build', id: 'provider-13', supportTier: 'experimental', version: '0.0.0' },
    runtimeDependencies: [],
    schemaVersion: 1,
    target: {
      cells: [{ edition: 'oss', source: { repository: 'grafana/grafana', revision: '6193dc03311b631b9727b560d24369e683dc396e' }, version: '13.2.3' }],
      family: 'grafana',
    },
  });
  if (!result.valid) throw new Error('test manifest must be valid');
  return result;
}

const discovery = {
  apiVersion: 'v1',
  kind: 'APIGroup',
  name: 'dashboard.grafana.app',
  preferredVersion: { groupVersion: 'dashboard.grafana.app/v2', version: 'v2' },
  versions: [
    { groupVersion: 'dashboard.grafana.app/v2', version: 'v2' },
    { groupVersion: 'dashboard.grafana.app/v1', version: 'v1' },
    { groupVersion: 'dashboard.grafana.app/v1beta1', version: 'v1beta1' },
  ],
};

function response(body: unknown, status = 200): TransportResult {
  return {
    kind: 'response',
    requestId: 'discovery-request',
    response: { body: typeof body === 'string' ? body : JSON.stringify(body), headers: [], status },
  };
}

function setup(result: TransportResult | (() => Promise<TransportResult>) = response(discovery)) {
  const execute = vi.fn(async (_request: TransportRequest) =>
    typeof result === 'function' ? await result() : result
  );
  const transport: HostTransportCapability = {
    descriptor: {
      basePath: '',
      requestPolicyId: 'test-policy',
      schemaVersion: 1,
      securityScopeId: 'test-scope',
      targetOrigin: 'http://example.test',
    },
    execute,
  };
  const input: Grafana13DashboardLoadInput = {
    manifest: manifest(),
    namespace: 'default',
    requestIds: { dashboard: 'dashboard-request', discovery: 'discovery-request' },
    signal: new AbortController().signal,
    transport,
    uid: 'grsdk-phase0-poc-alt',
  };
  return { execute, input };
}

function expectInputFailure(input: Grafana13DashboardLoadInput) {
  expect(validateDashboardLoadInput(input)).toEqual({
    error: {
      code: 'dashboard.input-invalid',
      message: 'Dashboard load input is invalid.',
      path: '$.input',
      stage: 'input',
    },
    kind: 'failure',
  });
}

describe('provider-13 dashboard input', () => {
  it.each(['grsdk-phase0-poc', 'grsdk-phase0-poc-alt', '_leading', '-leading', 'A'])('accepts valid UID %s', (uid) => {
    const { input } = setup();
    expect(validateDashboardLoadInput({ ...input, uid }).kind).toBe('success');
  });

  it.each(['', 'x'.repeat(41), '../admin', 'bad/uid', 'bad%20uid', 'bad uid', 'Dashboard Title'])('rejects invalid UID %j', (uid) => {
    const { input } = setup();
    expectInputFailure({ ...input, uid });
  });

  it.each(['', 'Default', '../default', 'bad/name', 'x'.repeat(64), '-bad', 'bad-'])('rejects invalid namespace %j', (namespace) => {
    const { input } = setup();
    expectInputFailure({ ...input, namespace });
  });

  it('rejects duplicate, empty, and control-bearing request IDs without transport', async () => {
    for (const requestIds of [
      { dashboard: 'same', discovery: 'same' },
      { dashboard: '', discovery: 'discovery' },
      { dashboard: 'dashboard', discovery: 'bad\nvalue' },
    ]) {
      const { execute, input } = setup();
      expectInputFailure({ ...input, requestIds });
      expect(execute).not.toHaveBeenCalled();
    }
  });

  it('rejects a non-native signal and does not leak throwing input detail', () => {
    const { input } = setup();
    expectInputFailure({ ...input, signal: { aborted: false } as AbortSignal });
    const hostile = new Proxy(input, { get: () => { throw new Error('secret'); } });
    expect(validateDashboardLoadInput(hostile)).toEqual(expect.objectContaining({ kind: 'failure' }));
    expect(JSON.stringify(validateDashboardLoadInput(hostile))).not.toContain('secret');
  });

  it('returns cancellation for a pre-aborted request without transport', () => {
    const { execute, input } = setup();
    const controller = new AbortController();
    controller.abort();
    expect(validateDashboardLoadInput({ ...input, signal: controller.signal })).toEqual({
      kind: 'cancelled', requestId: 'discovery-request', stage: 'discovery',
    });
    expect(execute).not.toHaveBeenCalled();
  });
});

describe('stable V1 discovery', () => {
  it('uses the exact request and selects v1 independently of preferred/order', async () => {
    const { execute, input } = setup(response({ ...discovery, versions: [...discovery.versions].reverse() }));
    const validated = validateDashboardLoadInput(input);
    if (validated.kind !== 'success') throw new Error('expected valid input');
    const result = await discoverStableGrafana13DashboardV1(validated.value);
    expect(result).toEqual({ kind: 'success', value: {
      advertisedVersions: ['v1beta1', 'v1', 'v2'], preferredVersion: 'v2', selectedVersion: 'v1',
    } });
    expect(execute).toHaveBeenCalledWith({
      headers: [['Accept', 'application/json']], method: 'GET', path: '/apis/dashboard.grafana.app/',
      requestId: 'discovery-request', signal: input.signal,
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.kind === 'success' ? result.value.advertisedVersions : [])).toBe(true);
  });

  it('returns unsupported without transport when manifest lookup or API declaration is missing', async () => {
    for (const mutate of [
      (value: Record<string, unknown>) => ((value.dashboards as Record<string, unknown>).lookup = 'slug'),
      (value: Record<string, unknown>) => ((value.dashboards as Record<string, unknown>).apis = [{ group: 'dashboard.grafana.app', version: 'v2' }]),
    ]) {
      const { execute, input } = setup();
      const raw = structuredClone(input.manifest.manifest) as unknown as Record<string, unknown>;
      mutate(raw);
      const validatedManifest = validateProviderCompatibilityManifest(raw);
      if (!validatedManifest.valid) throw new Error('mutated test manifest must remain structurally valid');
      const validated = validateDashboardLoadInput({ ...input, manifest: validatedManifest });
      if (validated.kind !== 'success') throw new Error('expected valid input');
      expect(await discoverStableGrafana13DashboardV1(validated.value)).toMatchObject({ kind: 'unsupported', stage: 'discovery' });
      expect(execute).not.toHaveBeenCalled();
    }
  });

  it('rejects discovery without stable v1 and never attempts another API family', async () => {
    const { execute, input } = setup(response({ ...discovery, versions: [discovery.versions[0]] }));
    const validated = validateDashboardLoadInput(input);
    if (validated.kind !== 'success') throw new Error('expected valid input');
    expect(await discoverStableGrafana13DashboardV1(validated.value)).toMatchObject({ kind: 'unsupported', stage: 'discovery' });
    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute.mock.calls.flatMap(([request]) => request.path)).not.toEqual(expect.arrayContaining(['/api/dashboards/uid/', '/apis/dashboard.grafana.app/v2']));
  });

  it.each([
    [401, 'dashboard.unauthorized'], [403, 'dashboard.forbidden'], [500, 'dashboard.http-error'],
  ] as const)('classifies HTTP %s', async (status, code) => {
    const { input } = setup(response({}, status));
    const validated = validateDashboardLoadInput(input);
    if (validated.kind !== 'success') throw new Error('expected valid input');
    expect(await discoverStableGrafana13DashboardV1(validated.value)).toMatchObject({ error: { code, requestId: 'discovery-request', status }, kind: 'failure' });
  });

  it('classifies discovery 404 as unsupported', async () => {
    const { input } = setup(response({}, 404));
    const validated = validateDashboardLoadInput(input);
    if (validated.kind !== 'success') throw new Error('expected valid input');
    expect(await discoverStableGrafana13DashboardV1(validated.value)).toMatchObject({ kind: 'unsupported', stage: 'discovery' });
  });

  it.each([
    [{ kind: 'network-error', requestId: 'discovery-request' }, 'dashboard.network-error'],
    [{ code: 'invalid-response', kind: 'policy-error', requestId: 'discovery-request' }, 'dashboard.transport-policy-error'],
  ] as const)('normalizes transport failure %#', async (transportResult, code) => {
    const { input } = setup(transportResult);
    const validated = validateDashboardLoadInput(input);
    if (validated.kind !== 'success') throw new Error('expected valid input');
    expect(await discoverStableGrafana13DashboardV1(validated.value)).toMatchObject({ error: { code }, kind: 'failure' });
  });

  it('preserves transport cancellation', async () => {
    const { input } = setup({ kind: 'cancelled', requestId: 'discovery-request' });
    const validated = validateDashboardLoadInput(input);
    if (validated.kind !== 'success') throw new Error('expected valid input');
    expect(await discoverStableGrafana13DashboardV1(validated.value)).toEqual({ kind: 'cancelled', requestId: 'discovery-request', stage: 'discovery' });
  });

  it.each([
    '{}', '{', JSON.stringify({ ...discovery, kind: 'Wrong' }),
    JSON.stringify({ ...discovery, versions: [...discovery.versions, discovery.versions[1]] }),
  ])('rejects malformed discovery body', (body) => {
    expect(decodeGrafana13DiscoveryBody(body, 'discovery-request')).toMatchObject({ error: { code: 'dashboard.response-malformed' }, kind: 'failure' });
  });

  it('enforces body, array, property, depth and node bounds', () => {
    expect(decodeGrafana13DiscoveryBody(' '.repeat(1_048_577), 'discovery-request')).toMatchObject({ kind: 'failure' });
    expect(decodeGrafana13DiscoveryValue({ ...discovery, versions: Array.from({ length: 65 }, (_, index) => ({ groupVersion: `dashboard.grafana.app/v${index}`, version: `v${index}` })) }, 'discovery-request')).toMatchObject({ kind: 'failure' });
    expect(decodeGrafana13DiscoveryValue(Object.fromEntries(Array.from({ length: 1_025 }, (_, index) => [`p${index}`, index])), 'discovery-request')).toMatchObject({ kind: 'failure' });
    let deep: unknown = 'leaf';
    for (let index = 0; index < 34; index += 1) deep = { value: deep };
    expect(decodeGrafana13DiscoveryValue(deep, 'discovery-request')).toMatchObject({ kind: 'failure' });
    expect(decodeGrafana13DiscoveryValue(Array.from({ length: 1_024 }, () => Array.from({ length: 17 }, () => null)), 'discovery-request')).toMatchObject({ kind: 'failure' });
  });

  it('rejects sparse, symbol, accessor, throwing and revoked hostile values deterministically', () => {
    const sparse = [...discovery.versions];
    delete sparse[1];
    const symbolValue = { ...discovery, [Symbol('secret')]: true };
    const accessor = { ...discovery };
    Object.defineProperty(accessor, 'secret', { enumerable: true, get: () => 'secret' });
    const throwing = new Proxy(discovery, { ownKeys: () => { throw new Error('secret'); } });
    const { proxy, revoke } = Proxy.revocable(discovery, {});
    revoke();
    for (const value of [{ ...discovery, versions: sparse }, symbolValue, accessor, throwing, proxy]) {
      const result = decodeGrafana13DiscoveryValue(value, 'discovery-request');
      expect(result).toMatchObject({ error: { code: 'dashboard.response-malformed' }, kind: 'failure' });
      expect(JSON.stringify(result)).not.toContain('secret');
    }
  });
});
