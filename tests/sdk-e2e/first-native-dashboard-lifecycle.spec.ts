import { expect, test } from '@playwright/test';

import { authenticateGrafanaFixture } from '../e2e/support/grafanaAuth';
import { installConsoleGuard } from '../e2e/support/consoleGuard';
import { installNetworkEvidence } from '../e2e/support/networkEvidence';
import {
  captureResourceEvidence,
  installResourceEvidence,
} from '../e2e/support/resourceEvidence';

test.use({ locale: 'en-US', trace: 'off' });

const stablePageResourceKeys = [
  'abortController',
  'animationFrame',
  'eventListener',
  'fetch',
  'interval',
  'mutationObserver',
  'resizeObserver',
  'timeout',
] as const;

const quiescentPageResourceKeys = [
  'animationFrame',
  'fetch',
  'interval',
  'mutationObserver',
  'resizeObserver',
  'timeout',
] as const;

async function waitForDormantResources(page: import('@playwright/test').Page, label: string) {
  await expect.poll(
    async () => {
      const snapshot = await captureResourceEvidence(page, label);
      return quiescentPageResourceKeys.map((key) => snapshot.page[key]);
    },
    { message: 'transient browser resources must settle after dashboard teardown' }
  ).toEqual(quiescentPageResourceKeys.map(() => 0));
}

async function hostComputedStyle(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const sentinel = document.querySelector('[data-testid="sdk-host-sentinel"]');
    const header = document.querySelector('.sdk-host-header');
    if (!(sentinel instanceof HTMLElement) || !(header instanceof HTMLElement)) {
      throw new Error('Host style sentinels are unavailable.');
    }
    const sentinelStyle = getComputedStyle(sentinel);
    const headerStyle = getComputedStyle(header);
    return {
      color: sentinelStyle.color,
      fontFamily: sentinelStyle.fontFamily,
      headerBackground: headerStyle.backgroundColor,
      headerBorderWidth: headerStyle.borderTopWidth,
    };
  });
}

test('switches UIDs without publishing a late stale dashboard response', async ({ page }) => {
  test.skip(
    !process.env.POC_GRAFANA_VERIFY_USER || !process.env.POC_GRAFANA_VERIFY_PASSWORD,
    'local disposable Grafana fixture credentials are required'
  );
  const session = await authenticateGrafanaFixture(page);
  try {
    const consoleGuard = await installConsoleGuard(page);
    let releaseAlternate!: () => void;
    const alternateHeld = new Promise<void>((resolve) => { releaseAlternate = resolve; });
    let alternateRequested!: () => void;
    const alternateRequest = new Promise<void>((resolve) => { alternateRequested = resolve; });
    await page.route('**/dashboards/grsdk-phase0-poc-alt/dto', async (route) => {
      alternateRequested();
      await alternateHeld;
      await route.continue();
    });
    await page.goto('/');
    await expect(page.getByTestId('TextPanel-converted-content')).toContainText('phase0.', {
      timeout: 15_000,
    });

    await page.getByTestId('sdk-switch-uid').click();
    await alternateRequest;
    await expect(page.getByTestId('sdk-dashboard-status').first()).toHaveAttribute(
      'data-sdk-status-uid',
      'grsdk-phase0-poc-alt'
    );
    await page.getByTestId('sdk-switch-uid').click();
    releaseAlternate();

    await expect(page.getByTestId('sdk-dashboard-status').first()).toHaveAttribute(
      'data-sdk-status-uid',
      'grsdk-phase0-poc'
    );
    await expect(page.getByTestId('TextPanel-converted-content')).toContainText(
      'Native phase0 Text fixture for phase0.'
    );
    await expect(page.getByText('Native phase0-alt lifecycle fixture.')).toHaveCount(0);
    await expect(page.locator('[data-dashboard-panel-kind="not-supported"]')).toHaveCount(3);
    await consoleGuard.assertClean();
  } finally {
    await session.cleanup();
  }
});

test('remounts and shares one compatible provider lifetime across two independent dashboards', async ({ page }) => {
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
    await expect(page.getByTestId('TextPanel-converted-content')).toContainText('phase0.');
    const mounted = await captureResourceEvidence(page, 'primary-mounted');
    expect(mounted.dom.portalChildren).toBe(0);
    const hostStyleBefore = await hostComputedStyle(page);
    expect(hostStyleBefore).toEqual({
      color: 'rgb(23, 36, 62)',
      fontFamily: 'Inter, system-ui, sans-serif',
      headerBackground: 'rgb(255, 255, 255)',
      headerBorderWidth: '2px',
    });

    await page.getByTestId('sdk-toggle-mount').click();
    await expect(page.locator('[data-dashboard-render-instance]')).toHaveCount(0);
    await waitForDormantResources(page, 'primary-unmount-settling');
    const unmounted = await captureResourceEvidence(page, 'primary-unmounted');
    expect(unmounted.dom.portalChildren).toBe(0);
    expect(unmounted.dom.portalRoots).toBe(1);
    expect(unmounted.page.resizeObserver).toBe(0);

    await page.getByTestId('sdk-toggle-mount').click();
    await expect(page.getByTestId('TextPanel-converted-content')).toContainText('phase0.');
    const remounted = await captureResourceEvidence(page, 'primary-remounted');
    expect(remounted.dom.portalChildren).toBe(0);
    await page.getByTestId('sdk-toggle-second').click();
    await expect(page.locator('[data-dashboard-render-instance]')).toHaveCount(2);
    await expect(page.getByTestId('TextPanel-converted-content')).toHaveCount(2);
    await expect(page.getByText('Native phase0-alt lifecycle fixture.')).toBeVisible();
    await expect(
      page.getByTestId('sdk-secondary-slot').locator('[data-dashboard-panel-kind="not-supported"]')
    ).toHaveCount(0);
    expect(await page.locator('#grafana-portal-container').count()).toBe(1);
    expect(await page.locator('#grafana-portal-container > *').count()).toBe(0);
    expect(await page.locator('#dashboard-render-sdk-g-styles').count()).toBe(1);

    await page.getByTestId('sdk-toggle-mount').click();
    await expect(page.locator('[data-dashboard-render-instance]')).toHaveCount(1);
    await expect(page.getByText('Native phase0-alt lifecycle fixture.')).toBeVisible();
    await page.getByTestId('sdk-toggle-second').click();
    await expect(page.locator('[data-dashboard-render-instance]')).toHaveCount(0);
    const dormantPageBaseline = stablePageResourceKeys.map((key) => unmounted.page[key]);
    await expect.poll(
      async () => {
        const settling = await captureResourceEvidence(page, 'all-dashboards-settling');
        return stablePageResourceKeys.map((key) => settling.page[key]);
      },
      { message: 'page resources must return to the first dormant baseline' }
    ).toEqual(dormantPageBaseline);
    const final = await captureResourceEvidence(page, 'all-dashboards-unmounted');
    expect(final.dom.portalChildren).toBe(0);
    expect(final.dom.portalRoots).toBe(1);
    expect(final.page.resizeObserver).toBe(0);
    expect(final.dom.styleElements).toBe(unmounted.dom.styleElements);
    expect(final.dom.emotionStyleElements).toBe(unmounted.dom.emotionStyleElements);
    for (const key of stablePageResourceKeys) {
      expect(final.page[key], `${key} must return to the first dormant baseline`).toBe(
        unmounted.page[key]
      );
    }
    expect(final.instance).toEqual(unmounted.instance);
    expect(await hostComputedStyle(page)).toEqual(hostStyleBefore);

    const assetRequests = (await networkEvidence.snapshot()).filter(
      (entry) => entry.type === 'request' && entry.resourceType === 'script'
    );
    expect(
      assetRequests.filter((entry) => /\/assets\/provider-implementation-[^/]+\.js$/.test(entry.url))
    ).toHaveLength(1);
    expect(
      assetRequests.filter((entry) => /\/assets\/feature-text-[^/]+\.js$/.test(entry.url))
    ).toHaveLength(1);
    expect(await page.locator('iframe').count()).toBe(0);
    await expect(page.getByTestId('sdk-host-sentinel')).toHaveText('Host remains functional');
    await consoleGuard.assertClean();
  } finally {
    await session.cleanup();
  }
});
