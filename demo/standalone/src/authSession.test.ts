import type Keycloak from 'keycloak-js';
import { describe, expect, it, vi } from 'vitest';

import { createAuthSession } from './authSession';

function setup(status = 200, claims: Keycloak['tokenParsed'] = {
  preferred_username: 'demo-viewer', name: 'Demo Viewer',
}) {
  // Only external browser/OIDC operations are replaced; the coordinator is real.
  const keycloak = { init: vi.fn(async () => true), tokenParsed: claims };
  const fetcher = vi.fn(async (_url: string, _options: RequestInit) =>
    new Response('{"id":1,"login":"demo-viewer","orgId":1}', { status }));
  const navigate = vi.fn();
  return { keycloak, fetcher, navigate,
    session: createAuthSession({ keycloak, fetch: fetcher, navigate }) };
}

describe('host-owned SPA and Grafana sessions', () => {
  it('requires standard Authorization Code with S256 PKCE before probing Grafana', async () => {
    const { session, keycloak, fetcher } = setup();
    await session.initialize();
    expect(keycloak.init).toHaveBeenCalledExactlyOnceWith({
      flow: 'standard', pkceMethod: 'S256', onLoad: 'login-required', checkLoginIframe: false,
    });
    expect(fetcher).toHaveBeenCalledExactlyOnceWith('/grafana/api/user', {
      method: 'GET', credentials: 'same-origin', redirect: 'error',
    });
  });

  it('does not become ready while the independent Grafana probe is pending', async () => {
    const { keycloak, navigate } = setup();
    let finish!: (response: Response) => void;
    const session = createAuthSession({ keycloak, navigate,
      fetch: () => new Promise<Response>(resolve => { finish = resolve; }) });
    let settled = false;
    const result = session.initialize().then(state => { settled = true; return state; });
    await Promise.resolve();
    expect(settled).toBe(false);
    finish(new Response('{"id":1,"login":"demo-viewer","orgId":1}'));
    expect((await result).status).toBe('ready');
  });

  it('starts only the exact Grafana OAuth bootstrap on 401', async () => {
    const { session, navigate } = setup(401);
    expect(await session.initialize()).toEqual({ status: 'redirecting' });
    expect(navigate).toHaveBeenCalledExactlyOnceWith(
      '/grafana/login/generic_oauth?redirectTo=%2Fdemo-return'
    );
  });

  it.each([302, 403, 404, 500, 503])('reports Grafana status %i without starting login', async status => {
    const { session, navigate } = setup(status);
    expect(await session.initialize()).toEqual({ status: 'error', error: 'Grafana session check failed.' });
    expect(navigate).not.toHaveBeenCalled();
  });

  it('reports a network failure without leaking its details or starting login', async () => {
    const { keycloak, navigate } = setup();
    const session = createAuthSession({ keycloak, navigate,
      fetch: async () => { throw new Error('sensitive external error'); } });
    expect(await session.initialize()).toEqual({ status: 'error', error: 'Authentication failed.' });
    expect(navigate).not.toHaveBeenCalled();
  });

  it.each(['not JSON', 'null', '[]', '{}', '{"id":0,"login":"viewer","orgId":1}',
    '{"id":1,"login":"","orgId":1}', '{"id":1,"login":"viewer","orgId":0}',
  ])('rejects a malformed Grafana user response without login: %s', async body => {
    const { keycloak, navigate } = setup();
    const session = createAuthSession({ keycloak, navigate, fetch: async () => new Response(body) });
    expect(await session.initialize()).toEqual({ status: 'error', error: 'Grafana session check failed.' });
    expect(navigate).not.toHaveBeenCalled();
  });

  it('does not probe Grafana when the SPA is not authenticated', async () => {
    const { session, keycloak, fetcher, navigate } = setup();
    keycloak.init.mockResolvedValue(false);
    expect((await session.initialize()).status).toBe('error');
    expect(fetcher).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('starts logout at Grafana so its cookie is cleared before the configured IdP logout', () => {
    const { session, navigate } = setup();
    session.logout();
    expect(navigate).toHaveBeenCalledExactlyOnceWith('/grafana/logout');
  });

  it('returns a frozen identity snapshot containing only bounded display fields', async () => {
    const claims = { name: `  ${'N'.repeat(180)}\n  `, preferred_username: 'demo-viewer',
      sub: 'internal-id', email: 'private@example.test', realm_access: { roles: ['private'] },
      access_token: 'never-expose' };
    const { session } = setup(200, claims);
    const state = await session.initialize();
    expect(state).toEqual({ status: 'ready', user: { displayName: 'N'.repeat(128), username: 'demo-viewer' } });
    claims.preferred_username = 'changed';
    expect(state.status === 'ready' && state.user.username).toBe('demo-viewer');
    expect(Object.isFrozen(state)).toBe(true);
    expect(state.status === 'ready' && Object.isFrozen(state.user)).toBe(true);
  });

  it('uses safe bounded defaults for absent or malformed display claims', async () => {
    const { session } = setup(200, { name: { token: 'private' }, preferred_username: 12 });
    expect(await session.initialize()).toEqual({ status: 'ready',
      user: { displayName: 'Viewer', username: 'Viewer' } });
  });
});
