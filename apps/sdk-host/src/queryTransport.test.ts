import { describe, expect, it, vi } from 'vitest';
import type { TransportRequest } from '@dashboard-render-sdk-g/provider-contract';
import { createSdkHostBrowserExecutor } from './transport';

const body = {
  queries: [{ refId: 'A', scenarioId: 'predictable_pulse', alias: 'Raw Signal',
    pulseWave: { offCount: 5, offValue: 10, onCount: 5, onValue: 90, timeStep: 1 },
    datasource: { type: 'grafana-testdata-datasource', uid: 'grsdk-testdata' },
    datasourceId: 1, intervalMs: 1000, maxDataPoints: 300 }],
  from: '1700000000000', to: '1700000060000',
};
function request(overrides: Partial<TransportRequest> = {}): TransportRequest {
  return { method: 'POST', path: '/api/ds/query', requestId: 'drsdk-1-A',
    query: [['ds_type', 'grafana-testdata-datasource'], ['requestId', 'drsdk-1-A']],
    headers: [['X-Plugin-Id', 'grafana-testdata-datasource'], ['X-Datasource-Uid', 'grsdk-testdata'],
      ['X-Dashboard-Uid', 'drsdk-g-phase2-visualizations'], ['X-Panel-Id', '2']],
    body: JSON.stringify(body), signal: new AbortController().signal, ...overrides };
}
describe('exact host datasource authorization', () => {
  it('forwards only the approved query with exact signal and host JSON content type', async () => {
    const fetcher = vi.fn(async () => new Response('{}'));
    const input = request();
    await createSdkHostBrowserExecutor('http://localhost:5173', fetcher)(input);
    expect(fetcher.mock.calls[0]).toEqual([
      '/grafana/api/ds/query?ds_type=grafana-testdata-datasource&requestId=drsdk-1-A',
      expect.objectContaining({ method: 'POST', body: input.body, signal: input.signal,
        credentials: 'same-origin', redirect: 'error' }),
    ]);
    expect(new Headers((fetcher.mock.calls[0] as unknown as [string, RequestInit])[1].headers).get('content-type')).toBe('application/json');
  });
  it('admits settings only as a bodyless queryless GET', async () => {
    const fetcher = vi.fn(async () => new Response('{}'));
    await createSdkHostBrowserExecutor('http://localhost:5173', fetcher)(request({
      method: 'GET', path: '/api/frontend/settings', body: undefined, query: [], headers: [],
    }));
    expect(fetcher).toHaveBeenCalledOnce();
  });
  const bypasses: Partial<TransportRequest>[] = [
    { method: 'GET' }, { path: '/api/frontend/settings' }, { path: '/api/datasources/uid/grsdk-testdata/resources/scenarios' },
    ...['https://evil.test/api/ds/query', '//evil.test/api/ds/query', '/api/../api/ds/query', '/api/%64s/query', '/api/ds/query#x', '/api/ds/query?x=1', '/api\\ds/query'].map(path => ({ path })),
    { query: [] }, { query: [['ds_type', 'prometheus']] },
    { query: [['ds_type', 'grafana-testdata-datasource'], ['ds_type', 'grafana-testdata-datasource']] },
    { query: [['ds_type', 'grafana-testdata-datasource'], ['expression', 'true']] },
    { query: [['ds_type', 'grafana-testdata-datasource'], ['requestId', 'bad&expression=true']] },
    { body: 'null' }, { body: '{' }, { body: ' '.repeat(16385) },
    { body: JSON.stringify({ ...body, extra: true }) },
    { body: JSON.stringify({ ...body, from: 'now-1h' }) },
    ...[
      { scenarioId: 'grafana_api' }, { refId: 'B' }, { hide: true }, { extra: true },
      { datasource: { type: 'prometheus', uid: 'grsdk-testdata' } },
      { datasource: { type: 'grafana-testdata-datasource', uid: 'other' } },
      { pulseWave: { ...body.queries[0]!.pulseWave, offValue: 99 } },
      { maxDataPoints: 1e9 }, { intervalMs: 0 },
    ].map(target => ({ body: JSON.stringify({ ...body, queries: [{ ...body.queries[0], ...target }] }) })),
    ...['Authorization', 'Cookie', 'X-Grafana-Org-Id', 'X-Tenant-Id', 'X-Forwarded-User', 'X-Scope-OrgID', 'Origin', 'X-Query-Group-Id', 'X-Cache-Skip', 'X-Grafana-From-Expr', 'X-Extra'].map(name => ({ headers: [[name, 'private']] as const })),
    { headers: [['Content-Type', 'text/plain']] },
    { headers: [['X-Plugin-Id', 'grafana-testdata-datasource'], ['x-plugin-id', 'grafana-testdata-datasource']] },
  ];
  it.each(bypasses.map((overrides, index) => [index, overrides] as const))('rejects bypass %i before fetch', async (_index, overrides) => {
    const fetcher = vi.fn();
    await expect(createSdkHostBrowserExecutor('http://localhost:5173', fetcher)(request(overrides))).rejects.toThrow('transport policy');
    expect(fetcher).not.toHaveBeenCalled();
  });
});
