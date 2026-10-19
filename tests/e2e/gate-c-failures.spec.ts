import { expect, test } from '@playwright/test';
import type { PocQueryEvidenceEvent } from '@dashboard-render-sdk-g/poc-compat';

import { authenticateGrafanaFixture } from './support/grafanaAuth';
import { installConsoleGuard } from './support/consoleGuard';
import { installResourceEvidence } from './support/resourceEvidence';

test.use({ locale: 'en-US', trace: 'off' });

test('isolates a real Time series query HTTP error from Text and the host', async ({ page }) => {
  test.skip(!process.env.POC_GRAFANA_VERIFY_USER, 'fixture credentials are required');
  const session = await authenticateGrafanaFixture(page);
  try {
    const consoleGuard = await installConsoleGuard(page, [
      {
        justification: 'Controlled TestData server_panic query returns HTTP 500.',
        pattern: /console-error: Failed to load resource:.*500 \(Internal Server Error\)/,
      },
    ]);
    await installResourceEvidence(page);
    await page.goto('/?gate=c&gateCQuery=server-error');
    await expect
      .poll(async () => {
        const inspection = await page.evaluate(async () => {
          const path = '/src/App.tsx';
          const module = await import(/* @vite-ignore */ path);
          return module.inspectGateCHost();
        });
        return inspection.queryEvents.some(
          (event: PocQueryEvidenceEvent) =>
            event.type === 'query' &&
            event.panelId === 3 &&
            event.outcome === 'failure' &&
            event.state === 'Error'
        );
      }, { timeout: 15_000 })
      .toBe(true);
    await expect(page.getByRole('region', { name: 'Text — phase0' })).toContainText('Native phase0');
    await expect(page.getByTestId('host-style-sentinel')).toBeVisible();
    await expect(page.getByRole('region', { name: 'Time series — predictable pulse' })).toBeVisible();
    expect(await page.locator('iframe').count()).toBe(0);
    await consoleGuard.assertClean();
  } finally {
    await session.cleanup();
  }
});

test('isolates a controlled Time series plugin load failure from Text and the host', async ({ page }) => {
  test.skip(!process.env.POC_GRAFANA_VERIFY_USER, 'fixture credentials are required');
  const session = await authenticateGrafanaFixture(page);
  try {
    await installResourceEvidence(page);
    await page.goto('/?gate=c&gateCPlugin=fail');
    await expect(page.getByRole('region', { name: 'Text — phase0' })).toContainText('Native phase0');
    await expect(page.getByTestId('host-style-sentinel')).toBeVisible();
    await expect
      .poll(async () => {
        const inspection = await page.evaluate(async () => {
          const path = '/src/App.tsx';
          const module = await import(/* @vite-ignore */ path);
          return module.inspectGateCHost();
        });
        return inspection.pluginEvents.some(
          (event: { pluginId?: string; type: string }) =>
            event.pluginId === 'timeseries' && event.type === 'failure'
        );
      })
      .toBe(true);
    expect(await page.locator('iframe').count()).toBe(0);
    expect(page.url()).toContain('/?gate=c&gateCPlugin=fail');
  } finally {
    await session.cleanup();
  }
});
