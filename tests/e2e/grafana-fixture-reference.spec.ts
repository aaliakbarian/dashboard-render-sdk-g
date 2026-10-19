import { expect, test } from '@playwright/test';

const user = process.env.POC_GRAFANA_VERIFY_USER;
const password = process.env.POC_GRAFANA_VERIFY_PASSWORD;

test.use({ trace: 'off' });

test('renders the provisioned dashboard in pinned Grafana as reference evidence', async ({ page }) => {
  test.skip(!user || !password, 'local disposable Grafana fixture credentials are required');

  const login = await page.request.post('/grafana/login', {
    data: { user, password },
  });
  expect(login.status()).toBe(200);

  await page.goto('/grafana/d/grsdk-phase0-poc/grsdk-phase0-poc?from=now-1h&to=now');

  await expect(page.getByText('Dashboard Render SDK G Phase 0 POC', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Text — phase0', { exact: true })).toBeVisible();
  await expect(page.getByText('Stat — predictable pulse', { exact: true })).toBeVisible();
  await expect(page.getByText('Time series — predictable pulse', { exact: true })).toBeVisible();
  await expect(page.getByText('Table — static TestData', { exact: true })).toBeVisible();

  const textPanel = page.getByRole('region', { name: 'Text — phase0' });
  const statPanel = page.getByRole('region', { name: 'Stat — predictable pulse' });
  const timeSeriesPanel = page.getByRole('region', { name: 'Time series — predictable pulse' });
  const tablePanel = page.getByRole('region', { name: 'Table — static TestData' });

  await expect(textPanel).toContainText('Native phase0 Text fixture for phase0.');
  await expect(statPanel).toContainText(/(?:10|90)\s*%/);
  await expect(timeSeriesPanel.locator('canvas').first()).toBeVisible();
  await expect(tablePanel).toContainText('This is a message');
  await expect(page.locator('[data-testid="data-testid Panel data error message"]')).toHaveCount(0);

  await page.screenshot({
    path: 'artifacts/grafana-fixture/grsdk-phase0-poc-reference.png',
    fullPage: true,
  });
});
