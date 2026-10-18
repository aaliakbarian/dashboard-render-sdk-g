// POC / EXPERIMENT / NOT FOR PRODUCTION
import { expect, test, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

import { authenticateGrafanaFixture } from '../../e2e/support/grafanaAuth.ts';
import { installConsoleGuard } from '../../e2e/support/consoleGuard.ts';
import { captureResourceEvidence, installResourceEvidence } from '../../e2e/support/resourceEvidence.ts';
import {
  captureLifecycleListenerEvidence,
  captureLifecycleTimerEvidence,
  installLifecycleResourceEvidence,
  type LifecycleListenerSnapshot,
  type LifecycleTimerSnapshot,
} from './lifecycleResourceEvidence.ts';

const artifactRoot = 'artifacts/experiments/style-lifecycle';
const evidence: Record<string, unknown> = { generatedBy: 'style-lifecycle-browser-v1' };

type LifecycleCommand = 'closeAll' | 'mountPrimary' | 'refresh' | 'resize' | 'switchUidWithOpenModal' | 'timeRange' | 'togglePrimary' | 'toggleSecondary';

interface LifecycleInspection {
  readonly admission: Record<string, unknown>;
  readonly assetBasePath: string;
  readonly hostCache: { readonly inserted: number; readonly key: string; readonly tags: number };
  readonly hostSentinels?: Record<string, string>;
  readonly nonce: string;
  readonly profile: 'nested' | 'root';
  readonly provider: {
    readonly initEvents: string[];
    readonly provider: {
      readonly caches: Record<string, { readonly inserted: number; readonly key: string; readonly tags: number }>;
      readonly cohort: {
        readonly pluginEvents: Array<{ readonly pluginId?: string; readonly type: string }>;
        readonly queryEvents: Array<{ readonly panelId?: number; readonly state?: string; readonly type: string }>;
        readonly runtime: {
          readonly activeDashboardScopes: number;
          readonly activeLeases: number;
          readonly initializationSteps: string[];
          readonly moduleIdentities: Record<string, { readonly copies: number; readonly version: string }>;
          readonly portal: { readonly activeReferences: number };
        };
        readonly scenes: { readonly readyCount: number };
      };
      readonly portal: {
        readonly childCount: number;
        readonly controlledBodyChild: boolean;
        readonly directBodyFallbacks: number;
      };
    };
    readonly runtime: {
      readonly activeDashboardScopes: number;
      readonly activeLeases: number;
      readonly fingerprint?: string;
      readonly initializationSteps: string[];
      readonly moduleIdentities?: Record<string, { readonly copies: number; readonly version: string }>;
      readonly portal: { readonly activeReferences: number };
    };
  };
  readonly shadowRoots: number;
  readonly styles: {
    readonly emotionElements: number;
    readonly staticElements: number;
    readonly tags: Array<{ readonly dataEmotion: string; readonly nonce: string; readonly owner: string; readonly rules: number }>;
    readonly totalRules: number;
  };
  readonly zodJitless: boolean;
}

declare global {
  interface Window {
    __STYLE_LIFECYCLE_EXPERIMENT__: {
      command(command: LifecycleCommand): void;
      inspect(): LifecycleInspection;
      mountProvider(): void;
      probeIncompatibleRuntimeIdentity(): Promise<{ category: string; noEffects: Record<string, boolean> }>;
      unmountProvider(): void;
    };
    __STYLE_LIFECYCLE_CSP_VIOLATIONS__: Array<{ effectiveDirective: string; sourceFile: string }>;
  }
}

test.afterAll(async () => {
  await mkdir(artifactRoot, { recursive: true });
  await writeFile(`${artifactRoot}/browser-evidence.json`, `${JSON.stringify(evidence, null, 2)}\n`);
});

async function installCspCapture(page: Page) {
  await page.addInitScript(() => {
    window.__STYLE_LIFECYCLE_CSP_VIOLATIONS__ = [];
    document.addEventListener('securitypolicyviolation', (event) => {
      window.__STYLE_LIFECYCLE_CSP_VIOLATIONS__.push({
        effectiveDirective: event.effectiveDirective,
        sourceFile: event.sourceFile,
      });
    });
  });
}

async function inspect(page: Page) {
  return page.evaluate(() => window.__STYLE_LIFECYCLE_EXPERIMENT__.inspect());
}

async function command(page: Page, value: LifecycleCommand) {
  await page.evaluate((commandValue) => window.__STYLE_LIFECYCLE_EXPERIMENT__.command(commandValue), value);
}

async function memoryObservation(page: Page) {
  return page.evaluate(() => {
    const memory = (performance as Performance & {
      memory?: { readonly jsHeapSizeLimit: number; readonly totalJSHeapSize: number; readonly usedJSHeapSize: number };
    }).memory;
    return memory ? {
      jsHeapSizeLimit: memory.jsHeapSizeLimit,
      totalJSHeapSize: memory.totalJSHeapSize,
      usedJSHeapSize: memory.usedJSHeapSize,
    } : undefined;
  });
}

async function waitForPanels(page: Page, count = 1) {
  const text = page.getByRole('region', { name: 'Text — phase0' });
  const stat = page.getByRole('region', { name: 'Stat — predictable pulse' });
  const timeseries = page.getByRole('region', { name: 'Time series — predictable pulse' });
  await expect(text).toHaveCount(count, { timeout: 30_000 });
  await expect(stat).toHaveCount(count, { timeout: 30_000 });
  await expect(timeseries).toHaveCount(count, { timeout: 30_000 });
  await expect(timeseries.first().getByText('Phase 0 Pulse Signal')).toBeVisible();
  await expect(timeseries.first().locator('canvas')).not.toHaveCount(0);
}

async function waitForZeroDashboards(page: Page) {
  await expect(page.locator('[data-poc-dashboard-instance]')).toHaveCount(0);
  await expect.poll(async () => (await inspect(page)).provider.runtime.activeDashboardScopes).toBe(0);
  await expect.poll(async () => (await inspect(page)).provider.provider.portal.childCount).toBe(0);
  await page.waitForTimeout(100);
  await page.requestGC();
  await page.waitForTimeout(0);
}

async function open(page: Page, url = '/') {
  await installCspCapture(page);
  const session = await authenticateGrafanaFixture(page);
  const guard = await installConsoleGuard(page);
  await installResourceEvidence(page);
  await installLifecycleResourceEvidence(page);
  const requests: string[] = [];
  page.on('request', (request) => requests.push(new URL(request.url()).pathname));
  await page.goto(url);
  await waitForPanels(page);
  await page.evaluate(() => document.fonts.ready);
  return { guard, requests, session };
}

async function openWithoutPanelWait(page: Page, url: string) {
  await installCspCapture(page);
  const session = await authenticateGrafanaFixture(page);
  const guard = await installConsoleGuard(page);
  await installResourceEvidence(page);
  await installLifecycleResourceEvidence(page);
  const requests: string[] = [];
  page.on('request', (request) => requests.push(new URL(request.url()).pathname));
  await page.goto(url);
  await expect.poll(async () => page.evaluate(() => Boolean(window.__STYLE_LIFECYCLE_EXPERIMENT__))).toBe(true);
  return { guard, requests, session };
}

function structuralMetrics(
  state: LifecycleInspection,
  resource: Awaited<ReturnType<typeof captureResourceEvidence>>,
  listeners: LifecycleListenerSnapshot,
  timers?: LifecycleTimerSnapshot
) {
  return {
    abortControllers: resource.page.abortController,
    activeDashboardScopes: state.provider.runtime.activeDashboardScopes,
    activeLeases: state.provider.runtime.activeLeases,
    animationFrames: resource.page.animationFrame,
    emotionElements: state.styles.emotionElements,
    comparableEventListeners: listeners.activeComparable,
    listenerByTarget: listeners.byTarget,
    listenerByTargetType: listeners.byTargetType,
    detachedEventListenerRecords: listeners.detachedNodes,
    eventListenerRecords: resource.page.eventListener,
    instrumentationAbortListeners: listeners.instrumentationAbortListeners,
    fetches: resource.page.fetch,
    intervals: resource.page.interval,
    mutationObservers: resource.page.mutationObserver,
    portalChildren: state.provider.provider.portal.childCount,
    portalReferences: state.provider.runtime.portal.activeReferences,
    resizeObservers: resource.page.resizeObserver,
    styleElements: resource.dom.styleElements,
    subscriptions: resource.page.subscription,
    timeouts: resource.page.timeout,
    timerByDelay: timers?.byDelay ?? {},
    totalRules: state.styles.totalRules,
  };
}

async function assertBoundaries(page: Page, state: LifecycleInspection) {
  expect(state.provider.runtime.moduleIdentities).toMatchObject({
    react: { copies: 1, version: '19.2.8' },
    'react-dom': { copies: 1, version: '19.2.8' },
  });
  expect(state.provider.provider.portal).toMatchObject({ controlledBodyChild: true, directBodyFallbacks: 0 });
  expect(state.shadowRoots).toBe(0);
  expect(state.zodJitless).toBe(true);
  expect(state.styles.tags.every((tag) => tag.nonce === state.nonce), JSON.stringify(state.styles.tags)).toBe(true);
  await expect(page.locator('iframe')).toHaveCount(0);
  await expect(page.locator('grafana-app')).toHaveCount(0);
  await expect(page.getByRole('navigation')).toHaveCount(0);
  expect(await page.evaluate(() => window.__STYLE_LIFECYCLE_CSP_VIOLATIONS__)).toEqual([]);
}

test('initialization, single lifecycle, dormant state, remount, and incompatible identity remain coherent', async ({ page }) => {
  const run = await openWithoutPanelWait(page, '/?startDormant=1');
  try {
    await expect.poll(async () => (await inspect(page)).provider.runtime.activeLeases).toBe(1);
    await expect(page.locator('[data-poc-dashboard-instance]')).toHaveCount(0);
    const trueZeroDashboardBaseline = {
      listeners: await captureLifecycleListenerEvidence(page),
      resources: await captureResourceEvidence(page, 'pre-dashboard-provider-baseline'),
      state: await inspect(page),
      timers: await captureLifecycleTimerEvidence(page),
    };
    expect(trueZeroDashboardBaseline.state.provider.initEvents).not.toContain('dashboard-scene-ready');
    await command(page, 'mountPrimary');
    await waitForPanels(page);
    const initial = await inspect(page);
    expect(initial.provider.initEvents).toEqual([
      'host-csp-nonce-ready',
      'zod-jitless-ready',
      'host-emotion-cache-ready',
      'provider-admission-start',
      'provider-admission-complete',
      'zod-jitless-confirmed',
      'asset-base-validated',
      'provider-emotion-cache-ready',
      'grafana-provider-implementation-loaded',
      'datasource-query-and-panels-ready',
      'portal-root-acquired',
      'dashboard-scene-ready',
    ]);
    expect(initial.provider.runtime.initializationSteps).toEqual(expect.arrayContaining([
      'host-config-validated',
      'boot-data-installed',
      'asset-policy-installed',
      'grafana-cohort-loaded',
      'backend-transport-installed',
      'runtime-ready',
      'query-runtime-ready',
    ]));
    const initialSteps = initial.provider.runtime.initializationSteps;
    const queryCount = run.requests.filter((path) => path === '/grafana/api/ds/query').length;

    const refresh = page.waitForResponse((response) => response.url().includes('/grafana/api/ds/query') && response.ok());
    await command(page, 'refresh');
    await refresh;
    const ranged = page.waitForRequest((request) => {
      if (!request.url().includes('/grafana/api/ds/query')) return false;
      const body = request.postDataJSON() as { from?: string; to?: string };
      return Number(body.to) - Number(body.from) <= 910_000;
    });
    await command(page, 'timeRange');
    await ranged;
    await page.getByTestId('popover-trigger-portal-primary').click();
    await expect(page.getByTestId('popover-portal-primary')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByTestId('modal-trigger-portal-primary').click();
    await expect(page.getByRole('dialog', { name: 'Provider modal portal-primary' })).toBeVisible();
    await page.getByRole('dialog', { name: 'Provider modal portal-primary' }).getByRole('button', { name: 'Close modal', exact: true }).click();
    await command(page, 'switchUidWithOpenModal');
    await expect(page.getByRole('region', { name: 'Alternate Text sentinel' })).toContainText('phase0-alt');
    await command(page, 'switchUidWithOpenModal');
    await waitForPanels(page);
    await command(page, 'resize');

    await command(page, 'togglePrimary');
    await waitForZeroDashboards(page);
    const baselineState = await inspect(page);
    const baselineResource = await captureResourceEvidence(page, 'zero-dashboard-baseline');
    expect(baselineState.provider.runtime.activeLeases).toBe(1);
    expect(baselineState.provider.runtime.portal.activeReferences).toBe(0);
    expect(page.locator('#grafana-portal-container')).toHaveCount(1);
    expect(await page.locator('#grafana-portal-container').getAttribute('data-grsdk-references')).toBe('1');

    await command(page, 'mountPrimary');
    await waitForPanels(page);
    const remounted = await inspect(page);
    expect(remounted.provider.runtime.initializationSteps).toEqual(initialSteps);
    expect(remounted.provider.runtime.activeLeases).toBe(1);
    expect(remounted.hostSentinels).toEqual(initial.hostSentinels);
    expect(run.requests.filter((path) => path === '/grafana/api/ds/query').length).toBeGreaterThan(queryCount);

    const rejected = await page.evaluate(() => window.__STYLE_LIFECYCLE_EXPERIMENT__.probeIncompatibleRuntimeIdentity());
    expect(rejected.category).toBe('runtime-conflict');
    expect(Object.values(rejected.noEffects).every(Boolean)).toBe(true);

    await command(page, 'togglePrimary');
    await waitForZeroDashboards(page);
    const afterResource = await captureResourceEvidence(page, 'compatible-remount-released');
    const afterListeners = await captureLifecycleListenerEvidence(page);
    expect(structuralMetrics(await inspect(page), afterResource, afterListeners)).toMatchObject({
      activeDashboardScopes: 0,
      activeLeases: 1,
      portalChildren: 0,
      portalReferences: 0,
    });

    await page.evaluate(() => window.__STYLE_LIFECYCLE_EXPERIMENT__.unmountProvider());
    await expect(page.getByTestId('provider-unmounted')).toBeVisible();
    await expect.poll(async () => (await inspect(page)).provider.runtime.activeLeases).toBe(0);
    await expect(page.locator('#grafana-portal-container')).toHaveCount(0);
    await page.evaluate(() => window.__STYLE_LIFECYCLE_EXPERIMENT__.mountProvider());
    await expect.poll(async () => (await inspect(page)).provider.runtime.activeLeases).toBe(1);
    await command(page, 'mountPrimary');
    await waitForPanels(page);
    expect((await inspect(page)).provider.runtime.initializationSteps).toEqual(initialSteps);
    await command(page, 'togglePrimary');
    await waitForZeroDashboards(page);
    await assertBoundaries(page, await inspect(page));
    await run.guard.assertClean();
    evidence.singleLifecycle = {
      afterFullProviderRemount: await inspect(page),
      afterResource,
      baselineResource,
      initial,
      rejected,
      remounted,
      trueZeroDashboardBaseline,
    };
  } finally {
    await run.session.cleanup();
  }
});

test('twenty cycles, two-dashboard handoff, and compatible remount keep structural resources bounded', async ({ page }) => {
  const run = await open(page);
  try {
    const sentinel = (await inspect(page)).hostSentinels;
    await command(page, 'togglePrimary');
    await waitForZeroDashboards(page);

    const baselineState = await inspect(page);
    const baselineResource = await captureResourceEvidence(page, 'stress-baseline');
    const baselineListeners = await captureLifecycleListenerEvidence(page);
    const baselineTimers = await captureLifecycleTimerEvidence(page);
    const baseline = structuralMetrics(baselineState, baselineResource, baselineListeners, baselineTimers);
    const baselineMemory = await memoryObservation(page);
    const samples: Array<{ cycle: number; during: ReturnType<typeof structuralMetrics>; released: ReturnType<typeof structuralMetrics> }> = [];

    for (let cycle = 1; cycle <= 20; cycle += 1) {
      await command(page, 'mountPrimary');
      await waitForPanels(page);
      if (cycle % 5 === 0) {
        await command(page, 'switchUidWithOpenModal');
        await expect(page.getByRole('region', { name: 'Alternate Text sentinel' })).toBeVisible();
        await command(page, 'switchUidWithOpenModal');
        await waitForPanels(page);
      }
      await command(page, 'resize');
      if (cycle % 4 === 0) {
        await page.getByTestId('popover-trigger-portal-primary').click();
        await expect(page.getByTestId('popover-portal-primary')).toBeVisible();
        await page.keyboard.press('Escape');
      }
      const duringState = await inspect(page);
      const duringResource = await captureResourceEvidence(page, `stress-${cycle}-during`);
      const duringListeners = await captureLifecycleListenerEvidence(page);
      const duringTimers = await captureLifecycleTimerEvidence(page);
      await command(page, 'togglePrimary');
      await waitForZeroDashboards(page);
      const releasedState = await inspect(page);
      const releasedResource = await captureResourceEvidence(page, `stress-${cycle}-released`);
      const releasedListeners = await captureLifecycleListenerEvidence(page);
      const releasedTimers = await captureLifecycleTimerEvidence(page);
      samples.push({
        cycle,
        during: structuralMetrics(duringState, duringResource, duringListeners, duringTimers),
        released: structuralMetrics(releasedState, releasedResource, releasedListeners, releasedTimers),
      });
    }

    evidence.stressDiagnostic = { baseline, samples };
    for (const sample of samples) {
      expect(sample.released).toMatchObject({
        activeDashboardScopes: 0,
        activeLeases: baseline.activeLeases,
        emotionElements: baseline.emotionElements,
        portalChildren: 0,
        portalReferences: 0,
        resizeObservers: baseline.resizeObservers,
        styleElements: baseline.styleElements,
      });
      expect(sample.released.fetches).toBe(0);
    }

    for (const sample of samples.slice(0, 3)) {
      expect(sample.released.comparableEventListeners).toBe(baseline.comparableEventListeners);
    }
    const portalWarmBaseline = samples[3]!.released;
    expect(portalWarmBaseline.listenerByTarget['provider-portal-root']).toBeGreaterThan(0);
    for (const sample of samples.slice(3)) {
      expect(sample.released.comparableEventListeners).toBe(portalWarmBaseline.comparableEventListeners);
      expect(sample.released.listenerByTarget['provider-portal-root']).toBe(
        portalWarmBaseline.listenerByTarget['provider-portal-root']
      );
    }

    const warm = samples.slice(4).map(({ released }) => released);
    expect(Math.max(...warm.map(({ timeouts }) => timeouts)) - Math.min(...warm.map(({ timeouts }) => timeouts))).toBeLessThanOrEqual(12);
    expect(Math.max(...warm.map(({ animationFrames }) => animationFrames))).toBeLessThanOrEqual(1);
    expect(new Set(warm.map(({ styleElements }) => styleElements)).size).toBe(1);
    expect(new Set(warm.map(({ totalRules }) => totalRules)).size).toBe(1);

    await command(page, 'mountPrimary');
    await waitForPanels(page);
    await command(page, 'toggleSecondary');
    await waitForPanels(page, 2);
    await page.getByTestId('modal-trigger-portal-primary').click();
    await expect(page.getByRole('dialog', { name: 'Provider modal portal-primary' })).toBeVisible();
    const twoDashboardPeak = structuralMetrics(
      await inspect(page),
      await captureResourceEvidence(page, 'two-dashboard-peak'),
      await captureLifecycleListenerEvidence(page),
      await captureLifecycleTimerEvidence(page)
    );
    await command(page, 'togglePrimary');
    await waitForPanels(page, 1);
    await expect(page.locator('#root')).not.toHaveAttribute('inert', '');
    const afterDashboardAUnmount = structuralMetrics(
      await inspect(page),
      await captureResourceEvidence(page, 'dashboard-a-released'),
      await captureLifecycleListenerEvidence(page),
      await captureLifecycleTimerEvidence(page)
    );
    await page.getByTestId('popover-trigger-portal-secondary').click();
    await expect(page.getByTestId('popover-portal-secondary')).toBeVisible();
    await page.keyboard.press('Escape');
    await command(page, 'toggleSecondary');
    await waitForZeroDashboards(page);
    const afterAllDashboardsUnmount = structuralMetrics(
      await inspect(page),
      await captureResourceEvidence(page, 'all-dashboards-released'),
      await captureLifecycleListenerEvidence(page),
      await captureLifecycleTimerEvidence(page)
    );

    await command(page, 'mountPrimary');
    await waitForPanels(page);
    await expect(page.getByTestId('host-sentinel-button')).toBeVisible();
    expect((await inspect(page)).hostSentinels).toEqual(sentinel);
    await command(page, 'togglePrimary');
    await waitForZeroDashboards(page);

    await page.waitForTimeout(2_100);
    await page.requestGC();
    const settledState = await inspect(page);
    const settledResource = await captureResourceEvidence(page, 'stress-settled');
    const settledListeners = await captureLifecycleListenerEvidence(page);
    const settledTimers = await captureLifecycleTimerEvidence(page);
    const settled = structuralMetrics(settledState, settledResource, settledListeners, settledTimers);
    const settledMemory = await memoryObservation(page);
    expect(settled.timeouts).toBeLessThanOrEqual(baseline.timeouts);
    expect(settled.fetches).toBe(0);
    expect(settled.resizeObservers).toBe(0);
    expect(settled.portalChildren).toBe(0);
    expect(settled.portalReferences).toBe(0);

    const staticRequests = run.requests.filter((path) => /\.(?:css|svg|woff2)$/.test(path));
    const staticRequestCounts = new Map<string, number>();
    for (const path of staticRequests) staticRequestCounts.set(path, (staticRequestCounts.get(path) ?? 0) + 1);
    const duplicateStaticRequests = [...staticRequestCounts]
      .filter(([, count]) => count > 1)
      .map(([path, count]) => ({ count, path }));
    expect(duplicateStaticRequests).toEqual([]);
    await assertBoundaries(page, await inspect(page));
    await run.guard.assertClean();
    evidence.stress = {
      baseline,
      afterAllDashboardsUnmount,
      afterDashboardAUnmount,
      duplicateStaticRequests,
      memory: { baseline: baselineMemory, settled: settledMemory },
      samples,
      settled,
      staticRequests: [...new Set(staticRequests)].sort(),
      twoDashboardPeak,
    };
  } finally {
    await run.session.cleanup();
  }
});

test('controlled query, cancellation, slow-generation, portal-owner, and asset failures recover', async ({ page }) => {
  let queryFailures = 2;
  await page.route('**/grafana/api/ds/query', async (route) => {
    if (queryFailures > 0) {
      queryFailures -= 1;
      await route.fulfill({ body: '{"message":"controlled query failure"}', contentType: 'application/json', status: 500 });
    } else await route.continue();
  });
  const run = await open(page);
  try {
    await page.unroute('**/grafana/api/ds/query');
    const recoveredQuery = page.waitForResponse((response) => response.url().includes('/grafana/api/ds/query') && response.ok());
    await command(page, 'refresh');
    await recoveredQuery;
    await waitForPanels(page);

    let failedAssetRequests = 0;
    await page.route('**/style-lifecycle-provider/build/img/icons/unicons/times.svg', (route) => {
      failedAssetRequests += 1;
      return route.abort('failed');
    });
    await page.getByTestId('modal-trigger-portal-primary').click();
    await expect(page.getByRole('dialog', { name: 'Provider modal portal-primary' })).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Provider modal portal-primary' }).getByRole('button', { name: 'Close modal', exact: true })).toBeVisible();
    await page.getByRole('dialog', { name: 'Provider modal portal-primary' }).getByRole('button', { name: 'Close modal', exact: true }).click();
    expect(failedAssetRequests).toBeGreaterThan(0);
    await page.unroute('**/style-lifecycle-provider/build/img/icons/unicons/times.svg');

    await page.getByTestId('modal-trigger-portal-primary').click();
    await expect(page.getByRole('dialog', { name: 'Provider modal portal-primary' })).toBeVisible();
    await command(page, 'togglePrimary');
    await waitForZeroDashboards(page);
    await expect(page.locator('#root')).not.toHaveAttribute('inert', '');
    await command(page, 'mountPrimary');
    await waitForPanels(page);

    let delayed = true;
    await page.route('**/grafana/api/ds/query', async (route) => {
      if (delayed) {
        delayed = false;
        await new Promise((resolve) => setTimeout(resolve, 800));
      }
      await route.continue();
    });
    await command(page, 'refresh');
    await command(page, 'switchUidWithOpenModal');
    await expect(page.getByRole('region', { name: 'Alternate Text sentinel' })).toBeVisible();
    await page.waitForTimeout(1_000);
    await expect(page.getByRole('region', { name: 'Stat — predictable pulse' })).toHaveCount(0);
    await page.unroute('**/grafana/api/ds/query');
    await command(page, 'switchUidWithOpenModal');
    await waitForPanels(page);

    let dashboardRequestReleased = false;
    await page.route('**/dashboards/grsdk-phase0-poc-alt/dto', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 800));
      dashboardRequestReleased = true;
      await route.continue();
    });
    await command(page, 'switchUidWithOpenModal');
    await command(page, 'togglePrimary');
    await waitForZeroDashboards(page);
    await expect.poll(() => dashboardRequestReleased).toBe(true);
    await expect(page.locator('[data-poc-dashboard-instance]')).toHaveCount(0);
    await page.unroute('**/dashboards/grsdk-phase0-poc-alt/dto');
    await command(page, 'mountPrimary');
    await expect(page.getByRole('region', { name: 'Alternate Text sentinel' })).toBeVisible();
    await command(page, 'switchUidWithOpenModal');
    await waitForPanels(page);

    await expect(page.getByRole('region', { name: 'Time series — predictable pulse' })).toBeVisible();

    await command(page, 'togglePrimary');
    await waitForZeroDashboards(page);
    await command(page, 'mountPrimary');
    await waitForPanels(page);
    await assertBoundaries(page, await inspect(page));
    evidence.failureRecovery = {
      cases: [
        'query-http-failure',
        'asset-load-failure',
        'portal-owner-unmount',
        'uid-replacement-during-slow-query',
        'dashboard-load-cancellation',
      ],
      dashboardRequestReleased,
      failedAssetRequests,
      queryFailuresRemaining: queryFailures,
      state: await inspect(page),
    };
  } finally {
    await run.session.cleanup();
  }
});

test('a controlled panel-loader failure is isolated and a compatible provider remount retries', async ({ page }) => {
  const run = await openWithoutPanelWait(page, '/?failPanel=timeseries');
  try {
    await expect(page.getByTestId('runtime-error')).toContainText('controlled-panel-load-failure');
    await expect(page.getByRole('region', { name: 'Text — phase0' })).toHaveCount(0);
    await page.evaluate(() => window.__STYLE_LIFECYCLE_EXPERIMENT__.unmountProvider());
    await expect(page.getByTestId('provider-unmounted')).toBeVisible();
    await page.evaluate(() => window.__STYLE_LIFECYCLE_EXPERIMENT__.mountProvider());
    await waitForPanels(page);
    await assertBoundaries(page, await inspect(page));
    evidence.panelFailureRecovery = {
      controlledFailure: 'style-lifecycle.controlled-panel-load-failure',
      retry: 'compatible-provider-remount',
      state: await inspect(page),
    };
  } finally {
    await run.session.cleanup();
  }
});

test('nested deployment preserves the same local, CSP, host-CSS, and lifecycle boundary', async ({ page }) => {
  const blocked: string[] = [];
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') await route.continue();
    else {
      blocked.push(`${url.protocol}//${url.host}${url.pathname}`);
      await route.abort('blockedbyclient');
    }
  });
  const run = await open(page, 'http://localhost:5197/app/sdk/');
  try {
    const state = await inspect(page);
    expect(state.profile).toBe('nested');
    expect(state.assetBasePath).toBe('/app/sdk/style-lifecycle-provider/');
    expect(blocked).toEqual([]);
    await command(page, 'togglePrimary');
    await waitForZeroDashboards(page);
    await command(page, 'mountPrimary');
    await waitForPanels(page);
    await assertBoundaries(page, await inspect(page));
    await run.guard.assertClean();
    evidence.nested = { blocked, state };
  } finally {
    await run.session.cleanup();
  }
});
