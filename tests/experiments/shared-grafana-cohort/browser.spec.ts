// POC / EXPERIMENT / NOT FOR PRODUCTION
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';

import type { BundleEvidence } from '../../../experiments/bundle/shared-grafana-cohort/analyzeCohortEvidence.ts';
import { FEATURE_APPLICATION_SOURCES } from '../../../experiments/bundle/shared-grafana-cohort/sourceIdentity.ts';
import { authenticateGrafanaFixture } from '../../e2e/support/grafanaAuth.ts';
import { installConsoleGuard } from '../../e2e/support/consoleGuard.ts';
import { captureResourceEvidence, installResourceEvidence } from '../../e2e/support/resourceEvidence.ts';

const report = JSON.parse(
  readFileSync(
    process.env.SHARED_COHORT_BROWSER_BUNDLE_REPORT ??
      'artifacts/experiments/shared-grafana-cohort/browser/evidence/bundle-evidence.json',
    'utf8'
  )
) as BundleEvidence;
const sourceChunks = Object.fromEntries(
  Object.entries(FEATURE_APPLICATION_SOURCES).map(([id, sources]) => {
    const owners = report.chunks
      .filter((chunk) => sources.some((source) => chunk.modules.includes(`<grafana-source>/${source}`)))
      .map((chunk) => chunk.fileName);
    if (owners.length === 0) throw new Error(`No emitted browser source owner was found for ${id}.`);
    return [id, owners];
  })
) as Record<'text' | 'stat' | 'timeseries' | 'testdata', string[]>;
const evidence: Record<string, unknown> = {};

test.afterAll(async () => {
  await mkdir('artifacts/experiments/shared-grafana-cohort/browser', { recursive: true });
  await writeFile(
    'artifacts/experiments/shared-grafana-cohort/browser/network-evidence.json',
    `${JSON.stringify({ generatedBy: 'shared-grafana-cohort-browser-v1', probes: evidence }, null, 2)}\n`
  );
});

interface Inspection {
  cohortEvents: Array<{ featureId?: string; scope: string; type: string }>;
  pluginEvents: Array<{ pluginId?: string; type: string }>;
  queryProbe?: { fields: number; points: number; series: number; state: string };
  runtime: {
    activeDashboardScopes?: number;
    moduleIdentities?: Record<string, { copies: number; version: string }>;
  };
  scenes: Array<{ active: boolean; uid: string }>;
}

async function inspect(page: Page): Promise<Inspection> {
  return page.evaluate(() =>
    (globalThis as typeof globalThis & {
      __SHARED_GRAFANA_COHORT__: { inspect(): Inspection };
    }).__SHARED_GRAFANA_COHORT__.inspect()
  );
}

async function open(page: Page, mode: 'text' | 'stat' | 'timeseries' | 'all' | 'testdata' | 'two') {
  const session = await authenticateGrafanaFixture(page);
  const consoleGuard = await installConsoleGuard(page);
  await installResourceEvidence(page);
  const requests: string[] = [];
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.stack ?? error.message));
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname.replace(/^\//, '');
    if (/\.(?:js|css|ttf)$/.test(path)) requests.push(path);
  });
  await page.goto(`/?mode=${mode}`);
  return { consoleGuard, pageErrors, requests, session };
}

function requested(requests: readonly string[], feature: keyof typeof sourceChunks) {
  return sourceChunks[feature].some((chunk) => requests.some((path) => path.endsWith(chunk)));
}

async function assertBoundaries(page: Page) {
  expect(await page.locator('iframe').count()).toBe(0);
  expect(await page.getByRole('navigation').count()).toBe(0);
  expect(new URL(page.url()).pathname).toBe('/');
}

async function expectRegion(
  page: Page,
  consoleGuard: { snapshot(): Promise<readonly unknown[]> },
  name: string,
  pageErrors: readonly string[] = [],
  timeout = 15_000
) {
  try {
    await expect(page.getByRole('region', { name })).toBeVisible({ timeout });
  } catch (cause: unknown) {
    throw new Error(
      `Shared-cohort region ${name} did not render: ${JSON.stringify({
        browser: await consoleGuard.snapshot(),
        pageErrors,
        runtimeError: await page.getByTestId('runtime-error').textContent({ timeout: 100 }).catch(() => null),
      })}`,
      { cause }
    );
  }
}

test('Text-only uses the shared cohort and requests no query feature', async ({ page }) => {
  const probe = await open(page, 'text');
  try {
    await expectRegion(page, probe.consoleGuard, 'Text — phase0', probe.pageErrors);
    expect(requested(probe.requests, 'text')).toBe(true);
    expect(requested(probe.requests, 'stat')).toBe(false);
    expect(requested(probe.requests, 'timeseries')).toBe(false);
    expect(requested(probe.requests, 'testdata')).toBe(false);
    const state = await inspect(page);
    expect(state.cohortEvents.filter((event) => event.scope === 'cohort' && event.type === 'start')).toHaveLength(1);
    expect(state.runtime.moduleIdentities).toMatchObject({
      react: { copies: 1, version: '19.2.8' },
      'react-dom': { copies: 1, version: '19.2.8' },
    });
    await assertBoundaries(page);
    await probe.consoleGuard.assertClean();
    evidence.text = { requests: [...new Set(probe.requests)].sort(), state };
  } finally {
    await probe.session.cleanup();
  }
});

for (const mode of ['stat', 'timeseries'] as const) {
  test(`${mode} preserves its independent feature request`, async ({ page }) => {
    const query = page.waitForRequest((request) => request.url().includes('/grafana/api/ds/query'));
    const probe = await open(page, mode);
    try {
      await query;
      const label = mode === 'stat' ? 'Stat — predictable pulse' : 'Time series — predictable pulse';
      const panel = page.getByRole('region', { name: label });
      await expectRegion(page, probe.consoleGuard, label, probe.pageErrors);
      try {
        if (mode === 'timeseries') {
          await expect(panel.locator('canvas')).not.toHaveCount(0, { timeout: 15_000 });
        } else {
          await expect(panel).toContainText(/(?:10|90)%/, { timeout: 15_000 });
        }
      } catch (cause: unknown) {
        throw new Error(
          `Shared-cohort ${mode} renderer did not become ready: ${JSON.stringify({
            browser: await probe.consoleGuard.snapshot(),
            pageErrors: probe.pageErrors,
            state: await inspect(page),
          })}`,
          { cause }
        );
      }
      expect(requested(probe.requests, mode)).toBe(true);
      expect(requested(probe.requests, 'text')).toBe(false);
      expect(requested(probe.requests, mode === 'stat' ? 'timeseries' : 'stat')).toBe(false);
      expect(requested(probe.requests, 'testdata')).toBe(true);
      await probe.consoleGuard.assertClean();
      evidence[mode] = { requests: [...new Set(probe.requests)].sort(), state: await inspect(page) };
    } finally {
      await probe.session.cleanup();
    }
  });
}

test('all capabilities initialize one cohort and reuse feature caches', async ({ page }) => {
  const probe = await open(page, 'all');
  try {
    const text = page.getByRole('region', { name: 'Text — phase0' });
    const stat = page.getByRole('region', { name: 'Stat — predictable pulse' });
    const timeSeries = page.getByRole('region', { name: 'Time series — predictable pulse' });
    await expectRegion(page, probe.consoleGuard, 'Text — phase0', probe.pageErrors);
    await expect(text).toContainText('Native phase0', { timeout: 15_000 });
    await expect(stat).toContainText(/(?:10|90)%/, { timeout: 15_000 });
    await expect(timeSeries.locator('canvas')).not.toHaveCount(0, { timeout: 15_000 });
    for (const feature of ['text', 'stat', 'timeseries', 'testdata'] as const) {
      expect(requested(probe.requests, feature)).toBe(true);
    }
    const state = await inspect(page);
    expect(state.cohortEvents.filter((event) => event.scope === 'cohort' && event.type === 'start')).toHaveLength(1);
    for (const featureId of ['text', 'stat', 'timeseries', 'testdata']) {
      expect(state.cohortEvents.filter((event) => event.featureId === featureId && event.type === 'start')).toHaveLength(1);
    }
    await page.getByTestId('toggle-dashboard').click();
    await expect(page.getByTestId('dashboard-unmounted')).toBeVisible();
    await expect.poll(async () => Object.values((await captureResourceEvidence(page, 'shared-unmounted')).instance).every((count) => count === 0)).toBe(true);
    await page.getByTestId('toggle-dashboard').click();
    await expect(page.getByRole('region', { name: 'Time series — predictable pulse' }).locator('canvas')).not.toHaveCount(0, { timeout: 15_000 });
    const remounted = await inspect(page);
    for (const featureId of ['text', 'stat', 'timeseries']) {
      expect(remounted.cohortEvents.filter((event) => event.featureId === featureId && event.type === 'start')).toHaveLength(1);
    }
    await probe.consoleGuard.assertClean();
    evidence.all = { requests: [...new Set(probe.requests)].sort(), state: remounted };
  } finally {
    await probe.session.cleanup();
  }
});

test('TestData-only executes the real query without loading a panel renderer', async ({ page }) => {
  const query = page.waitForRequest((request) => request.url().includes('/grafana/api/ds/query'));
  const probe = await open(page, 'testdata');
  try {
    await query;
    await expect(page.getByTestId('testdata-result')).toHaveText('Done', { timeout: 15_000 });
    expect(requested(probe.requests, 'testdata')).toBe(true);
    expect(requested(probe.requests, 'text')).toBe(false);
    expect(requested(probe.requests, 'stat')).toBe(false);
    expect(requested(probe.requests, 'timeseries')).toBe(false);
    const state = await inspect(page);
    expect(state.queryProbe).toMatchObject({ state: 'Done' });
    expect(state.queryProbe?.series).toBeGreaterThan(0);
    await assertBoundaries(page);
    await probe.consoleGuard.assertClean();
    evidence.testdata = { requests: [...new Set(probe.requests)].sort(), state };
  } finally {
    await probe.session.cleanup();
  }
});

test('two dashboards share provider caches but retain independent scene lifecycles', async ({ page }) => {
  const probe = await open(page, 'two');
  try {
    await expect(page.getByRole('region', { name: 'Time series — predictable pulse' })).toHaveCount(2, { timeout: 20_000 });
    let state = await inspect(page);
    expect(state.scenes.filter((scene) => scene.active)).toHaveLength(2);
    for (const featureId of ['text', 'stat', 'timeseries', 'testdata']) {
      expect(state.cohortEvents.filter((event) => event.featureId === featureId && event.type === 'start')).toHaveLength(1);
    }
    await page.getByTestId('toggle-secondary').click();
    await expect(page.getByRole('region', { name: 'Time series — predictable pulse' })).toHaveCount(1);
    state = await inspect(page);
    expect(state.scenes.filter((scene) => scene.active)).toHaveLength(1);
    await page.getByTestId('toggle-dashboard').click();
    await expect.poll(async () => Object.values((await captureResourceEvidence(page, 'shared-two-unmounted')).instance).every((count) => count === 0)).toBe(true);
    await probe.consoleGuard.assertClean();
    evidence.two = { requests: [...new Set(probe.requests)].sort(), state: await inspect(page) };
  } finally {
    await probe.session.cleanup();
  }
});
