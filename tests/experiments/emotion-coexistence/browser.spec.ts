// POC / EXPERIMENT / NOT FOR PRODUCTION
import { expect, test, type Locator, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

import { authenticateGrafanaFixture } from '../../e2e/support/grafanaAuth.ts';
import { installConsoleGuard } from '../../e2e/support/consoleGuard.ts';
import { captureResourceEvidence, installResourceEvidence } from '../../e2e/support/resourceEvidence.ts';

const artifactRoot = 'artifacts/experiments/emotion-coexistence';
const evidence: Record<string, unknown> = { generatedBy: 'emotion-coexistence-browser-v1' };

interface CacheEvidence {
  readonly id: string;
  readonly inserted: number;
  readonly key: string;
  readonly tags: number;
}

interface Inspection {
  readonly admission: Record<string, boolean>;
  readonly cacheObjectsDistinct: {
    readonly hostVsProvider: boolean;
    readonly hostVsProviderCss: boolean;
    readonly providerVsProviderCss: boolean;
  };
  readonly caches: {
    readonly host: CacheEvidence;
    readonly provider: CacheEvidence;
    readonly providerCss: CacheEvidence;
  };
  readonly classes: { readonly host: readonly string[]; readonly provider: readonly string[] };
  readonly cohort: {
    readonly pluginEvents: Array<{ pluginId?: string; type: string }>;
    readonly runtime: { readonly moduleIdentities?: Record<string, { copies: number; version: string }> };
    readonly scenes: Array<{ active: boolean; uid: string }>;
  };
  readonly model: string;
  readonly styleTags: Array<{
    readonly dataEmotion: string;
    readonly index: number;
    readonly owner: string;
    readonly rules: number;
  }>;
}

declare global {
  interface Window {
    __EMOTION_COEXISTENCE__: {
      inspect(): Inspection;
      mountProvider(): void;
      resize(): void;
      runDuplicateKeyProbe(): {
        code: string;
        key: string;
        owners: readonly string[];
        rejected: boolean;
      };
      showDynamicHost(): void;
      showHost(): void;
      switchUid(): void;
      toggleSecondary(): void;
      unmountProvider(): void;
    };
  }
}

test.afterAll(async () => {
  await mkdir(artifactRoot, { recursive: true });
  await writeFile(`${artifactRoot}/browser-evidence.json`, `${JSON.stringify(evidence, null, 2)}\n`);
});

async function computed(locator: Locator) {
  return locator.evaluate((element) => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return {
      background: style.backgroundColor,
      color: style.color,
      font: style.fontFamily,
      height: Math.round(rect.height * 100) / 100,
      padding: style.padding,
      width: Math.round(rect.width * 100) / 100,
    };
  });
}

async function inspect(page: Page) {
  return page.evaluate(() => window.__EMOTION_COEXISTENCE__.inspect());
}

async function waitForPanels(page: Page) {
  await expect(page.getByRole('region', { name: 'Text — phase0' })).toContainText('Native phase0', { timeout: 30_000 });
  await expect(page.getByRole('region', { name: 'Stat — predictable pulse' })).toContainText(/(?:10|90)%/, { timeout: 30_000 });
  const timeSeries = page.getByRole('region', { name: 'Time series — predictable pulse' });
  await expect(timeSeries.getByText('Phase 0 Pulse Signal')).toBeVisible({ timeout: 30_000 });
  await expect(timeSeries.locator('canvas')).not.toHaveCount(0, { timeout: 30_000 });
}

async function open(page: Page, query: string) {
  const session = await authenticateGrafanaFixture(page);
  const guard = await installConsoleGuard(page);
  await installResourceEvidence(page);
  const requests: string[] = [];
  const pageErrors: string[] = [];
  page.on('request', (request) => requests.push(new URL(request.url()).pathname));
  page.on('pageerror', (error) => pageErrors.push(error.stack ?? error.message));
  await page.goto(`/${query}`);
  await expect(page.getByTestId('emotion-host-ready')).toHaveText('ready');
  return { guard, pageErrors, requests, session };
}

function expectBoundaries(page: Page, state: Inspection) {
  expect(state.admission).toEqual(expect.objectContaining({
    jsxDevRuntimeIdentity: true,
    jsxRuntimeIdentity: true,
    reactDomIdentity: true,
    reactIdentity: true,
  }));
  expect(state.cohort.runtime.moduleIdentities).toMatchObject({
    react: { copies: 1, version: '19.2.8' },
    'react-dom': { copies: 1, version: '19.2.8' },
  });
  return Promise.all([
    expect(page.locator('iframe')).toHaveCount(0),
    expect(page.getByRole('navigation')).toHaveCount(0),
  ]);
}

test('host-first rendering preserves three distinct Emotion ownership paths', async ({ page }) => {
  const run = await open(page, '?model=marked&order=host-first');
  try {
    const hostBefore = await computed(page.getByTestId('emotion-host-heading'));
    const beforeProvider = await inspect(page);
    expect(beforeProvider.styleTags.some((tag) => tag.owner === 'host-react')).toBe(true);
    expect(beforeProvider.classes.provider).toEqual([]);
    await page.evaluate(() => window.__EMOTION_COEXISTENCE__.mountProvider());
    await waitForPanels(page);
    await expect(page.getByTestId('provider-emotion-portal')).toHaveText('provider-portal-styled');
    const state = await inspect(page);

    expect(state.caches.host).toMatchObject({ key: 'grsdk-host' });
    expect(state.caches.provider).toMatchObject({ key: 'grsdk-provider' });
    expect(state.caches.providerCss).toMatchObject({ key: 'css' });
    expect(state.cacheObjectsDistinct).toEqual({
      hostVsProvider: true,
      hostVsProviderCss: true,
      providerVsProviderCss: true,
    });
    expect(new Set([state.caches.host.id, state.caches.provider.id, state.caches.providerCss.id]).size).toBe(3);
    expect(state.styleTags.some((tag) => tag.owner === 'host-react')).toBe(true);
    expect(state.styleTags.some((tag) => tag.owner === 'provider-react')).toBe(true);
    expect(state.styleTags.some((tag) => tag.owner === 'provider-css')).toBe(true);
    expect(state.classes.host.every((name) => name.startsWith('grsdk-host-'))).toBe(true);
    expect(state.classes.provider.every((name) => name.startsWith('grsdk-provider-'))).toBe(true);
    expect(await computed(page.getByTestId('emotion-host-heading'))).toEqual(hostBefore);
    expect(run.requests.filter((path) => path === '/grafana/api/ds/query').length).toBeGreaterThanOrEqual(2);
    expect(state.cohort.pluginEvents.filter((event) => event.type === 'success').map((event) => event.pluginId))
      .toEqual(expect.arrayContaining(['text', 'stat', 'timeseries']));
    await expectBoundaries(page, state);
    expect(run.pageErrors).toEqual([]);
    await run.guard.assertClean();

    await page.evaluate(() => window.__EMOTION_COEXISTENCE__.unmountProvider());
    await expect(page.getByTestId('provider-unmounted')).toBeVisible();
    await expect(page.locator('#provider-portal')).toBeEmpty();
    expect(await computed(page.getByTestId('emotion-host-heading'))).toEqual(hostBefore);
    const afterProvider = await inspect(page);
    expect(afterProvider.classes.provider).toEqual([]);
    expect(afterProvider.caches.host).toEqual(beforeProvider.caches.host);
    evidence.hostFirst = {
      afterProvider,
      beforeProvider,
      duringProvider: state,
      hostBefore,
      requests: [...new Set(run.requests)].sort(),
    };
  } finally {
    await run.session.cleanup();
  }
});

test('provider-first and later dynamic host styles preserve both owners', async ({ page }) => {
  const run = await open(page, '?model=marked&order=provider-first');
  try {
    await waitForPanels(page);
    await expect(page.getByTestId('emotion-host-heading')).toHaveCount(0);
    const providerBefore = await computed(page.getByTestId('provider-emotion-sentinel'));
    await page.evaluate(() => window.__EMOTION_COEXISTENCE__.showHost());
    await expect(page.getByTestId('emotion-host-heading')).toBeVisible();
    const hostBeforeDynamic = await computed(page.getByTestId('emotion-host-heading'));
    await page.evaluate(() => window.__EMOTION_COEXISTENCE__.showDynamicHost());
    await expect(page.getByTestId('emotion-host-dynamic')).toBeVisible();
    expect(await computed(page.getByTestId('provider-emotion-sentinel'))).toEqual(providerBefore);
    expect(await computed(page.getByTestId('emotion-host-heading'))).toEqual(hostBeforeDynamic);
    const state = await inspect(page);
    expect(state.styleTags.filter((tag) => tag.owner === 'host-react')).toHaveLength(1);
    expect(state.styleTags.filter((tag) => tag.owner === 'provider-react')).toHaveLength(1);
    await expectBoundaries(page, state);
    await run.guard.assertClean();
    evidence.providerFirst = { hostBeforeDynamic, providerBefore, state };
  } finally {
    await run.session.cleanup();
  }
});

test('head, marked insertion-point, and prepend models have observable deterministic ordering', async ({ context }) => {
  const results: Record<string, unknown> = {};
  for (const model of ['head', 'marked', 'prepend'] as const) {
    // Each model owns a fresh document realm. The shared instrumentation installs
    // non-configurable globals intentionally and therefore must not be installed
    // repeatedly on a reused Playwright page.
    const modelPage = await context.newPage();
    const run = await open(modelPage, `?model=${model}&order=host-first`);
    try {
      await modelPage.evaluate(() => window.__EMOTION_COEXISTENCE__.mountProvider());
      await waitForPanels(modelPage);
      const state = await inspect(modelPage);
      const host = state.styleTags.find((tag) => tag.owner === 'host-react');
      const provider = state.styleTags.find((tag) => tag.owner === 'provider-react');
      expect(host).toBeDefined();
      expect(provider).toBeDefined();
      expect(state.styleTags.some((tag) => tag.owner === 'provider-css')).toBe(true);
      expect(await computed(modelPage.getByTestId('emotion-host-heading'))).toMatchObject({ color: 'rgb(76, 29, 149)' });
      expect(await computed(modelPage.getByTestId('provider-emotion-sentinel'))).toMatchObject({ color: 'rgb(6, 95, 70)' });
      results[model] = { host, provider, state };
      await run.guard.assertClean();
    } finally {
      await run.session.cleanup();
      await modelPage.close();
    }
  }
  evidence.insertionModels = results;
});

test('same-key negative is rejected as ownership ambiguity before normal rendering', async ({ page }) => {
  const run = await open(page, '?model=marked&order=host-first');
  try {
    const result = await page.evaluate(() => window.__EMOTION_COEXISTENCE__.runDuplicateKeyProbe());
    expect(result).toEqual({
      code: 'duplicate-emotion-cache-key',
      key: 'grsdk-conflict',
      owners: ['host-react', 'provider-react'],
      rejected: true,
    });
    expect((await inspect(page)).caches.host.key).toBe('grsdk-host');
    await run.guard.assertClean();
    evidence.duplicateKey = result;
  } finally {
    await run.session.cleanup();
  }
});

test('UID change, resize, remount, and two dashboards retain one provider cache', async ({ page }) => {
  const run = await open(page, '?model=marked&order=host-first');
  try {
    await page.evaluate(() => window.__EMOTION_COEXISTENCE__.mountProvider());
    await waitForPanels(page);
    const initial = await inspect(page);
    const plot = page.getByRole('region', { name: 'Time series — predictable pulse' }).first().locator('.uplot');
    const widthBefore = (await plot.boundingBox())?.width ?? 0;
    await page.evaluate(() => window.__EMOTION_COEXISTENCE__.resize());
    await expect.poll(async () => (await plot.boundingBox())?.width ?? 0).toBeLessThan(widthBefore - 50);
    await page.evaluate(() => window.__EMOTION_COEXISTENCE__.switchUid());
    await expect(page.getByRole('region', { name: 'Alternate Text sentinel' })).toContainText('phase0-alt');
    await page.evaluate(() => window.__EMOTION_COEXISTENCE__.switchUid());
    await waitForPanels(page);
    await page.evaluate(() => window.__EMOTION_COEXISTENCE__.toggleSecondary());
    await expect(page.getByRole('region', { name: 'Time series — predictable pulse' })).toHaveCount(2, { timeout: 30_000 });
    const two = await inspect(page);
    expect(two.caches.provider.id).toBe(initial.caches.provider.id);
    expect(two.cohort.scenes.filter((scene) => scene.active)).toHaveLength(2);
    await page.evaluate(() => window.__EMOTION_COEXISTENCE__.toggleSecondary());
    await expect(page.getByRole('region', { name: 'Time series — predictable pulse' })).toHaveCount(1);
    await page.evaluate(() => window.__EMOTION_COEXISTENCE__.unmountProvider());
    await expect.poll(async () =>
      Object.values((await captureResourceEvidence(page, 'emotion-lifecycle-released')).instance)
        .every((count) => count === 0)
    ).toBe(true);
    await page.evaluate(() => window.__EMOTION_COEXISTENCE__.mountProvider());
    await waitForPanels(page);
    const remounted = await inspect(page);
    expect(remounted.caches.provider.id).toBe(initial.caches.provider.id);
    await run.guard.assertClean();
    evidence.lifecycle = { initial, remounted, two, widthBefore };
  } finally {
    await run.session.cleanup();
  }
});

test('twenty dashboard cycles retain bounded provider-lifetime styles', async ({ page }) => {
  test.setTimeout(360_000);
  const run = await open(page, '?model=marked&order=host-first');
  try {
    await page.evaluate(() => window.__EMOTION_COEXISTENCE__.mountProvider());
    await waitForPanels(page);
    await page.evaluate(() => window.__EMOTION_COEXISTENCE__.switchUid());
    await expect(page.getByRole('region', { name: 'Alternate Text sentinel' })).toContainText('phase0-alt');
    await page.evaluate(() => window.__EMOTION_COEXISTENCE__.switchUid());
    await waitForPanels(page);
    await page.evaluate(() => window.__EMOTION_COEXISTENCE__.unmountProvider());
    const baseline = await inspect(page);
    const cycles: Inspection[] = [];
    for (let index = 0; index < 20; index += 1) {
      await page.evaluate(() => window.__EMOTION_COEXISTENCE__.mountProvider());
      await waitForPanels(page);
      await page.evaluate(() => window.__EMOTION_COEXISTENCE__.switchUid());
      await expect(page.getByRole('region', { name: 'Alternate Text sentinel' })).toContainText('phase0-alt');
      await page.evaluate(() => window.__EMOTION_COEXISTENCE__.switchUid());
      await waitForPanels(page);
      await page.evaluate(() => window.__EMOTION_COEXISTENCE__.unmountProvider());
      await expect.poll(async () =>
        Object.values((await captureResourceEvidence(page, `emotion-cycle-${index}`)).instance)
          .every((count) => count === 0)
      ).toBe(true);
      cycles.push(await inspect(page));
    }
    const final = cycles.at(-1)!;
    expect(final.styleTags.length).toBe(baseline.styleTags.length);
    expect(final.caches.host.inserted).toBe(baseline.caches.host.inserted);
    expect(final.caches.provider.inserted).toBe(baseline.caches.provider.inserted);
    expect(final.caches.providerCss.inserted).toBe(baseline.caches.providerCss.inserted);
    await run.guard.assertClean();
    evidence.styleGrowth = { baseline, cycles, final };
  } finally {
    await run.session.cleanup();
  }
});
