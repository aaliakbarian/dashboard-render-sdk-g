import { chromium, type Browser, type Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer, type ViteDevServer } from 'vite';

// Only the external IdP adapter is replaced. React, Core, provider-13 and the
// demo session/transport run unchanged in Chromium against controlled HTTP.
const keycloakAdapter = `
export default class Keycloak {
  tokenParsed = { name: 'Demo Viewer', preferred_username: 'demo-viewer' };
  constructor(configuration) { window.__auth.configuration = configuration; }
  init(options) {
    window.__auth.initCalls += 1;
    window.__auth.options = options;
    if (window.__auth.initCalls > 1) throw new Error('Keycloak cannot initialize twice');
    return new Promise((resolve, reject) => {
      window.__auth.resolve = resolve;
      window.__auth.reject = reject;
    });
  }
}`;

let server: ViteDevServer;
let browser: Browser;
let origin: string;

beforeAll(async () => {
  server = await createServer({
    configFile: 'demo/standalone/vite.config.ts',
    plugins: [{
      name: 'standalone-test-idp', enforce: 'pre',
      resolveId: source => source === 'keycloak-js' ? '\0standalone-test-idp' : undefined,
      load: id => id === '\0standalone-test-idp' ? keycloakAdapter : undefined,
    }],
    server: { host: '127.0.0.1', port: 0, strictPort: false },
  });
  await server.listen();
  origin = server.resolvedUrls!.local[0]!.replace(/\/$/, '');
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
}, 60_000);

afterAll(async () => {
  await browser?.close();
  await server?.close();
});

async function openHost() {
  const page = await browser.newPage();
  page.setDefaultTimeout(10_000);
  const errors: string[] = [];
  const sdkRequests: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(`window.__auth = { initCalls: 0 }; window.__documentIdentity = {};`);
  let finishGrafana!: (status: number) => void;
  const grafanaStatus = new Promise<number>(resolve => { finishGrafana = resolve; });
  await page.route('**/grafana/api/user', async route => {
    const status = await grafanaStatus;
    await route.fulfill({ status, json: status === 200 ? { id: 1, orgId: 1, login: 'demo-viewer' } : {} });
  });
  await page.route('**/grafana/**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/grafana/api/user') return route.fallback();
    sdkRequests.push(url.pathname);
    if (url.pathname === '/grafana/api/health') {
      return route.fulfill({ json: { database: 'ok', version: '13.2.3', commit: '6193dc03311b631b9727b560d24369e683dc396e' } });
    }
    if (url.pathname === '/grafana/apis/dashboard.grafana.app/') {
      return route.fulfill({ json: {
        kind: 'APIGroup', apiVersion: 'v1', name: 'dashboard.grafana.app',
        preferredVersion: { groupVersion: 'dashboard.grafana.app/v1', version: 'v1' },
        versions: [{ groupVersion: 'dashboard.grafana.app/v1', version: 'v1' }],
      } });
    }
    return route.fulfill({ status: 404, json: {} });
  });
  await page.goto(origin);
  return { page, errors, sdkRequests, finishGrafana };
}

async function authenticate(page: Page) {
  await page.waitForFunction('typeof window.__auth.resolve === "function"');
  await page.evaluate('window.__auth.resolve(true)');
}

async function readyHost() {
  const host = await openHost();
  host.finishGrafana(200);
  await authenticate(host.page);
  await host.page.getByRole('button', { name: 'Log out', exact: true }).waitFor();
  return host;
}

describe('standalone React host in Chromium', { timeout: 20_000 }, () => {
  // Removing either gate would start real SDK network work before both sessions.
  it('withholds the real dashboard until SPA and Grafana sessions are both ready', async () => {
    const { page, errors, sdkRequests, finishGrafana } = await openHost();
    try {
      await page.getByRole('status').filter({ hasText: 'Signing in' }).waitFor();
      expect(await page.locator('[data-dashboard-render-status]').count()).toBe(0);
      expect(sdkRequests).toEqual([]);
      const checkingGrafana = page.waitForRequest('**/grafana/api/user');
      await authenticate(page);
      await checkingGrafana;
      expect(await page.locator('[data-dashboard-render-status]').count()).toBe(0);
      expect(sdkRequests).toEqual([]);
      finishGrafana(200);
      await page.locator('[data-dashboard-render-error="not-found"]').waitFor();
      expect(sdkRequests).toContain('/grafana/apis/dashboard.grafana.app/v1/namespaces/default/dashboards/drsdk-g-phase2-visualizations/dto');
      expect(await page.evaluate('window.__auth.initCalls')).toBe(1);
      expect(errors).toEqual([]);
    } finally { finishGrafana(200); await page.close(); }
  });

  it('shows safe authentication failure without mounting a dashboard', async () => {
    const { page, errors, sdkRequests, finishGrafana } = await openHost();
    try {
      await page.waitForFunction('typeof window.__auth.reject === "function"');
      await page.evaluate('window.__auth.reject(new Error("private credential details"))');
      await page.getByRole('alert').filter({ hasText: 'Authentication failed.' }).waitFor();
      expect(await page.locator('body').textContent()).not.toContain('private credential');
      expect(await page.locator('[data-dashboard-render-status]').count()).toBe(0);
      expect(sdkRequests).toEqual([]);
      expect(errors).toEqual([]);
    } finally { finishGrafana(200); await page.close(); }
  });

  it('reports a failed Grafana session independently of successful SPA authentication', async () => {
    const { page, errors, sdkRequests, finishGrafana } = await openHost();
    try {
      finishGrafana(403);
      await authenticate(page);
      await page.getByRole('alert').filter({ hasText: 'Grafana session check failed.' }).waitFor();
      expect(await page.locator('[data-dashboard-render-status]').count()).toBe(0);
      expect(sdkRequests).toEqual([]);
      expect(errors).toEqual([]);
    } finally { await page.close(); }
  });

  it('shows the identity and starts logout at Grafana from a keyboard action', async () => {
    const { page, errors } = await readyHost();
    try {
      const header = page.getByRole('banner');
      expect(await header.textContent()).toContain('Demo Viewer');
      expect(await header.textContent()).toContain('demo-viewer');
      const logout = header.getByRole('button', { name: 'Log out', exact: true });
      await logout.focus();
      const requested = page.waitForRequest('**/grafana/logout');
      await page.keyboard.press('Enter');
      expect(new URL((await requested).url()).pathname).toBe('/grafana/logout');
      expect(errors).toEqual([]);
    } finally { await page.close(); }
  });

  it('has one accessible Phase 2 entry and an expandable icon rail that grows the main region', async () => {
    const { page, errors } = await readyHost();
    try {
      const nav = page.getByRole('navigation', { name: 'Dashboards' });
      expect(await nav.getByRole('button').count()).toBe(1);
      const phase = nav.getByRole('button', { name: 'Phase 2 visualizations', exact: true });
      expect(await phase.getAttribute('aria-current')).toBe('page');
      const initialWidth = (await page.getByRole('main').boundingBox())!.width;
      const collapse = page.getByRole('button', { name: 'Collapse navigation', exact: true });
      expect(await collapse.getAttribute('aria-expanded')).toBe('true');
      expect(await collapse.getAttribute('aria-controls')).toBe(await nav.getAttribute('id'));
      await collapse.click();
      const expand = page.getByRole('button', { name: 'Expand navigation', exact: true });
      expect(await expand.getAttribute('aria-expanded')).toBe('false');
      await phase.focus();
      expect(await phase.evaluate(element => element === document.activeElement)).toBe(true);
      expect((await page.getByRole('main').boundingBox())!.width).toBeGreaterThan(initialWidth + 100);
      await expand.click();
      expect(await page.getByRole('button', { name: 'Collapse navigation' }).getAttribute('aria-expanded')).toBe('true');
      await page.setViewportSize({ width: 390, height: 844 });
      expect(await page.evaluate('document.documentElement.scrollWidth <= window.innerWidth')).toBe(true);
      expect(errors).toEqual([]);
    } finally { await page.close(); }
  });

  it('changes a valid UID through React state and rejects malformed optional lookups', async () => {
    const { page, errors, sdkRequests } = await readyHost();
    try {
      await page.locator('[data-dashboard-render-error="not-found"]').waitFor();
      await page.evaluate('window.__documentIdentity.marker = "original"');
      const input = page.getByLabel('Dashboard UID');
      const open = page.getByRole('button', { name: 'Open dashboard', exact: true });
      await input.fill('../invalid');
      expect(await open.isDisabled()).toBe(true);
      expect(await input.evaluate(element => (element as HTMLInputElement).validity.patternMismatch)).toBe(true);
      await input.fill('another_dashboard-1');
      expect(await open.isDisabled()).toBe(false);
      const alternate = page.waitForRequest('**/dashboards/another_dashboard-1/dto');
      await open.click();
      await alternate;
      expect(await page.evaluate('window.__documentIdentity.marker')).toBe('original');
      expect(page.url()).toBe(`${origin}/`);
      expect(sdkRequests.filter(path => path.includes('../invalid'))).toEqual([]);
      const primary = page.waitForRequest('**/dashboards/drsdk-g-phase2-visualizations/dto');
      await page.getByRole('navigation').getByRole('button', { name: 'Phase 2 visualizations' }).click();
      await primary;
      expect(await input.inputValue()).toBe('drsdk-g-phase2-visualizations');
      expect(await page.evaluate('window.__documentIdentity.marker')).toBe('original');
      expect(await page.evaluate('window.__auth.initCalls')).toBe(1);
      expect(errors).toEqual([]);
    } finally { await page.close(); }
  });
});
