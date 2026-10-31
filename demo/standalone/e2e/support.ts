import { createHash } from 'node:crypto';
import { expect, type Page } from '@playwright/test';

export const origin = 'http://localhost:8088';
export const uid = 'drsdk-g-phase2-visualizations';
export const dashboardPath = `/grafana/apis/dashboard.grafana.app/v1/namespaces/default/dashboards/${uid}/dto`;
export const missingPath = '/grafana/apis/dashboard.grafana.app/v1/namespaces/default/dashboards/demo-missing-dashboard/dto';
const realm = '/keycloak/realms/dashboard-render-sdk-g-demo/protocol/openid-connect';

export function redact(message: unknown): string {
  return String(message).replace(/https?:\/\/[^\s"']+/g, '<url>')
    .replace(/\beyJ[A-Za-z0-9._-]+/g, '<jwt>')
    .replace(/\b(Basic|Bearer)\s+\S+/gi, '$1 <redacted>');
}

/** Keeps only bounded, non-secret evidence. Authorization codes, cookies and tokens stay in memory. */
export async function observeBrowser(page: Page) {
  const paths: string[] = [];
  const problems: string[] = [];
  const authClients: string[] = [];
  const queryPanels: string[] = [];
  const frames: { types: string[]; values: number[][] }[] = [];
  const statuses: { path: string; status: number }[] = [];
  const pending: Promise<void>[] = [];
  const tokens = new Set<string>();
  // Private, bounded request text may contain credentials. Never expose it in
  // returned evidence, assertion operands, diagnostics, or persisted artifacts.
  const grafanaRequests: string[] = [];
  let requestTextSize = 0;
  const challenges = new Set<string>();
  let pkceExchanges = 0;
  let expectedUnauthorizedConsole = 0;
  let documents = 0;
  const allowedApis = new Set([
    '/grafana/api/user', '/grafana/api/health', '/grafana/apis/dashboard.grafana.app/',
    '/grafana/api/frontend/settings', dashboardPath, missingPath, '/grafana/api/ds/query',
  ]);
  const authPaths = new Set([`${realm}/auth`, `${realm}/token`, `${realm}/logout`,
    '/grafana/login/generic_oauth', '/grafana/demo-return', '/grafana/logout']);

  await page.addInitScript(() => {
    const versions: string[] = [];
    const renderers = new Map();
    Object.defineProperty(window, '__DEMO_REACT_RENDERERS__', { value: versions });
    Object.defineProperty(window, '__REACT_DEVTOOLS_GLOBAL_HOOK__', { value: {
      supportsFiber: true,
      renderers,
      inject(renderer: { version: string }) { versions.push(renderer.version); renderers.set(versions.length, renderer); return versions.length; },
      onCommitFiberRoot() {}, onCommitFiberUnmount() {}, onPostCommitFiberRoot() {},
    } });
  });
  page.on('pageerror', () => problems.push('page error'));
  page.on('crash', () => problems.push('page crash'));
  page.on('console', message => {
    if (message.type() !== 'error' && message.type() !== 'warning') return;
    const location = message.location().url;
    // Chromium reports the deliberately unauthorized bootstrap probe as a console error.
    if (location === `${origin}/grafana/api/user` && /401/.test(message.text())) {
      expectedUnauthorizedConsole++; return;
    }
    if (location === `${origin}${missingPath}` && /404/.test(message.text())) return;
    problems.push(`console ${message.type()}`);
  });
  page.on('websocket', () => problems.push('unexpected WebSocket'));
  page.on('request', request => {
    const url = new URL(request.url());
    const resourceClass = /\/assets\/provider-barchart-[^/]+\.js$/.test(url.pathname)
      ? '<provider-barchart-asset>'
      : /\/assets\/(?:feature|provider)-(?:table|piechart)-[^/]+\.js$/.test(url.pathname)
        ? '<unsupported-panel-asset>'
        : '<resource>';
    paths.push(allowedApis.has(url.pathname) || authPaths.has(url.pathname) ? url.pathname : resourceClass);
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documents++;
    if (url.origin !== origin) problems.push('cross-origin request');
    const allowedResource = url.pathname === '/' || url.pathname === '/favicon.ico' ||
      url.pathname.startsWith('/assets/') || url.pathname.startsWith('/keycloak/resources/') ||
      url.pathname.startsWith('/keycloak/realms/dashboard-render-sdk-g-demo/login-actions/') ||
      authPaths.has(url.pathname) ||
      allowedApis.has(url.pathname);
    if (!allowedResource) problems.push('unexpected request');
    if (url.pathname === `${realm}/auth`) {
      const client = url.searchParams.get('client_id') ?? '';
      authClients.push(['standalone-demo', 'grafana'].includes(client) ? client : '<unexpected-client>');
      if (!['standalone-demo', 'grafana'].includes(client) || url.searchParams.get('response_type') !== 'code' ||
          url.searchParams.get('code_challenge_method') !== 'S256' || !url.searchParams.get('code_challenge')) {
        problems.push('authorization request missing code/S256');
      }
      if (client === 'standalone-demo') challenges.add(url.searchParams.get('code_challenge') ?? '');
    }
    if (url.pathname === `${realm}/token`) {
      const body = new URLSearchParams(request.postData() ?? '');
      const challenge = createHash('sha256').update(body.get('code_verifier') ?? '').digest('base64url');
      if (body.get('grant_type') === 'authorization_code' && body.get('client_id') === 'standalone-demo' && challenges.has(challenge)) pkceExchanges++;
      else problems.push('invalid browser PKCE exchange');
    }
    if (url.pathname.startsWith('/grafana/api')) {
      if (!allowedApis.has(url.pathname)) problems.push('unapproved API');
      const headers = request.headers();
      pending.push((async () => {
        // headers() omits security-related headers; inspect the complete set.
        const allHeaders = await request.allHeaders();
        const transportText = [request.url(), ...Object.entries(allHeaders).flat(),
          ...[...url.searchParams].flat(), request.postData() ?? ''].join('\n');
        if (grafanaRequests.length >= 256 || transportText.length > 65536 || requestTextSize + transportText.length > 4194304) {
          if (!problems.includes('Grafana request evidence limit exceeded')) problems.push('Grafana request evidence limit exceeded');
        } else {
          grafanaRequests.push(transportText);
          requestTextSize += transportText.length;
        }
        if (allHeaders.authorization || /(?:access_token|id_token|refresh_token|Bearer\s)/i.test(transportText) ||
            [...tokens].some(token => transportText.includes(token))) problems.push('OIDC credential forwarded to Grafana');
      })().catch(() => { problems.push('unreadable Grafana request headers'); }));
      const query = [...url.searchParams];
      const queryAllowed = url.pathname === '/grafana/api/ds/query'
        ? query.length >= 1 && query.length <= 2 && new Set(query.map(([name]) => name)).size === query.length &&
          query.some(([name, value]) => name === 'ds_type' && value === 'grafana-testdata-datasource') &&
          query.every(([name, value]) => name === 'ds_type' || (name === 'requestId' && /^[A-Za-z0-9_-]{1,128}$/.test(value)))
        : query.length === 0;
      if (!queryAllowed) problems.push('unexpected API query parameters');
      if (url.pathname === '/grafana/api/ds/query') {
        const panel = headers['x-panel-id'] ?? '';
        queryPanels.push(['2', '3', '5', '6', '8'].includes(panel) ? panel : '<unexpected-panel>');
        const body = request.postDataJSON();
        if (request.method() !== 'POST' || body.queries?.length !== 1 || body.queries[0].datasource?.uid !== 'grsdk-testdata' ||
            body.queries[0].scenarioId !== 'predictable_pulse') problems.push('unexpected query shape');
      } else if (request.method() !== 'GET') problems.push('unexpected API method');
    }
  });
  page.on('response', response => {
    const path = new URL(response.url()).pathname;
    if (path.startsWith('/grafana/api')) statuses.push({ path: allowedApis.has(path) ? path : '<unapproved-api>', status: response.status() });
    if (response.status() >= 400 && !(path === '/grafana/api/user' && response.status() === 401) &&
        !(path === missingPath && response.status() === 404)) problems.push(`HTTP ${response.status()}`);
    pending.push((async () => {
      if (path === `${realm}/token` && response.ok()) {
        const body = await response.json();
        for (const key of ['access_token', 'id_token', 'refresh_token']) {
          const token = body[key];
          if (typeof token !== 'string') continue;
          if (!token.length || token.length > 16384 || (!tokens.has(token) && tokens.size >= 32)) {
            if (!problems.includes('OIDC token evidence limit exceeded')) problems.push('OIDC token evidence limit exceeded');
          } else tokens.add(token);
        }
      }
      if (path === '/grafana/api/ds/query' && response.ok()) {
        const body = await response.json();
        const frame = body.results.A.frames[0];
        frames.push({ types: frame.schema.fields.map((field: { type: string }) => field.type), values: frame.data.values });
      }
    })().catch(error => {
      // The first token exchange immediately navigates to Grafana. Chromium can
      // retire that response handle; the stable exchange after return is required below.
      if (path === `${realm}/token` && /No resource with given identifier found|No data found for resource with given identifier/.test(String(error))) return;
      problems.push(`unreadable response: ${path}`);
    }));
  });

  return {
    paths, problems, authClients, queryPanels, frames, statuses,
    documents: () => documents,
    async assertNoTokenPersistence() {
      await Promise.all(pending);
      const leaked = await page.evaluate(values => {
        const storage = JSON.stringify([Object.entries(localStorage), Object.entries(sessionStorage)]);
        const dom = document.documentElement.outerHTML;
        return values.some(value => storage.includes(value) || dom.includes(value));
      }, [...tokens]);
      expect(leaked, 'OIDC tokens must not be persisted in browser storage or DOM').toBe(false);
    },
    async verify() {
      await Promise.all(pending);
      // Token response bodies are asynchronous: compare every earlier request
      // again after collection, including requests preceding token discovery.
      if (grafanaRequests.some(text => [...tokens].some(token => text.includes(token))) &&
          !problems.includes('OIDC credential forwarded to Grafana')) problems.push('OIDC credential forwarded to Grafana');
      expect(problems).toEqual([]);
      expect(pkceExchanges).toBeGreaterThan(0);
      expect(expectedUnauthorizedConsole).toBe(1);
      expect(tokens.size).toBeGreaterThanOrEqual(3);
      expect(authClients).toContain('grafana');
      expect(authClients).toContain('standalone-demo');
    },
  };
}

export async function signIn(page: Page) {
  await page.goto('/');
  await expect(page.locator('#username')).toBeVisible().catch(async () => {
    throw new Error(`Keycloak login unavailable; path=${new URL(page.url()).pathname}; body=${(await page.locator('body').innerText()).replace(/https?:\/\/\S+/g, '<url>').slice(0, 1500)}`);
  });
  expect(new URL(page.url()).pathname).toContain('/keycloak/realms/dashboard-render-sdk-g-demo/');
  await page.locator('#username').fill('demo-viewer');
  await page.locator('#password').fill('development-only-viewer');
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Log out', exact: true })).toBeVisible();
  expect(page.url()).toBe(`${origin}/`);
}
