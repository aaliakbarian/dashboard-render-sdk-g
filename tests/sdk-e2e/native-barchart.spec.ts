import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { authenticateGrafanaFixture } from '../e2e/support/grafanaAuth';
import { installConsoleGuard } from '../e2e/support/consoleGuard';
import { captureResourceEvidence, installResourceEvidence } from '../e2e/support/resourceEvidence';

const fixture = JSON.parse(readFileSync('dev/grafana/provisioning/dashboards/drsdk-g-phase2-visualizations.json', 'utf8'));
const stablePageResourceKeys = [
  'abortController',
  'animationFrame',
  'fetch',
  'interval',
  'resizeObserver',
  'timeout',
] as const;
const quiescentPageResourceKeys = stablePageResourceKeys.filter(key => key !== 'abortController');

async function selectPanels(page: Page, types: readonly string[], mutate?: (panels: any[]) => void) {
  await page.route('**/dashboards/grsdk-phase0-poc/dto', async route => {
    const response = await route.fetch(); const dto = await response.json();
    dto.spec.panels = structuredClone(fixture.panels.filter((panel: any) => types.includes(panel.type)));
    mutate?.(dto.spec.panels);
    await route.fulfill({ response, json: dto });
  });
}

test.use({ locale: 'en-US', trace: 'off' });
test.beforeEach(() => test.skip(!process.env.POC_GRAFANA_VERIFY_USER || !process.env.POC_GRAFANA_VERIFY_PASSWORD, 'local fixture credentials required'));

test('renders the native Bar chart from the exact one-series Predictable Pulse profile', async ({ page }) => {
  const session = await authenticateGrafanaFixture(page);
  try {
    const guard = await installConsoleGuard(page); const requests: string[] = [];
    page.on('request', request => requests.push(new URL(request.url()).pathname));
    await selectPanels(page, ['barchart']);
    const query = page.waitForResponse(response => response.url().includes('/api/ds/query') && response.request().method() === 'POST');
    await page.goto('/');
    const panel = page.getByRole('region', { name: 'Bar chart — predictable pulse' });
    await expect(panel.locator('.uplot canvas')).not.toHaveCount(0, { timeout: 15_000 });
    const response = await query;
    expect(response.status()).toBe(200);
    expect(response.request().headers()['x-panel-id']).toBe('8');
    const frame = (await response.json()).results.A.frames[0];
    expect(frame.schema.refId).toBe('A');
    expect(frame.schema.fields.map((field: any) => field.type)).toEqual(['time', 'number']);
    expect(frame.data.values[0].length).toBe(frame.data.values[1].length);
    expect(new Set(frame.data.values[1])).toEqual(new Set([10, 90]));
    await expect(panel.getByText('Phase 2 Pulse Raw', { exact: true })).toBeVisible();
    await expect(panel.locator('.u-over')).toHaveCSS('position', 'absolute');
    const canvasEvidence = await panel.locator('.uplot canvas').first().evaluate((canvas: HTMLCanvasElement) => {
      const context = canvas.getContext('2d');
      if (!context) return { colored: 0, height: canvas.height, width: canvas.width };
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let colored = 0;
      for (let index = 0; index < pixels.length; index += 4) {
        if (pixels[index + 3]! > 0 && (pixels[index]! + pixels[index + 1]! + pixels[index + 2]!) > 0) colored++;
      }
      return { colored, height: canvas.height, width: canvas.width };
    });
    expect(canvasEvidence.width).toBeGreaterThan(100);
    expect(canvasEvidence.height).toBeGreaterThan(100);
    expect(canvasEvidence.colored).toBeGreaterThan(1_000);
    const before = await panel.locator('.uplot').first().boundingBox();
    await page.setViewportSize({ width: 900, height: 850 });
    await expect.poll(async () => (await panel.locator('.uplot').first().boundingBox())!.width).toBeLessThan(before!.width - 50);
    expect(requests.some(path => path.includes('/feature-barchart-'))).toBe(true);
    expect(requests.some(path => path.includes('/feature-piechart-'))).toBe(false);
    expect(requests.filter(path => path.includes('/api/ds/query'))).toHaveLength(1);
    await guard.assertClean();
  } finally { await session.cleanup(); }
});

test('keeps Pie and rejected Bar profiles inert and query-free', async ({ page }) => {
  const session = await authenticateGrafanaFixture(page);
  try {
    const guard = await installConsoleGuard(page); const requests: string[] = [];
    page.on('request', request => requests.push(new URL(request.url()).pathname));
    await selectPanels(page, ['piechart', 'barchart'], panels => {
      panels.find(panel => panel.type === 'barchart').options.stacking = 'normal';
    });
    await page.goto('/');
    await expect(page.locator('[data-dashboard-panel-kind="not-supported"]')).toHaveCount(2, { timeout: 15_000 });
    expect(requests.some(path => /feature-(?:piechart|barchart|testdata-runtime)-|provider-query-runtime-|\/api\/(?:ds\/query|frontend\/settings)/.test(path))).toBe(false);
    await guard.assertClean();
  } finally { await session.cleanup(); }
});

test('keeps a Bar renderer-load failure local and query-free', async ({ page }) => {
  const session = await authenticateGrafanaFixture(page);
  try {
    const guard = await installConsoleGuard(page); let queries = 0;
    page.on('request', request => { if (request.url().includes('/api/ds/query')) queries++; });
    await selectPanels(page, ['text', 'barchart']);
    await page.route('**/feature-barchart-*.js', route => route.fulfill({
      body: 'throw new Error("controlled-barchart-load-failure");',
      contentType: 'application/javascript',
    }));
    await page.goto('/');
    await expect(page.locator('[data-dashboard-panel-error="8"]')).toHaveText('Panel unavailable.', { timeout: 15_000 });
    await expect(page.getByTestId('TextPanel-converted-content')).toContainText('Phase 2 native visualizations');
    expect(queries).toBe(0);
    await guard.assertClean();
  } finally { await session.cleanup(); }
});

test('owns Bar queries and plots independently across two instances, UID changes and teardown', async ({ page }) => {
  const session = await authenticateGrafanaFixture(page);
  try {
    const guard = await installConsoleGuard(page); await installResourceEvidence(page);
    const queries: string[] = [];
    page.on('request', request => {
      if (request.url().includes('/api/ds/query')) queries.push(new URL(request.url()).searchParams.get('requestId')!);
    });
    await selectPanels(page, ['barchart']);
    await page.goto('/');
    const primary = page.getByTestId('sdk-primary-slot'); const secondary = page.getByTestId('sdk-secondary-slot');
    await expect(primary.locator('.uplot canvas')).not.toHaveCount(0, { timeout: 15_000 });
    await page.getByTestId('sdk-toggle-native-second').click();
    await expect(secondary.locator('.uplot canvas')).not.toHaveCount(0);
    expect(queries).toHaveLength(2); expect(new Set(queries).size).toBe(2);
    await page.getByTestId('sdk-toggle-mount').click();
    await expect(primary.locator('.uplot')).toHaveCount(0);
    await expect(secondary.locator('.uplot canvas')).not.toHaveCount(0);
    await page.getByTestId('sdk-toggle-native-second').click();
    await expect(page.locator('[data-dashboard-render-instance]')).toHaveCount(0);
    await expect.poll(async () => {
      const settling = await captureResourceEvidence(page, 'bar-dormant-settling');
      return quiescentPageResourceKeys.map(key => settling.page[key]);
    }).toEqual(quiescentPageResourceKeys.map(() => 0));
    await expect(page.locator('[data-dashboard-native-styles]')).toHaveCount(0);
    const dormant = await captureResourceEvidence(page, 'bar-dormant-baseline');
    expect(dormant.dom.portalChildren).toBe(0);
    await page.getByTestId('sdk-toggle-mount').click();
    await expect(primary.locator('.uplot canvas')).not.toHaveCount(0);
    const mutationCreationsBeforeTooltip = await page.evaluate(
      () => (globalThis as any).__POC_RESOURCE_EVIDENCE__.mutationObserverCreations().length
    );
    const overlayBox = await primary.locator('.u-over').boundingBox();
    expect(overlayBox).not.toBeNull();
    await page.mouse.move(
      overlayBox!.x + overlayBox!.width / 2,
      overlayBox!.y + overlayBox!.height / 2
    );
    const portal = page.locator('#grafana-portal-container');
    await expect(portal).toContainText('Phase 2 Pulse Raw');
    await expect.poll(async () => (await captureResourceEvidence(page, 'bar-tooltip-open')).dom.portalChildren)
      .toBeGreaterThan(0);
    await page.evaluate(() => {
      (document.querySelector('[data-testid="sdk-toggle-mount"]') as HTMLButtonElement).click();
    });
    await expect(page.locator('[data-dashboard-render-instance]')).toHaveCount(0);
    await expect(page.locator('[data-dashboard-native-styles]')).toHaveCount(0);
    await expect.poll(async () => (await captureResourceEvidence(page, 'bar-tooltip-retired')).dom.portalChildren).toBe(0);
    const mutationCreationsAfterTooltip = await page.evaluate(
      () => (globalThis as any).__POC_RESOURCE_EVIDENCE__.mutationObserverCreations()
    );
    const tooltipMutationCreations = mutationCreationsAfterTooltip.slice(mutationCreationsBeforeTooltip);
    expect(tooltipMutationCreations).toHaveLength(1);
    expect(tooltipMutationCreations[0]).toContain('InjectedScript._setupGlobalListenersRemovalDetection');
    const dormantPageResources = stablePageResourceKeys.map(key => dormant.page[key]);
    await expect.poll(async () => {
      const settling = await captureResourceEvidence(page, 'bar-tooltip-settling');
      return stablePageResourceKeys.map(key => settling.page[key]);
    }, { message: 'Bar tooltip resources must return to the first dormant baseline' }).toEqual(dormantPageResources);
    const tooltipRetired = await captureResourceEvidence(page, 'bar-tooltip-dormant');
    expect(tooltipRetired.page.mutationObserver - dormant.page.mutationObserver).toBe(tooltipMutationCreations.length);
    expect(tooltipRetired.dom.styleElements).toBe(dormant.dom.styleElements);
    expect(tooltipRetired.dom.emotionStyleElements).toBe(dormant.dom.emotionStyleElements);
    expect(tooltipRetired.instance).toEqual(dormant.instance);
    await page.getByTestId('sdk-toggle-mount').click();
    await expect(primary.locator('.uplot canvas')).not.toHaveCount(0);
    await page.getByTestId('sdk-switch-uid').click();
    await expect(primary.getByTestId('TextPanel-converted-content')).toContainText('phase0-alt');
    await expect(primary.locator('.uplot')).toHaveCount(0);
    await expect.poll(async () => (await captureResourceEvidence(page, 'bar-tooltip-retired')).dom.portalChildren).toBe(0);
    await expect(page.locator('[data-dashboard-native-styles]')).toHaveCount(0);
    await page.getByTestId('sdk-toggle-mount').click();
    await expect(page.locator('[data-dashboard-render-instance]')).toHaveCount(0);
    await expect.poll(async () => (await captureResourceEvidence(page, 'bar-retired')).page.resizeObserver).toBe(0);
    await expect.poll(async () => (await captureResourceEvidence(page, 'bar-retired')).page.fetch).toBe(0);
    const retired = await captureResourceEvidence(page, 'bar-retired-baseline');
    expect(retired.dom.portalChildren).toBe(0);
    expect(retired.dom.styleElements).toBe(dormant.dom.styleElements);
    expect(retired.dom.emotionStyleElements).toBe(dormant.dom.emotionStyleElements);
    await guard.assertClean();
  } finally { await session.cleanup(); }
});

test('cancels a held Bar query generation before an alternate UID can publish stale data', async ({ page }) => {
  const session = await authenticateGrafanaFixture(page);
  let release!: () => void; const held = new Promise<void>(resolve => { release = resolve; });
  try {
    const guard = await installConsoleGuard(page); await installResourceEvidence(page); let responses = 0;
    await selectPanels(page, ['barchart']);
    await page.route('**/api/ds/query?*', async route => {
      const response = await route.fetch(); responses++;
      await held;
      await route.fulfill({ response }).catch(() => {});
    });
    await page.goto('/');
    await expect.poll(() => responses).toBe(1);
    await page.getByTestId('sdk-switch-uid').click();
    await expect(page.getByTestId('TextPanel-converted-content')).toContainText('phase0-alt');
    release();
    await expect(page.locator('.uplot')).toHaveCount(0);
    await page.getByTestId('sdk-toggle-mount').click();
    await expect(page.locator('[data-dashboard-render-instance]')).toHaveCount(0);
    await expect.poll(async () => (await captureResourceEvidence(page, 'cancelled-bar')).page.fetch).toBe(0);
    await expect.poll(async () => (await captureResourceEvidence(page, 'cancelled-bar')).page.resizeObserver).toBe(0);
    await guard.assertClean();
  } finally { release(); await session.cleanup(); }
});
