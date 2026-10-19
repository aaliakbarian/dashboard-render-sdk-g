import { mkdir, writeFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

import { authenticateGrafanaFixture } from './support/grafanaAuth';
import { capturePanelVisual, compareStablePixels } from './support/visualReference';

test.use({ locale: 'en-US', trace: 'off', viewport: { height: 1000, width: 1440 } });

test('records objective Time series comparison evidence against Grafana 13.2.3', async ({ page }) => {
  test.skip(!process.env.POC_GRAFANA_VERIFY_USER, 'fixture credentials are required');
  const session = await authenticateGrafanaFixture(page);
  try {
    await page.goto('/?gate=c');
    const pocPanel = page.getByRole('region', { name: 'Time series — predictable pulse' });
    await expect(pocPanel).toBeVisible({ timeout: 15_000 });
    await expect(pocPanel.getByText('Phase 0 Pulse Signal')).toBeVisible();
    const poc = await capturePanelVisual(pocPanel, 'gate-c-poc-timeseries');

    await page.goto(
      '/grafana/d/grsdk-phase0-poc/dashboard-render-sdk-g-phase-0-poc?orgId=1&from=now-1h&to=now&viewPanel=3&kiosk&theme=light'
    );
    const referencePanel = page.getByRole('region', { name: 'Time series — predictable pulse' });
    await expect(referencePanel).toBeVisible({ timeout: 20_000 });
    await expect(referencePanel.getByText('Phase 0 Pulse Signal')).toBeVisible({ timeout: 15_000 });
    const reference = await capturePanelVisual(referencePanel, 'gate-c-grafana-reference-timeseries');
    const stablePixels = compareStablePixels(poc, reference);
    const discrepancies = {
      heightPercent: Math.abs(poc.height - reference.height) / Math.max(reference.height, 1),
      plotHeightPercent:
        Math.abs(poc.plotHeight - reference.plotHeight) / Math.max(reference.plotHeight, 1),
      plotWidthPercent: Math.abs(poc.plotWidth - reference.plotWidth) / Math.max(reference.plotWidth, 1),
      widthPercent: Math.abs(poc.width - reference.width) / Math.max(reference.width, 1),
    };

    expect(poc.title).toBe(reference.title);
    expect(poc.legend).toContain('Phase 0 Pulse Signal');
    expect(reference.legend).toContain('Phase 0 Pulse Signal');
    expect(poc.canvasCount).toBeGreaterThan(0);
    expect(reference.canvasCount).toBeGreaterThan(0);
    expect(reference.background).toBe('rgb(255, 255, 255)');
    expect(stablePixels.comparedPixels).toBeGreaterThan(500);
    expect(stablePixels.ratio).toBeLessThanOrEqual(0.02);

    await mkdir('artifacts/playwright', { recursive: true });
    await writeFile(
      'artifacts/playwright/gate-c-visual-comparison.json',
      `${JSON.stringify({ discrepancies, poc: { ...poc, pixels: undefined }, reference: { ...reference, pixels: undefined }, stablePixels }, null, 2)}\n`,
      'utf8'
    );
  } finally {
    await session.cleanup();
  }
});
