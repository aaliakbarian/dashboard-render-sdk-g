import type { HostTransportExecutor, TransportRequest } from '@dashboard-render-sdk-g/provider-contract';
import { describe, expect, it, vi } from 'vitest';

import { createSdkHostBrowserExecutor } from './transport';

function request(overrides: Partial<TransportRequest> = {}): TransportRequest {
  return {
    method: 'GET',
    path: '/api/health',
    requestId: 'transport-policy-test',
    signal: new AbortController().signal,
    ...overrides,
  };
}

describe('SDK host browser transport policy', () => {
  it.each([
    '/api/health',
    '/apis/dashboard.grafana.app/',
    '/apis/dashboard.grafana.app/v1/namespaces/default/dashboards/grsdk-phase0-poc/dto',
  ])('allows the exact read-only fixture route %s', async (path) => {
    const fetchImplementation = vi.fn(async (_input: string, _init: RequestInit) =>
      new Response('{}', { status: 200 })
    );
    const executor: HostTransportExecutor = createSdkHostBrowserExecutor(
      'http://localhost:5173',
      fetchImplementation
    );

    await executor(request({ path }));

    expect(fetchImplementation).toHaveBeenCalledTimes(1);
    expect(fetchImplementation.mock.calls[0]?.[0]).toBe(`/grafana${path}`);
  });

  it.each(['POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'] as const)(
    'rejects %s before invoking fetch',
    async (method) => {
      const fetchImplementation = vi.fn();
      const executor = createSdkHostBrowserExecutor('http://localhost:5173', fetchImplementation);

      await expect(executor(request({ method }))).rejects.toThrow('read-only transport policy');
      expect(fetchImplementation).not.toHaveBeenCalled();
    }
  );

  it('rejects a body before invoking fetch', async () => {
    const fetchImplementation = vi.fn();
    const executor = createSdkHostBrowserExecutor('http://localhost:5173', fetchImplementation);

    await expect(executor(request({ body: '{}' }))).rejects.toThrow('read-only transport policy');
    expect(fetchImplementation).not.toHaveBeenCalled();
  });

  it.each([
    '/api/health/',
    '/api/ds/query',
    '/api/dashboards/uid/grsdk-phase0-poc',
    '/apis/dashboard.grafana.app/v2/namespaces/default/dashboards/grsdk-phase0-poc/dto',
    '/apis/dashboard.grafana.app/v1/namespaces/other/dashboards/grsdk-phase0-poc/dto',
    '/apis/dashboard.grafana.app/v1/namespaces/default/dashboards/bad%2fuid/dto',
    '/apis/dashboard.grafana.app/v1/namespaces/default/dashboards/../dto',
  ])('rejects the non-allowlisted path %s before invoking fetch', async (path) => {
    const fetchImplementation = vi.fn();
    const executor = createSdkHostBrowserExecutor('http://localhost:5173', fetchImplementation);

    await expect(executor(request({ path }))).rejects.toThrow('read-only transport policy');
    expect(fetchImplementation).not.toHaveBeenCalled();
  });

  it('rejects query parameters before invoking fetch', async () => {
    const fetchImplementation = vi.fn();
    const executor = createSdkHostBrowserExecutor('http://localhost:5173', fetchImplementation);

    await expect(executor(request({ query: [['orgId', '2']] }))).rejects.toThrow(
      'read-only transport policy'
    );
    expect(fetchImplementation).not.toHaveBeenCalled();
  });
});
