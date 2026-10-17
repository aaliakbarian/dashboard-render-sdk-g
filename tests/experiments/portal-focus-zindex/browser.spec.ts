// POC / EXPERIMENT / NOT FOR PRODUCTION
import { expect, test, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

import { authenticateGrafanaFixture } from '../../e2e/support/grafanaAuth.ts';
import { installConsoleGuard } from '../../e2e/support/consoleGuard.ts';
import { captureResourceEvidence, installResourceEvidence } from '../../e2e/support/resourceEvidence.ts';

const artifactRoot = 'artifacts/experiments/portal-focus-zindex';
const evidence: Record<string, unknown> = { generatedBy: 'portal-focus-zindex-browser-v1' };

interface Inspection {
  readonly admission: Record<string, boolean>;
  readonly hostCache: { inserted: number; key: string; tags: number };
  readonly provider: {
    readonly cacheObjectsDistinct: Record<string, boolean>;
    readonly caches: Record<string, { inserted: number; key: string; tags: number }>;
    readonly cohort: {
      readonly pluginEvents: Array<{ pluginId?: string; type: string }>;
      readonly runtime: {
        readonly activeDashboardScopes: number;
        readonly moduleIdentities: Record<string, { copies: number; version: string }>;
        readonly portal: { activeReferences: number; ownsRoot: boolean };
      };
    };
    readonly events: { nativeDocument: number; outside: number; providerSynthetic: number };
    readonly policy: { band: { portal: number; popover: number; modal: number; nested: number }; model: string };
    readonly portal: {
      childCount: number;
      controlledBodyChild: boolean;
      directBodyFallbacks: number;
      owners: string[];
      root?: { provider: string; runtime: string; surface: string };
    };
  };
  readonly styleTags: Array<{ dataEmotion: string; rules: number }>;
}

declare global {
  interface Window {
    __PORTAL_FOCUS_EXPERIMENT__: {
      command(command: 'closeAll' | 'mountPrimary' | 'resize' | 'switchUidWithOpenModal' | 'togglePrimary' | 'toggleSecondary'): void;
      inspect(): Inspection;
      mountProvider(): void;
      unmountProvider(): void;
    };
  }
}

test.afterAll(async () => {
  await mkdir(artifactRoot, { recursive: true });
  await writeFile(`${artifactRoot}/browser-evidence.json`, `${JSON.stringify(evidence, null, 2)}\n`);
});

async function inspect(page: Page) {
  return page.evaluate(() => window.__PORTAL_FOCUS_EXPERIMENT__.inspect());
}

async function command(page: Page, value: Parameters<Window['__PORTAL_FOCUS_EXPERIMENT__']['command']>[0]) {
  await page.evaluate((commandValue) => window.__PORTAL_FOCUS_EXPERIMENT__.command(commandValue), value);
}

async function waitForPanels(page: Page, count = 1) {
  await expect(page.getByRole('region', { name: 'Text — phase0' })).toHaveCount(count, { timeout: 30_000 });
  await expect(page.getByRole('region', { name: 'Stat — predictable pulse' })).toHaveCount(count, { timeout: 30_000 });
  await expect(page.getByRole('region', { name: 'Time series — predictable pulse' })).toHaveCount(count, { timeout: 30_000 });
  await expect(page.getByRole('region', { name: 'Time series — predictable pulse' }).first().locator('canvas')).not.toHaveCount(0, { timeout: 30_000 });
}

async function open(page: Page, model = 'host-base') {
  const session = await authenticateGrafanaFixture(page);
  const guard = await installConsoleGuard(page);
  await installResourceEvidence(page);
  const pageErrors: string[] = [];
  const requests: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.stack ?? error.message));
  page.on('request', (request) => requests.push(new URL(request.url()).pathname));
  await page.goto(`/?model=${model}`);
  await waitForPanels(page);
  return { guard, pageErrors, requests, session };
}

async function assertCoreBoundaries(page: Page, state: Inspection) {
  expect(state.admission).toEqual(expect.objectContaining({
    jsxDevRuntimeIdentity: true,
    jsxRuntimeIdentity: true,
    reactDomIdentity: true,
    reactIdentity: true,
  }));
  expect(state.provider.cohort.runtime.moduleIdentities).toMatchObject({
    react: { copies: 1, version: '19.2.8' },
    'react-dom': { copies: 1, version: '19.2.8' },
  });
  expect(state.provider.portal).toMatchObject({
    controlledBodyChild: true,
    directBodyFallbacks: 0,
    root: { provider: 'grafana-13.2.3', runtime: 'portal-focus-zindex-v1', surface: 'portal' },
  });
  expect(state.provider.cacheObjectsDistinct).toEqual({
    hostVsProvider: true,
    hostVsProviderCss: true,
    providerVsProviderCss: true,
  });
  await expect(page.locator('iframe')).toHaveCount(0);
  await expect(page.locator('grafana-app')).toHaveCount(0);
  await expect(page.getByRole('navigation')).toHaveCount(0);
}

test('controlled portal preserves context, Emotion, and distinct event semantics for non-modal content', async ({ page }) => {
  const run = await open(page);
  try {
    const trigger = page.getByTestId('popover-trigger-portal-primary');
    await trigger.focus();
    await trigger.click();
    const popover = page.getByTestId('popover-portal-primary');
    await expect(popover).toBeVisible();
    await expect(trigger).toBeFocused();
    await expect(popover).toHaveAttribute('data-context-value', 'context-portal-primary');
    await expect(popover).not.toHaveAttribute('aria-modal', 'true');
    expect(await page.locator('#root').evaluate((element) => (element as HTMLElement).inert)).toBe(false);

    const before = await inspect(page);
    await page.getByTestId('popover-action-portal-primary').click();
    const after = await inspect(page);
    expect(after.provider.events.providerSynthetic).toBeGreaterThan(before.provider.events.providerSynthetic);
    expect(after.provider.events.nativeDocument).toBeGreaterThan(before.provider.events.nativeDocument);
    await expect(page.getByTestId('host-action-count')).toHaveText('0');

    await page.getByTestId('host-action').click();
    await expect(popover).toHaveCount(0);
    await expect(page.getByTestId('host-action-count')).toHaveText('1');
    const outside = await inspect(page);
    expect(outside.provider.events.outside).toBeGreaterThan(after.provider.events.outside);
    await assertCoreBoundaries(page, outside);
    expect(run.requests.filter((path) => path === '/grafana/api/ds/query').length).toBeGreaterThanOrEqual(2);
    expect(run.pageErrors).toEqual([]);
    await run.guard.assertClean();
    evidence.nonModal = { after, before, outside };
  } finally {
    await run.session.cleanup();
  }
});

test('real Grafana Modal satisfies the tested keyboard, focus, ARIA, and return-focus contract', async ({ page }) => {
  const run = await open(page);
  try {
    const trigger = page.getByTestId('modal-trigger-portal-primary');
    await trigger.click();
    const modalDiagnostic = await page.evaluate(() => ({
      contentCount: document.querySelectorAll('[data-testid="modal-content-portal-primary"]').length,
      dialogCount: document.querySelectorAll('[role="dialog"]').length,
      hostAriaHidden: document.getElementById('root')?.getAttribute('aria-hidden'),
      hostInert: document.getElementById('root')?.inert,
      portalChildCount: document.getElementById('grafana-portal-container')?.childElementCount,
      portalHidden: document.getElementById('grafana-portal-container')?.getAttribute('aria-hidden'),
    }));
    expect(run.pageErrors).toEqual([]);
    expect(modalDiagnostic).toMatchObject({ contentCount: 1, dialogCount: 1, portalHidden: null });
    const dialog = page.getByRole('dialog', { name: 'Provider modal portal-primary' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(await page.locator('#root').evaluate((element) => (element as HTMLElement).inert)).toBe(true);
    expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
    await expect(dialog.getByRole('button', { name: 'Close' }).first()).toBeVisible();

    const forward: string[] = [];
    for (let index = 0; index < 5; index += 1) {
      await page.keyboard.press('Tab');
      forward.push(await page.evaluate(() => (document.activeElement as HTMLElement | null)?.getAttribute('data-testid') ?? (document.activeElement as HTMLElement | null)?.getAttribute('aria-label') ?? 'unknown'));
      expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
    }
    await page.keyboard.press('Shift+Tab');
    expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
    expect(await page.locator('#root').evaluate((element) => (element as HTMLElement).inert)).toBe(false);
    expect(run.pageErrors).toEqual([]);
    await run.guard.assertClean();
    evidence.modal = { forward, modalDiagnostic, state: await inspect(page) };
  } finally {
    await run.session.cleanup();
  }
});

test('UID replacement and owner unmount use deterministic focus fallback and preserve compatible owners', async ({ page }) => {
  const run = await open(page);
  try {
    await page.getByTestId('modal-trigger-portal-primary').click();
    await command(page, 'switchUidWithOpenModal');
    await expect(page.getByRole('region', { name: 'Alternate Text sentinel' })).toContainText('phase0-alt');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByTestId('portal-provider-surface')).toBeFocused();

    await command(page, 'switchUidWithOpenModal');
    await waitForPanels(page);
    await command(page, 'toggleSecondary');
    await waitForPanels(page, 2);
    await page.getByTestId('popover-trigger-portal-primary').click();
    await page.getByTestId('popover-trigger-portal-secondary').click();
    await expect(page.getByTestId('popover-portal-primary')).toBeVisible();
    await expect(page.getByTestId('popover-portal-secondary')).toBeVisible();
    await command(page, 'togglePrimary');
    await expect(page.getByTestId('popover-portal-primary')).toHaveCount(0);
    await expect(page.getByTestId('popover-portal-secondary')).toBeVisible();
    const oneOwner = await inspect(page);
    expect(oneOwner.provider.cohort.runtime.portal.activeReferences).toBe(1);
    expect(oneOwner.provider.portal.owners).toContain('portal-secondary');

    await page.getByTestId('modal-trigger-portal-secondary').click();
    await command(page, 'toggleSecondary');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByTestId('portal-provider-surface')).toBeFocused();
    await expect(page.locator('#grafana-portal-container')).toHaveCount(1);
    await expect(page.locator('#grafana-portal-container')).toBeEmpty();
    expect((await inspect(page)).provider.cohort.runtime.portal.activeReferences).toBe(0);
    expect(run.pageErrors).toEqual([]);
    await run.guard.assertClean();
    evidence.focusFallback = { oneOwner, released: await inspect(page) };
  } finally {
    await run.session.cleanup();
  }
});

test('bounded nested modal to popover closes the top logical surface first', async ({ page }) => {
  const run = await open(page);
  try {
    await page.getByTestId('modal-trigger-portal-primary').click();
    const dialog = page.getByRole('dialog', { name: 'Provider modal portal-primary' });
    await page.getByTestId('nested-trigger-portal-primary').click();
    const nested = page.getByTestId('nested-overlay-portal-primary');
    await expect(nested).toBeVisible();
    const nestedZ = Number.parseInt(await nested.evaluate((element) => getComputedStyle(element).zIndex), 10);
    expect(nestedZ).toBe((await inspect(page)).provider.policy.band.nested);
    await page.keyboard.press('Escape');
    await expect(nested).toHaveCount(0);
    await expect(dialog).toBeVisible();
    await expect(page.getByTestId('nested-trigger-portal-primary')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await run.guard.assertClean();
    evidence.nested = { nestedZ };
  } finally {
    await run.session.cleanup();
  }
});

test('overlay policy matrix is measurable across host stacking contexts and escapes dashboard clipping', async ({ context }) => {
  const matrix: Record<string, unknown> = {};
  for (const model of ['fixed', 'provider-token', 'host-base'] as const) {
    const page = await context.newPage();
    const run = await open(page, model);
    try {
      await page.getByTestId('popover-trigger-portal-primary').click();
      const state = await inspect(page);
      const geometry = await page.evaluate(() => {
        const portal = document.getElementById('grafana-portal-container')!;
        const overlay = document.querySelector<HTMLElement>('[data-testid="popover-portal-primary"]')!;
        const owner = document.querySelector<HTMLElement>('[data-testid="dashboard-owner-portal-primary"]')!;
        const style = (testId: string) => {
          const element = document.querySelector<HTMLElement>(`[data-testid="${testId}"]`)!;
          const computed = getComputedStyle(element);
          return { isolation: computed.isolation, opacity: computed.opacity, transform: computed.transform, zIndex: computed.zIndex };
        };
        return {
          hostHigh: style('host-overlay-high'),
          hostLow: style('host-overlay-low'),
          opacity: style('host-opacity-context'),
          overlayRect: overlay.getBoundingClientRect().toJSON(),
          ownerRect: owner.getBoundingClientRect().toJSON(),
          portalParent: portal.parentElement === document.body ? 'body' : 'other',
          portalZ: getComputedStyle(portal).zIndex,
          positioned: style('host-positioned-context'),
          transform: style('host-transform-context'),
        };
      });
      expect(geometry.portalParent).toBe('body');
      expect(Number.parseInt(geometry.portalZ, 10)).toBe(state.provider.policy.band.portal);
      expect(geometry.overlayRect.top).toBeLessThan(geometry.ownerRect.top);
      expect(state.provider.portal.directBodyFallbacks).toBe(0);
      matrix[model] = { geometry, policy: state.provider.policy };
      expect(run.pageErrors).toEqual([]);
      await run.guard.assertClean();
    } finally {
      await run.session.cleanup();
      await page.close();
    }
  }
  evidence.stackingMatrix = matrix;
});

test('resize, provider unmount, and remount leave bounded styles and resources', async ({ page }) => {
  const run = await open(page);
  try {
    const legend = page.getByRole('region', { name: 'Time series — predictable pulse' }).getByRole('button', { name: 'All series selected' });
    const legendBefore = await legend.evaluate((element) => ({ padding: getComputedStyle(element).padding, border: getComputedStyle(element).borderWidth }));
    const stylesBefore = (await inspect(page)).styleTags;
    const plot = page.getByRole('region', { name: 'Time series — predictable pulse' }).locator('.uplot');
    const widthBefore = (await plot.boundingBox())?.width ?? 0;
    await command(page, 'resize');
    await expect.poll(async () => (await plot.boundingBox())?.width ?? 0).toBeLessThan(widthBefore - 50);
    await page.evaluate(() => window.__PORTAL_FOCUS_EXPERIMENT__.unmountProvider());
    await expect(page.getByTestId('provider-unmounted')).toBeVisible();
    await expect(page.locator('#grafana-portal-container')).toHaveCount(0);
    await expect.poll(async () => Object.values((await captureResourceEvidence(page, 'portal-provider-released')).instance).every((count) => count === 0)).toBe(true);
    await page.evaluate(() => window.__PORTAL_FOCUS_EXPERIMENT__.mountProvider());
    await waitForPanels(page);
    const stylesAfter = (await inspect(page)).styleTags;
    expect(stylesAfter.length).toBe(stylesBefore.length);
    const legendAfter = await page.getByRole('region', { name: 'Time series — predictable pulse' }).getByRole('button', { name: 'All series selected' })
      .evaluate((element) => ({ padding: getComputedStyle(element).padding, border: getComputedStyle(element).borderWidth }));
    expect(legendAfter).toEqual(legendBefore);
    expect(run.pageErrors).toEqual([]);
    await run.guard.assertClean();
    evidence.lifecycle = { legendAfter, legendBefore, stylesAfter, stylesBefore, widthBefore };
  } finally {
    await run.session.cleanup();
  }
});
