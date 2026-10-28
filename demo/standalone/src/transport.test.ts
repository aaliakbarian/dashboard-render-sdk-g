import type { TransportRequest } from '@dashboard-render-sdk-g/provider-contract';
import { describe, expect, it, vi } from 'vitest';

import { createDemoBrowserExecutor } from './transport';

const body = {
  queries: [{ refId: 'A', scenarioId: 'predictable_pulse', alias: 'Raw Signal',
    pulseWave: { offCount: 5, offValue: 10, onCount: 5, onValue: 90, timeStep: 1 },
    datasource: { type: 'grafana-testdata-datasource', uid: 'grsdk-testdata' },
    datasourceId: 1, intervalMs: 1000, maxDataPoints: 300 }],
  from: '1700000000000', to: '1700000060000',
};
function query(overrides: Partial<TransportRequest> = {}): TransportRequest {
  return { method: 'POST', path: '/api/ds/query', requestId: 'drsdk-1-A',
    query: [['ds_type', 'grafana-testdata-datasource'], ['requestId', 'drsdk-1-A']],
    headers: [['X-Plugin-Id', 'grafana-testdata-datasource'], ['X-Datasource-Uid', 'grsdk-testdata'],
      ['X-Dashboard-Uid', 'drsdk-g-phase2-visualizations'], ['X-Panel-Id', '2']],
    body: JSON.stringify(body), signal: new AbortController().signal, ...overrides };
}
function read(path: string, overrides: Partial<TransportRequest> = {}): TransportRequest {
  return query({ path, method: 'GET', body: undefined, query: [], headers: [], ...overrides });
}
const origin = 'http://localhost:8080';

describe('demo-local exact Grafana transport', () => {
  it.each(['/api/health', '/apis/dashboard.grafana.app/', '/api/frontend/settings',
    '/apis/dashboard.grafana.app/v1/namespaces/default/dashboards/drsdk-g-phase2-visualizations/dto',
  ])('allows the exact bodyless GET %s using same-origin cookies', async path => {
    const fetcher = vi.fn(async (_url: string, _options: RequestInit) => new Response('{}'));
    const request = read(path);
    await createDemoBrowserExecutor(origin, fetcher)(request);
    expect(fetcher).toHaveBeenCalledExactlyOnceWith(`/grafana${path}`, {
      method: 'GET', credentials: 'same-origin', redirect: 'error', signal: request.signal,
      headers: new Headers(),
    });
  });

  it.each(['/api/health', '/apis/dashboard.grafana.app/', '/api/frontend/settings',
    '/apis/dashboard.grafana.app/v1/namespaces/default/dashboards/drsdk-g-phase2-visualizations/dto',
  ])('accepts the real provider JSON Accept header on %s', async path => {
    let receivedAccept: string | null = null;
    const fetcher = async (_url: string, options: RequestInit) => {
      receivedAccept = new Headers(options.headers).get('accept');
      return new Response('{}');
    };
    const result = await createDemoBrowserExecutor(origin, fetcher)(read(path, {
      headers: [['Accept', 'application/json']],
    }));
    expect(result.status).toBe(200);
    expect(receivedAccept).toBe('application/json');
  });

  it('accepts a lowercase JSON accept name without broadening allowed values', async () => {
    const result = await createDemoBrowserExecutor(origin, async () => new Response('{}'))(
      read('/api/health', { headers: [['accept', 'application/json']] })
    );
    expect(result.status).toBe(200);
  });

  it('forwards the approved TestData query without changing its body or cancellation signal', async () => {
    const fetcher = vi.fn(async (_url: string, _options: RequestInit) => new Response('{}'));
    const request = query();
    await createDemoBrowserExecutor(origin, fetcher)(request);
    expect(fetcher).toHaveBeenCalledExactlyOnceWith(
      '/grafana/api/ds/query?ds_type=grafana-testdata-datasource&requestId=drsdk-1-A',
      { method: 'POST', credentials: 'same-origin', redirect: 'error', signal: request.signal,
        body: request.body, headers: new Headers([
          ['X-Plugin-Id', 'grafana-testdata-datasource'], ['X-Datasource-Uid', 'grsdk-testdata'],
          ['X-Dashboard-Uid', 'drsdk-g-phase2-visualizations'], ['X-Panel-Id', '2'],
          ['Content-Type', 'application/json'],
        ]) });
  });

  it('propagates cancellation to the fetch operation', async () => {
    const controller = new AbortController();
    const fetcher = (_url: string, options: RequestInit) => new Promise<Response>((_resolve, reject) => {
      options.signal!.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    });
    const response = createDemoBrowserExecutor(origin, fetcher)(query({ signal: controller.signal }));
    controller.abort();
    await expect(response).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('strips known sensitive response headers and freezes the sanitized result', async () => {
    const fetcher = async () => new Response('{"ok":true}', { status: 201, headers: {
      'Set-Cookie': 'private', 'Set-Cookie2': 'private', Authorization: 'private',
      'Proxy-Authorization': 'private', 'Authentication-Info': 'private',
      'Proxy-Authentication-Info': 'private', 'Content-Type': 'application/json',
    } });
    const result = await createDemoBrowserExecutor(origin, fetcher)(read('/api/health'));
    expect(result).toEqual({ status: 201, body: '{"ok":true}', headers: [['content-type', 'application/json']] });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.headers)).toBe(true);
    expect(Object.isFrozen(result.headers[0])).toBe(true);
  });

  const invalidQueries: Partial<TransportRequest>[] = [
    { method: 'GET' }, { method: 'PUT' }, { path: '/api/frontend/settings' },
    ...['https://evil.test/api/ds/query', '//evil.test/api/ds/query', '/api/../api/ds/query',
      '/api/%64s/query', '/api/ds/query#x', '/api/ds/query?x=1', '/api\\ds/query',
      '/api/datasources/uid/grsdk-testdata/resources/scenarios'].map(path => ({ path })),
    { query: [] }, { query: [['ds_type', 'prometheus']] },
    { query: [['ds_type', 'grafana-testdata-datasource'], ['ds_type', 'grafana-testdata-datasource']] },
    { query: [['ds_type', 'grafana-testdata-datasource'], ['expression', 'true']] },
    { query: [['ds_type', 'grafana-testdata-datasource'], ['requestId', 'another-request']] },
    { body: 'null' }, { body: '{' }, { body: ' '.repeat(16385) },
    { body: JSON.stringify({ ...body, extra: true }) },
    { body: JSON.stringify({ ...body, from: 'now-1h' }) },
    { body: JSON.stringify({ ...body, to: body.from }) },
    { body: JSON.stringify({ ...body, to: '1800000000000' }) },
    { body: JSON.stringify({ ...body, queries: [] }) },
    { body: JSON.stringify({ ...body, queries: [body.queries[0], body.queries[0]] }) },
    ...[{ scenarioId: 'grafana_api' }, { refId: 'B' }, { hide: true }, { extra: true },
      { datasource: { type: 'prometheus', uid: 'grsdk-testdata' } },
      { datasource: { type: 'grafana-testdata-datasource', uid: 'other' } },
      { pulseWave: { ...body.queries[0]!.pulseWave, offValue: 99 } },
      { datasourceId: 0 }, { maxDataPoints: 1e9 }, { intervalMs: 0 },
    ].map(target => ({ body: JSON.stringify({ ...body, queries: [{ ...body.queries[0], ...target }] }) })),
    ...['Authorization', 'Cookie', 'X-Grafana-Org-Id', 'X-Tenant-Id', 'X-Forwarded-User',
      'X-Scope-OrgID', 'Origin', 'X-Query-Group-Id', 'X-Cache-Skip', 'X-Grafana-From-Expr',
      'X-Extra'].map(name => ({ headers: [[name, 'private']] as const })),
    { headers: [['Content-Type', 'text/plain']] },
    { headers: [['X-Plugin-Id', 'grafana-testdata-datasource'], ['x-plugin-id', 'grafana-testdata-datasource']] },
  ];
  it.each(invalidQueries.map((value, i) => [i, value] as const))('rejects query bypass %i before fetch', async (_i, value) => {
    const fetcher = vi.fn();
    await expect(createDemoBrowserExecutor(origin, fetcher)(query(value))).rejects.toThrow('transport policy');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each([
    read('/api/health', { method: 'POST' }), read('/api/health', { body: '{}' }),
    read('/api/health', { query: [['orgId', '2']] }),
    read('/api/health', { headers: [['Accept', 'text/html']] }),
    read('/api/health', { headers: [['Accept', 'application/json'], ['accept', 'application/json']] }),
    read('/api/health', { headers: [['Accept', 'application/json'], ['X-Extra', 'extra']] }),
    ...['/api/health/', '/api/user', '/api/dashboards/uid/drsdk-g-phase2-visualizations',
      '/apis/dashboard.grafana.app/v2/namespaces/default/dashboards/demo/dto',
      '/apis/dashboard.grafana.app/v1/namespaces/other/dashboards/demo/dto',
      '/apis/dashboard.grafana.app/v1/namespaces/default/dashboards/bad%2fuid/dto',
      '/apis/dashboard.grafana.app/v1/namespaces/default/dashboards/../dto',
    ].map(path => read(path)),
    ...['/api/health', '/api/frontend/settings',
      '/apis/dashboard.grafana.app/v1/namespaces/default/dashboards/demo/dto',
    ].flatMap(path => ['Authorization', 'Cookie', 'X-Grafana-Org-Id'].map(name =>
      read(path, { headers: [[name, 'private']] }))),
  ])('rejects read bypass $path before fetch', async request => {
    const fetcher = vi.fn();
    await expect(createDemoBrowserExecutor(origin, fetcher)(request)).rejects.toThrow('transport policy');
    expect(fetcher).not.toHaveBeenCalled();
  });
});
