import { expect, test } from '@playwright/test';
import { authenticateGrafanaFixture } from '../e2e/support/grafanaAuth';
import { installConsoleGuard } from '../e2e/support/consoleGuard';
import { captureResourceEvidence, installResourceEvidence } from '../e2e/support/resourceEvidence';

test.use({ locale: 'en-US', trace: 'off' });
test.beforeEach(() => test.skip(!process.env.POC_GRAFANA_VERIFY_USER || !process.env.POC_GRAFANA_VERIFY_PASSWORD, 'local fixture credentials required'));

test('keeps Text-only rendering free of native renderers, query services and uPlot styles', async ({ page }) => {
  const session = await authenticateGrafanaFixture(page);
  try {
    const guard = await installConsoleGuard(page); const requests: string[] = [];
    page.on('request', r => requests.push(new URL(r.url()).pathname));
    await page.route('**/dashboards/grsdk-phase0-poc/dto', async route => {
      const response = await route.fetch(); const dto = await response.json();
      dto.spec.panels = dto.spec.panels.filter((p: any) => p.type === 'text');
      await route.fulfill({ response, json: dto });
    });
    await page.goto('/');
    await expect(page.getByTestId('TextPanel-converted-content')).toContainText('phase0.', { timeout: 15_000 });
    expect(requests.some(p => /feature-(?:stat|timeseries|testdata-runtime)-|provider-query-runtime-|\/api\/(?:ds\/query|frontend\/settings)/.test(p))).toBe(false);
    await expect(page.locator('[data-dashboard-native-styles]')).toHaveCount(0);
    await guard.assertClean();
  } finally { await session.cleanup(); }
});

for (const type of ['stat', 'timeseries'] as const) {
  test(`renders the real query-backed ${type} renderer in an independent lazy closure`, async ({ page }) => {
    const session = await authenticateGrafanaFixture(page);
    try {
      const guard = await installConsoleGuard(page);
      const requests: string[] = [];
      page.on('request', r => requests.push(new URL(r.url()).pathname));
      await page.route('**/dashboards/grsdk-phase0-poc/dto', async route => {
        const response = await route.fetch(); const dto = await response.json();
        dto.spec.panels = dto.spec.panels.filter((p: any) => p.type === type);
        await route.fulfill({ response, json: dto });
      });
      const query = page.waitForResponse(r => r.url().includes('/api/ds/query') && r.request().method() === 'POST', { timeout: 15_000 }).catch(async () => {
        throw new Error(`Native query did not reach Grafana: ${JSON.stringify({ body: (await page.locator('body').innerText()).slice(0, 1500), console: await guard.snapshot(), requests })}`);
      });
      await page.goto('/');
      const response = await query;
      expect(response.status()).toBe(200);
      const request = response.request();
      expect(new URL(request.url()).searchParams.get('requestId')).toMatch(new RegExp(`^sdk13-g\\d+-p${type === 'stat' ? 2 : 3}\\d+$`));
      expect(request.headers()['x-dashboard-uid']).toBe('grsdk-phase0-poc');
      expect(request.headers()['x-panel-id']).toBe(type === 'stat' ? '2' : '3');
      const wire = await response.json();
      const frame = wire.results.A.frames[0];
      expect(frame.schema.fields.map((f: any) => f.type)).toEqual(['time', 'number']);
      expect(frame.data.values[1].length).toBeGreaterThan(0);
      expect(new Set(frame.data.values[1])).toEqual(new Set([10, 90]));
      const title = type === 'stat' ? 'Stat — predictable pulse' : 'Time series — predictable pulse';
      const panel = page.getByRole('region', { name: title });
      await expect(panel).toBeVisible({ timeout: 15_000 });
      if (type === 'stat') {
        const last = frame.data.values[1].filter((v: unknown) => v !== null).at(-1);
        await expect(panel).toContainText(`${last}%`);
        const gradients = await panel.locator('[style]').evaluateAll(nodes => nodes.map(n => (n as HTMLElement).style.background).filter(v => v.includes('linear-gradient')));
        expect(gradients.length).toBeGreaterThan(0);
        const [gradient] = gradients;
        if (!gradient) throw new Error('Expected a native Stat background gradient');
        const color = /rgb\((\d+), (\d+), (\d+)\)/.exec(gradient)?.slice(1).map(Number);
        const [red, green, blue] = color ?? [];
        if (red === undefined || green === undefined || blue === undefined) throw new Error('Expected native Stat RGB gradient channels');
        expect(last === 90 ? red : green).toBeGreaterThan(last === 90 ? green : red);
        expect(last === 90 ? red : green).toBeGreaterThan(blue);
      } else {
        await expect(panel.locator('.uplot canvas')).not.toHaveCount(0);
        await expect(panel.locator('.u-over').first()).toHaveCSS('position', 'absolute');
        await expect(panel.getByText('Phase 0 Pulse Signal', { exact: true })).toBeVisible();
        await expect(panel).not.toContainText('Phase 0 Pulse Raw');
        const before = await panel.locator('.uplot').first().boundingBox();
        await page.setViewportSize({ width: 900, height: 850 });
        await expect.poll(async () => (await panel.locator('.uplot').first().boundingBox())!.width).toBeLessThan(before!.width - 100);
      }
      const sibling = type === 'stat' ? 'timeseries' : 'stat';
      expect(requests.some(p => p.includes(`/feature-${type}-`))).toBe(true);
      expect(requests.some(p => p.includes(`/feature-${sibling}-`))).toBe(false);
      expect(requests.some(p => p.includes('/feature-text-'))).toBe(false);
      expect(requests.filter(p => p.includes('/api/ds/query'))).toHaveLength(1);
      await guard.assertClean();
    } finally { await session.cleanup(); }
  });
}

test('cleans native queries, plots and ResizeObservers through UID switch and unmount', async ({ page }) => {
  const session = await authenticateGrafanaFixture(page);
  try {
    const guard = await installConsoleGuard(page);
    await installResourceEvidence(page);
    await page.goto('/');
    await expect(page.getByRole('region', { name: 'Time series — predictable pulse' }).locator('.uplot canvas')).not.toHaveCount(0, { timeout: 15_000 });
    await expect(page.locator('[data-dashboard-panel-kind="not-supported"]')).toHaveCount(1);
    await expect(page.locator('[data-dashboard-native-styles]')).toHaveCount(1);
    await page.getByTestId('sdk-switch-uid').click();
    await expect(page.getByTestId('TextPanel-converted-content')).toContainText('phase0-alt');
    await expect(page.locator('.uplot')).toHaveCount(0);
    await expect(page.locator('[data-dashboard-native-styles]')).toHaveCount(0);
    await page.getByTestId('sdk-switch-uid').click();
    await expect(page.getByRole('region', { name: 'Time series — predictable pulse' }).locator('.uplot canvas')).not.toHaveCount(0);
    await page.getByTestId('sdk-toggle-mount').click();
    await expect(page.locator('[data-dashboard-render-instance]')).toHaveCount(0);
    await expect.poll(async () => (await captureResourceEvidence(page, 'native-unmounted')).page.resizeObserver).toBe(0);
    await expect.poll(async () => (await captureResourceEvidence(page, 'native-unmounted')).page.fetch).toBe(0);
    await expect(page.locator('.uplot')).toHaveCount(0);
    await guard.assertClean();
  } finally { await session.cleanup(); }
});

test('keeps a native module-load failure local with no failed-panel query', async ({ page }) => {
  const session = await authenticateGrafanaFixture(page);
  try {
    const guard = await installConsoleGuard(page);
    const queries: string[] = [];
    page.on('request', r => { if (r.url().includes('/api/ds/query')) queries.push(r.url()); });
    await page.route('**/feature-stat-*.js', route => route.fulfill({ contentType: 'application/javascript', body: 'throw new Error("controlled-native-load-failure");' }));
    await page.goto('/');
    await expect(page.locator('[data-dashboard-panel-error="2"]')).toHaveText('Panel unavailable.', { timeout: 15_000 });
    await expect(page.getByTestId('TextPanel-converted-content')).toContainText('phase0.');
    await expect(page.getByRole('region', { name: 'Time series — predictable pulse' }).locator('.uplot canvas')).not.toHaveCount(0);
    expect(queries).toHaveLength(1);
    await guard.assertClean();
  } finally { await session.cleanup(); }
});

test('owns native query and observer lifetimes independently across two compatible instances', async ({ page }) => {
  const session = await authenticateGrafanaFixture(page);
  try {
    const guard = await installConsoleGuard(page);
    await installResourceEvidence(page);
    const queryIds: string[] = [];
    page.on('request', r => { if (r.url().includes('/api/ds/query')) queryIds.push(new URL(r.url()).searchParams.get('requestId')!); });
    await page.goto('/');
    await expect(page.getByTestId('sdk-primary-slot').locator('.uplot canvas')).not.toHaveCount(0, { timeout: 15_000 });
    await page.getByTestId('sdk-toggle-native-second').click();
    await expect(page.getByTestId('sdk-secondary-slot').getByRole('region', { name: 'Time series — predictable pulse' }).locator('.uplot canvas')).not.toHaveCount(0);
    expect(queryIds).toHaveLength(4);
    expect(new Set(queryIds).size).toBe(4);
    await page.getByTestId('sdk-toggle-mount').click();
    await expect(page.getByTestId('sdk-primary-slot').locator('.uplot')).toHaveCount(0);
    await expect(page.getByTestId('sdk-secondary-slot').getByRole('region', { name: 'Time series — predictable pulse' }).locator('.uplot canvas')).not.toHaveCount(0);
    await expect(page.locator('[data-dashboard-native-styles]')).toHaveCount(1);
    await page.getByTestId('sdk-toggle-native-second').click();
    await expect(page.locator('[data-dashboard-render-instance]')).toHaveCount(0);
    await expect.poll(async () => (await captureResourceEvidence(page, 'two-native-unmounted')).page.resizeObserver).toBe(0);
    await expect(page.locator('[data-dashboard-native-styles]')).toHaveCount(0);
    await guard.assertClean();
  } finally { await session.cleanup(); }
});

test('cancels held native query generations and consumes late real responses after UID switch', async ({ page }) => {
  const session = await authenticateGrafanaFixture(page);
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  try {
    const guard = await installConsoleGuard(page);
    let responses = 0;
    await page.route('**/api/ds/query?*', async route => {
      const response = await route.fetch(); responses++;
      await held;
      await route.fulfill({ response }).catch(() => {});
    });
    await page.goto('/');
    await expect.poll(() => responses).toBe(2);
    await page.getByTestId('sdk-switch-uid').click();
    await expect(page.getByTestId('TextPanel-converted-content')).toContainText('phase0-alt');
    release();
    await expect(page.locator('.uplot')).toHaveCount(0);
    await expect(page.locator('[data-dashboard-native-styles]')).toHaveCount(0);
    await page.getByTestId('sdk-toggle-mount').click();
    await expect(page.locator('[data-dashboard-render-instance]')).toHaveCount(0);
    await guard.assertClean();
  } finally { release(); await session.cleanup(); }
});

test('keeps Table and Pie inert while all five admitted native query panels render independently', async ({ page }) => {
  const session = await authenticateGrafanaFixture(page);
  try {
    const guard = await installConsoleGuard(page); let queries = 0;
    page.on('request', r => { if (r.url().includes('/api/ds/query')) queries++; });
    await page.goto('/');
    await expect(page.getByRole('region', { name: 'Time series — predictable pulse' }).locator('.uplot canvas')).not.toHaveCount(0, { timeout: 15_000 });
    await page.getByTestId('sdk-expanded-uid').click();
    await expect(page.getByText('Phase 2 Pulse Signal', { exact: true })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Gauge — predictable pulse' }).getByRole('img', { name: 'Gauge', exact: true })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Bar gauge — predictable pulse' })).toContainText('%');
    await expect(page.getByRole('region', { name: 'Bar chart — predictable pulse' }).locator('.uplot canvas')).not.toHaveCount(0);
    await expect(page.locator('[data-dashboard-panel-kind="not-supported"]')).toHaveCount(2);
    expect(queries).toBe(7);
    await guard.assertClean();
  } finally { await session.cleanup(); }
});
