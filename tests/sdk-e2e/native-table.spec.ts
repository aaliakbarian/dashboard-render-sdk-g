import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { authenticateGrafanaFixture } from '../e2e/support/grafanaAuth';
import { installConsoleGuard } from '../e2e/support/consoleGuard';
import { captureResourceEvidence, installResourceEvidence } from '../e2e/support/resourceEvidence';

const phase2 = JSON.parse(readFileSync('dev/grafana/provisioning/dashboards/drsdk-g-phase2-visualizations.json', 'utf8'));
const phase0 = JSON.parse(readFileSync('dev/grafana/provisioning/dashboards/grsdk-phase0-poc.json', 'utf8'));

async function selectTable(page: Page, kind: 'pulse' | 'static', includeText = false) {
  await page.route('**/dashboards/grsdk-phase0-poc/dto', async route => {
    const response = await route.fetch();
    const dto = await response.json();
    const source = kind === 'pulse' ? phase2 : phase0;
    const table = structuredClone(source.panels.find((panel: any) => panel.type === 'table'));
    const text = structuredClone(phase2.panels.find((panel: any) => panel.type === 'text'));
    dto.spec.panels = includeText ? [text, table] : [table];
    await route.fulfill({ response, json: dto });
  });
}

test.use({ locale: 'en-US', trace: 'off' });
test.beforeEach(() => test.skip(
  !process.env.POC_GRAFANA_VERIFY_USER || !process.env.POC_GRAFANA_VERIFY_PASSWORD,
  'local fixture credentials required'
));

test('renders the real pinned TableNG flat renderer with native DataFrames and local sorting', async ({ page }) => {
  const session = await authenticateGrafanaFixture(page);
  try {
    const guard = await installConsoleGuard(page);
    const requests: string[] = [];
    page.on('request', request => requests.push(new URL(request.url()).pathname));
    await selectTable(page, 'pulse');
    const query = page.waitForResponse(response => response.url().includes('/api/ds/query') && response.request().method() === 'POST');
    await page.goto('/');

    const panel = page.getByRole('region', { name: 'Table — predictable pulse' });
    const grid = panel.getByRole('grid');
    await expect(grid).toBeVisible({ timeout: 15_000 });
    await expect(grid.getByRole('columnheader')).toHaveCount(2);
    await expect(grid.getByRole('columnheader').nth(0)).toContainText('Time');
    await expect(grid.getByRole('columnheader').nth(1)).toContainText('Phase 2 Pulse Raw');
    await expect(grid.getByRole('gridcell').filter({ hasText: /(?:10|90)%/ }).first()).toBeVisible();

    const response = await query;
    expect(response.status()).toBe(200);
    expect(response.request().headers()['x-panel-id']).toBe('4');
    const frame = (await response.json()).results.A.frames[0];
    expect(frame.schema.refId).toBe('A');
    expect(frame.schema.fields.map((field: any) => field.type)).toEqual(['time', 'number']);
    expect(frame.data.values[0].length).toBe(frame.data.values[1].length);
    expect(new Set(frame.data.values[1])).toEqual(new Set([10, 90]));

    const numericHeader = grid.getByRole('columnheader').nth(1);
    await numericHeader.click();
    await expect.poll(async () => grid.getByRole('row').nth(1).innerText()).toContain('10%');
    await numericHeader.click();
    await expect.poll(async () => grid.getByRole('row').nth(1).innerText()).toContain('90%');

    const initialGrid = await grid.boundingBox();
    expect(initialGrid?.width).toBeGreaterThan(220);
    await panel.evaluate((element) => {
      const gridItem = element.closest('.react-grid-item');
      if (!(gridItem instanceof HTMLElement)) throw new Error('Table grid item not found.');
      gridItem.style.width = '220px';
    });
    await expect.poll(async () => (await grid.boundingBox())!.width)
      .toBeLessThan(initialGrid!.width - 20);

    const style = page.locator('style[data-dashboard-native-styles]');
    await expect(style).toHaveCount(1);
    const cssRules = await style.evaluate((node: HTMLStyleElement) =>
      Array.from(node.sheet?.cssRules ?? [], rule => rule.cssText).join('\n')
    );
    expect(cssRules).toContain('[data-dashboard-render-sdk-g-surface] .');
    expect(requests.some(path => path.includes('/feature-table-'))).toBe(true);
    expect(requests.filter(path => path.includes('/api/ds/query'))).toHaveLength(1);
    expect(requests.some(path => /monaco|editor|table-nested|openlayers/i.test(path))).toBe(false);
    await guard.assertClean();
  } finally { await session.cleanup(); }
});

test('keeps the original table_static profile inert and query-free', async ({ page }) => {
  const session = await authenticateGrafanaFixture(page);
  try {
    const guard = await installConsoleGuard(page);
    const requests: string[] = [];
    page.on('request', request => requests.push(new URL(request.url()).pathname));
    await selectTable(page, 'static');
    await page.goto('/');
    await expect(page.locator('[data-dashboard-panel-kind="not-supported"]')).toHaveCount(1, { timeout: 15_000 });
    expect(requests.some(path => /feature-table-|testdata-runtime-|provider-query-runtime-|\/api\/(?:ds\/query|frontend\/settings)/.test(path))).toBe(false);
    await guard.assertClean();
  } finally { await session.cleanup(); }
});

test('isolates a Table chunk failure without executing its query or destroying Text', async ({ page }) => {
  const session = await authenticateGrafanaFixture(page);
  try {
    const guard = await installConsoleGuard(page);
    let queries = 0;
    page.on('request', request => { if (request.url().includes('/api/ds/query')) queries++; });
    await selectTable(page, 'pulse', true);
    await page.route('**/feature-table-*.js', route => route.fulfill({
      body: 'throw new Error("controlled-table-load-failure");', contentType: 'application/javascript',
    }));
    await page.goto('/');
    await expect(page.locator('[data-dashboard-panel-error="4"]')).toHaveText('Panel unavailable.', { timeout: 15_000 });
    await expect(page.getByTestId('TextPanel-converted-content')).toContainText('Phase 2 native visualizations');
    expect(queries).toBe(0);
    await guard.assertClean();
  } finally { await session.cleanup(); }
});

test('owns Table queries, styles and grids independently across two instances, UID switch and teardown', async ({ page }) => {
  const session = await authenticateGrafanaFixture(page);
  try {
    const guard = await installConsoleGuard(page);
    await installResourceEvidence(page);
    const requestIds: string[] = [];
    page.on('request', request => {
      if (request.url().includes('/api/ds/query')) requestIds.push(new URL(request.url()).searchParams.get('requestId')!);
    });
    await selectTable(page, 'pulse');
    await page.goto('/');
    const primary = page.getByTestId('sdk-primary-slot');
    const secondary = page.getByTestId('sdk-secondary-slot');
    await expect(primary.getByRole('grid')).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('sdk-toggle-native-second').click();
    await expect(secondary.getByRole('grid')).toBeVisible();
    expect(requestIds).toHaveLength(2);
    expect(new Set(requestIds).size).toBe(2);
    await page.getByTestId('sdk-toggle-mount').click();
    await expect(primary.getByRole('grid')).toHaveCount(0);
    await expect(secondary.getByRole('grid')).toBeVisible();
    await page.getByTestId('sdk-toggle-native-second').click();
    await expect(page.locator('[data-dashboard-render-instance]')).toHaveCount(0);
    await expect(page.locator('[data-dashboard-native-styles]')).toHaveCount(0);
    await expect.poll(async () => (await captureResourceEvidence(page, 'table-dormant')).page.fetch).toBe(0);
    await expect.poll(async () => (await captureResourceEvidence(page, 'table-dormant')).page.resizeObserver).toBe(0);
    await page.getByTestId('sdk-toggle-mount').click();
    await expect(primary.getByRole('grid')).toBeVisible();
    await page.getByTestId('sdk-switch-uid').click();
    await expect(primary.getByTestId('TextPanel-converted-content')).toContainText('phase0-alt');
    await expect(primary.getByRole('grid')).toHaveCount(0);
    await guard.assertClean();
  } finally { await session.cleanup(); }
});
