// POC / EXPERIMENT / NOT FOR PRODUCTION
import { expect, test, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

import { authenticateGrafanaFixture } from '../../e2e/support/grafanaAuth.ts';
import { installConsoleGuard } from '../../e2e/support/consoleGuard.ts';
import { captureResourceEvidence, installResourceEvidence } from '../../e2e/support/resourceEvidence.ts';

const artifactRoot = 'artifacts/experiments/transformation-conformance';
const evidence: Record<string, unknown> = { generatedBy: 'transformation-conformance-browser-v1' };
const queryRoute = /\/grafana\/api\/ds\/query(?:\?.*)?$/;

interface Inspection {
  readonly conformance: {
    readonly catalogue: { readonly maxChainLength: number; readonly supportedIds: readonly string[]; readonly version: string };
    readonly executionFailures: number;
    readonly executions: number;
    readonly failClosedContainments: number;
    readonly grafanaDataIdentity: { readonly copies: number; readonly version: string };
    readonly operatorIdentityMatchesRegistry: boolean;
    readonly operatorLoader: { readonly loadAttempts: number; readonly loaded: boolean; readonly operatorId?: string };
    readonly registryIds: readonly string[];
  };
  readonly provider: {
    readonly provider: {
      readonly portal: { readonly childCount: number; readonly directBodyFallbacks: number };
    };
    readonly runtime: {
      readonly activeDashboardScopes: number;
      readonly moduleIdentities?: Record<string, { readonly copies: number; readonly version: string }>;
    };
  };
  readonly styles: {
    readonly emotionElements: number;
    readonly tags: Array<{ readonly nonce: string }>;
  };
}

declare global {
  interface Window {
    __TRANSFORMATION_CONFORMANCE_EXPERIMENT__: {
      command(command: 'mountPrimary' | 'refresh' | 'resize' | 'switchUidWithOpenModal' | 'timeRange' | 'togglePrimary' | 'toggleSecondary'): void;
      inspect(): Inspection;
      probePipeline(input: unknown): { readonly category: string; readonly accepted: boolean };
      runRealParity(): Promise<{
        readonly actualDisplayName?: string;
        readonly declarative: unknown;
        readonly explicit: unknown;
        readonly fieldConfig: unknown;
        readonly rawDisplayName?: string;
        readonly refId?: string;
      }>;
    };
    __TRANSFORMATION_CONFORMANCE_CSP_VIOLATIONS__: Array<{ effectiveDirective: string }>;
  }
}

test.afterAll(async () => {
  await mkdir(artifactRoot, { recursive: true });
  await writeFile(`${artifactRoot}/browser-evidence.json`, `${JSON.stringify(evidence, null, 2)}\n`);
});

async function installCspCapture(page: Page) {
  await page.addInitScript(() => {
    window.__TRANSFORMATION_CONFORMANCE_CSP_VIOLATIONS__ = [];
    document.addEventListener('securitypolicyviolation', (event) => {
      window.__TRANSFORMATION_CONFORMANCE_CSP_VIOLATIONS__.push({ effectiveDirective: event.effectiveDirective });
    });
  });
}

async function inspect(page: Page) {
  return page.evaluate(() => window.__TRANSFORMATION_CONFORMANCE_EXPERIMENT__.inspect());
}

async function command(page: Page, value: Parameters<Window['__TRANSFORMATION_CONFORMANCE_EXPERIMENT__']['command']>[0]) {
  await page.evaluate((commandValue) => window.__TRANSFORMATION_CONFORMANCE_EXPERIMENT__.command(commandValue), value);
}

async function waitForRealPanels(page: Page) {
  await expect(page.getByRole('region', { name: 'Text — phase0' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('region', { name: 'Stat — predictable pulse' })).toBeVisible();
  const timeseries = page.getByRole('region', { name: 'Time series — predictable pulse' });
  await expect(timeseries).toBeVisible();
  await expect(timeseries.getByText('Phase 0 Pulse Signal')).toBeVisible();
  await expect(timeseries.locator('canvas')).not.toHaveCount(0);
}

async function open(page: Page, guardConsole = true) {
  await installCspCapture(page);
  const session = await authenticateGrafanaFixture(page);
  const guard = guardConsole ? await installConsoleGuard(page) : undefined;
  await installResourceEvidence(page);
  const requests: string[] = [];
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('request', (request) => requests.push(new URL(request.url()).pathname));
  await page.goto('/');
  try {
    await expect.poll(() => page.evaluate(() => Boolean(window.__TRANSFORMATION_CONFORMANCE_EXPERIMENT__)), { timeout: 10_000 }).toBe(true);
  } catch {
    throw new Error(`Transformation experiment host API unavailable: ${JSON.stringify(pageErrors)}`);
  }
  return { guard, pageErrors, requests, session };
}

test('real query, explicit/declarative parity, field display, refresh, time range, resize, and presentation stay conformant', async ({ page }) => {
  const run = await open(page);
  try {
    await waitForRealPanels(page);
    const before = await inspect(page);
    expect(before.conformance).toMatchObject({
      catalogue: { maxChainLength: 1, supportedIds: ['renameByRegex'], version: '13.2.3' },
      executionFailures: 0,
      operatorIdentityMatchesRegistry: true,
      operatorLoader: { loadAttempts: 1, loaded: true, operatorId: 'renameByRegex' },
      registryIds: ['renameByRegex'],
    });
    expect(before.conformance.executions).toBeGreaterThan(0);
    expect(before.conformance.grafanaDataIdentity).toEqual({ copies: 1, version: '13.2.3' });
    expect(before.provider.runtime.moduleIdentities).toMatchObject({
      react: { copies: 1, version: '19.2.8' },
      'react-dom': { copies: 1, version: '19.2.8' },
    });

    const parity = await page.evaluate(() => window.__TRANSFORMATION_CONFORMANCE_EXPERIMENT__.runRealParity());
    expect(parity.explicit).toEqual(parity.declarative);
    expect(parity.rawDisplayName).toBe('Phase 0 Pulse Raw');
    expect(parity.actualDisplayName).toBe('Phase 0 Pulse Signal');
    expect(parity.refId).toBe('A');
    expect(parity.fieldConfig).toMatchObject({
      defaults: {
        custom: { fillOpacity: 15, lineWidth: 2 },
        thresholds: { mode: 'absolute' },
        unit: 'percent',
      },
    });

    const queryCount = run.requests.filter((path) => path === '/grafana/api/ds/query').length;
    const refreshed = page.waitForResponse((response) => response.url().includes('/grafana/api/ds/query') && response.ok());
    await command(page, 'refresh');
    await refreshed;
    await expect.poll(() => run.requests.filter((path) => path === '/grafana/api/ds/query').length).toBeGreaterThan(queryCount);

    const ranged = page.waitForResponse((response) => response.url().includes('/grafana/api/ds/query') && response.ok());
    await command(page, 'timeRange');
    await ranged;
    const canvas = page.getByRole('region', { name: 'Time series — predictable pulse' }).locator('canvas').first();
    const widthBefore = (await canvas.boundingBox())?.width ?? 0;
    await command(page, 'resize');
    await expect.poll(async () => (await canvas.boundingBox())?.width ?? 0).toBeLessThan(widthBefore);

    await command(page, 'toggleSecondary');
    await expect(page.getByRole('region', { name: 'Text — phase0' })).toHaveCount(2);
    await expect(page.getByText('Phase 0 Pulse Signal')).toHaveCount(2);
    await expect.poll(async () => (await inspect(page)).provider.runtime.activeDashboardScopes).toBe(2);
    await command(page, 'toggleSecondary');
    await expect(page.getByRole('region', { name: 'Text — phase0' })).toHaveCount(1);
    await expect.poll(async () => (await inspect(page)).provider.runtime.activeDashboardScopes).toBe(1);

    await page.getByTestId('popover-trigger-portal-primary').click();
    await expect(page.getByTestId('popover-portal-primary')).toBeVisible();
    await page.keyboard.press('Escape');
    const state = await inspect(page);
    expect(state.styles.emotionElements).toBe(3);
    expect(state.styles.tags.every(({ nonce }) => nonce.length > 0)).toBe(true);
    expect(state.provider.provider.portal.directBodyFallbacks).toBe(0);
    expect(await page.evaluate(() => window.__TRANSFORMATION_CONFORMANCE_CSP_VIOLATIONS__)).toEqual([]);
    expect(run.requests.some((path) => path === '/grafana/api/ds/query')).toBe(true);
    await run.guard?.assertClean();
    evidence.realPipeline = {
      conformance: state.conformance,
      parity: {
        actualDisplayName: parity.actualDisplayName,
        explicitEqualsDeclarative: JSON.stringify(parity.explicit) === JSON.stringify(parity.declarative),
        fieldConfig: parity.fieldConfig,
        rawDisplayName: parity.rawDisplayName,
        refId: parity.refId,
      },
      presentation: {
        emotionElements: state.styles.emotionElements,
        portalBodyFallbacks: state.provider.provider.portal.directBodyFallbacks,
      },
    };
  } finally {
    await run.session.cleanup();
  }
});

test('cancellation, UID replacement, unmount, and a later generation prevent stale transformed publication', async ({ page }) => {
  let delayedRequests = 0;
  await page.route(queryRoute, async (route) => {
    delayedRequests += 1;
    await new Promise((resolve) => setTimeout(resolve, 700));
    await route.continue();
  });
  const run = await open(page);
  try {
    await expect.poll(() => delayedRequests, { timeout: 30_000 }).toBeGreaterThan(0);
    await command(page, 'togglePrimary');
    await expect(page.locator('[data-poc-dashboard-instance]')).toHaveCount(0);
    await page.waitForTimeout(900);
    expect((await inspect(page)).provider.runtime.activeDashboardScopes).toBe(0);

    await page.unroute(queryRoute);
    await command(page, 'mountPrimary');
    await waitForRealPanels(page);

    let slowReplacement = true;
    await page.route(queryRoute, async (route) => {
      if (slowReplacement) {
        slowReplacement = false;
        await new Promise((resolve) => setTimeout(resolve, 700));
      }
      await route.continue();
    });
    await command(page, 'refresh');
    await command(page, 'switchUidWithOpenModal');
    await expect(page.getByRole('region', { name: 'Alternate Text sentinel' })).toBeVisible();
    await page.waitForTimeout(900);
    await expect(page.getByText('Phase 0 Pulse Signal')).toHaveCount(0);
    await page.unroute(queryRoute);
    await command(page, 'switchUidWithOpenModal');
    await waitForRealPanels(page);
    await run.guard?.assertClean();
    const state = await inspect(page);
    evidence.cancellation = {
      activeDashboardScopes: state.provider.runtime.activeDashboardScopes,
      delayedRequests,
      executions: state.conformance.executions,
    };
  } finally {
    await run.session.cleanup();
  }
});

test('preflight rejects unsupported profiles and runtime transform failure is panel-local without raw fallback', async ({ page }) => {
  const run = await open(page, false);
  try {
    const probes = await page.evaluate(() => {
      const api = window.__TRANSFORMATION_CONFORMANCE_EXPERIMENT__;
      return [
        api.probePipeline([{ id: 'reduce', options: {} }]),
        api.probePipeline([
          { id: 'renameByRegex', options: { regex: '/Raw/', renamePattern: 'A' } },
          { id: 'renameByRegex', options: { regex: '/A/', renamePattern: 'B' } },
        ]),
        api.probePipeline([{ id: 'renameByRegex', options: { regex: '/Raw/' } }]),
        api.probePipeline([{ id: 'renameByRegex', options: { regex: '/Raw/', renamePattern: 'Signal', extra: true } }]),
        api.probePipeline([{ id: 'renameByRegex', options: { regex: '/Raw/', renamePattern: 'Signal' }, disabled: true }]),
      ];
    });
    expect(probes).toEqual([
      { accepted: false, category: 'UnsupportedTransformation' },
      { accepted: false, category: 'TransformationPipelineInvalid' },
      { accepted: false, category: 'TransformationOptionsInvalid' },
      { accepted: false, category: 'TransformationOptionsInvalid' },
      { accepted: false, category: 'TransformationPipelineInvalid' },
    ]);

    await page.route('**/dashboards/grsdk-phase0-poc/dto', async (route) => {
      const response = await route.fetch();
      const body = await response.json() as { spec: { panels: Array<{ id: number; transformations?: Array<{ options: { regex: string } }> }> } };
      const panel = body.spec.panels.find(({ id }) => id === 3);
      if (panel?.transformations?.[0]) panel.transformations[0].options.regex = '/[/';
      await route.fulfill({ response, json: body });
    });
    await page.reload();
    await expect(page.getByRole('region', { name: 'Text — phase0' })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('region', { name: 'Stat — predictable pulse' })).toBeVisible();
    await expect.poll(async () => (await inspect(page)).conformance.executionFailures).toBeGreaterThan(0);
    await expect.poll(async () => (await inspect(page)).conformance.failClosedContainments).toBeGreaterThan(0);
    await expect(page.getByText('Phase 0 Pulse Raw')).toHaveCount(0);
    await expect(page.getByText('Phase 0 Pulse Signal')).toHaveCount(0);
    const failed = await inspect(page);

    await page.unroute('**/dashboards/grsdk-phase0-poc/dto');
    await page.reload();
    await waitForRealPanels(page);
    expect((await captureResourceEvidence(page, 'recovered')).page.fetch).toBe(0);
    const recovered = await inspect(page);
    evidence.failureIsolation = {
      probes,
      failed: {
        executionFailures: failed.conformance.executionFailures,
        failClosedContainments: failed.conformance.failClosedContainments,
      },
      recovered: {
        executionFailures: recovered.conformance.executionFailures,
        executions: recovered.conformance.executions,
        visibleDisplayName: 'Phase 0 Pulse Signal',
      },
    };
  } finally {
    await run.session.cleanup();
  }
});
