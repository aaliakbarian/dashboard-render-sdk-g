// POC / EXPERIMENT / NOT FOR PRODUCTION
import { expect, test, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

import { authenticateGrafanaFixture } from '../../e2e/support/grafanaAuth.ts';
import { installConsoleGuard } from '../../e2e/support/consoleGuard.ts';
import { captureResourceEvidence, installResourceEvidence } from '../../e2e/support/resourceEvidence.ts';

interface Inspection {
  admission: {
    reactIdentity: boolean;
    reactCreateContextIdentity: boolean;
    reactCreateElementIdentity: boolean;
    reactDomIdentity: boolean;
    reactDomClientIdentity: boolean;
    reactDomCreateRootIdentity: boolean;
    reactUseStateIdentity: boolean;
    jsxRuntimeIdentity: boolean;
    jsxDevRuntimeIdentity: boolean;
  };
  behavior: {
    activeEffects: number;
    cleanups: number;
    lazyLoads: number;
    setups: number;
  };
  cohort: {
    cohortEvents: Array<{ featureId?: string; scope: string; type: string }>;
    queryProbe?: { series: number; state: string };
    runtime: { moduleIdentities?: Record<string, { copies: number; version: string }> };
    scenes: Array<{ active: boolean; uid: string }>;
  };
}

const evidence: Record<string, unknown> = {};

test.afterAll(async () => {
  await mkdir('artifacts/experiments/react-externalized-provider/host', { recursive: true });
  await writeFile(
    'artifacts/experiments/react-externalized-provider/host/browser-evidence.json',
    `${JSON.stringify({ generatedBy: 'react-externalized-provider-v1', probes: evidence }, null, 2)}\n`
  );
});

async function open(page: Page, mode: 'text' | 'stat' | 'timeseries' | 'all' | 'testdata' | 'two') {
  const session = await authenticateGrafanaFixture(page);
  const consoleGuard = await installConsoleGuard(page);
  await installResourceEvidence(page);
  const failedResponses: string[] = [];
  const requests: string[] = [];
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.stack ?? error.message));
  page.on('request', (request) => requests.push(new URL(request.url()).pathname));
  page.on('response', (response) => {
    if (response.status() >= 400) {
      failedResponses.push(`${response.status()} ${new URL(response.url()).pathname}`);
    }
  });
  await page.goto(`/?mode=${mode}`);
  await expect(page.getByTestId('provider-admitted')).toHaveText('ready', { timeout: 20_000 });
  return { consoleGuard, failedResponses, pageErrors, requests, session };
}

async function inspect(page: Page): Promise<Inspection> {
  return page.evaluate(() =>
    (globalThis as typeof globalThis & {
      __REACT_EXTERNALIZED_PROVIDER__: { inspect(): Inspection };
    }).__REACT_EXTERNALIZED_PROVIDER__.inspect()
  );
}

async function assertBoundaries(page: Page, pageErrors: readonly string[]) {
  expect(pageErrors).toEqual([]);
  expect(await page.locator('iframe').count()).toBe(0);
  expect(await page.getByRole('navigation').count()).toBe(0);
  expect(new URL(page.url()).pathname).toBe('/');
}

for (const admission of ['duplicate', 'unsupported-version'] as const) {
  test(`built provider rejects ${admission} before implementation load`, async ({ page }) => {
    const requests: string[] = [];
    page.on('request', (request) => requests.push(new URL(request.url()).pathname));
    await page.goto(`/?admission=${admission}`);
    await expect(page.getByTestId('admission-rejected')).toContainText(admission);
    const result = await page.evaluate(() =>
      (globalThis as typeof globalThis & {
        __REACT_EXTERNALIZED_ADMISSION_PROBE__: {
          code: string;
          implementationLoads: number;
        };
      }).__REACT_EXTERNALIZED_ADMISSION_PROBE__
    );
    expect(result.implementationLoads).toBe(0);
    expect(result.code).toMatch(/duplicate-react-runtime|unsupported-react-version/);
    expect(requests.some((path) => path.startsWith('/grafana/'))).toBe(false);
    expect(await page.getByTestId('provider-admitted').count()).toBe(0);
    evidence[`admission-${admission}`] = result;
  });
}

test('host and provider share React hooks, context, JSX, portals, and lazy behavior', async ({ page }) => {
  const probe = await open(page, 'text');
  try {
    await expect(page.getByRole('region', { name: 'Text — phase0' })).toContainText('Native phase0');
    await expect(page.getByTestId('provider-context')).toHaveText('host-context-value');
    await expect(page.getByTestId('provider-lazy')).toHaveText('lazy-ready');
    await expect(page.getByTestId('provider-portal')).toHaveText('portal-ready');
    await page.getByTestId('provider-state').click();
    await expect(page.getByTestId('provider-state')).toHaveText('state:1');
    const state = await inspect(page);
    expect(state.admission).toEqual({
      jsxDevRuntimeIdentity: true,
      jsxRuntimeIdentity: true,
      reactCreateContextIdentity: true,
      reactCreateElementIdentity: true,
      reactDomClientIdentity: true,
      reactDomCreateRootIdentity: true,
      reactDomIdentity: true,
      reactIdentity: true,
      reactUseStateIdentity: true,
    });
    expect(state.behavior.lazyLoads).toBe(1);
    expect(state.behavior.setups).toBeGreaterThanOrEqual(1);
    expect(state.behavior.activeEffects).toBe(1);
    expect(state.cohort.runtime.moduleIdentities).toMatchObject({
      react: { copies: 1, version: '19.2.8' },
      'react-dom': { copies: 1, version: '19.2.8' },
    });
    await assertBoundaries(page, probe.pageErrors);
    expect(probe.failedResponses).toEqual([]);
    await probe.consoleGuard.assertClean();
    evidence.react = { requests: [...new Set(probe.requests)].sort(), state };
  } finally {
    await probe.session.cleanup();
  }
});

for (const mode of ['stat', 'timeseries'] as const) {
  test(`externalized host renders the real ${mode} query path`, async ({ page }) => {
    const query = page.waitForRequest((request) => request.url().includes('/grafana/api/ds/query'));
    const probe = await open(page, mode);
    try {
      await query;
      const label = mode === 'stat' ? 'Stat — predictable pulse' : 'Time series — predictable pulse';
      const panel = page.getByRole('region', { name: label });
      if (mode === 'stat') await expect(panel).toContainText(/(?:10|90)%/, { timeout: 20_000 });
      else await expect(panel.locator('canvas')).not.toHaveCount(0, { timeout: 20_000 });
      await assertBoundaries(page, probe.pageErrors);
      expect(probe.failedResponses).toEqual([]);
      await probe.consoleGuard.assertClean();
      evidence[mode] = { requests: [...new Set(probe.requests)].sort(), state: await inspect(page) };
    } finally {
      await probe.session.cleanup();
    }
  });
}

test('externalized provider executes real TestData without a panel', async ({ page }) => {
  const query = page.waitForRequest((request) => request.url().includes('/grafana/api/ds/query'));
  const probe = await open(page, 'testdata');
  try {
    await query;
    await expect(page.getByTestId('testdata-result')).toHaveText('Done', { timeout: 20_000 });
    expect((await inspect(page)).cohort.queryProbe).toMatchObject({ state: 'Done' });
    expect(probe.failedResponses).toEqual([]);
    await probe.consoleGuard.assertClean();
    evidence.testdata = { state: await inspect(page) };
  } finally {
    await probe.session.cleanup();
  }
});

test('two dashboards share host React and provider cohort with independent scenes', async ({ page }) => {
  const probe = await open(page, 'two');
  try {
    await expect(page.getByRole('region', { name: 'Time series — predictable pulse' })).toHaveCount(2, { timeout: 20_000 });
    let state = await inspect(page);
    expect(state.cohort.scenes.filter((scene) => scene.active)).toHaveLength(2);
    expect(state.cohort.cohortEvents.filter((event) => event.scope === 'cohort' && event.type === 'start')).toHaveLength(1);
    await page.getByTestId('toggle-secondary').click();
    await expect(page.getByRole('region', { name: 'Time series — predictable pulse' })).toHaveCount(1);
    state = await inspect(page);
    expect(state.cohort.scenes.filter((scene) => scene.active)).toHaveLength(1);
    expect(probe.failedResponses).toEqual([]);
    await probe.consoleGuard.assertClean();
    evidence.two = { state };
  } finally {
    await probe.session.cleanup();
  }
});

test('StrictMode unmount and remount clean provider resources and portals', async ({ page }) => {
  const probe = await open(page, 'all');
  try {
    await expect(page.getByRole('region', { name: 'Time series — predictable pulse' }).locator('canvas')).not.toHaveCount(0, { timeout: 20_000 });
    await page.evaluate(() =>
      (globalThis as typeof globalThis & { __REACT_EXTERNALIZED_PROVIDER__: { unmount(): void } })
        .__REACT_EXTERNALIZED_PROVIDER__.unmount()
    );
    await expect(page.locator('#root')).toBeEmpty();
    await expect(page.locator('#provider-portal')).toBeEmpty();
    await expect.poll(async () => Object.values((await captureResourceEvidence(page, 'externalized-unmounted')).instance).every((value) => value === 0)).toBe(true);
    expect((await inspect(page)).behavior.activeEffects).toBe(0);
    await page.evaluate(() =>
      (globalThis as typeof globalThis & { __REACT_EXTERNALIZED_PROVIDER__: { remount(): void } })
        .__REACT_EXTERNALIZED_PROVIDER__.remount()
    );
    await expect(page.getByRole('region', { name: 'Text — phase0' })).toContainText('Native phase0', { timeout: 20_000 });
    await expect(page.getByTestId('provider-portal')).toHaveText('portal-ready');
    expect(probe.failedResponses).toEqual([]);
    await probe.consoleGuard.assertClean();
    evidence.strictMode = { state: await inspect(page) };
  } finally {
    await probe.session.cleanup();
  }
});
