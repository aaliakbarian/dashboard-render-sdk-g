import { expect, test } from '@playwright/test';

import { authenticateGrafanaFixture } from '../e2e/support/grafanaAuth';
import { installConsoleGuard } from '../e2e/support/consoleGuard';
import { installNetworkEvidence } from '../e2e/support/networkEvidence';
import {
  captureResourceEvidence,
  installResourceEvidence,
} from '../e2e/support/resourceEvidence';

test.use({ locale: 'en-US', trace: 'off' });

test('renders real Grafana Text and three inert placeholders through the SDK boundary', async ({ page }) => {
  test.skip(
    !process.env.POC_GRAFANA_VERIFY_USER || !process.env.POC_GRAFANA_VERIFY_PASSWORD,
    'local disposable Grafana fixture credentials are required'
  );

  const session = await authenticateGrafanaFixture(page);
  try {
    const consoleGuard = await installConsoleGuard(page);
    const networkEvidence = installNetworkEvidence(page);
    await installResourceEvidence(page);
    await page.goto('/');

    await expect(page.getByTestId('sdk-host-sentinel')).toHaveText('Host remains functional');
    const text = page.getByTestId('TextPanel-converted-content');
    try {
      await expect(text).toContainText('Dashboard Render SDK G POC', { timeout: 15_000 });
    } catch (error) {
      const diagnostics = {
        admission: await page.getByTestId('sdk-react-admission').evaluate((element) => ({
          hostReact: element.getAttribute('data-host-react-19-2-8'),
          hostReactDom: element.getAttribute('data-host-react-dom-19-2-8'),
          result: element.textContent,
        })),
        body: (await page.locator('body').innerText()).slice(0, 2_000),
        console: await consoleGuard.snapshot(),
        network: (await networkEvidence.snapshot()).filter((entry) =>
          entry.url.includes('/grafana/') || entry.url.includes('/assets/')
        ),
        statuses: await page.locator('[data-sdk-status], [data-dashboard-render-status], [data-dashboard-render-error]').evaluateAll(
          (elements) => elements.map((element) => ({
            error: element.getAttribute('data-dashboard-render-error'),
            status: element.getAttribute('data-sdk-status') ?? element.getAttribute('data-dashboard-render-status'),
            text: element.textContent,
            uid: element.getAttribute('data-sdk-status-uid'),
          }))
        ),
      };
      throw new Error(`SDK Text did not render: ${JSON.stringify(diagnostics)}`, { cause: error });
    }
    await expect(text).toContainText('Native phase0 Text fixture for phase0.');
    await expect(page.getByRole('region', { name: 'Text — phase0' })).toBeVisible();

    const fallbacks = page.locator('[data-dashboard-panel-kind="not-supported"]');
    await expect(fallbacks).toHaveCount(3);
    await expect(fallbacks).toHaveText([
      /Stat — predictable pulseNot-Supported/,
      /Table — static TestDataNot-Supported/,
      /Time series — predictable pulseNot-Supported/,
    ]);
    await expect(page.locator('[data-dashboard-panel-id="1"], [data-viz-panel-key="panel-1"]')).toHaveCount(1);
    await expect(page.locator('[data-dashboard-panel-id="2"]')).toHaveCount(1);
    await expect(page.locator('[data-dashboard-panel-id="3"]')).toHaveCount(1);
    await expect(page.locator('[data-dashboard-panel-id="4"]')).toHaveCount(1);

    const boxes = await Promise.all([
      page.getByRole('region', { name: 'Text — phase0' }).boundingBox(),
      page.locator('[data-dashboard-panel-id="2"]').boundingBox(),
      page.locator('[data-dashboard-panel-id="3"]').boundingBox(),
      page.locator('[data-dashboard-panel-id="4"]').boundingBox(),
    ]);
    expect(boxes.every(Boolean)).toBe(true);
    const [textBox, statBox, timeSeriesBox, tableBox] = boxes as Array<NonNullable<(typeof boxes)[number]>>;
    expect(statBox.x).toBeGreaterThan(textBox.x);
    expect(timeSeriesBox.y).toBeGreaterThan(textBox.y);
    expect(tableBox.x).toBeGreaterThan(statBox.x);
    expect(Math.abs(textBox.width - statBox.width)).toBeLessThanOrEqual(2);
    expect(Math.abs(textBox.width - tableBox.width)).toBeLessThanOrEqual(2);
    expect(Math.abs(textBox.x - timeSeriesBox.x)).toBeLessThanOrEqual(2);
    expect(Math.abs(textBox.y - tableBox.y)).toBeLessThanOrEqual(2);
    expect(timeSeriesBox.width).toBeGreaterThan(textBox.width * 1.9);

    for (const fallback of await fallbacks.all()) {
      await expect(fallback).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    }
    expect(await page.locator('iframe').count()).toBe(0);
    expect(await page.locator('nav:not([data-sdk-host-controls])').count()).toBe(0);
    expect(page.url()).toBe('http://localhost:5173/');

    const network = await networkEvidence.snapshot();
    expect(network.some((entry) => entry.type === 'request' && entry.url.includes('/grafana/api/health'))).toBe(true);
    expect(network.some((entry) => entry.type === 'request' && entry.url.includes('/grafana/apis/dashboard.grafana.app/'))).toBe(true);
    expect(network.some((entry) => entry.type === 'request' && entry.url.includes('/api/ds/query'))).toBe(false);
    expect(network.some((entry) => entry.type === 'request' && entry.url.includes('/api/frontend/settings'))).toBe(false);
    expect(network.some((entry) => entry.type === 'request' && /\/(?:feature-testdata-runtime|provider-query-runtime|provider-query-services)-/.test(entry.url))).toBe(false);
    expect(JSON.stringify(network)).not.toMatch(/authorization|cookie|password|bearer\s/i);

    const resources = await captureResourceEvidence(page, 'sdk-primary-mounted');
    expect(resources.dom.iframeElements).toBe(0);
    expect(resources.dom.portalRoots).toBe(1);
    await consoleGuard.assertClean();
  } finally {
    await session.cleanup();
  }
});
