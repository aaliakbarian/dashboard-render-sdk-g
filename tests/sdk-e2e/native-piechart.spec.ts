import { readFileSync } from 'node:fs';
import { selectors } from '@grafana/e2e-selectors';
import { expect, test, type Page } from '@playwright/test';
import { authenticateGrafanaFixture } from '../e2e/support/grafanaAuth';
import { installConsoleGuard } from '../e2e/support/consoleGuard';
import { captureResourceEvidence, installResourceEvidence } from '../e2e/support/resourceEvidence';

const fixture = JSON.parse(readFileSync('dev/grafana/provisioning/dashboards/drsdk-g-phase2-visualizations.json', 'utf8'));
const sliceTestId = selectors.components.Panels.Visualization.PieChart.svgSlice;
const labelTestId = selectors.components.Panels.Visualization.PieChart.svgLabel;

async function selectPanels(page: Page, types: readonly string[], mutate?: (panels: any[]) => void) {
  await page.route('**/dashboards/grsdk-phase0-poc/dto', async route => {
    const response = await route.fetch();
    const dto = await response.json();
    dto.spec.panels = structuredClone(fixture.panels.filter((panel: any) => types.includes(panel.type)));
    mutate?.(dto.spec.panels);
    await route.fulfill({ response, json: dto });
  });
}

test.use({ locale: 'en-US', trace: 'off' });
test.beforeEach(() => test.skip(
  !process.env.POC_GRAFANA_VERIFY_USER || !process.env.POC_GRAFANA_VERIFY_PASSWORD,
  'local fixture credentials required'
));

test('renders the real native Pie chart for the exact one-series Predictable Pulse profile', async ({ page }) => {
  const session = await authenticateGrafanaFixture(page);
  try {
    const guard = await installConsoleGuard(page);
    const requests: string[] = [];
    page.on('request', request => requests.push(new URL(request.url()).pathname));
    await selectPanels(page, ['piechart']);
    const query = page.waitForResponse(response =>
      response.url().includes('/api/ds/query') && response.request().method() === 'POST'
    );

    await page.goto('/');
    const panel = page.getByRole('region', { name: 'Pie chart — predictable pulse' });
    const slice = panel.getByTestId(sliceTestId);
    await expect(slice).toHaveCount(1, { timeout: 15_000 });

    const response = await query;
    expect(response.status()).toBe(200);
    expect(response.request().headers()['x-panel-id']).toBe('7');
    const frame = (await response.json()).results.A.frames[0];
    expect(frame.schema.refId).toBe('A');
    expect(frame.schema.fields.map((field: any) => field.type)).toEqual(['time', 'number']);
    expect(frame.data.values[0].length).toBe(frame.data.values[1].length);
    expect(new Set(frame.data.values[1])).toEqual(new Set([10, 90]));

    const pathEvidence = await slice.locator('path').evaluate((path: SVGPathElement) => ({
      d: path.getAttribute('d'),
      fill: path.getAttribute('fill'),
      length: path.getTotalLength(),
    }));
    expect(pathEvidence.d).toMatch(/^M/);
    expect(pathEvidence.fill).toMatch(/^(?:#|url\()/);
    expect(pathEvidence.length).toBeGreaterThan(100);
    await expect(panel.getByTestId(labelTestId)).toContainText('Phase 2 Pulse Raw');
    await expect(panel.getByTestId(labelTestId)).toContainText(/(?:10|90)%/);
    await expect(panel.getByRole('button', { name: 'All series selected' })).toHaveText(
      'Phase 2 Pulse Raw'
    );

    const initialSvg = await panel.locator('svg').first().boundingBox();
    expect(initialSvg?.width).toBeGreaterThan(100);
    await panel.evaluate((element) => {
      const gridItem = element.closest('.react-grid-item');
      if (!(gridItem instanceof HTMLElement)) throw new Error('Pie grid item not found.');
      gridItem.style.width = '220px';
    });
    await expect.poll(async () => (await panel.locator('svg').first().boundingBox())!.width)
      .toBeLessThan(initialSvg!.width - 20);

    await slice.hover();
    const portalTooltip = page.locator(
      '#grafana-portal-container > [data-dashboard-render-sdk-g-surface="visx-tooltip"]'
    );
    await expect(portalTooltip).toContainText('Phase 2 Pulse Raw');
    await expect(portalTooltip).toContainText(/(?:10|90)%/);
    await expect(page.locator('body > [data-dashboard-render-sdk-g-surface="visx-tooltip"]')).toHaveCount(0);
    await page.mouse.move(0, 0);
    await expect(portalTooltip).toHaveCount(0);

    expect(requests.some(path => path.includes('/feature-piechart-'))).toBe(true);
    expect(requests.some(path => path.includes('/feature-barchart-'))).toBe(false);
    expect(requests.filter(path => path.includes('/api/ds/query'))).toHaveLength(1);
    await guard.assertClean();
  } finally {
    await session.cleanup();
  }
});

test('keeps unsupported Pie options and targets inert and query-free', async ({ page }) => {
  const session = await authenticateGrafanaFixture(page);
  try {
    const guard = await installConsoleGuard(page);
    const requests: string[] = [];
    page.on('request', request => requests.push(new URL(request.url()).pathname));
    await selectPanels(page, ['piechart', 'barchart'], panels => {
      panels.find(panel => panel.type === 'piechart').options.pieType = 'donut';
      panels.find(panel => panel.type === 'barchart').targets[0].scenarioId = 'random_walk';
    });
    await page.goto('/');
    await expect(page.locator('[data-dashboard-panel-kind="not-supported"]')).toHaveCount(2, { timeout: 15_000 });
    expect(requests.some(path => /feature-(?:piechart|barchart|testdata-runtime)-|provider-query-runtime-|\/api\/(?:ds\/query|frontend\/settings)/.test(path))).toBe(false);
    await guard.assertClean();
  } finally {
    await session.cleanup();
  }
});

test('keeps a Pie renderer-load failure local and query-free', async ({ page }) => {
  const session = await authenticateGrafanaFixture(page);
  try {
    const guard = await installConsoleGuard(page);
    let queries = 0;
    page.on('request', request => { if (request.url().includes('/api/ds/query')) queries++; });
    await selectPanels(page, ['text', 'piechart']);
    await page.route('**/feature-piechart-*.js', route => route.fulfill({
      body: 'throw new Error("controlled-piechart-load-failure");',
      contentType: 'application/javascript',
    }));
    await page.goto('/');
    await expect(page.locator('[data-dashboard-panel-error="7"]')).toHaveText('Panel unavailable.', { timeout: 15_000 });
    await expect(page.getByTestId('TextPanel-converted-content')).toContainText('Phase 2 native visualizations');
    expect(queries).toBe(0);
    await guard.assertClean();
  } finally {
    await session.cleanup();
  }
});

test('owns Pie queries, SVGs and tooltip portals independently across instances and teardown', async ({ page }) => {
  const session = await authenticateGrafanaFixture(page);
  try {
    const guard = await installConsoleGuard(page);
    await installResourceEvidence(page);
    const requests: string[] = [];
    page.on('request', request => {
      if (request.url().includes('/api/ds/query')) requests.push(new URL(request.url()).searchParams.get('requestId')!);
    });
    await selectPanels(page, ['piechart']);
    await page.goto('/');
    const primary = page.getByTestId('sdk-primary-slot');
    const secondary = page.getByTestId('sdk-secondary-slot');
    await expect(primary.getByTestId(sliceTestId)).toHaveCount(1, { timeout: 15_000 });
    await page.getByTestId('sdk-toggle-native-second').click();
    await expect(secondary.getByTestId(sliceTestId)).toHaveCount(1);
    expect(requests).toHaveLength(2);
    expect(new Set(requests).size).toBe(2);

    await primary.getByTestId(sliceTestId).hover();
    await expect(page.locator('#grafana-portal-container > [data-dashboard-render-sdk-g-surface="visx-tooltip"]')).toHaveCount(1);
    await page.getByTestId('sdk-toggle-mount').click();
    await expect(primary.getByTestId(sliceTestId)).toHaveCount(0);
    await expect(secondary.getByTestId(sliceTestId)).toHaveCount(1);
    await expect(page.locator('#grafana-portal-container > [data-dashboard-render-sdk-g-surface="visx-tooltip"]')).toHaveCount(0);
    await page.getByTestId('sdk-toggle-native-second').click();
    await expect(page.locator('[data-dashboard-render-instance]')).toHaveCount(0);
    await expect.poll(async () => (await captureResourceEvidence(page, 'pie-dormant')).dom.portalChildren).toBe(0);
    await expect.poll(async () => (await captureResourceEvidence(page, 'pie-dormant')).page.fetch).toBe(0);
    await expect.poll(async () => (await captureResourceEvidence(page, 'pie-dormant')).page.resizeObserver).toBe(0);
    await expect(page.locator('[data-dashboard-native-styles]')).toHaveCount(0);

    await page.getByTestId('sdk-toggle-mount').click();
    await expect(primary.getByTestId(sliceTestId)).toHaveCount(1);
    await page.getByTestId('sdk-switch-uid').click();
    await expect(primary.getByTestId('TextPanel-converted-content')).toContainText('phase0-alt');
    await expect(primary.getByTestId(sliceTestId)).toHaveCount(0);
    await expect(page.locator('#grafana-portal-container > [data-dashboard-render-sdk-g-surface="visx-tooltip"]')).toHaveCount(0);
    await guard.assertClean();
  } finally {
    await session.cleanup();
  }
});

test('cancels a held Pie query generation before an alternate UID can publish stale data', async ({ page }) => {
  const session = await authenticateGrafanaFixture(page);
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  try {
    const guard = await installConsoleGuard(page);
    await installResourceEvidence(page);
    let responses = 0;
    await selectPanels(page, ['piechart']);
    await page.route('**/api/ds/query?*', async route => {
      const response = await route.fetch();
      responses++;
      await held;
      await route.fulfill({ response }).catch(() => {});
    });
    await page.goto('/');
    await expect.poll(() => responses).toBe(1);
    await page.getByTestId('sdk-switch-uid').click();
    await expect(page.getByTestId('TextPanel-converted-content')).toContainText('phase0-alt');
    release();
    await expect(page.getByTestId(sliceTestId)).toHaveCount(0);
    await page.getByTestId('sdk-toggle-mount').click();
    await expect(page.locator('[data-dashboard-render-instance]')).toHaveCount(0);
    await expect.poll(async () => (await captureResourceEvidence(page, 'cancelled-pie')).page.fetch).toBe(0);
    await expect.poll(async () => (await captureResourceEvidence(page, 'cancelled-pie')).page.resizeObserver).toBe(0);
    await guard.assertClean();
  } finally {
    release();
    await session.cleanup();
  }
});
