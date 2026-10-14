// POC / EXPERIMENT / NOT FOR PRODUCTION
import { expect, test, type Locator, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

import { authenticateGrafanaFixture } from '../../e2e/support/grafanaAuth.ts';
import { installConsoleGuard } from '../../e2e/support/consoleGuard.ts';
import {
  captureResourceEvidence,
  installResourceEvidence,
} from '../../e2e/support/resourceEvidence.ts';

const artifactRoot = 'artifacts/experiments/host-css-containment';
const profiles = [
  'baseline',
  'reset',
  'typography',
  'layout',
  'controls',
  'framework',
  'important',
] as const;

interface ElementEvidence {
  readonly rect: { readonly height: number; readonly width: number; readonly x: number; readonly y: number };
  readonly style: Record<string, string>;
}

interface PageEvidence {
  readonly emotion: readonly string[];
  readonly host: {
    readonly button: ElementEvidence;
    readonly canvas: ElementEvidence;
    readonly container: ElementEvidence;
    readonly heading: ElementEvidence;
    readonly input: ElementEvidence;
    readonly svg: ElementEvidence;
    readonly text: ElementEvidence;
  };
  readonly iframeCount: number;
  readonly page: { readonly clientWidth: number; readonly scrollWidth: number };
  readonly panels?: {
    readonly provider: ElementEvidence;
    readonly stat: ElementEvidence;
    readonly statBackgroundColors: readonly string[];
    readonly text: ElementEvidence;
    readonly textHeading: ElementEvidence;
    readonly textPanelTitle: ElementEvidence;
    readonly textParagraph: ElementEvidence;
    readonly timeSeries: ElementEvidence;
    readonly timeSeriesCanvas: ElementEvidence;
    readonly timeSeriesLegendButton: ElementEvidence;
    readonly uplot: ElementEvidence;
  };
  readonly portal?: { readonly provider?: string; readonly surface?: string; readonly theme?: string };
}

const evidence: Record<string, unknown> = {
  generatedBy: 'host-css-containment-browser-v1',
  profiles: {},
};

test.afterAll(async () => {
  await mkdir(artifactRoot, { recursive: true });
  await writeFile(`${artifactRoot}/computed-style-evidence.json`, `${JSON.stringify(evidence, null, 2)}\n`);
});

async function elementEvidence(locator: Locator): Promise<ElementEvidence> {
  return locator.evaluate((element) => {
    const computed = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return {
      rect: {
        height: Math.round(rect.height * 100) / 100,
        width: Math.round(rect.width * 100) / 100,
        x: Math.round(rect.x * 100) / 100,
        y: Math.round(rect.y * 100) / 100,
      },
      style: Object.fromEntries(
        [
          'background-color', 'border-bottom-width', 'border-left-width', 'border-right-width',
          'border-top-width', 'box-sizing', 'color', 'display', 'font-family', 'font-size',
          'font-weight', 'height', 'letter-spacing', 'line-height', 'margin-bottom', 'margin-left',
          'margin-right', 'margin-top', 'max-width', 'min-width', 'overflow-x', 'overflow-y',
          'padding-bottom', 'padding-left', 'padding-right', 'padding-top', 'position',
          'text-transform', 'width',
        ].map((property) => [property, computed.getPropertyValue(property)])
      ),
    };
  });
}

async function captureHost(page: Page): Promise<PageEvidence['host']> {
  return {
    button: await elementEvidence(page.getByTestId('host-css-button')),
    canvas: await elementEvidence(page.getByTestId('host-css-canvas')),
    container: await elementEvidence(page.getByTestId('host-css-container')),
    heading: await elementEvidence(page.getByTestId('host-css-heading')),
    input: await elementEvidence(page.getByTestId('host-css-input')),
    svg: await elementEvidence(page.getByTestId('host-css-svg')),
    text: await elementEvidence(page.getByTestId('host-css-text')),
  };
}

async function capturePage(page: Page, includePanels: boolean): Promise<PageEvidence> {
  const host = await captureHost(page);
  const shared = await page.evaluate(() => ({
    emotion: [...document.querySelectorAll<HTMLStyleElement>('style[data-emotion]')]
      .map((style) => style.dataset.emotion ?? '')
      .sort(),
    iframeCount: document.querySelectorAll('iframe').length,
    page: { clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth },
    portal: (() => {
      const portal = document.getElementById('grafana-portal-container');
      return portal
        ? {
            provider: portal.dataset.grsdkProvider,
            surface: portal.dataset.grsdkSurface,
            theme: portal.dataset.grsdkTheme,
          }
        : undefined;
    })(),
  }));
  if (!includePanels) return { ...shared, host };

  const text = page.getByRole('region', { name: 'Text — phase0' });
  const stat = page.getByRole('region', { name: 'Stat — predictable pulse' });
  const timeSeries = page.getByRole('region', { name: 'Time series — predictable pulse' });
  return {
    ...shared,
    host,
    panels: {
      provider: await elementEvidence(page.getByTestId('provider-surface')),
      stat: await elementEvidence(stat),
      statBackgroundColors: await stat.locator('*').evaluateAll((elements) =>
        [...new Set(elements.map((element) => getComputedStyle(element).backgroundColor))]
          .filter((color) => color !== 'rgba(0, 0, 0, 0)' && color !== 'rgb(255, 255, 255)')
          .sort()
      ),
      text: await elementEvidence(text),
      textHeading: await elementEvidence(text.locator('h1').first()),
      textPanelTitle: await elementEvidence(text.getByText('Text — phase0', { exact: true })),
      textParagraph: await elementEvidence(text.locator('p').first()),
      timeSeries: await elementEvidence(timeSeries),
      timeSeriesCanvas: await elementEvidence(timeSeries.locator('canvas').first()),
      timeSeriesLegendButton: await elementEvidence(timeSeries.locator('button').first()),
      uplot: await elementEvidence(timeSeries.locator('.uplot').first()),
    },
  };
}

async function waitForRealPanels(page: Page) {
  const text = page.getByRole('region', { name: 'Text — phase0' });
  const stat = page.getByRole('region', { name: 'Stat — predictable pulse' });
  const timeSeries = page.getByRole('region', { name: 'Time series — predictable pulse' });
  await expect(text).toContainText('Native phase0', { timeout: 20_000 });
  await expect(stat).toContainText(/(?:10|90)%/, { timeout: 20_000 });
  await expect(timeSeries.getByText('Phase 0 Pulse Signal')).toBeVisible({ timeout: 20_000 });
  await expect(timeSeries.locator('canvas')).not.toHaveCount(0, { timeout: 20_000 });
}

async function inspect(page: Page) {
  return page.evaluate(() =>
    (globalThis as typeof globalThis & {
      __HOST_CSS_CONTAINMENT__: { inspect(): unknown };
    }).__HOST_CSS_CONTAINMENT__.inspect()
  );
}

function stableHostStyle(host: PageEvidence['host']) {
  return Object.fromEntries(
    Object.entries(host).map(([key, value]) => [key, {
      rect: { height: value.rect.height, width: value.rect.width },
      style: value.style,
    }])
  );
}

test('profiles A-F preserve real panels and provider-to-host containment', async ({ page }) => {
  const session = await authenticateGrafanaFixture(page);
  try {
    const consoleGuard = await installConsoleGuard(page);
    await installResourceEvidence(page);
    let queryRequests: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/grafana/api/ds/query')) queryRequests.push(new URL(request.url()).pathname);
    });
    let baselinePanels: NonNullable<PageEvidence['panels']> | undefined;
    for (const profile of profiles) {
      queryRequests = [];

      await page.goto(`/?profile=${profile}&mounted=0`);
      await expect(page.getByTestId('host-css-heading')).toBeVisible();
      await expect(page.locator('[data-grsdk-surface="dashboard"]')).toHaveCount(0);
      const before = await capturePage(page, false);

      await page.getByTestId('toggle-provider').click();
      await waitForRealPanels(page);
      const during = await capturePage(page, true);
      expect(during.panels).toBeDefined();
      expect(during.panels!.provider.rect.width).toBeGreaterThan(600);
      expect(during.panels!.provider.rect.width).toBeLessThanOrEqual(1120);
      expect(during.panels!.timeSeriesCanvas.rect.width).toBeGreaterThan(100);
      expect(during.panels!.timeSeriesCanvas.rect.height).toBeGreaterThan(40);
      expect(during.panels!.uplot.rect.width).toBeGreaterThan(100);
      expect(during.panels!.statBackgroundColors.length).toBeGreaterThan(0);
      expect(Number.parseFloat(during.panels!.textHeading.style['font-size'] ?? '0')).toBeGreaterThan(20);
      expect(Number.parseFloat(during.panels!.textParagraph.style['line-height'] ?? '0')).toBeGreaterThan(15);
      expect(during.panels!.provider.style['box-sizing']).toBe('border-box');
      expect(during.panels!.provider.style['font-size']).toBe('14px');
      expect(during.page.scrollWidth).toBeLessThanOrEqual(during.page.clientWidth + 1);
      expect(during.portal).toMatchObject({
        provider: 'grafana-13.2.3', surface: 'portal', theme: 'light',
      });
      expect(during.iframeCount).toBe(0);
      expect(new URL(page.url()).pathname).toBe('/');
      expect(queryRequests.length).toBeGreaterThanOrEqual(2);
      expect(stableHostStyle(during.host)).toEqual(stableHostStyle(before.host));
      const legendButton = page.getByRole('region', { name: 'Time series — predictable pulse' })
        .getByRole('button', { name: 'All series selected' });
      await legendButton.focus();
      await expect(legendButton).toBeFocused();
      if (profile === 'baseline') {
        baselinePanels = during.panels;
      } else {
        expect(baselinePanels).toBeDefined();
        expect(during.panels!.timeSeriesLegendButton.rect.height)
          .toBe(baselinePanels!.timeSeriesLegendButton.rect.height);
        for (const property of [
          'background-color',
          'border-top-width',
          'color',
          'padding-top',
        ]) {
          expect(during.panels!.timeSeriesLegendButton.style[property])
            .toBe(baselinePanels!.timeSeriesLegendButton.style[property]);
        }
        expect(during.panels!.uplot.rect.height).toBe(baselinePanels!.uplot.rect.height);
      }

      await page.screenshot({ fullPage: true, path: `${artifactRoot}/screenshots/${profile}.png` });

      await page.getByTestId('toggle-provider').click();
      await expect(page.getByTestId('provider-unmounted')).toBeVisible();
      await expect(page.locator('[data-grsdk-surface="dashboard"]')).toHaveCount(0);
      await expect.poll(async () => {
        const snapshot = await captureResourceEvidence(page, `${profile}-released`);
        return Object.values(snapshot.instance).every((count) => count === 0);
      }).toBe(true);
      const after = await capturePage(page, false);
      expect(stableHostStyle(after.host)).toEqual(stableHostStyle(before.host));
      expect(after.portal).toBeUndefined();
      await consoleGuard.assertClean();

      (evidence.profiles as Record<string, unknown>)[profile] = {
        after, before, during, queryRequests: [...new Set(queryRequests)].sort(), runtime: await inspect(page),
      };
    }
  } finally {
    await session.cleanup();
  }
});

test('UID switch, responsive resize, unmount and remount remain clean', async ({ page }) => {
  const session = await authenticateGrafanaFixture(page);
  try {
    const consoleGuard = await installConsoleGuard(page);
    await installResourceEvidence(page);
    await page.goto('/?profile=framework');
    await waitForRealPanels(page);

    const plot = page.getByRole('region', { name: 'Time series — predictable pulse' }).locator('.uplot');
    const beforeResize = await plot.boundingBox();
    expect(beforeResize?.width).toBeGreaterThan(500);
    await page.getByTestId('resize-provider').click();
    await expect(page.getByTestId('provider-surface')).toHaveCSS('width', '640px');
    await expect.poll(async () => Math.round((await plot.boundingBox())?.width ?? 0))
      .toBeLessThan((beforeResize?.width ?? 0) - 50);
    expect((await plot.boundingBox())?.width).toBeLessThanOrEqual(640);
    const resizeEvents = await page.evaluate(() =>
      (globalThis as typeof globalThis & {
        __POC_RESOURCE_EVIDENCE__?: { resizeObserverEvents(): Array<{ entries?: number; event: string }> };
      }).__POC_RESOURCE_EVIDENCE__?.resizeObserverEvents() ?? []
    );
    expect(resizeEvents.some((event) => event.event === 'delivery' && (event.entries ?? 0) > 0)).toBe(true);

    await page.getByTestId('switch-uid').click();
    await expect(page.getByRole('region', { name: 'Alternate Text sentinel' })).toContainText('phase0-alt');
    await expect(page.getByRole('region', { name: 'Time series — predictable pulse' })).toHaveCount(0);
    await page.getByTestId('switch-uid').click();
    await waitForRealPanels(page);

    await page.getByTestId('toggle-provider').click();
    await expect.poll(async () => {
      const snapshot = await captureResourceEvidence(page, 'lifecycle-released');
      return Object.values(snapshot.instance).every((count) => count === 0);
    }).toBe(true);
    await page.getByTestId('toggle-provider').click();
    await waitForRealPanels(page);
    await consoleGuard.assertClean();
    evidence.lifecycle = {
      afterRemount: await capturePage(page, true),
      inspection: await inspect(page),
      plotWidth: { after: Math.round((await plot.boundingBox())?.width ?? 0), before: Math.round(beforeResize?.width ?? 0) },
    };
  } finally {
    await session.cleanup();
  }
});

test('two dashboards retain independent plots and shared compatible infrastructure', async ({ page }) => {
  const session = await authenticateGrafanaFixture(page);
  try {
    const consoleGuard = await installConsoleGuard(page);
    await installResourceEvidence(page);
    await page.goto('/?profile=important&instances=2');
    const plots = page.getByRole('region', { name: 'Time series — predictable pulse' });
    await expect(plots).toHaveCount(2, { timeout: 20_000 });
    await expect(plots.nth(0).locator('canvas')).not.toHaveCount(0);
    await expect(plots.nth(1).locator('canvas')).not.toHaveCount(0);
    const before = await captureResourceEvidence(page, 'two-active');
    expect(before.page.resizeObserver).toBeGreaterThanOrEqual(2);

    await page.getByTestId('toggle-secondary').click();
    await expect(plots).toHaveCount(1);
    await expect(plots.locator('canvas')).not.toHaveCount(0);
    await expect.poll(async () => (await captureResourceEvidence(page, 'one-active')).page.resizeObserver)
      .toBeLessThan(before.page.resizeObserver);

    const state = await inspect(page) as {
      runtime: { moduleIdentities?: Record<string, { copies: number; version: string }> };
      scenes: Array<{ active: boolean; uid: string }>;
    };
    expect(state.scenes.filter((scene) => scene.active)).toHaveLength(1);
    expect(state.runtime.moduleIdentities).toMatchObject({
      react: { copies: 1, version: '19.2.8' },
      'react-dom': { copies: 1, version: '19.2.8' },
    });
    expect(await page.locator('iframe').count()).toBe(0);
    await consoleGuard.assertClean();
    evidence.multipleInstances = { resources: before, state };
  } finally {
    await session.cleanup();
  }
});
