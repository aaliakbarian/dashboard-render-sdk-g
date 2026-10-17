// POC / EXPERIMENT / NOT FOR PRODUCTION
import { expect, test, type Page, type Response } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

import { authenticateGrafanaFixture } from '../../e2e/support/grafanaAuth.ts';
import { installConsoleGuard } from '../../e2e/support/consoleGuard.ts';
import { captureResourceEvidence, installResourceEvidence } from '../../e2e/support/resourceEvidence.ts';

const artifactRoot = 'artifacts/experiments/strict-csp';
const evidence: Record<string, unknown> = { generatedBy: 'strict-csp-browser-v1' };

interface CspViolation {
  readonly blockedURI: string;
  readonly disposition: string;
  readonly effectiveDirective: string;
  readonly sample: string;
  readonly sourceFile: string;
  readonly violatedDirective: string;
}

interface StrictCspInspection {
  readonly admission: Record<string, unknown>;
  readonly assetBasePath: string;
  readonly nonce: string;
  readonly profile: 'nested' | 'root';
  readonly styles: Array<{
    readonly dataEmotion: string;
    readonly nonce: string;
    readonly owner: string;
    readonly rules: number;
  }>;
  readonly font: { readonly medium: boolean; readonly regular: boolean };
  readonly inlineEventAttributes: string[];
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
  readonly zodJitless: boolean;
}

declare global {
  interface Window {
    __STRICT_CSP_EXPERIMENT__: {
      command(command: 'resize' | 'switchUidWithOpenModal' | 'togglePrimary' | 'toggleSecondary'): void;
      inspect(): StrictCspInspection;
      mountProvider(): void;
      unmountProvider(): void;
    };
    __STRICT_CSP_VIOLATIONS__: CspViolation[];
  }
}

test.afterAll(async () => {
  await mkdir(artifactRoot, { recursive: true });
  await writeFile(`${artifactRoot}/browser-evidence.json`, `${JSON.stringify(evidence, null, 2)}\n`);
});

async function installViolationCapture(page: Page) {
  await page.addInitScript(() => {
    window.__STRICT_CSP_VIOLATIONS__ = [];
    document.addEventListener('securitypolicyviolation', (event) => {
      window.__STRICT_CSP_VIOLATIONS__.push({
        blockedURI: event.blockedURI,
        disposition: event.disposition,
        effectiveDirective: event.effectiveDirective,
        sample: event.sample,
        sourceFile: event.sourceFile,
        violatedDirective: event.violatedDirective,
      });
    });
  });
}

async function violations(page: Page) {
  return page.evaluate(() => structuredClone(window.__STRICT_CSP_VIOLATIONS__ ?? []));
}

async function inspect(page: Page) {
  return page.evaluate(() => window.__STRICT_CSP_EXPERIMENT__.inspect());
}

async function command(page: Page, value: Parameters<Window['__STRICT_CSP_EXPERIMENT__']['command']>[0]) {
  await page.evaluate((commandValue) => window.__STRICT_CSP_EXPERIMENT__.command(commandValue), value);
}

async function waitForPanels(page: Page, count = 1) {
  const text = page.getByRole('region', { name: 'Text — phase0' });
  const stat = page.getByRole('region', { name: 'Stat — predictable pulse' });
  const timeseries = page.getByRole('region', { name: 'Time series — predictable pulse' });
  await expect(text).toHaveCount(count, { timeout: 30_000 });
  await expect(text.first()).toContainText('Native phase0 Text fixture for phase0.');
  await expect(stat).toHaveCount(count, { timeout: 30_000 });
  await expect(timeseries).toHaveCount(count, { timeout: 30_000 });
  await expect(timeseries.first().getByText('Phase 0 Pulse Signal')).toBeVisible();
  await expect(timeseries.first().locator('canvas')).not.toHaveCount(0);
}

function assertStrictHeader(response: Response | null, nonce: string) {
  const policy = response?.headers()['content-security-policy'] ?? '';
  expect(policy).toContain("default-src 'none'");
  expect(policy).toContain("script-src 'self' 'report-sample'");
  expect(policy).toContain("script-src-attr 'none'");
  expect(policy).toContain(`style-src 'self' 'nonce-${nonce}'`);
  expect(policy).toContain(`style-src-elem 'self' 'nonce-${nonce}'`);
  expect(policy).toContain("style-src-attr 'none'");
  expect(policy).toContain("font-src 'self'");
  expect(policy).toContain("img-src 'self'");
  expect(policy).toContain("connect-src 'self'");
  expect(policy).not.toContain('unsafe-eval');
  expect(policy).not.toContain('unsafe-inline');
  expect(policy).not.toMatch(/script-src[^;]*unsafe-inline/);
  expect(policy).not.toMatch(/https?:|data:|blob:/);
  return policy;
}

async function assertProviderBoundaries(page: Page, state: StrictCspInspection) {
  expect(state.provider.cohort.runtime.moduleIdentities).toMatchObject({
    react: { copies: 1, version: '19.2.8' },
    'react-dom': { copies: 1, version: '19.2.8' },
  });
  expect(state.provider.portal).toMatchObject({ controlledBodyChild: true, directBodyFallbacks: 0 });
  expect(state.zodJitless).toBe(true);
  expect(state.inlineEventAttributes).toEqual([]);
  await expect(page.locator('iframe')).toHaveCount(0);
  await expect(page.locator('grafana-app')).toHaveCount(0);
  await expect(page.getByRole('navigation')).toHaveCount(0);
}

async function open(page: Page, url: string) {
  await installViolationCapture(page);
  const session = await authenticateGrafanaFixture(page);
  const guard = await installConsoleGuard(page);
  await installResourceEvidence(page);
  const requests: string[] = [];
  page.on('request', (request) => requests.push(new URL(request.url()).pathname));
  const response = await page.goto(url);
  await waitForPanels(page);
  await page.evaluate(() => document.fonts.ready);
  return { guard, requests, response, session };
}

test('root production build renders real provider behavior with zero CSP violations', async ({ page }) => {
  const run = await open(page, '/');
  try {
    await page.getByTestId('popover-trigger-portal-primary').click();
    await expect(page.getByTestId('popover-portal-primary')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByTestId('modal-trigger-portal-primary').click();
    await expect(page.getByRole('dialog', { name: 'Provider modal portal-primary' })).toBeVisible();
    const state = await inspect(page);
    const policy = assertStrictHeader(run.response, state.nonce);
    expect(state.profile).toBe('root');
    expect(state.assetBasePath).toBe('/strict-csp-provider/');
    expect(state.font).toEqual({ medium: true, regular: true });
    expect(state.styles.map((style) => style.owner).sort()).toEqual(expect.arrayContaining(['host-react', 'provider-css', 'provider-react']));
    expect(state.styles.every((style) => style.nonce === state.nonce), JSON.stringify(state.styles)).toBe(true);
    expect(run.requests).toContain('/grafana/api/ds/query');
    expect(run.requests).toContain('/csp-prelude.js');
    expect(run.requests.some((path) => /Inter-Regular-.*\.woff2$/.test(path))).toBe(true);
    expect(run.requests.some((path) => path.endsWith('/strict-csp-provider/build/img/icons/unicons/times.svg'))).toBe(true);
    expect(await violations(page)).toEqual([]);
    await expect(page.locator('script:not([src])')).toHaveCount(0);
    await expect(page.locator('#grafana-portal-container')).toHaveAttribute('style', /--grsdk-overlay-portal/);
    await assertProviderBoundaries(page, state);
    await run.guard.assertClean();
    evidence.root = { policy, requests: [...new Set(run.requests)].sort(), state, violations: [] };
  } finally {
    await run.session.cleanup();
  }
});

test('nested and offline profiles retain the same strict local-only contract', async ({ page }) => {
  const blocked: string[] = [];
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') await route.continue();
    else {
      blocked.push(`${url.protocol}//${url.host}${url.pathname}`);
      await route.abort('blockedbyclient');
    }
  });
  const run = await open(page, 'http://localhost:5193/app/sdk/');
  try {
    const state = await inspect(page);
    const policy = assertStrictHeader(run.response, state.nonce);
    expect(state.profile).toBe('nested');
    expect(state.assetBasePath).toBe('/app/sdk/strict-csp-provider/');
    expect(blocked).toEqual([]);
    expect(run.requests.filter((path) => !path.startsWith('/grafana/')).every((path) => path === '/app/sdk/' || path.startsWith('/app/sdk/'))).toBe(true);
    expect(await violations(page)).toEqual([]);
    await assertProviderBoundaries(page, state);
    await run.guard.assertClean();
    evidence.nestedOffline = { blocked, policy, requests: [...new Set(run.requests)].sort(), state };
  } finally {
    await run.session.cleanup();
  }
});

test('enforcement rejects every unauthorized harness probe without weakening the provider policy', async ({ page }) => {
  await installViolationCapture(page);
  const session = await authenticateGrafanaFixture(page);
  const consoleMessages: string[] = [];
  page.on('console', (message) => {
    if (/Content Security Policy/i.test(message.text())) consoleMessages.push(message.text());
  });
  try {
    const response = await page.goto('/');
    await waitForPanels(page);
    const state = await inspect(page);
    assertStrictHeader(response, state.nonce);
    await page.getByTestId('csp-eval-probe').click();
    const results = await page.evaluate(async (nonce) => {
      const target = document.createElement('div');
      target.id = 'csp-negative-style-target';
      document.body.append(target);

      const wrongStyle = document.createElement('style');
      wrongStyle.nonce = 'wrongNonce123456789';
      wrongStyle.textContent = '#csp-negative-style-target { color: rgb(1, 2, 3); }';
      document.head.append(wrongStyle);

      const inlineStyle = document.createElement('div');
      inlineStyle.id = 'csp-negative-style-attribute';
      inlineStyle.setAttribute('style', 'color: rgb(4, 5, 6)');
      document.body.append(inlineStyle);

      (window as typeof window & { __cspInlineScriptRan?: boolean }).__cspInlineScriptRan = false;
      const script = document.createElement('script');
      script.textContent = 'window.__cspInlineScriptRan = true';
      document.body.append(script);

      const inlineHandler = document.createElement('button');
      inlineHandler.setAttribute('onclick', 'window.__cspInlineHandlerRan = true');
      document.body.append(inlineHandler);
      inlineHandler.click();

      const image = document.createElement('img');
      const imageSettled = new Promise<void>((resolve) => {
        image.addEventListener('error', () => resolve(), { once: true });
        image.addEventListener('load', () => resolve(), { once: true });
      });
      image.src = 'https://example.invalid/grsdk-csp-image.svg';
      document.body.append(image);

      const fontStyle = document.createElement('style');
      fontStyle.nonce = nonce;
      fontStyle.textContent = '@font-face{font-family:GrsdkBlocked;src:url(https://example.invalid/grsdk-csp-font.woff2)}';
      document.head.append(fontStyle);
      const fontProbe = document.createElement('span');
      fontProbe.style.fontFamily = 'GrsdkBlocked';
      fontProbe.textContent = 'font probe';
      document.body.append(fontProbe);

      let connectRejected = false;
      try { await fetch('https://example.invalid/grsdk-csp-connect'); } catch { connectRejected = true; }
      const evalRejected = document.body.dataset.cspEvalRejected === 'true';
      await Promise.allSettled([imageSettled, document.fonts.load('12px GrsdkBlocked')]);
      await new Promise((resolve) => setTimeout(resolve, 100));

      return {
        connectRejected,
        evalRejected,
        inlineHandlerRan: Boolean((window as typeof window & { __cspInlineHandlerRan?: boolean }).__cspInlineHandlerRan),
        inlineScriptRan: Boolean((window as typeof window & { __cspInlineScriptRan?: boolean }).__cspInlineScriptRan),
        inlineStyleAttributeApplied: getComputedStyle(inlineStyle).color === 'rgb(4, 5, 6)',
        wrongStyleApplied: getComputedStyle(target).color === 'rgb(1, 2, 3)',
      };
    }, state.nonce);
    expect(results).toEqual({
      connectRejected: true,
      evalRejected: true,
      inlineHandlerRan: false,
      inlineScriptRan: false,
      inlineStyleAttributeApplied: false,
      wrongStyleApplied: false,
    });
    await expect.poll(async () => new Set((await violations(page)).map((entry) => entry.effectiveDirective)).size).toBeGreaterThanOrEqual(6);
    const observed = await violations(page);
    for (const directive of ['connect-src', 'font-src', 'img-src', 'script-src', 'script-src-attr', 'style-src-elem']) {
      expect(observed.some((entry) => entry.effectiveDirective === directive), directive).toBe(true);
    }
    expect(observed.every((entry) => entry.disposition === 'enforce')).toBe(true);
    evidence.negative = { consoleMessageCount: consoleMessages.length, observed, results };
  } finally {
    await session.cleanup();
  }
});

test('UID, resize, two dashboards, portals, unmount, and remount remain violation-free', async ({ page }) => {
  const run = await open(page, '/');
  try {
    await command(page, 'switchUidWithOpenModal');
    await expect(page.getByRole('region', { name: 'Alternate Text sentinel' })).toContainText('phase0-alt');
    await command(page, 'switchUidWithOpenModal');
    await waitForPanels(page);
    const plot = page.getByRole('region', { name: 'Time series — predictable pulse' }).locator('.uplot');
    const initialWidth = (await plot.boundingBox())?.width ?? 0;
    await command(page, 'resize');
    await expect.poll(async () => (await plot.boundingBox())?.width ?? 0).toBeLessThan(initialWidth - 50);
    await command(page, 'toggleSecondary');
    await waitForPanels(page, 2);
    expect((await inspect(page)).provider.cohort.runtime.activeDashboardScopes).toBe(2);
    await page.getByTestId('modal-trigger-portal-secondary').click();
    await expect(page.getByRole('dialog', { name: 'Provider modal portal-secondary' })).toBeVisible();
    await page.keyboard.press('Escape');
    await command(page, 'togglePrimary');
    await waitForPanels(page, 1);
    await page.evaluate(() => window.__STRICT_CSP_EXPERIMENT__.unmountProvider());
    await expect(page.getByTestId('provider-unmounted')).toBeVisible();
    await expect(page.locator('#grafana-portal-container')).toHaveCount(0);
    await expect.poll(async () => Object.values((await captureResourceEvidence(page, 'strict-csp-released')).instance).every((count) => count === 0)).toBe(true);
    await page.evaluate(() => window.__STRICT_CSP_EXPERIMENT__.mountProvider());
    await waitForPanels(page);
    const state = await inspect(page);
    expect(state.styles.every((style) => style.nonce === state.nonce), JSON.stringify(state.styles)).toBe(true);
    expect(await violations(page)).toEqual([]);
    await assertProviderBoundaries(page, state);
    await run.guard.assertClean();
    evidence.lifecycle = { state, violations: [] };
  } finally {
    await run.session.cleanup();
  }
});
