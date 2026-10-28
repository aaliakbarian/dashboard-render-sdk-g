import type { HostTransportCapability } from '@dashboard-render-sdk-g/provider-contract';
import { firstValueFrom } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { createGrafana13BackendSrv, Grafana13BackendTransportError } from './backendSrv';

function capability(execute: HostTransportCapability['execute']): HostTransportCapability {
  return {
    descriptor: {
      basePath: '/grafana',
      requestPolicyId: 'policy',
      schemaVersion: 1,
      securityScopeId: 'scope',
      targetOrigin: 'https://host.example',
    },
    execute,
  };
}

describe('createGrafana13BackendSrv', () => {
  it.each([
    { series: [null] }, { tables: [null] }, { series: { length: 1 } }, { tables: 'legacy' },
    { series: [{ target: 'legacy', datapoints: [[1, 1]] }] },
    { tables: [{ columns: [], rows: [] }] },
  ])('rejects material legacy decoder branches even with empty frames: %j', async legacy => {
    const backend = createGrafana13BackendSrv(capability(async request => ({ kind: 'response', requestId: request.requestId,
      response: { body: JSON.stringify({ results: { A: { frames: [], ...legacy } } }), headers: [], status: 200 } })));
    await expect(firstValueFrom(backend.fetch({ method: 'POST', url: '/api/ds/query' })))
      .rejects.toMatchObject({ code: 'transport-response-malformed', status: 500 });
  });
  it.each([{}, { series: [], tables: [] }, { series: null, tables: null }])('keeps native empty frames valid without material legacy data: %j', async legacy => {
    const data = { results: { A: { frames: [], ...legacy } } };
    const backend = createGrafana13BackendSrv(capability(async request => ({ kind: 'response', requestId: request.requestId,
      response: { body: JSON.stringify(data), headers: [], status: 200 } })));
    expect((await firstValueFrom(backend.fetch({ method: 'POST', url: '/api/ds/query' }))).data).toEqual(data);
  });
  it('rejects noniterable notices consumed by the pinned cache-hit decoder branch', async () => {
    const data = { results: { A: { frames: [{ schema: { meta: { notices: 1 }, fields: [{ name: 'Value', type: 'number' }] }, data: { values: [[1]] } }] } } };
    const backend = createGrafana13BackendSrv(capability(async request => ({ kind: 'response', requestId: request.requestId,
      response: { body: JSON.stringify(data), headers: [['X-Cache', 'HIT']], status: 200 } })));
    await expect(firstValueFrom(backend.fetch({ method: 'POST', url: '/api/ds/query' })))
      .rejects.toMatchObject({ code: 'transport-response-malformed', status: 500 });
  });
  it.each(['/api/x/../ds/query', '/api/%64s/query', '/api//ds/query', '/api\\ds/query',
    '/api/ds/qu\tery', '/api/ds/qu\nery', '/api/ds/qu\rery', '/api/ds/query\u0000',
    '/api/ds/query?ds_type=grafana-testdata-data\tsource',
  ])('rejects ambiguous raw URL %s before normalization can hide it', async url => {
    let calls = 0;
    const backend = createGrafana13BackendSrv(capability(async request => { calls++; return { kind: 'cancelled', requestId: request.requestId }; }));
    await expect(backend.request({ method: 'POST', url })).rejects.toMatchObject({ code: 'transport-policy-error' });
    expect(calls).toBe(0);
  });
  it.each([
    { entities: [{ NaN: 1 }] }, { entities: { 0: { NaN: [0] } } },
    { entities: [{ NaN: [0.5] }] }, { entities: [{ NaN: [1] }] },
    { entities: [{ unexpected: [0] }] }, { entities: [{ NaN: 'private' }] },
    { enums: [1] }, { enums: { 0: ['one'] } }, { enums: [[{}]] },
    { nanos: [1] }, { nanos: [[-1]] }, { nanos: [[0, 0]] },
  ])('rejects malformed decoder-consumed optional wire data %j', async optional => {
    const body = JSON.stringify({ results: { A: { frames: [{ schema: { fields: [{ name: 'Value', type: 'number' }] },
      data: { values: [[1]], ...optional } }] } } });
    const backend = createGrafana13BackendSrv(capability(async request => ({ kind: 'response', requestId: request.requestId,
      response: { body, headers: [], status: 200 } })));
    await expect(firstValueFrom(backend.fetch({ method: 'POST', url: '/api/ds/query' })))
      .rejects.toMatchObject({ code: 'transport-response-malformed', status: 500 });
  });
  it('admits bounded valid decoder entities, enum strings and nanoseconds without decoding them', async () => {
    const data = { results: { A: { frames: [{ schema: { fields: [{ name: 'Value', type: 'number' }] },
      data: { values: [[0]], entities: [{ NaN: [0] }], enums: [['one']], nanos: [[1]] } }] } } };
    const backend = createGrafana13BackendSrv(capability(async request => ({ kind: 'response', requestId: request.requestId,
      response: { body: JSON.stringify(data), headers: [], status: 200 } })));
    expect((await firstValueFrom(backend.fetch({ method: 'POST', url: '/api/ds/query' }))).data).toEqual(data);
  });
  it('preserves exact POST request identity, signal, body and safe routing headers', async () => {
    let observed: any;
    const backend = createGrafana13BackendSrv(capability(async request => {
      observed = request;
      return { kind: 'response', requestId: request.requestId,
        response: { status: 200, headers: [], body: '{"results":{"A":{"frames":[]}}}' } };
    }));
    const signal = new AbortController().signal;
    const data = { queries: [], from: '1', to: '2' };
    await firstValueFrom(backend.fetch({ url: '/api/ds/query?ds_type=grafana-testdata-datasource&requestId=drsdk-1-A', method: 'POST',
      data, requestId: 'drsdk-1-A', abortSignal: signal, headers: { 'X-Datasource-Uid': 'grsdk-testdata' } }));
    expect(observed).toMatchObject({ method: 'POST', path: '/api/ds/query', requestId: 'drsdk-1-A', body: JSON.stringify(data), headers: [['X-Datasource-Uid', 'grsdk-testdata']] });
    expect(observed.signal).toBe(signal);
  });
  it('aborts an owned observable request when its subscription is released', async () => {
    let signal: AbortSignal | undefined;
    const backend = createGrafana13BackendSrv(capability(request => {
      signal = request.signal; return new Promise(resolve => request.signal.addEventListener('abort', () => resolve({ kind: 'cancelled', requestId: request.requestId })));
    }));
    const subscription = backend.fetch({ url: '/api/ds/query?ds_type=grafana-testdata-datasource', method: 'POST' }).subscribe();
    expect(signal?.aborted).toBe(false); subscription.unsubscribe(); expect(signal?.aborted).toBe(true);
  });
  it.each(['{}', 'null', '{"results":[]}', '{"results":{"B":{"frames":[]}}}',
    '{"results":{"A":{"frames":[{}]}}}',
    '{"results":{"A":{"error":"synthetic failure","frames":[{}]}}}',
    '{"results":{"A":{"frames":[{"schema":{"fields":[{"name":"Value","type":"number"}]},"data":{"values":[]}}]}}}',
  ])('rejects a malformed successful query envelope %s', async body => {
    const backend = createGrafana13BackendSrv(capability(async request => ({ kind: 'response', requestId: request.requestId,
      response: { body, headers: [], status: 200 } })));
    await expect(firstValueFrom(backend.fetch({ method: 'POST', url: '/api/ds/query' }))).rejects.toMatchObject({ code: 'transport-response-malformed', status: 500 });
  });
  it('sanitizes observable signal reflection without invoking transport', async () => {
    let calls = 0;
    const backend = createGrafana13BackendSrv(capability(async request => { calls++; return { kind: 'cancelled', requestId: request.requestId }; }));
    const error = await firstValueFrom(backend.fetch({ url: '/api/ds/query', get abortSignal(): AbortSignal { throw new Error('private signal'); } })).catch(error => error);
    expect(error.code).toBe('transport-policy-error'); expect(String(error)).not.toContain('private'); expect(calls).toBe(0);
  });
  it.each([401, 403, 500, 'network'] as const)('exposes a decoder-visible sanitized failure for %s', async outcome => {
    const backend = createGrafana13BackendSrv(capability(async request => outcome === 'network'
      ? { kind: 'network-error', requestId: request.requestId }
      : { kind: 'response', requestId: request.requestId, response: { body: 'private auth token', headers: [], status: outcome } }));
    const error = await firstValueFrom(backend.fetch({ method: 'POST', url: '/api/ds/query' })).catch(value => value);
    expect(error.status).toBe(outcome === 'network' ? 500 : outcome);
    expect(error).not.toHaveProperty('cause'); expect(JSON.stringify(error)).not.toMatch(/private|token/);
  });
  it('delegates a permitted relative request with the exact signal and request ID', async () => {
    const execute = vi.fn(async (request) => ({
      kind: 'response' as const,
      requestId: request.requestId,
      response: {
        body: '{"ok":true}',
        headers: [['content-type', 'application/json']] as const,
        status: 200,
      },
    }));
    const signal = new AbortController().signal;
    const backend = createGrafana13BackendSrv(capability(execute));
    const response = await backend.datasourceRequest({
      abortSignal: signal,
      method: 'GET',
      requestId: 'request-1',
      url: '/api/frontend/settings',
    });
    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        path: '/api/frontend/settings',
        requestId: 'request-1',
        signal,
      })
    );
    expect(response).toMatchObject({ data: { ok: true }, status: 200 });
  });

  it('reads the request URL exactly once and reuses the guarded value in the response', async () => {
    let urlReads = 0;
    const execute = vi.fn(async (request) => ({
      kind: 'response' as const,
      requestId: request.requestId,
      response: {
        body: '{"ok":true}',
        headers: [] as const,
        status: 200,
      },
    }));
    const backend = createGrafana13BackendSrv(capability(execute));
    const config = {
      get url(): string {
        urlReads += 1;
        if (urlReads > 1) throw new Error('secret-second-url-read');
        return '/api/frontend/settings';
      },
    };

    const response = await backend.datasourceRequest(config);

    expect(response.url).toBe('/api/frontend/settings');
    expect(urlReads).toBe(1);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('guards response-type reflection before invoking the host transport', async () => {
    const execute = vi.fn(async (request) => ({
      kind: 'response' as const,
      requestId: request.requestId,
      response: {
        body: '{"ok":true}',
        headers: [] as const,
        status: 200,
      },
    }));
    const backend = createGrafana13BackendSrv(capability(execute));
    const config = {
      get responseType(): never {
        throw new Error('secret-response-type');
      },
      url: '/api/frontend/settings',
    };

    const error = await backend.datasourceRequest(config).catch((value) => value);

    expect(error).toBeInstanceOf(Grafana13BackendTransportError);
    if (!(error instanceof Grafana13BackendTransportError)) throw new Error('Expected typed error');
    expect(error).toMatchObject({ code: 'transport-policy-error' });
    expect(error.message).toBe('The Grafana Runtime request could not be safely normalized.');
    expect(JSON.stringify(error)).not.toContain('secret-response-type');
    expect(execute).not.toHaveBeenCalled();
  });

  it.each([
    'Authorization', 'Cookie', 'Proxy-Authorization', 'Set-Cookie', 'X-API-Key', 'X-Auth-Token',
    'Host', 'Origin', 'Forwarded', 'X-Forwarded-For', 'X-Forwarded-Host', 'X-Forwarded-Proto',
    'X-Real-IP', 'X-Grafana-Org-Id', 'X-Scope-OrgID', 'X-Org-Id', 'X-Tenant-Id', 'X-User-Id',
  ])('rejects host-controlled header %s before transport', async (name) => {
    const execute = vi.fn();
    const backend = createGrafana13BackendSrv(capability(execute));
    await expect(
      backend.request({ headers: { [name]: 'secret' }, url: '/api/frontend/settings' })
    ).rejects.toMatchObject({ code: 'transport-policy-error' });
    expect(execute).not.toHaveBeenCalled();
  });

  it.each([
    ['request property', new Proxy({}, { get() { throw new Error('secret-getter'); } })],
    ['query reflection', { params: new Proxy({}, { ownKeys() { throw new Error('secret-query'); } }), url: '/api/x' }],
    ['header reflection', { headers: new Proxy({}, { ownKeys() { throw new Error('secret-header'); } }), url: '/api/x' }],
    ['body serialization', { data: { toJSON() { throw new Error('secret-body'); } }, method: 'POST', url: '/api/x' }],
  ] as const)('sanitizes hostile %s preprocessing failures', async (_label, config) => {
    const execute = vi.fn();
    const backend = createGrafana13BackendSrv(capability(execute));
    const error = await backend.request(config as never).catch((value) => value);
    expect(error).toBeInstanceOf(Grafana13BackendTransportError);
    if (!(error instanceof Grafana13BackendTransportError)) throw new Error('Expected typed error');
    expect(error).toMatchObject({ code: 'transport-policy-error' });
    expect(error.message).toBe('The Grafana Runtime request could not be safely normalized.');
    expect(JSON.stringify(error)).not.toMatch(/secret-(?:getter|query|header|body)/);
    expect(execute).not.toHaveBeenCalled();
  });

  it('maps cancellation and failures without retaining raw causes or bodies', async () => {
    const cancelled = createGrafana13BackendSrv(
      capability(async (request) => ({ kind: 'cancelled', requestId: request.requestId }))
    );
    await expect(cancelled.request({ requestId: 'cancel', url: '/api/x' })).rejects.toMatchObject({
      code: 'transport-cancelled',
      requestId: 'cancel',
    });

    const failed = createGrafana13BackendSrv(
      capability(async (request) => ({ kind: 'network-error', requestId: request.requestId }))
    );
    const error = await failed.request({ requestId: 'failure', url: '/api/x' }).catch((value) => value);
    expect(error).toBeInstanceOf(Grafana13BackendTransportError);
    expect(JSON.stringify(error)).not.toContain('secret');
  });

  it('preserves cancellation through the observable BackendSrv path', async () => {
    const controller = new AbortController();
    const backend = createGrafana13BackendSrv(
      capability(async (request) => {
        controller.abort();
        return { kind: 'cancelled', requestId: request.requestId };
      })
    );
    await expect(
      firstValueFrom(
        backend.fetch({ abortSignal: controller.signal, requestId: 'observable', url: '/api/x' })
      )
    ).rejects.toMatchObject({ code: 'transport-cancelled' });
  });
});
