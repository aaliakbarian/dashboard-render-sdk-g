// POC / EXPERIMENT / NOT FOR PRODUCTION
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';

import type { BundleEvidence } from '../../../experiments/bundle/lazy-panel-chunks/analyzeBundleEvidence.ts';
import { PANEL_APPLICATION_SOURCES } from '../../../experiments/bundle/lazy-panel-chunks/sourceIdentity.ts';
import { authenticateGrafanaFixture } from '../../e2e/support/grafanaAuth.ts';
import { installConsoleGuard } from '../../e2e/support/consoleGuard.ts';
import { captureResourceEvidence, installResourceEvidence } from '../../e2e/support/resourceEvidence.ts';

const report = JSON.parse(
  readFileSync(
    process.env.LAZY_PANEL_BROWSER_BUNDLE_REPORT ??
      'artifacts/experiments/lazy-panel-chunks/browser/evidence/bundle-evidence.json',
    'utf8'
  )
) as BundleEvidence;

const sourceChunk = Object.fromEntries(
  Object.entries(PANEL_APPLICATION_SOURCES).map(([id, sources]) => {
    const owner = report.chunks.find((chunk) =>
      sources.some((source) => chunk.modules.includes(`<grafana-source>/${source}`))
    );
    if (!owner) throw new Error(`No browser renderer chunk was found for ${id}.`);
    return [id, owner.fileName];
  })
) as Record<'text' | 'stat' | 'timeseries', string>;
const networkResults: Record<string, readonly string[]> = {};
const requestSequences: Record<string, readonly string[]> = {};

test.afterAll(async () => {
  const output = 'artifacts/experiments/lazy-panel-chunks/browser/network-evidence.json';
  await mkdir('artifacts/experiments/lazy-panel-chunks/browser', { recursive: true });
  await writeFile(
    output,
    `${JSON.stringify(
      {
        generatedBy: 'lazy-panel-browser-probe-v1',
        probes: Object.fromEntries(
          Object.entries(networkResults).map(([mode, requests]) => [
            mode,
            {
              requests: [...new Set(requests)].sort(),
              sequence: requestSequences[mode] ?? [],
            },
          ])
        ),
        rendererChunks: sourceChunk,
      },
      null,
      2
    )}\n`
  );
});

async function inspection(page: Page) {
  return page.evaluate(() =>
    (globalThis as typeof globalThis & {
      __LAZY_PANEL_EXPERIMENT__: { inspect(): unknown };
    }).__LAZY_PANEL_EXPERIMENT__.inspect()
  ) as Promise<{
    pluginEvents: Array<{ category?: string; pluginId?: string; type: string }>;
    runtime: {
      activeDashboardScopes?: number;
      moduleIdentities?: Record<string, { copies: number; version: string }>;
    };
  }>;
}

async function openProbe(page: Page, mode: 'text' | 'stat' | 'timeseries' | 'all') {
  const session = await authenticateGrafanaFixture(page);
  const consoleGuard = await installConsoleGuard(page);
  await installResourceEvidence(page);
  const scripts: string[] = [];
  const sequence: string[] = [];
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname.replace(/^\//, '');
    sequence.push(path);
    if (path.endsWith('.js') || path.endsWith('.css') || path.endsWith('.ttf')) scripts.push(path);
  });
  await page.goto(`/?panel=${mode}`);
  return { consoleGuard, scripts, sequence, session };
}

function expectRendererRequests(
  requests: readonly string[],
  expected: readonly ('text' | 'stat' | 'timeseries')[]
) {
  for (const id of ['text', 'stat', 'timeseries'] as const) {
    expect(
      requests.some((request) => request.endsWith(sourceChunk[id])),
      `${id} source chunk ${sourceChunk[id]} request state`
    ).toBe(expected.includes(id));
  }
}

function expectDashboardBeforeRenderer(
  sequence: readonly string[],
  renderer: 'text' | 'stat' | 'timeseries'
) {
  const dashboard = sequence.findIndex((path) => path.endsWith('/dashboards/grsdk-phase0-poc/dto'));
  const panel = sequence.findIndex((path) => path.endsWith(sourceChunk[renderer]));
  expect(dashboard, 'dashboard DTO request index').toBeGreaterThanOrEqual(0);
  expect(panel, `${renderer} renderer request index`).toBeGreaterThan(dashboard);
}

test('Text-only loads and renders only the Text renderer chunk', async ({ page }) => {
  const probe = await openProbe(page, 'text');
  try {
    const panel = page.getByRole('region', { name: 'Text — phase0' });
    await expect(panel).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('TextPanel-converted-content')).toContainText('Native phase0');
    networkResults.text = probe.scripts;
    requestSequences.text = probe.sequence;
    expectRendererRequests(probe.scripts, ['text']);
    expectDashboardBeforeRenderer(probe.sequence, 'text');
    const runtimeInspection = await inspection(page);
    expect(runtimeInspection.pluginEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ pluginId: 'text', type: 'start' }),
        expect.objectContaining({ pluginId: 'text', type: 'success' }),
      ])
    );
    expect(runtimeInspection.runtime.moduleIdentities).toMatchObject({
      react: { copies: 1, version: '19.2.8' },
      'react-dom': { copies: 1, version: '19.2.8' },
    });
    expect(await page.locator('iframe').count()).toBe(0);
    expect(await page.getByRole('navigation').count()).toBe(0);
    await probe.consoleGuard.assertClean();
  } finally {
    await probe.session.cleanup();
  }
});

test('Stat-only loads only Stat and renders real query data', async ({ page }) => {
  const query = page.waitForRequest((request) => request.url().includes('/grafana/api/ds/query'));
  const probe = await openProbe(page, 'stat');
  try {
    await query;
    const panel = page.getByRole('region', { name: 'Stat — predictable pulse' });
    await expect(panel).toBeVisible({ timeout: 15_000 });
    await expect(panel).toContainText(/(?:10|90)%/);
    networkResults.stat = probe.scripts;
    requestSequences.stat = probe.sequence;
    expectRendererRequests(probe.scripts, ['stat']);
    expectDashboardBeforeRenderer(probe.sequence, 'stat');
    await probe.consoleGuard.assertClean();
  } finally {
    await probe.session.cleanup();
  }
});

test('Time-series-only loads only Time series and renders the real plot', async ({ page }) => {
  const query = page.waitForRequest((request) => request.url().includes('/grafana/api/ds/query'));
  const probe = await openProbe(page, 'timeseries');
  try {
    await query;
    const panel = page.getByRole('region', { name: 'Time series — predictable pulse' });
    await expect(panel).toBeVisible({ timeout: 15_000 });
    await expect(panel.locator('canvas')).not.toHaveCount(0);
    await expect(panel.getByText('Phase 0 Pulse Signal')).toBeVisible();
    networkResults.timeseries = probe.scripts;
    requestSequences.timeseries = probe.sequence;
    expectRendererRequests(probe.scripts, ['timeseries']);
    expectDashboardBeforeRenderer(probe.sequence, 'timeseries');
    await probe.consoleGuard.assertClean();
  } finally {
    await probe.session.cleanup();
  }
});

test('all-panels path renders all three and survives UID lifecycle cleanup', async ({ page }) => {
  const probe = await openProbe(page, 'all');
  try {
    await expect(page.getByRole('region', { name: 'Text — phase0' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('region', { name: 'Stat — predictable pulse' })).toBeVisible();
    const timeSeries = page.getByRole('region', { name: 'Time series — predictable pulse' });
    await expect(timeSeries).toBeVisible();
    await expect(timeSeries.locator('canvas')).not.toHaveCount(0);
    networkResults.all = probe.scripts;
    requestSequences.all = probe.sequence;
    expectRendererRequests(probe.scripts, ['text', 'stat', 'timeseries']);
    expectDashboardBeforeRenderer(probe.sequence, 'text');
    expectDashboardBeforeRenderer(probe.sequence, 'stat');
    expectDashboardBeforeRenderer(probe.sequence, 'timeseries');

    await page.getByTestId('switch-uid').click();
    await expect(page.getByRole('region', { name: 'Alternate Text sentinel' })).toBeVisible();
    await page.getByTestId('switch-uid').click();
    await expect(timeSeries).toBeVisible();
    await page.getByTestId('toggle-dashboard').click();
    await expect(page.getByTestId('dashboard-unmounted')).toBeVisible();
    await expect
      .poll(async () => {
        const released = await captureResourceEvidence(page, 'lazy-panels-unmounted');
        return Object.values(released.instance).every((count) => count === 0);
      })
      .toBe(true);
    expect((await inspection(page)).runtime.activeDashboardScopes).toBe(0);
    await page.getByTestId('toggle-dashboard').click();
    await expect(timeSeries).toBeVisible();
    const lifecycleEvents = (await inspection(page)).pluginEvents;
    for (const pluginId of ['text', 'stat', 'timeseries']) {
      expect(
        lifecycleEvents.filter((event) => event.pluginId === pluginId && event.type === 'start')
      ).toHaveLength(1);
    }
    await probe.consoleGuard.assertClean();
  } finally {
    await probe.session.cleanup();
  }
});

test('injected Stat load failure is panel-local and retry succeeds', async ({ page }) => {
  const session = await authenticateGrafanaFixture(page);
  const consoleGuard = await installConsoleGuard(page);
  try {
    await page.goto('/?panel=all&fail=stat');
    await expect(page.getByRole('region', { name: 'Text — phase0' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('region', { name: 'Time series — predictable pulse' })).toBeVisible();
    await expect.poll(async () => (await inspection(page)).pluginEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ category: 'module-load-failed', pluginId: 'stat', type: 'failure' }),
      ])
    );
    await page.getByTestId('probe-failure').click();
    await expect(page.getByTestId('failure-result')).toHaveText('success');
    await expect(page.getByRole('region', { name: 'Text — phase0' })).toBeVisible();
    await consoleGuard.assertClean();
  } finally {
    await session.cleanup();
  }
});
