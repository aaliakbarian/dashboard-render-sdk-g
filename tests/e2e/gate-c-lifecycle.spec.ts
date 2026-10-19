import { expect, test, type Page } from '@playwright/test';
import type { PocQueryEvidenceEvent } from '@dashboard-render-sdk-g/poc-compat';

import { authenticateGrafanaFixture } from './support/grafanaAuth';
import { installConsoleGuard } from './support/consoleGuard';
import { captureResourceEvidence, installResourceEvidence } from './support/resourceEvidence';

test.use({ locale: 'en-US', trace: 'off', viewport: { height: 1000, width: 1440 } });

async function inspect(page: Page) {
  return page.evaluate(async () => {
    const path = '/src/App.tsx';
    const module = await import(/* @vite-ignore */ path);
    return module.inspectGateCHost();
  });
}

async function unmount(page: Page) {
  await page.evaluate(async () => {
    const path = '/src/main.tsx';
    const module = await import(/* @vite-ignore */ path);
    module.unmountPocHost();
    await Promise.resolve();
  });
}

test('cancels stale Time series work across UID change and recovers on return', async ({ page }) => {
  test.skip(!process.env.POC_GRAFANA_VERIFY_USER, 'fixture credentials are required');
  const session = await authenticateGrafanaFixture(page);
  try {
    const consoleGuard = await installConsoleGuard(page);
    await installResourceEvidence(page);
    const slowQuery = page.waitForRequest(
      (request) =>
        request.url().includes('/grafana/api/ds/query') &&
        request.headers()['x-panel-plugin-id'] === 'timeseries'
    );
    await page.goto('/?gate=c&gateCQuery=slow');
    await slowQuery;
    await page.getByTestId('gate-c-switch-uid').click();
    await expect(page.getByRole('region', { name: 'Alternate Text sentinel' })).toContainText(
      'phase0-alt'
    );
    await expect(page.getByRole('region', { name: 'Time series — predictable pulse' })).toHaveCount(0);
    await expect
      .poll(async () =>
        (await inspect(page)).queryEvents.some(
          (event: PocQueryEvidenceEvent) =>
            event.type === 'query' && event.panelId === 3 && event.outcome === 'cancelled'
        )
      )
      .toBe(true);

    await page.getByTestId('gate-c-switch-uid').click();
    await expect(page.getByRole('region', { name: 'Time series — predictable pulse' })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText('Phase 0 Pulse Signal')).toBeVisible({ timeout: 15_000 });
    expect((await inspect(page)).scenes.filter(({ active }: { active: boolean }) => active)).toHaveLength(1);
    await consoleGuard.assertClean();
  } finally {
    await session.cleanup();
  }
});

test('keeps resources bounded over 20 UID changes and 20 mount cycles', async ({ page }) => {
  test.skip(!process.env.POC_GRAFANA_VERIFY_USER, 'fixture credentials are required');
  const session = await authenticateGrafanaFixture(page);
  try {
    const consoleGuard = await installConsoleGuard(page);
    await installResourceEvidence(page);
    await page.goto('/?gate=c');
    await expect(page.getByRole('region', { name: 'Time series — predictable pulse' })).toBeVisible();

    for (let index = 0; index < 20; index += 1) {
      await page.getByTestId('gate-c-switch-uid').click();
      await expect(
        index % 2 === 0
          ? page.getByRole('region', { name: 'Alternate Text sentinel' })
          : page.getByRole('region', { name: 'Time series — predictable pulse' })
      ).toBeVisible({ timeout: 15_000 });
    }
    expect((await inspect(page)).scenes.filter(({ active }: { active: boolean }) => active)).toHaveLength(1);

    for (let index = 0; index < 20; index += 1) {
      await unmount(page);
      const released = await captureResourceEvidence(page, `gate-c-cycle-${index}-released`);
      expect(Object.values(released.instance).every((count) => count === 0)).toBe(true);
      await page.evaluate(async () => {
        const path = '/src/main.tsx';
        const module = await import(/* @vite-ignore */ path);
        module.mountPocHost(document.querySelector<HTMLElement>('#root')!);
      });
      await expect(page.getByTestId('poc-host-shell')).toBeVisible();
    }
    await expect(page.getByRole('region', { name: 'Time series — predictable pulse' })).toBeVisible({
      timeout: 15_000,
    });
    await unmount(page);
    const final = await captureResourceEvidence(page, 'gate-c-lifecycle-final');
    expect(Object.values(final.instance).every((count) => count === 0)).toBe(true);
    expect(final.dom).toMatchObject({ iframeElements: 0, portalRoots: 0 });
    await consoleGuard.assertClean();
  } finally {
    await session.cleanup();
  }
});
