import { readFileSync } from 'node:fs';
import { selectors } from '@grafana/e2e-selectors';
import { expect, test, type Page } from '@playwright/test';
import { authenticateGrafanaFixture } from '../e2e/support/grafanaAuth';
import { installConsoleGuard } from '../e2e/support/consoleGuard';
import { captureResourceEvidence, installResourceEvidence } from '../e2e/support/resourceEvidence';

const fixture = JSON.parse(readFileSync('dev/grafana/provisioning/dashboards/drsdk-g-phase2-visualizations.json', 'utf8'));
const barGaugeValueTestId = selectors.components.Panels.Visualization.BarGauge.valueV2;
const quiescentPageKeys = ['animationFrame', 'fetch', 'interval', 'mutationObserver', 'resizeObserver', 'timeout'] as const;

async function persistentListenerOwners(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  try { await cdp.send('HeapProfiler.collectGarbage'); }
  finally { await cdp.detach(); }
  await page.evaluate(() => (globalThis as any).__POC_RESOURCE_EVIDENCE__.sweepCollectedEventListeners());
  return page.evaluate(() => (globalThis as any).__POC_RESOURCE_EVIDENCE__.activeEventListeners()
    .filter((entry: { connected?: boolean }) => entry.connected !== false)
    .map((entry: { type: string; target: string }) => `${entry.target}:${entry.type}`).sort());
}

async function selectPanels(page: Page, types: readonly string[], mutate?: (panels: any[], dto: any) => void) {
  await page.route('**/dashboards/grsdk-phase0-poc/dto', async route => {
    const response = await route.fetch(); const dto = await response.json();
    dto.spec.panels = structuredClone(fixture.panels.filter((p: any) => types.includes(p.type)));
    mutate?.(dto.spec.panels, dto);
    await route.fulfill({ response, json: dto });
  });
}

test.use({ locale: 'en-US', trace: 'off' });
test.beforeEach(() => test.skip(!process.env.POC_GRAFANA_VERIFY_USER || !process.env.POC_GRAFANA_VERIFY_PASSWORD, 'local fixture credentials required'));

for (const [type, expectedLast] of [['gauge', null], ['bargauge', 10], ['bargauge', 90]] as const) {
  test(`renders native ${type}${expectedLast === null ? '' : ` at ${expectedLast}%`} geometry and lastNotNull percent from its real independent query`, async ({ page }) => {
    const session = await authenticateGrafanaFixture(page);
    try {
      const guard = await installConsoleGuard(page); const requests: string[] = [];
      page.on('request', r => requests.push(new URL(r.url()).pathname));
      await selectPanels(page, [type], (_panels, dto) => {
        if (expectedLast !== null) dto.spec.time = {
          from: '2026-10-28T00:00:00Z',
          to: expectedLast === 10 ? '2026-10-28T00:01:00Z' : '2026-10-28T00:01:05Z',
        };
      });
      const query = page.waitForResponse(r => r.url().includes('/api/ds/query') && r.request().method() === 'POST').catch(() => undefined);
      await page.goto('/');
      const panel = page.getByRole('region', { name: type === 'gauge' ? 'Gauge — predictable pulse' : 'Bar gauge — predictable pulse' });
      // This native-owned output is the RED gate while the manifest stays inactive.
      try {
        if (type === 'gauge') await expect(panel.getByRole('img', { name: 'Gauge', exact: true })).toBeVisible({ timeout: 15_000 });
        else await expect(panel.getByTestId(barGaugeValueTestId)).toBeVisible({ timeout: 15_000 });
      } catch {
        throw new Error(JSON.stringify({ native: type, body: (await page.locator('body').innerText()).slice(0, 1600), console: await guard.snapshot(), requests }));
      }
      const response = await query;
      if (!response) throw new Error('Expected the native renderer query response.');
      expect(response.status()).toBe(200);
      const request = response.request();
      const panelId = type === 'gauge' ? 5 : 6;
      expect(request.headers()['x-dashboard-uid']).toBe('grsdk-phase0-poc');
      expect(request.headers()['x-panel-id']).toBe(String(panelId));
      expect(new URL(request.url()).searchParams.get('requestId')).toMatch(new RegExp(`^sdk13-g\\d+-p${panelId}\\d+$`));
      const frame = (await response.json()).results.A.frames[0];
      expect(frame.schema.refId).toBe('A');
      expect(frame.schema.fields.map((f: any) => f.type)).toEqual(['time', 'number']);
      expect(frame.data.values[0].length).toBe(frame.data.values[1].length);
      expect(frame.data.values[1].length).toBeGreaterThan(0);
      expect(new Set(frame.data.values[1])).toEqual(new Set([10, 90]));
      const last = frame.data.values[1].filter((v: unknown) => v !== null).at(-1);
      if (expectedLast !== null) expect(last).toBe(expectedLast);
      await expect(panel).toContainText(`${last}%`);
      if (type === 'gauge') {
        const svg = panel.getByRole('img', { name: 'Gauge', exact: true });
        const radial = svg.locator(':scope > path');
        const geometry = await radial.evaluateAll(nodes => nodes.slice(0, 2).map(n => ({
          length: (n as SVGPathElement).getTotalLength(), stroke: getComputedStyle(n).stroke,
        })));
        expect(geometry).toHaveLength(2);
        const [unfilled, filled] = geometry;
        if (!unfilled || !filled) throw new Error('Expected both native Gauge arc paths');
        expect(filled.length / (unfilled.length + filled.length)).toBeCloseTo(last / 100, 2);
        expect(filled.stroke).toBe(last === 90 ? 'rgb(224, 47, 68)' : 'rgb(86, 166, 75)');
        const before = await svg.boundingBox();
        await page.setViewportSize({ width: 900, height: 850 });
        await expect.poll(async () => (await svg.boundingBox())!.width).toBeLessThan(before!.width - 50);
      } else {
        const bar = panel.locator('div[style*="linear-gradient"]');
        await expect(bar).toHaveCount(1);
        await expect.poll(() => bar.evaluate(node => {
          const element = node as HTMLElement; const empty = element.previousElementSibling as HTMLElement;
          const vertical = element.parentElement!.style.flexDirection === 'column';
          const filled = parseFloat(vertical ? element.style.height : element.style.width);
          const unfilled = vertical ? empty.getBoundingClientRect().height : empty.getBoundingClientRect().width;
          return filled / (filled + unfilled);
        })).toBeCloseTo(last / 100, 1);
        const gradient = await bar.evaluate(node => (node as HTMLElement).style.backgroundImage);
        expect(gradient.match(/rgb\(\d+, \d+, \d+\)/g)).toEqual(last === 10
          ? ['rgb(86, 166, 75)', 'rgb(86, 166, 75)']
          : ['rgb(86, 166, 75)', 'rgb(86, 166, 75)', 'rgb(255, 120, 10)', 'rgb(224, 47, 68)']);
        await expect(panel.getByTestId(barGaugeValueTestId)).toHaveCSS('color', last === 10 ? 'rgb(86, 166, 75)' : 'rgb(224, 47, 68)');
      }
      expect(requests.filter(p => p.includes('/api/ds/query'))).toHaveLength(1);
      expect(requests.some(p => p.includes(`/feature-${type}-`))).toBe(true);
      for (const sibling of ['text', 'stat', 'timeseries', 'gauge', 'bargauge', 'table', 'piechart', 'barchart'].filter(id => id !== type)) {
        expect(requests.some(p => p.includes(`/feature-${sibling}-`)), sibling).toBe(false);
      }
      await guard.assertClean();
    } finally { await session.cleanup(); }
  });
}

test('keeps rejected single-value and Table profiles query-free and loader-free', async ({ page }) => {
  const session = await authenticateGrafanaFixture(page);
  try {
    const guard = await installConsoleGuard(page); const requests: string[] = [];
    page.on('request', r => requests.push(new URL(r.url()).pathname));
    await selectPanels(page, ['gauge', 'bargauge', 'table'], panels => {
      panels.find(p => p.type === 'gauge').options.shape = 'circle';
      panels.find(p => p.type === 'bargauge').targets[0].scenarioId = 'table_static';
      panels.find(p => p.type === 'table').options.enablePagination = true;
      const old = JSON.parse(readFileSync('dev/grafana/provisioning/dashboards/grsdk-phase0-poc.json', 'utf8')).panels.find((p: any) => p.type === 'table');
      old.id = 44; old.gridPos = { x: 0, y: 30, w: 8, h: 6 }; panels.push(old);
    });
    await page.goto('/');
    await expect(page.locator('[data-dashboard-panel-kind="not-supported"]')).toHaveCount(4, { timeout: 15_000 });
    expect(requests.some(p => /feature-(?:gauge|bargauge|table|testdata-runtime|piechart|barchart)-|provider-query-runtime-|\/api\/(?:ds\/query|frontend\/settings)/.test(p))).toBe(false);
    await guard.assertClean();
  } finally { await session.cleanup(); }
});

test('owns Gauge and Bar gauge queries across two instances, resize, UID switch and repeated teardown', async ({ page }) => {
  const session = await authenticateGrafanaFixture(page);
  try {
    const guard = await installConsoleGuard(page); await installResourceEvidence(page);
    const queries: string[] = []; const chunks: string[] = [];
    page.on('request', r => {
      const url = new URL(r.url());
      if (url.pathname.includes('/api/ds/query')) queries.push(url.searchParams.get('requestId')!);
      if (/feature-(?:gauge|bargauge)-/.test(url.pathname)) chunks.push(url.pathname);
    });
    await selectPanels(page, ['gauge', 'bargauge']);
    await page.goto('/');
    const primary = page.getByTestId('sdk-primary-slot'); const secondary = page.getByTestId('sdk-secondary-slot');
    await expect(primary.getByTestId(barGaugeValueTestId)).toContainText('%', { timeout: 15_000 });
    await expect(primary.getByRole('img', { name: 'Gauge', exact: true })).toBeVisible();
    await page.getByTestId('sdk-toggle-native-second').click();
    await expect(secondary.getByTestId(barGaugeValueTestId)).toContainText('%');
    await expect(secondary.getByRole('img', { name: 'Gauge', exact: true })).toBeVisible();
    expect(queries).toHaveLength(4); expect(new Set(queries).size).toBe(4);
    expect(chunks).toHaveLength(2);
    await page.getByTestId('sdk-toggle-mount').click();
    await expect(primary.locator('[data-dashboard-render-instance]')).toHaveCount(0);
    await expect(secondary.getByRole('img', { name: 'Gauge', exact: true })).toBeVisible();
    await page.getByTestId('sdk-toggle-native-second').click();
    await expect(page.locator('[data-dashboard-render-instance]')).toHaveCount(0);
    await expect.poll(async () => {
      const snapshot = await captureResourceEvidence(page, 'single-value-dormant');
      return quiescentPageKeys.map(key => snapshot.page[key]);
    }).toEqual(quiescentPageKeys.map(() => 0));
    const dormant = await captureResourceEvidence(page, 'single-value-dormant');
    const dormantListeners = await persistentListenerOwners(page);
    for (let iteration = 0; iteration < 2; iteration++) {
      await page.getByTestId('sdk-toggle-mount').click();
      await expect(primary.getByTestId(barGaugeValueTestId)).toContainText('%');
      await expect(primary.getByRole('img', { name: 'Gauge', exact: true })).toBeVisible();
      await page.getByTestId('sdk-switch-uid').click();
      await expect(primary.getByTestId('TextPanel-converted-content')).toContainText('phase0-alt');
      await expect(primary.getByRole('img', { name: 'Gauge', exact: true })).toHaveCount(0);
      await page.getByTestId('sdk-switch-uid').click();
      await expect(primary.getByTestId(barGaugeValueTestId)).toContainText('%');
      await page.getByTestId('sdk-toggle-mount').click();
      await expect(page.locator('[data-dashboard-render-instance]')).toHaveCount(0);
      await expect.poll(async () => {
        const snapshot = await captureResourceEvidence(page, 'single-value-retired');
        return quiescentPageKeys.map(key => snapshot.page[key]);
      }).toEqual(quiescentPageKeys.map(() => 0));
      const current = await captureResourceEvidence(page, 'single-value-retired');
      expect(current.instance).toEqual(dormant.instance);
      expect(current.dom).toEqual(dormant.dom);
      expect(await persistentListenerOwners(page)).toEqual(dormantListeners);
    }
    expect(chunks).toHaveLength(2);
    await guard.assertClean();
  } finally { await session.cleanup(); }
});

test('cancels held Gauge/Bar gauge queries and consumes late real frames without publishing into the alternate UID', async ({ page }) => {
  const session = await authenticateGrafanaFixture(page);
  let release!: () => void; const held = new Promise<void>(resolve => { release = resolve; });
  try {
    const guard = await installConsoleGuard(page); await installResourceEvidence(page);
    await selectPanels(page, ['gauge', 'bargauge']);
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
    await expect(page.getByRole('img', { name: 'Gauge', exact: true })).toHaveCount(0);
    await expect(page.getByTestId(barGaugeValueTestId)).toHaveCount(0);
    await page.getByTestId('sdk-toggle-mount').click();
    await expect(page.locator('[data-dashboard-render-instance]')).toHaveCount(0);
    await expect.poll(async () => (await captureResourceEvidence(page, 'cancelled-single-values')).page.fetch).toBe(0);
    await expect.poll(async () => (await captureResourceEvidence(page, 'cancelled-single-values')).page.resizeObserver).toBe(0);
    await guard.assertClean();
  } finally { release(); await session.cleanup(); }
});
