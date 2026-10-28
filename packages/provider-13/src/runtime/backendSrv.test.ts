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
