import type Keycloak from 'keycloak-js';

export interface DisplayUser {
  readonly displayName: string;
  readonly username: string;
}

export type AuthSessionState =
  | { readonly status: 'loading' }
  | { readonly status: 'redirecting' }
  | { readonly status: 'ready'; readonly user: DisplayUser }
  | { readonly status: 'error'; readonly error: string };

export interface AuthSession {
  initialize(): Promise<AuthSessionState>;
  logout(): void;
}

interface AuthSessionOptions {
  // The adapter is host-owned and never returned through the public session API.
  readonly keycloak: Pick<Keycloak, 'init' | 'tokenParsed'>;
  readonly fetch?: (url: string, options: RequestInit) => Promise<Response>;
  readonly navigate?: (url: string) => void;
}

function displayClaim(value: unknown, fallback: string, maxLength: number): string {
  if (typeof value !== 'string') return fallback;
  return value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, maxLength) || fallback;
}

function validGrafanaUser(value: unknown): boolean {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const user = value as Record<string, unknown>;
  return Number.isSafeInteger(user.id) && Number(user.id) > 0 &&
    Number.isSafeInteger(user.orgId) && Number(user.orgId) > 0 &&
    typeof user.login === 'string' && user.login.trim().length > 0;
}

/** Coordinates two independent sessions; exposes only detached display data. */
export function createAuthSession(options: AuthSessionOptions): AuthSession {
  const fetcher = options.fetch ?? globalThis.fetch.bind(globalThis);
  const navigate = options.navigate ?? (url => globalThis.location.assign(url));

  return Object.freeze({
    async initialize(): Promise<AuthSessionState> {
      try {
        const authenticated = await options.keycloak.init({
          flow: 'standard', pkceMethod: 'S256', onLoad: 'login-required', checkLoginIframe: false,
        });
        if (!authenticated) return Object.freeze({ status: 'error', error: 'Authentication failed.' });

        const response = await fetcher('/grafana/api/user', {
          method: 'GET', credentials: 'same-origin', redirect: 'error',
        });
        if (response.status === 401) {
          // Grafana prepends its configured /grafana subpath after OAuth.
          navigate('/grafana/login/generic_oauth?redirectTo=%2Fdemo-return');
          return Object.freeze({ status: 'redirecting' });
        }
        const grafanaUser: unknown = response.status === 200 ? await response.json().catch(() => null) : null;
        if (!validGrafanaUser(grafanaUser)) {
          return Object.freeze({ status: 'error', error: 'Grafana session check failed.' });
        }

        const claims = options.keycloak.tokenParsed;
        const username = displayClaim(claims?.preferred_username, 'Viewer', 64);
        const user = Object.freeze({
          displayName: displayClaim(claims?.name, username, 128), username,
        });
        return Object.freeze({ status: 'ready', user });
      } catch {
        return Object.freeze({ status: 'error', error: 'Authentication failed.' });
      }
    },
    logout(): void {
      // Grafana clears its cookie, then its configured signout redirect logs out the IdP.
      navigate('/grafana/logout');
    },
  });
}
