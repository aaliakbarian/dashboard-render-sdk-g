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
  retrieveGrafana13DashboardV1Dto,
  validateDashboardLoadInput,
  type Grafana13DashboardDiscovery,
} from './dashboardApi';
import {
  decodeGrafana13DashboardV1Body,
  decodeGrafana13DashboardV1Value,
} from './dashboardDto';

function manifest(): ManifestValidationSuccess {
  const result = validateProviderCompatibilityManifest({
    capabilities: { datasources: ['grafana-testdata-datasource'], panels: ['text', 'stat', 'timeseries'], transformations: { allowEmptyPipeline: true, ids: ['renameByRegex'], maxChainLength: 1 } },
    dashboards: { apis: [{ group: 'dashboard.grafana.app', version: 'v1' }], lookup: 'uid', schemas: [{ family: 'v1', schemaVersion: 42 }] },
    host: { reactDomVersion: '19.2.8', reactVersion: '19.2.8' },
    provenance: { recordId: 'test' },
    provider: { buildId: 'test-build', id: 'provider-13', supportTier: 'experimental', version: '0.0.0' },
    runtimeDependencies: [], schemaVersion: 1,
    target: { cells: [{ edition: 'oss', source: { repository: 'grafana/grafana', revision: '6193dc03311b631b9727b560d24369e683dc396e' }, version: '13.2.3' }], family: 'grafana' },
  });
  if (!result.valid) throw new Error('invalid test manifest');
  return result;
}

function dto(uid = 'grsdk-phase0-poc-alt', overrides: Record<string, unknown> = {}) {
  return {
    access: { canAdmin: false, canDelete: false, canEdit: true, canSave: true, canStar: false, isPublic: false, slug: uid, url: `/d/${uid}` },
    apiVersion: 'dashboard.grafana.app/v1',
    kind: 'DashboardWithAccessInfo',
    metadata: { generation: 1, name: uid, namespace: 'default', resourceVersion: 'rv-1', uid: 'opaque-resource-id' },
    spec: { panels: [], schemaVersion: 42, title: 'Fixture', uid },
    status: { conversion: { failed: false, storedVersion: 'v1' } },
    ...overrides,
  };
}

function transportResponse(body: unknown, status = 200): TransportResult {
  return { kind: 'response', requestId: 'dashboard-request', response: { body: typeof body === 'string' ? body : JSON.stringify(body), headers: [], status } };
}

function setup(result: TransportResult | (() => Promise<TransportResult>) = transportResponse(dto())) {
  const execute = vi.fn(async (_request: TransportRequest) => typeof result === 'function' ? await result() : result);
  const transport: HostTransportCapability = {
    descriptor: { basePath: '', requestPolicyId: 'test', schemaVersion: 1, securityScopeId: 'scope', targetOrigin: 'http://example.test' },
    execute,
  };
  const input: Grafana13DashboardLoadInput = {
    manifest: manifest(), namespace: 'default', requestIds: { dashboard: 'dashboard-request', discovery: 'discovery-request' },
    signal: new AbortController().signal, transport, uid: 'grsdk-phase0-poc-alt',
  };
  const validated = validateDashboardLoadInput(input);
  if (validated.kind !== 'success') throw new Error('input must be valid');
  const discovery: Grafana13DashboardDiscovery = { advertisedVersions: ['v1'], preferredVersion: 'v1', selectedVersion: 'v1' };
  return { discovery, execute, input, validated: validated.value };
}

describe('stable V1 DTO retrieval', () => {
  it('uses the exact stable V1 DTO path, request ID and signal', async () => {
    const { discovery, execute, input, validated } = setup();
    const result = await retrieveGrafana13DashboardV1Dto(validated, discovery);
    expect(result).toMatchObject({ kind: 'success', value: { metadata: { name: input.uid }, spec: { schemaVersion: 42 } } });
    expect(execute).toHaveBeenCalledWith({
      headers: [['Accept', 'application/json']], method: 'GET',
      path: '/apis/dashboard.grafana.app/v1/namespaces/default/dashboards/grsdk-phase0-poc-alt/dto',
      requestId: 'dashboard-request', signal: input.signal,
    });
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it.each([[401, 'dashboard.unauthorized'], [403, 'dashboard.forbidden'], [404, 'dashboard.not-found'], [500, 'dashboard.http-error']] as const)('classifies HTTP %s', async (status, code) => {
    const { discovery, validated } = setup(transportResponse({}, status));
    expect(await retrieveGrafana13DashboardV1Dto(validated, discovery)).toMatchObject({ error: { code, requestId: 'dashboard-request', status }, kind: 'failure' });
  });

  it.each([
    [{ kind: 'network-error', requestId: 'dashboard-request' }, 'dashboard.network-error'],
    [{ code: 'invalid-response', kind: 'policy-error', requestId: 'dashboard-request' }, 'dashboard.transport-policy-error'],
  ] as const)('normalizes transport result %#', async (transportResult, code) => {
    const { discovery, validated } = setup(transportResult);
    expect(await retrieveGrafana13DashboardV1Dto(validated, discovery)).toMatchObject({ error: { code }, kind: 'failure' });
  });

  it('preserves cancellation after discovery', async () => {
    const { discovery, validated } = setup({ kind: 'cancelled', requestId: 'dashboard-request' });
    expect(await retrieveGrafana13DashboardV1Dto(validated, discovery)).toEqual({ kind: 'cancelled', requestId: 'dashboard-request', stage: 'dashboard-v1' });
  });

  it('keeps concurrent UID loads independent when they resolve out of order', async () => {
    const releases = new Map<string, (value: TransportResult) => void>();
    const execute = vi.fn((request: TransportRequest) => new Promise<TransportResult>((resolve) => releases.set(request.path, resolve)));
    const base = setup();
    const create = (uid: string, dashboardId: string) => validateDashboardLoadInput({ ...base.input, requestIds: { dashboard: dashboardId, discovery: `discovery-${dashboardId}` }, transport: { ...base.input.transport, execute }, uid });
    const first = create('grsdk-phase0-poc', 'dashboard-a');
    const second = create('grsdk-phase0-poc-alt', 'dashboard-b');
    if (first.kind !== 'success' || second.kind !== 'success') throw new Error('inputs must be valid');
    const pendingA = retrieveGrafana13DashboardV1Dto(first.value, base.discovery);
    const pendingB = retrieveGrafana13DashboardV1Dto(second.value, base.discovery);
    releases.get('/apis/dashboard.grafana.app/v1/namespaces/default/dashboards/grsdk-phase0-poc-alt/dto')?.({ kind: 'response', requestId: 'dashboard-b', response: { body: JSON.stringify(dto('grsdk-phase0-poc-alt')), headers: [], status: 200 } });
    expect(await pendingB).toMatchObject({ kind: 'success', value: { metadata: { name: 'grsdk-phase0-poc-alt' } } });
    releases.get('/apis/dashboard.grafana.app/v1/namespaces/default/dashboards/grsdk-phase0-poc/dto')?.({ kind: 'response', requestId: 'dashboard-a', response: { body: JSON.stringify(dto('grsdk-phase0-poc')), headers: [], status: 200 } });
    expect(await pendingA).toMatchObject({ kind: 'success', value: { metadata: { name: 'grsdk-phase0-poc' } } });
  });
});

describe('DashboardWithAccessInfo decoding', () => {
  const expected = { namespace: 'default', requestId: 'dashboard-request', uid: 'grsdk-phase0-poc-alt' };

  it.each([
    ['absent status', () => { const value = dto(expected.uid); delete (value as { status?: unknown }).status; return value; }],
    ['absent conversion', () => dto(expected.uid, { status: {} })],
    ['successful conversion', () => dto(expected.uid)],
  ])('accepts %s and omits opaque metadata.uid', (_name, makeValue) => {
    const result = decodeGrafana13DashboardV1Value(makeValue(), expected);
    expect(result).toMatchObject({ kind: 'success', value: { access: { canEdit: true }, family: 'v1', metadata: { name: expected.uid, namespace: 'default' }, spec: { schemaVersion: 42 } } });
    if (result.kind !== 'success') throw new Error('expected success');
    expect(result.value.metadata).not.toHaveProperty('uid');
    expect(Object.isFrozen(result.value)).toBe(true);
    expect(Object.isFrozen(result.value.spec)).toBe(true);
  });

  it('uses metadata.name and namespace as identity and ignores opaque metadata.uid', () => {
    expect(decodeGrafana13DashboardV1Value(dto(expected.uid, { metadata: { name: expected.uid, namespace: 'default', uid: 'different' } }), expected).kind).toBe('success');
    for (const metadata of [
      { name: 'other', namespace: 'default' },
      { name: expected.uid, namespace: 'other' },
    ]) expect(decodeGrafana13DashboardV1Value(dto(expected.uid, { metadata }), expected)).toMatchObject({ error: { code: 'dashboard.identity-mismatch' }, kind: 'failure' });
  });

  it('recognizes but does not retain standard Kubernetes managedFields metadata', () => {
    const value = dto(expected.uid);
    value.metadata = {
      ...value.metadata,
      managedFields: [{ apiVersion: 'dashboard.grafana.app/v1', manager: 'grafana' }],
    } as typeof value.metadata;
    const result = decodeGrafana13DashboardV1Value(value, expected);
    expect(result.kind).toBe('success');
    if (result.kind === 'success') expect(result.value.metadata).not.toHaveProperty('managedFields');
  });

  it('requires canonical access booleans and accepts nullable annotation permissions', () => {
    expect(decodeGrafana13DashboardV1Value(dto(expected.uid, { access: {} }), expected)).toMatchObject({ kind: 'failure' });
    const value = dto(expected.uid, { access: { canAdmin: false, canDelete: false, canEdit: true, canSave: true, canStar: false, isPublic: false, annotationsPermissions: null } });
    const result = decodeGrafana13DashboardV1Value(value, expected);
    expect(result.kind).toBe('success');
    if (result.kind === 'success') expect(result.value.access).not.toHaveProperty('annotationsPermissions');
  });

  it('rejects explicit failed conversion without retaining error/source', () => {
    const result = decodeGrafana13DashboardV1Value(dto(expected.uid, { status: { conversion: { error: 'token=secret', failed: true, source: { secret: true }, storedVersion: 'v2' } } }), expected);
    expect(result).toMatchObject({ kind: 'unsupported', stage: 'dashboard-v1' });
    expect(JSON.stringify(result)).not.toMatch(/secret|token|source|storedVersion/);
  });

  it('rejects unsupported schema independently from malformed DTOs', () => {
    expect(decodeGrafana13DashboardV1Value(dto(expected.uid, { spec: { panels: [], schemaVersion: 41 } }), expected)).toMatchObject({ diagnostics: [expect.objectContaining({ code: 'dashboard.schema-unsupported' })], kind: 'unsupported' });
    expect(decodeGrafana13DashboardV1Value(dto(expected.uid, { spec: { panels: [], schemaVersion: '42' } }), expected)).toMatchObject({ error: { code: 'dashboard.response-malformed' }, kind: 'failure' });
  });

  it.each([
    ['wrong api', { apiVersion: 'dashboard.grafana.app/v2' }], ['wrong kind', { kind: 'Dashboard' }],
    ['missing access', { access: undefined }], ['bad access', { access: { canEdit: 'yes' } }],
    ['missing metadata', { metadata: undefined }], ['missing spec', { spec: undefined }],
    ['bad panels', { spec: { panels: {}, schemaVersion: 42 } }], ['unknown envelope field', { extra: true }],
  ])('rejects malformed envelope: %s', (_name, overrides) => {
    expect(decodeGrafana13DashboardV1Value(dto(expected.uid, overrides), expected)).toMatchObject({ error: { code: 'dashboard.response-malformed' }, kind: 'failure' });
  });

  it('rejects malformed JSON and bounded body overflow', () => {
    expect(decodeGrafana13DashboardV1Body('{', expected)).toMatchObject({ kind: 'failure' });
    expect(decodeGrafana13DashboardV1Body(' '.repeat(1_048_577), expected)).toMatchObject({ kind: 'failure' });
  });

  it('enforces the panel bound', () => {
    expect(decodeGrafana13DashboardV1Value(dto(expected.uid, { spec: { panels: Array.from({ length: 256 }, () => ({})), schemaVersion: 42 } }), expected).kind).toBe('success');
    expect(decodeGrafana13DashboardV1Value(dto(expected.uid, { spec: { panels: Array.from({ length: 257 }, () => ({})), schemaVersion: 42 } }), expected)).toMatchObject({ kind: 'failure' });
  });

  it('rejects non-JSON, sparse, symbol, accessor, prototype and hostile proxy values', () => {
    const sparse: unknown[] = [];
    sparse.length = 1;
    const symbolValue = dto(expected.uid) as Record<PropertyKey, unknown>;
    symbolValue[Symbol('secret')] = true;
    const accessor = dto(expected.uid);
    Object.defineProperty(accessor, 'secret', { enumerable: true, get: () => 'secret' });
    const customPrototype = Object.create({ inherited: true }) as Record<string, unknown>;
    Object.assign(customPrototype, dto(expected.uid));
    const throwing = new Proxy(dto(expected.uid), { ownKeys: () => { throw new Error('secret'); } });
    const revoked = Proxy.revocable(dto(expected.uid), {}); revoked.revoke();
    for (const value of [
      dto(expected.uid, { spec: { panels: [], schemaVersion: Number.NaN } }),
      dto(expected.uid, { spec: { panels: sparse, schemaVersion: 42 } }), symbolValue,
      accessor, customPrototype, throwing, revoked.proxy,
    ]) {
      const result = decodeGrafana13DashboardV1Value(value, expected);
      expect(result).toMatchObject({ error: { code: 'dashboard.response-malformed' }, kind: 'failure' });
      expect(JSON.stringify(result)).not.toContain('secret');
    }
  });

  it('returns typed failures for hostile array length and expected-identity reflection', () => {
    const array = new Proxy([], { get: (target, key) => { if (key === 'length') throw new Error('secret-array-length'); return Reflect.get(target, key); } });
    expect(() => decodeGrafana13DashboardV1Value(array, expected)).not.toThrow();
    expect(decodeGrafana13DashboardV1Value(array, expected)).toMatchObject({ kind: 'failure' });
    const hostileExpected = new Proxy(expected, { get: () => { throw new Error('secret-expected'); } });
    expect(() => decodeGrafana13DashboardV1Value(dto(expected.uid), hostileExpected)).not.toThrow();
    expect(decodeGrafana13DashboardV1Value(dto(expected.uid), hostileExpected)).toMatchObject({ kind: 'failure' });
  });

  it('detaches and deeply freezes returned dashboard data', () => {
    const input = dto(expected.uid, { spec: { nested: { value: 'original' }, panels: [], schemaVersion: 42 } });
    const result = decodeGrafana13DashboardV1Value(input, expected);
    if (result.kind !== 'success') throw new Error('expected success');
    (input.spec as unknown as { nested: { value: string } }).nested.value = 'mutated';
    expect((result.value.spec.nested as { readonly value: string }).value).toBe('original');
    expect(Object.isFrozen(result.value.spec.nested)).toBe(true);
  });
});
