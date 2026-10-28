import { selectors } from '@grafana/e2e-selectors';
import { expect, test } from '@playwright/test';
import { dashboardPath, missingPath, observeBrowser, origin, redact, signIn, uid } from './support';

// Catches anonymous access, broken OAuth/PKCE/session separation, native-render regressions,
// expanded transport authority, full-page UID navigation, and incomplete dual logout.
test('real PKCE and independent Viewer session render the supported catalogue and end at both services', async ({ page, context }) => {
  try {
  const anonymous = await context.request.get(dashboardPath, { maxRedirects: 0 });
  expect(anonymous.status()).toBe(401);
  expect(await anonymous.text()).not.toContain('Predictable Pulse');
  const evidence = await observeBrowser(page);
  await signIn(page).catch(error => { throw new Error(`${error.message}; problems=${JSON.stringify(evidence.problems)}`); });

  const userResponse = await context.request.get('/grafana/api/user');
  expect(userResponse.status()).toBe(200);
  const user = await userResponse.json();
  expect(user.login).toBe('demo-viewer');
  // Grafana 13's /api/user omits the role; the authenticated organization endpoint owns it.
  const organizations = await context.request.get('/grafana/api/user/orgs');
  expect(organizations.status()).toBe(200);
  expect((await organizations.json()).find((org: { orgId: number }) => org.orgId === user.orgId)?.role).toBe('Viewer');
  expect(user.isGrafanaAdmin).toBe(false);
  expect((await context.cookies()).some(cookie => cookie.name === 'standalone_demo_grafana_session' && cookie.httpOnly)).toBe(true);
  await expect(page.locator('.demo-identity')).toContainText('demo-viewer');
  const identity = await page.locator('.demo-identity').innerText();
  expect(identity.length).toBeLessThanOrEqual(193);

  await expect(page.getByTestId('TextPanel-converted-content')).toContainText('Bounded Predictable Pulse fixture.').catch(async () => {
    const dto = await (await context.request.get(dashboardPath)).json();
    throw new Error(`Native render failed: ${JSON.stringify({ body: (await page.locator('body').innerText()).slice(0, 1500), problems: evidence.problems, statuses: evidence.statuses, dto: { kind: dto.kind, apiVersion: dto.apiVersion, access: dto.access, schemaVersion: dto.spec?.schemaVersion, name: dto.metadata?.name, namespace: dto.metadata?.namespace }, errors: await page.locator('[data-dashboard-render-error]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-dashboard-render-error'))) })}`);
  });
  await expect(page.getByRole('region', { name: 'Stat — predictable pulse' })).toContainText(/(?:10|90)%/);
  await expect(page.getByRole('region', { name: 'Time series — predictable pulse' }).locator('.uplot canvas')).not.toHaveCount(0);
  const gauge = page.getByRole('region', { name: 'Gauge — predictable pulse', exact: true });
  await expect(gauge.getByRole('img', { name: 'Gauge', exact: true })).toBeVisible();
  await expect(gauge).toContainText(/(?:10|90)%/);
  const arcLengths = await gauge.getByRole('img', { name: 'Gauge', exact: true }).locator(':scope > path').evaluateAll(nodes =>
    nodes.slice(0, 2).map(node => (node as SVGPathElement).getTotalLength()));
  expect(arcLengths).toHaveLength(2);
  expect(arcLengths.every(length => length > 0)).toBe(true);
  await expect(page.getByRole('region', { name: 'Bar gauge — predictable pulse' }).getByTestId(selectors.components.Panels.Visualization.BarGauge.valueV2)).toHaveText(/(?:10|90)%/);
  const placeholders = page.locator('[data-dashboard-panel-kind="not-supported"]');
  await expect(placeholders).toHaveCount(3);
  for (const title of ['Table', 'Pie chart', 'Bar chart']) await expect(placeholders.filter({ hasText: `${title} — predictable pulse` })).toContainText('Not-Supported');
  await expect.poll(() => evidence.frames.length).toBe(4);
  expect(evidence.queryPanels.sort()).toEqual(['2', '3', '5', '6']);
  for (const frame of evidence.frames) {
    expect(frame.types).toEqual(['time', 'number']);
    expect(frame.values[0].length).toBe(frame.values[1].length);
    expect(frame.values[0].every(Number.isFinite)).toBe(true);
    expect(new Set(frame.values[1])).toEqual(new Set([10, 90]));
  }
  expect(evidence.paths).toContain(dashboardPath);
  expect(evidence.paths.some(path => /feature-(?:table|piechart|barchart)-/.test(path))).toBe(false);
  expect(evidence.statuses.some(entry => entry.path === '/grafana/api/user' && entry.status === 401)).toBe(true);
  expect(evidence.statuses.some(entry => entry.path === '/grafana/api/user' && entry.status === 200)).toBe(true);

  const main = page.getByRole('main', { name: 'Dashboard workspace' });
  const expanded = (await main.boundingBox())!;
  const dashboardWidth = (await page.locator('.demo-dashboard').boundingBox())!.width;
  await page.getByRole('button', { name: 'Collapse navigation' }).click();
  await expect(page.getByRole('button', { name: 'Expand navigation' })).toHaveAttribute('aria-expanded', 'false');
  expect((await main.boundingBox())!.width).toBeGreaterThan(expanded.width + 150);
  expect((await page.locator('.demo-dashboard').boundingBox())!.width).toBeGreaterThan(dashboardWidth + 150);
  expect((await page.locator('.demo-sidebar').boundingBox())!.width).toBeLessThan(80);
  await expect(page.locator('.demo-navigation-label')).toBeHidden();
  await expect(page.locator('.demo-navigation-icon')).toBeVisible();
  await page.getByRole('button', { name: 'Expand navigation' }).click();
  expect((await main.boundingBox())!.width).toBeCloseTo(expanded.width, 0);

  // A real unknown UID request proves state navigation, then the sidebar restores the real fixture.
  const documents = evidence.documents();
  await page.getByLabel('Dashboard UID', { exact: true }).fill('demo-missing-dashboard');
  const missing = page.waitForResponse(response => new URL(response.url()).pathname === missingPath);
  await page.getByRole('button', { name: 'Open dashboard' }).click();
  expect((await missing).status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'Dashboard lookup' })).toBeVisible();
  await page.getByRole('button', { name: 'Phase 2 visualizations', exact: true }).click();
  await expect(page.getByTestId('TextPanel-converted-content')).toContainText('Phase 2 native visualizations');
  await expect(page.getByLabel('Dashboard UID', { exact: true })).toHaveValue(uid);
  await expect.poll(() => evidence.frames.length).toBe(8);
  expect(evidence.queryPanels.sort()).toEqual(['2', '2', '3', '3', '5', '5', '6', '6']);
  expect(evidence.documents()).toBe(documents);
  expect(page.url()).toBe(`${origin}/`);
  await expect(page.locator('iframe')).toHaveCount(0);
  await expect(page.locator('nav')).toHaveCount(1);
  await expect(page.getByRole('navigation', { name: 'Dashboards', exact: true })).toBeVisible();
  await expect(page.locator('.grafana-app, .sidemenu, [data-testid="data-testid Nav toolbar"]')).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { __DEMO_REACT_RENDERERS__: string[] }).__DEMO_REACT_RENDERERS__)).toEqual(['19.2.8']);
  const stored = await page.evaluate(() => [...Object.keys(localStorage), ...Object.keys(sessionStorage)]);
  expect(stored.some(key => /token/i.test(key))).toBe(false);
  await evidence.assertNoTokenPersistence();

  const logout = page.getByRole('button', { name: 'Log out', exact: true });
  await logout.focus();
  await expect(logout).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#kc-logout, #username')).toBeVisible().catch(async () => {
    throw new Error(`Keycloak logout did not reach confirmation or login: ${(await page.locator('body').innerText()).slice(0, 800)}`);
  });
  if (await page.locator('#kc-logout').count()) await page.locator('#kc-logout').click();
  await expect(page.locator('#username')).toBeVisible();
  expect((await context.request.get('/grafana/api/user', { maxRedirects: 0 })).status()).toBe(401);
  const afterLogout = await context.request.get(dashboardPath, { maxRedirects: 0 });
  expect(afterLogout.status()).toBe(401);
  expect(await afterLogout.text()).not.toContain('Predictable Pulse');
  expect((await context.cookies()).some(cookie => cookie.name === 'standalone_demo_grafana_session')).toBe(false);
  expect(evidence.paths).toContain('/grafana/logout');
  expect(evidence.paths).toContain('/keycloak/realms/dashboard-render-sdk-g-demo/protocol/openid-connect/logout');
  await evidence.verify();
  } catch (error) {
    // Playwright's navigation call logs may contain IdP codes or id_token_hint.
    throw new Error(redact(error instanceof Error ? error.message : error));
  }
});
