// POC / EXPERIMENT / NOT FOR PRODUCTION
import { expect, test, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

import { authenticateGrafanaFixture } from '../../e2e/support/grafanaAuth.ts';
import { installConsoleGuard } from '../../e2e/support/consoleGuard.ts';
import { captureResourceEvidence, installResourceEvidence } from '../../e2e/support/resourceEvidence.ts';

const artifactRoot = 'artifacts/experiments/provider-assets';
const evidence: Record<string, unknown> = { generatedBy: 'provider-assets-browser-v1' };

interface Inspection {
  readonly admission: Record<string, unknown>;
  readonly assetBasePath: string;
  readonly font: {
    fallbackSampleWidth: number;
    family: string;
    medium: boolean;
    regular: boolean;
    sampleWidth: number;
  };
  readonly profile: 'nested' | 'root';
  readonly provider: {
    readonly cacheObjectsDistinct: Record<string, boolean>;
    readonly cohort: {
      readonly pluginEvents: Array<{ pluginId?: string; type: string }>;
      readonly queryEvents: Array<{ panelId?: number; state?: string; type: string }>;
      readonly runtime: {
        readonly activeDashboardScopes: number;
        readonly moduleIdentities: Record<string, { copies: number; version: string }>;
      };
    };
    readonly portal: { controlledBodyChild: boolean; directBodyFallbacks: number };
  };
}

declare global {
  interface Window {
    __PROVIDER_ASSET_EXPERIMENT__: {
      command(command: 'resize' | 'switchUidWithOpenModal' | 'togglePrimary' | 'toggleSecondary'): void;
      inspect(): Inspection;
      mountProvider(): void;
      unmountProvider(): void;
    };
  }
}

interface NetworkEntry {
  cacheControl: string;
  contentType: string;
  fromServiceWorker: boolean;
  path: string;
  resourceType: string;
  status: number;
}

test.afterAll(async () => {
  await mkdir(artifactRoot, { recursive: true });
  await writeFile(`${artifactRoot}/browser-evidence.json`, `${JSON.stringify(evidence, null, 2)}\n`);
});

async function inspect(page: Page) {
  return page.evaluate(() => window.__PROVIDER_ASSET_EXPERIMENT__.inspect());
}

async function command(page: Page, value: Parameters<Window['__PROVIDER_ASSET_EXPERIMENT__']['command']>[0]) {
  await page.evaluate((commandValue) => window.__PROVIDER_ASSET_EXPERIMENT__.command(commandValue), value);
}

async function waitForPanels(page: Page, count = 1) {
  await expect(page.getByRole('region', { name: 'Text — phase0' })).toHaveCount(count, { timeout: 30_000 });
  await expect(page.getByRole('region', { name: 'Stat — predictable pulse' })).toHaveCount(count, { timeout: 30_000 });
  await expect(page.getByRole('region', { name: 'Time series — predictable pulse' })).toHaveCount(count, { timeout: 30_000 });
  await expect(page.getByRole('region', { name: 'Time series — predictable pulse' }).first().locator('canvas')).not.toHaveCount(0, { timeout: 30_000 });
}

async function waitForPanelMode(page: Page, panelId: 'stat' | 'text' | 'timeseries') {
  const names = {
    stat: 'Stat — predictable pulse',
    text: 'Text — phase0',
    timeseries: 'Time series — predictable pulse',
  } as const;
  await expect(page.getByRole('region', { name: names[panelId] })).toBeVisible({ timeout: 30_000 });
  if (panelId === 'timeseries') {
    await expect(page.getByRole('region', { name: names[panelId] }).getByText('Phase 0 Pulse Signal')).toBeVisible();
  }
  for (const [candidate, name] of Object.entries(names)) {
    if (candidate !== panelId) await expect(page.getByRole('region', { name })).toHaveCount(0);
  }
}

async function open(page: Page, url = '/') {
  const session = await authenticateGrafanaFixture(page);
  const guard = await installConsoleGuard(page);
  await installResourceEvidence(page);
  const network: NetworkEntry[] = [];
  page.on('response', async (response) => {
    const request = response.request();
    const parsed = new URL(response.url());
    network.push({
      cacheControl: (await response.allHeaders())['cache-control'] ?? '',
      contentType: (await response.allHeaders())['content-type'] ?? '',
      fromServiceWorker: response.fromServiceWorker(),
      path: parsed.pathname,
      resourceType: request.resourceType(),
      status: response.status(),
    });
  });
  await page.goto(url);
  await waitForPanels(page);
  return { guard, network, session };
}

async function assertBoundaries(page: Page, state: Inspection) {
  expect(state.provider.cohort.runtime.moduleIdentities).toMatchObject({
    react: { copies: 1, version: '19.2.8' },
    'react-dom': { copies: 1, version: '19.2.8' },
  });
  expect(state.provider.portal).toMatchObject({ controlledBodyChild: true, directBodyFallbacks: 0 });
  await expect(page.locator('iframe')).toHaveCount(0);
  await expect(page.locator('grafana-app')).toHaveCount(0);
  await expect(page.getByRole('navigation')).toHaveCount(0);
}

function staticAssetRequests(network: readonly NetworkEntry[]) {
  return network.filter((entry) => /\.(?:css|woff2|svg)$/.test(entry.path));
}

function classifyNetwork(network: readonly NetworkEntry[]) {
  return {
    api: network.filter((entry) => entry.path.startsWith('/grafana/apis/')),
    datasource: network.filter((entry) => entry.path === '/grafana/api/ds/query'),
    javascript: network.filter((entry) => entry.path.endsWith('.js')),
    staticAssets: staticAssetRequests(network),
  };
}

function assertValidStaticAssetResponses(entries: readonly NetworkEntry[]) {
  for (const entry of entries) {
    expect(entry.status, entry.path).toBe(200);
    if (entry.path.endsWith('.css')) expect(entry.contentType, entry.path).toContain('text/css');
    if (entry.path.endsWith('.woff2')) expect(entry.contentType, entry.path).toContain('font/woff2');
    if (entry.path.endsWith('.svg')) expect(entry.contentType, entry.path).toContain('image/svg+xml');
  }
}

for (const panelId of ['text', 'stat', 'timeseries'] as const) {
  test(`${panelId}-only view records its local static-asset request set`, async ({ page }) => {
    const session = await authenticateGrafanaFixture(page);
    const guard = await installConsoleGuard(page);
    const network: NetworkEntry[] = [];
    page.on('response', async (response) => {
      const request = response.request();
      network.push({
        cacheControl: (await response.allHeaders())['cache-control'] ?? '',
        contentType: (await response.allHeaders())['content-type'] ?? '',
        fromServiceWorker: response.fromServiceWorker(),
        path: new URL(response.url()).pathname,
        resourceType: request.resourceType(),
        status: response.status(),
      });
    });
    try {
      await page.goto(`/?view=${panelId}`);
      await waitForPanelMode(page, panelId);
      await page.evaluate(() => document.fonts.ready);
      const assets = staticAssetRequests(network);
      assertValidStaticAssetResponses(assets);
      expect(assets.some((entry) => entry.path.startsWith('/grafana/public/'))).toBe(false);
      const state = await inspect(page);
      expect(state.provider.cohort.pluginEvents).toContainEqual(expect.objectContaining({ pluginId: panelId, type: 'success' }));
      const panelNumber = panelId === 'stat' ? 2 : panelId === 'timeseries' ? 3 : undefined;
      if (panelNumber) {
        expect(state.provider.cohort.queryEvents).toContainEqual(expect.objectContaining({ panelId: panelNumber, state: 'Done' }));
      } else {
        expect(state.provider.cohort.queryEvents.some((event) => event.type === 'query')).toBe(false);
      }
      await guard.assertClean();
      evidence[`${panelId}Only`] = { network: classifyNetwork(network), state };
    } finally {
      await session.cleanup();
    }
  });
}

test('root deployment resolves the complete local view asset set', async ({ page }) => {
  const run = await open(page);
  try {
    await page.getByTestId('modal-trigger-portal-primary').click();
    const dialog = page.getByRole('dialog', { name: 'Provider modal portal-primary' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Close', exact: true }).locator('svg')).toHaveCount(1);
    await page.evaluate(() => document.fonts.ready);
    const state = await inspect(page);
    expect(state).toMatchObject({ assetBasePath: '/provider-assets/', profile: 'root' });
    expect(state.font).toMatchObject({ medium: true, regular: true });
    expect(state.font.family).toContain('Grsdk Provider Inter');
    expect(run.network.some((entry) => entry.path === '/provider-assets/build/img/icons/unicons/times.svg' && entry.status === 200)).toBe(true);
    expect(run.network.some((entry) => /Inter-Regular-.*\.woff2$/.test(entry.path) && entry.status === 200)).toBe(true);
    expect(run.network.some((entry) => /Inter-Medium-.*\.woff2$/.test(entry.path) && entry.status === 200)).toBe(true);
    expect(run.network.some((entry) => entry.path.startsWith('/grafana/public/') && /\.(?:svg|woff2)$/.test(entry.path))).toBe(false);
    expect(run.network.some((entry) => /^https?:\/\//.test(entry.path))).toBe(false);
    assertValidStaticAssetResponses(staticAssetRequests(run.network));
    await assertBoundaries(page, state);
    await run.guard.assertClean();
    evidence.root = { network: classifyNetwork(run.network), state };
  } finally {
    await run.session.cleanup();
  }
});

test('nested deployment resolves chunks, CSS, fonts, and icons beneath its configured base', async ({ page }) => {
  const run = await open(page, 'http://localhost:5189/app/sdk/');
  try {
    await page.getByTestId('modal-trigger-portal-primary').click();
    await expect(page.getByRole('dialog', { name: 'Provider modal portal-primary' })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    const state = await inspect(page);
    expect(state).toMatchObject({ assetBasePath: '/app/sdk/provider-assets/', profile: 'nested' });
    const providerAssets = staticAssetRequests(run.network).filter((entry) => !entry.path.startsWith('/grafana/'));
    expect(providerAssets.length).toBeGreaterThan(0);
    expect(providerAssets.every((entry) => entry.path.startsWith('/app/sdk/'))).toBe(true);
    assertValidStaticAssetResponses(providerAssets);
    await assertBoundaries(page, state);
    await run.guard.assertClean();
    evidence.nested = { network: classifyNetwork(run.network), state };
  } finally {
    await run.session.cleanup();
  }
});

test('offline profile blocks public internet while local panels and assets remain usable', async ({ page }) => {
  const blocked: string[] = [];
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') await route.continue();
    else {
      blocked.push(`${url.protocol}//${url.host}${url.pathname}`);
      await route.abort('blockedbyclient');
    }
  });
  const run = await open(page);
  try {
    await page.getByTestId('modal-trigger-portal-primary').click();
    await expect(page.getByRole('dialog', { name: 'Provider modal portal-primary' })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    expect(blocked).toEqual([]);
    expect((await inspect(page)).font.regular).toBe(true);
    assertValidStaticAssetResponses(staticAssetRequests(run.network));
    await run.guard.assertClean();
    evidence.offline = { blocked, network: classifyNetwork(run.network) };
  } finally {
    await run.session.cleanup();
  }
});

test('missing icon is detectable and isolated without crashing the host or panels', async ({ page }) => {
  const failed: Array<{ contentType: string; path: string; status: number }> = [];
  page.on('response', async (response) => {
    const path = new URL(response.url()).pathname;
    if (!path.endsWith('/provider-assets-missing/build/img/icons/unicons/times.svg')) return;
    const contentType = (await response.allHeaders())['content-type'] ?? '';
    if (response.status() >= 400 || !contentType.includes('image/svg+xml')) {
      failed.push({ contentType, path, status: response.status() });
    }
  });
  const session = await authenticateGrafanaFixture(page);
  await installResourceEvidence(page);
  try {
    await page.goto('/?assetFailure=icon');
    await waitForPanels(page);
    await page.getByTestId('modal-trigger-portal-primary').click();
    await expect(page.getByRole('dialog', { name: 'Provider modal portal-primary' })).toBeVisible();
    await expect.poll(() => failed.length).toBe(1);
    await expect(page.getByTestId('asset-host')).toBeVisible();
    await page.getByRole('dialog', { name: 'Provider modal portal-primary' }).getByRole('button', { name: 'Close modal', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Time series — predictable pulse' })).toBeVisible();
    evidence.missingIcon = { category: 'ICON', failed };
  } finally {
    await session.cleanup();
  }
});

test('font failure uses the declared fallback stack and keeps rendering usable', async ({ page }) => {
  const failedFonts: string[] = [];
  await page.route(/\.woff2(?:\?.*)?$/, async (route) => {
    failedFonts.push(new URL(route.request().url()).pathname);
    await route.abort('failed');
  });
  const run = await open(page);
  try {
    await page.evaluate(() => document.fonts.ready);
    const state = await inspect(page);
    expect(failedFonts.length).toBeGreaterThanOrEqual(1);
    expect(state.font.regular).toBe(false);
    expect(state.font.family).toContain('system-ui');
    expect(Math.abs(state.font.sampleWidth - state.font.fallbackSampleWidth)).toBeLessThan(0.01);
    await expect(page.getByRole('region', { name: 'Text — phase0' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Stat — predictable pulse' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Time series — predictable pulse' })).toBeVisible();
    evidence.fontFailure = { failedFonts, font: state.font, classification: 'SOFT FIDELITY REQUIREMENT' };
  } finally {
    await run.session.cleanup();
  }
});

test('UID, resize, two dashboards, portal, Emotion, host CSS, and cleanup remain bounded', async ({ page }) => {
  const run = await open(page);
  try {
    const initialAssets = staticAssetRequests(run.network).length;
    await page.getByTestId('popover-trigger-portal-primary').click();
    await expect(page.getByTestId('popover-portal-primary')).toBeVisible();
    await command(page, 'switchUidWithOpenModal');
    await expect(page.getByRole('region', { name: 'Alternate Text sentinel' })).toContainText('phase0-alt');
    await command(page, 'switchUidWithOpenModal');
    await waitForPanels(page);
    const plot = page.getByRole('region', { name: 'Time series — predictable pulse' }).locator('.uplot');
    const width = (await plot.boundingBox())?.width ?? 0;
    await command(page, 'resize');
    await expect.poll(async () => (await plot.boundingBox())?.width ?? 0).toBeLessThan(width - 50);
    await command(page, 'toggleSecondary');
    await waitForPanels(page, 2);
    const two = await inspect(page);
    expect(two.provider.cohort.runtime.activeDashboardScopes).toBe(2);
    expect(two.provider.cacheObjectsDistinct).toEqual({ hostVsProvider: true, hostVsProviderCss: true, providerVsProviderCss: true });
    const legend = page.getByRole('region', { name: 'Time series — predictable pulse' }).first().getByRole('button', { name: 'All series selected' });
    expect(await legend.evaluate((element) => ({ border: getComputedStyle(element).borderWidth, padding: getComputedStyle(element).padding })))
      .toEqual({ border: '0px', padding: '0px' });
    await command(page, 'togglePrimary');
    await waitForPanels(page, 1);
    await page.evaluate(() => window.__PROVIDER_ASSET_EXPERIMENT__.unmountProvider());
    await expect(page.getByTestId('provider-unmounted')).toBeVisible();
    await expect(page.locator('#grafana-portal-container')).toHaveCount(0);
    await expect.poll(async () => Object.values((await captureResourceEvidence(page, 'provider-assets-released')).instance).every((count) => count === 0)).toBe(true);
    await page.evaluate(() => window.__PROVIDER_ASSET_EXPERIMENT__.mountProvider());
    await waitForPanels(page);
    expect(staticAssetRequests(run.network).length).toBeLessThanOrEqual(initialAssets + 1);
    await assertBoundaries(page, await inspect(page));
    await run.guard.assertClean();
    evidence.lifecycle = { initialAssets, finalAssets: staticAssetRequests(run.network).length, two };
  } finally {
    await run.session.cleanup();
  }
});
