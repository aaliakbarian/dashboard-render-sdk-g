import { expect, test, type Page } from '@playwright/test';

import { authenticateGrafanaFixture } from '../e2e/support/grafanaAuth';
import { installConsoleGuard } from '../e2e/support/consoleGuard';

test.use({ locale: 'en-US', trace: 'off' });

const credentialsAvailable = Boolean(
  process.env.POC_GRAFANA_VERIFY_USER && process.env.POC_GRAFANA_VERIFY_PASSWORD
);

async function expectHostAlive(page: Page) {
  await expect(page.getByTestId('sdk-host-sentinel')).toHaveText('Host remains functional');
  expect(await page.locator('iframe').count()).toBe(0);
}

for (const [status, code] of [
  [401, 'unauthorized'],
  [403, 'forbidden'],
  [404, 'not-found'],
] as const) {
  test(`normalizes dashboard HTTP ${status} without destroying the host`, async ({ page }) => {
    test.skip(!credentialsAvailable, 'local disposable Grafana fixture credentials are required');
    const session = await authenticateGrafanaFixture(page);
    try {
      await page.route('**/dashboards/grsdk-phase0-poc/dto', (route) =>
        route.fulfill({ body: '{}', contentType: 'application/json', status })
      );
      await page.goto('/');
      await expect(page.locator(`[data-dashboard-render-error="${code}"]`)).toBeVisible();
      await expectHostAlive(page);
    } finally {
      await session.cleanup();
    }
  });
}

test('shows loading, then a sanitized malformed-response failure', async ({ page }) => {
  test.skip(!credentialsAvailable, 'local disposable Grafana fixture credentials are required');
  const session = await authenticateGrafanaFixture(page);
  try {
    let release!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    await page.route('**/dashboards/grsdk-phase0-poc/dto', async (route) => {
      await held;
      await route.fulfill({ body: '{}', contentType: 'application/json', status: 200 });
    });
    await page.goto('/');
    await expect(page.locator('[data-dashboard-render-status="loading"]')).toBeVisible();
    release();
    await expect(page.locator('[data-dashboard-render-error="response-malformed"]')).toBeVisible();
    await expectHostAlive(page);
  } finally {
    await session.cleanup();
  }
});

test('uses dashboard-level fallback for unsupported Grafana version and schema', async ({ page }) => {
  test.skip(!credentialsAvailable, 'local disposable Grafana fixture credentials are required');
  const session = await authenticateGrafanaFixture(page);
  try {
    await page.route('**/api/health', (route) => route.fulfill({
      body: JSON.stringify({ version: '13.2.4' }),
      contentType: 'application/json',
      status: 200,
    }));
    await page.goto('/');
    await expect(page.locator('[data-dashboard-render-status="unsupported-dashboard"]')).toBeVisible();
    await expectHostAlive(page);

    await page.unroute('**/api/health');
    await page.route('**/dashboards/grsdk-phase0-poc-alt/dto', async (route) => {
      const response = await route.fetch();
      const dto = await response.json();
      dto.spec.schemaVersion = 43;
      await route.fulfill({ json: dto, response });
    });
    await page.getByTestId('sdk-switch-uid').click();
    await expect(page.locator('[data-dashboard-render-status="unsupported-dashboard"]')).toBeVisible();
    await expectHostAlive(page);
  } finally {
    await session.cleanup();
  }
});

test('rejects a conflicting runtime identity before a second render', async ({ page }) => {
  test.skip(!credentialsAvailable, 'local disposable Grafana fixture credentials are required');
  const session = await authenticateGrafanaFixture(page);
  try {
    const consoleGuard = await installConsoleGuard(page);
    await page.goto('/');
    await expect(page.getByTestId('TextPanel-converted-content')).toContainText('phase0.');
    await page.getByTestId('sdk-toggle-conflict').click();
    await expect(page.locator('[data-dashboard-render-error="runtime-identity-conflict"]')).toBeVisible();
    await expectHostAlive(page);
    await consoleGuard.assertClean();
  } finally {
    await session.cleanup();
  }
});

test('surfaces a failed real Text feature load without replacing it with host markup', async ({ page }) => {
  test.skip(!credentialsAvailable, 'local disposable Grafana fixture credentials are required');
  const session = await authenticateGrafanaFixture(page);
  try {
    await page.route(/\/assets\/feature-text-[^/]+\.js$/, (route) => route.abort('failed'));
    await page.goto('/');
    await expect(page.locator('[data-dashboard-render-error="panel-render-failed"]')).toBeVisible();
    await expect(page.getByTestId('TextPanel-converted-content')).toHaveCount(0);
    await expectHostAlive(page);
  } finally {
    await session.cleanup();
  }
});
