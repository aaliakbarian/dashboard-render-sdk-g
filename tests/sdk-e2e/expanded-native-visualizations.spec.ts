import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { selectors } from '@grafana/e2e-selectors';
import { authenticateGrafanaFixture } from '../e2e/support/grafanaAuth';
import { installConsoleGuard } from '../e2e/support/consoleGuard';
import { captureResourceEvidence, installResourceEvidence } from '../e2e/support/resourceEvidence';

const expandedUid = 'drsdk-g-phase2-visualizations';
const expandedFixture = JSON.parse(readFileSync(
  'dev/grafana/provisioning/dashboards/drsdk-g-phase2-visualizations.json',
  'utf8'
));
const queryPanelIds = ['2', '3', '4', '5', '6', '7', '8'];
const stableDormantKeys = [
  'abortController',
  'animationFrame',
  'fetch',
  'interval',
  'mutationObserver',
  'resizeObserver',
  'timeout',
] as const;

async function waitForExpandedDashboard(page: import('@playwright/test').Page) {
  await expect(page.getByTestId('sdk-dashboard-status').first()).toHaveAttribute(
    'data-sdk-status-uid',
    expandedUid,
    { timeout: 15_000 }
  );
  await expect(page.getByTestId('TextPanel-converted-content')).toContainText(
    'Phase 2 native visualizations'
  );
  await expect(page.getByRole('region', { name: 'Time series — predictable pulse' }).locator('.uplot canvas'))
    .not.toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Table — predictable pulse' }).getByRole('grid'))
    .toBeVisible();
  await expect(page.getByRole('region', { name: 'Pie chart — predictable pulse' })
    .getByTestId(selectors.components.Panels.Visualization.PieChart.svgSlice)).toHaveCount(1);
}

async function waitForDormantResources(page: import('@playwright/test').Page, label: string) {
  await expect.poll(async () => {
    const snapshot = await captureResourceEvidence(page, label);
    return stableDormantKeys.slice(1).map(key => snapshot.page[key]);
  }).toEqual(stableDormantKeys.slice(1).map(() => 0));
}

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

test('renders the real all-eight UID with one exact native DataFrame query per query-backed panel', async ({ page }) => {
  const session = await authenticateGrafanaFixture(page);
  try {
    const guard = await installConsoleGuard(page);
    const assetRequests = new Set<string>();
    const frames: Array<{
      names: string[];
      labels: unknown[];
      meta: unknown;
      panelId: string;
      requestId: string;
      types: string[];
      values: unknown[][];
    }> = [];
    const pending: Promise<void>[] = [];
    page.on('request', request => {
      const path = new URL(request.url()).pathname;
      if (path.startsWith('/assets/') && path.endsWith('.js')) assetRequests.add(path);
    });
    page.on('response', response => {
      const request = response.request();
      if (!response.url().includes('/api/ds/query') || request.headers()['x-dashboard-uid'] !== expandedUid) return;
      pending.push((async () => {
        const wire = await response.json();
        const frame = wire.results.A.frames[0];
        frames.push({
          names: frame.schema.fields.map((field: any) => field.name),
          labels: frame.schema.fields.map((field: any) => field.labels ?? null),
          meta: frame.schema.meta,
          panelId: request.headers()['x-panel-id'] ?? '',
          requestId: new URL(request.url()).searchParams.get('requestId') ?? '',
          types: frame.schema.fields.map((field: any) => field.type),
          values: frame.data.values,
        });
      })());
    });
    await page.goto('/');
    await page.getByTestId('sdk-expanded-uid').click();
    await waitForExpandedDashboard(page);
    await expect(page.getByRole('region', { name: 'Stat — predictable pulse' })).toContainText(/(?:10|90)%/);
    await expect(page.getByText('Phase 2 Pulse Signal', { exact: true })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Gauge — predictable pulse' })
      .getByRole('img', { name: 'Gauge', exact: true })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Bar gauge — predictable pulse' })
      .getByTestId(selectors.components.Panels.Visualization.BarGauge.valueV2)).toHaveText(/(?:10|90)%/);
    await expect(page.getByRole('region', { name: 'Bar chart — predictable pulse' })
      .locator('.uplot canvas')).not.toHaveCount(0);
    await expect(page.locator('[data-dashboard-panel-kind="not-supported"]')).toHaveCount(0);
    await expect.poll(() => frames.length).toBe(7);
    await Promise.all(pending);
    expect(frames.map(frame => frame.panelId).sort()).toEqual(queryPanelIds);
    expect(new Set(frames.map(frame => frame.requestId)).size).toBe(7);
    for (const frame of frames) {
      expect(frame.names).toEqual(['Time', 'Value']);
      expect(frame.types).toEqual(['time', 'number']);
      expect(frame.labels).toEqual([null, {}]);
      expect(frame.meta).toEqual({ type: 'timeseries-multi', typeVersion: [0, 0] });
      const [timesRaw, values] = frame.values;
      if (!timesRaw || !values) throw new Error('Expected time and numeric fields.');
      expect(timesRaw.length).toBeGreaterThan(0);
      expect(values).toHaveLength(timesRaw.length);
      const times = timesRaw as number[];
      expect(times.every((value, index) => Number.isFinite(value) &&
        (index === 0 || value > times[index - 1]!))).toBe(true);
      expect(new Set(values)).toEqual(new Set([10, 90]));
    }
    // Text identity is asserted through its renderer-owned content test id and
    // the fail-closed host bundle inspector. The browser may satisfy its
    // already-loaded feature chunk from the page's module map before this
    // aggregate transition; every newly activated query renderer must still
    // produce its independent lazy network edge.
    const requestedFeatureIds = [...assetRequests]
      .map(path => /\/feature-([a-z]+)-/.exec(path)?.[1])
      .filter((id): id is string => id !== undefined)
      .sort();
    expect(requestedFeatureIds).toEqual(expect.arrayContaining([
      'stat', 'timeseries', 'table', 'gauge', 'bargauge', 'piechart', 'barchart',
    ]));
    await expect(page.locator('iframe')).toHaveCount(0);
    await expect(page.locator('.grafana-app, .sidemenu, [data-testid="data-testid Nav toolbar"]')).toHaveCount(0);
    await guard.assertClean();
  } finally { await session.cleanup(); }
});

test('keeps one rejected profile for every panel inert while preserving the complete grid', async ({ page }) => {
  const session = await authenticateGrafanaFixture(page);
  try {
    const guard = await installConsoleGuard(page);
    const requests: string[] = [];
    page.on('request', request => requests.push(new URL(request.url()).pathname));
    await page.route('**/dashboards/grsdk-phase0-poc/dto', async route => {
      const response = await route.fetch();
      const dto = await response.json();
      const panels = structuredClone(expandedFixture.panels);
      panels.find((panel: any) => panel.type === 'text').options.mode = 'html';
      panels.find((panel: any) => panel.type === 'stat').options.reduceOptions.calcs = ['mean'];
      panels.find((panel: any) => panel.type === 'timeseries').transformations[0].options.regex = '/Other/';
      panels.find((panel: any) => panel.type === 'table').targets[0].scenarioId = 'table_static';
      panels.find((panel: any) => panel.type === 'gauge').options.shape = 'circle';
      panels.find((panel: any) => panel.type === 'bargauge').options.displayMode = 'basic';
      panels.find((panel: any) => panel.type === 'piechart').options.pieType = 'donut';
      panels.find((panel: any) => panel.type === 'barchart').options.stacking = 'normal';
      dto.spec.panels = panels;
      await route.fulfill({ response, json: dto });
    });

    await page.goto('/');
    const placeholders = page.locator('[data-dashboard-panel-kind="not-supported"]');
    await expect(placeholders).toHaveCount(8, { timeout: 15_000 });
    await expect(page.locator('[data-dashboard-panel-error]')).toHaveCount(0);
    await expect(page.locator('[data-dashboard-render-instance] .react-grid-item')).toHaveCount(8);
    expect(requests.some(path => /\/feature-(?:text|stat|timeseries|table|gauge|bargauge|piechart|barchart)-/.test(path))).toBe(false);
    expect(requests.some(path => /testdata-runtime-|provider-query-runtime-|\/api\/(?:ds\/query|frontend\/settings)/.test(path))).toBe(false);
    await expect(page.locator('iframe')).toHaveCount(0);
    await guard.assertClean();
  } finally { await session.cleanup(); }
});

test('returns two all-eight dashboards to the measured dormant resource baseline across UID changes', async ({ page }) => {
  const session = await authenticateGrafanaFixture(page);
  try {
    const guard = await installConsoleGuard(page);
    await installResourceEvidence(page);
    const requestIds: string[] = [];
    page.on('request', request => {
      if (request.url().includes('/api/ds/query') && request.headers()['x-dashboard-uid'] === expandedUid) {
        requestIds.push(new URL(request.url()).searchParams.get('requestId') ?? '');
      }
    });
    await page.goto('/');
    await page.getByTestId('sdk-expanded-uid').click();
    await waitForExpandedDashboard(page);
    await page.getByTestId('sdk-toggle-mount').click();
    await expect(page.locator('[data-dashboard-render-instance]')).toHaveCount(0);
    await waitForDormantResources(page, 'all-eight-initial-dormant');
    const dormant = await captureResourceEvidence(page, 'all-eight-initial-dormant');

    await page.getByTestId('sdk-toggle-mount').click();
    await waitForExpandedDashboard(page);
    await expect.poll(async () => {
      const mounted = await captureResourceEvidence(page, 'all-eight-primary-mounted');
      return [mounted.instance.sceneActivation, mounted.instance.subscription];
    }).toEqual([1, 7]);
    await page.getByTestId('sdk-toggle-expanded-second').click();
    await expect(page.locator('[data-dashboard-render-instance]')).toHaveCount(2);
    await expect(page.getByTestId('sdk-secondary-slot').getByRole('grid')).toBeVisible();
    await expect.poll(async () => {
      const mounted = await captureResourceEvidence(page, 'all-eight-two-mounted');
      return [mounted.instance.sceneActivation, mounted.instance.subscription];
    }).toEqual([2, 14]);
    await expect.poll(() => requestIds.length).toBe(21);
    expect(new Set(requestIds).size).toBe(21);

    await page.getByTestId('sdk-select-alternate-uid').click();
    await expect(page.getByTestId('sdk-primary-slot').getByTestId('TextPanel-converted-content'))
      .toContainText('phase0-alt');
    await expect(page.getByTestId('sdk-secondary-slot').getByRole('grid')).toBeVisible();
    await page.getByTestId('sdk-expanded-uid').click();
    await expect(page.getByTestId('sdk-primary-slot').getByRole('grid')).toBeVisible();

    await page.getByTestId('sdk-toggle-mount').click();
    await expect(page.getByTestId('sdk-primary-slot').locator('[data-dashboard-render-instance]')).toHaveCount(0);
    await expect(page.getByTestId('sdk-secondary-slot').getByRole('grid')).toBeVisible();
    await expect.poll(async () => {
      const secondary = await captureResourceEvidence(page, 'all-eight-secondary-mounted');
      return [secondary.instance.sceneActivation, secondary.instance.subscription];
    }).toEqual([1, 7]);
    await page.getByTestId('sdk-toggle-expanded-second').click();
    await expect(page.locator('[data-dashboard-render-instance]')).toHaveCount(0);
    await waitForDormantResources(page, 'all-eight-final-dormant');
    const final = await captureResourceEvidence(page, 'all-eight-final-dormant');
    expect(stableDormantKeys.map(key => final.page[key])).toEqual(
      stableDormantKeys.map(key => dormant.page[key])
    );
    expect(final.dom.portalChildren).toBe(0);
    expect(final.dom.styleElements).toBe(dormant.dom.styleElements);
    expect(final.dom.emotionStyleElements).toBe(dormant.dom.emotionStyleElements);
    expect([final.instance.sceneActivation, final.instance.subscription]).toEqual([0, 0]);
    await expect(page.locator('[data-dashboard-native-styles]')).toHaveCount(0);
    await expect(page.locator('iframe')).toHaveCount(0);
    await guard.assertClean();
  } finally { await session.cleanup(); }
});
