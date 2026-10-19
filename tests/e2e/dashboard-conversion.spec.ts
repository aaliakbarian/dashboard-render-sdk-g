import { expect, test } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

import { installConsoleGuard } from './support/consoleGuard';
import { installNetworkEvidence } from './support/networkEvidence';
import {
  captureResourceEvidence,
  installResourceEvidence,
  writeResourceEvidence,
} from './support/resourceEvidence';

const user = process.env.POC_GRAFANA_VERIFY_USER;
const password = process.env.POC_GRAFANA_VERIFY_PASSWORD;

test.use({ locale: 'en-US', trace: 'off' });

test('converts both real V1 fixture DTOs into inactive Scenes graphs', async ({ page }) => {
  test.skip(!user || !password, 'local disposable Grafana fixture credentials are required');

  const login = await page.request.post('/grafana/login', { data: { user, password } });
  expect(login.status()).toBe(200);

  const consoleGuard = await installConsoleGuard(page);
  const networkEvidence = installNetworkEvidence(page);
  await installResourceEvidence(page);
  await page.goto('/');

  const result = await page.evaluate(async () => {
    const runtimePath = '/@fs/workspace/packages/poc-compat/src/runtime/acquirePocRuntime.ts';
    const conversionPath = '/@fs/workspace/packages/poc-compat/src/scenes/convertFixtureV1.ts';
    const preflightPath = '/@fs/workspace/packages/poc-compat/src/dashboard/preflightFixture.ts';
    const runtime = await import(/* @vite-ignore */ runtimePath);
    const request = window.fetch.bind(window);
    const lease = await runtime.acquirePocRuntime({
      assetBasePath: '/grafana/public/',
      grafanaBasePath: '/grafana',
      locale: 'en-US',
      namespace: 'default',
      panelCatalog: { identity: 'task7-no-plugin-loader', panelIds: [] },
      request,
      theme: 'light',
      timezone: 'browser',
    });
    const conversion = await import(/* @vite-ignore */ conversionPath);
    const preflight = await import(/* @vite-ignore */ preflightPath);
    const evidence = conversion.createSceneConversionEvidenceRecorder();

    const primaryInput = await lease.dashboardClient.loadByUid('grsdk-phase0-poc');
    const primaryRoot = conversion.convertFixtureV1ToScene({
      catalog: preflight.POC_TASK7_PANEL_CATALOG,
      evidence,
      input: primaryInput,
      runtime: lease,
    });
    const primary = conversion.inspectPocDashboardScene(primaryRoot, lease.scenes);

    const alternateInput = await lease.dashboardClient.loadByUid('grsdk-phase0-poc-alt');
    const alternateRoot = conversion.convertFixtureV1ToScene({
      catalog: preflight.POC_TASK7_PANEL_CATALOG,
      evidence,
      input: alternateInput,
      runtime: lease,
    });
    const alternate = conversion.inspectPocDashboardScene(alternateRoot, lease.scenes);
    const transport = lease.transportEvidence.snapshot();
    const runtimeDuring = runtime.inspectPocRuntime();
    lease.release();

    return {
      alternate,
      conversionEvidence: evidence.snapshot(),
      iframeCount: document.querySelectorAll('iframe').length,
      location: `${location.pathname}${location.search}${location.hash}`,
      pluginResources: performance
        .getEntriesByType('resource')
        .map(({ name }) => name)
        .filter((name) => /public\/app\/plugins|systemjs|plugin-loader/i.test(name)),
      primary,
      runtimeAfter: runtime.inspectPocRuntime(),
      runtimeDuring,
      transport,
    };
  });

  expect(result.primary).toEqual({
    active: false,
    layout: 'grid',
    panels: [
      { dataProvider: 'none', gridPos: { h: 6, w: 8, x: 0, y: 0 }, id: 1, queryCount: 0, type: 'text' },
      { dataProvider: 'query', gridPos: { h: 6, w: 8, x: 8, y: 0 }, id: 2, queryCount: 1, type: 'stat' },
      { dataProvider: 'query', gridPos: { h: 10, w: 8, x: 16, y: 0 }, id: 4, queryCount: 1, type: 'table' },
      { dataProvider: 'transform', gridPos: { h: 10, w: 16, x: 0, y: 6 }, id: 3, queryCount: 1, type: 'timeseries' },
    ],
    refresh: '',
    timeRange: { from: 'now-1h', timeZone: 'browser', to: 'now' },
    title: 'Dashboard Render SDK G Phase 0 POC',
    uid: 'grsdk-phase0-poc',
    variables: [{ hide: 2, name: 'environment', value: 'phase0' }],
  });
  expect(result.alternate).toMatchObject({
    active: false,
    panels: [{ dataProvider: 'none', id: 1, queryCount: 0, type: 'text' }],
    title: 'Dashboard Render SDK G Phase 0 POC Alternate',
    uid: 'grsdk-phase0-poc-alt',
  });
  expect(result).toMatchObject({
    iframeCount: 0,
    location: '/',
    pluginResources: [],
    runtimeAfter: { activeLeases: 0, status: 'ready' },
    runtimeDuring: { activeLeases: 1, status: 'ready' },
  });
  expect(result.runtimeDuring.moduleIdentities).toMatchObject({
    react: { copies: 1, version: '19.2.8' },
    'react-dom': { copies: 1, version: '19.2.8' },
  });
  expect(result.conversionEvidence).toEqual([
    expect.objectContaining({
      annotationPolicy: 'builtin-default-omitted',
      outcome: 'success',
      panelCount: 4,
      uid: 'grsdk-phase0-poc',
    }),
    expect.objectContaining({
      annotationPolicy: 'builtin-default-omitted',
      outcome: 'success',
      panelCount: 1,
      uid: 'grsdk-phase0-poc-alt',
    }),
  ]);
  expect(result.transport).toEqual([
    expect.objectContaining({ endpoint: 'dashboard-discovery', outcome: 'success', status: 200 }),
    expect.objectContaining({ endpoint: 'dashboard-v1-dto', outcome: 'success', status: 200 }),
    expect.objectContaining({ endpoint: 'dashboard-v1-dto', outcome: 'success', status: 200 }),
  ]);
  expect(JSON.stringify(result)).not.toMatch(
    /Bearer |authorization|cookie|password|service.?account|responseBody|queryText/i
  );

  const browserNetwork = await networkEvidence.snapshot();
  const grafanaRequests = browserNetwork.filter(
    (entry) => entry.type === 'request' && entry.url.includes('/grafana/')
  );
  expect(grafanaRequests.some((entry) => entry.url.includes('/api/ds/query'))).toBe(false);
  expect(grafanaRequests.some((entry) => entry.url.includes('/public/app/plugins'))).toBe(false);
  expect(grafanaRequests.filter((entry) => entry.url.includes('/apis/dashboard.grafana.app/'))).toHaveLength(3);

  const resources = await captureResourceEvidence(page, 'task7-scenes-graphs-released');
  expect(resources.iframes).toEqual({ current: 0, observations: [] });
  expect(resources.dom.iframeElements).toBe(0);
  expect(resources.dom.portalRoots).toBe(0);
  expect(Object.values(resources.instance).every((count) => count === 0)).toBe(true);

  await mkdir('artifacts/playwright', { recursive: true });
  await writeFile(
    'artifacts/playwright/task-7-conversion.json',
    `${JSON.stringify(
      {
        alternate: result.alternate,
        conversionEvidence: result.conversionEvidence,
        primary: result.primary,
      },
      null,
      2
    )}\n`,
    'utf8'
  );
  await networkEvidence.write('artifacts/playwright/task-7-dashboard-network.json');
  await writeResourceEvidence('artifacts/playwright/task-7-resources.json', [resources]);
  await consoleGuard.assertClean();
});

test('publishes UID changes through the diagnostic component and cleans up without panel activation', async ({
  page,
}) => {
  test.skip(!user || !password, 'local disposable Grafana fixture credentials are required');

  const login = await page.request.post('/grafana/login', { data: { user, password } });
  expect(login.status()).toBe(200);
  const consoleGuard = await installConsoleGuard(page);
  const networkEvidence = installNetworkEvidence(page);
  await installResourceEvidence(page);
  await page.goto('/');

  const result = await page.evaluate(async () => {
    const runtimePath = '/@fs/workspace/packages/poc-compat/src/runtime/acquirePocRuntime.ts';
    const preflightPath = '/@fs/workspace/packages/poc-compat/src/dashboard/preflightFixture.ts';
    const probePath = '/@fs/workspace/tests/e2e/support/task7ComponentProbe.tsx';
    const runtime = await import(/* @vite-ignore */ runtimePath);
    const preflight = await import(/* @vite-ignore */ preflightPath);
    const probe = await import(/* @vite-ignore */ probePath);
    const lease = await runtime.acquirePocRuntime({
      assetBasePath: '/grafana/public/',
      grafanaBasePath: '/grafana',
      locale: 'en-US',
      namespace: 'default',
      panelCatalog: { identity: 'task7-no-plugin-loader', panelIds: [] },
      request: window.fetch.bind(window),
      theme: 'light',
      timezone: 'browser',
    });
    const component = await probe.runTask7ComponentProbe(
      lease,
      preflight.POC_TASK7_PANEL_CATALOG
    );
    const during = runtime.inspectPocRuntime();
    const transport = lease.transportEvidence.snapshot();
    lease.release();
    return {
      after: runtime.inspectPocRuntime(),
      component,
      during,
      iframeCount: document.querySelectorAll('iframe').length,
      location: `${location.pathname}${location.search}${location.hash}`,
      transport,
    };
  });

  expect(result).toMatchObject({
    after: { activeDashboardScopes: 0, activeLeases: 0, status: 'ready' },
    component: {
      alternatePanelCount: 1,
      primaryPanelCount: 4,
      readyUids: ['grsdk-phase0-poc', 'grsdk-phase0-poc-alt'],
      remainingProbeElements: 0,
    },
    during: { activeDashboardScopes: 0, activeLeases: 1, status: 'ready' },
    iframeCount: 0,
    location: '/',
  });
  expect(result.transport).toEqual([
    expect.objectContaining({ endpoint: 'dashboard-discovery', outcome: 'success', status: 200 }),
    expect.objectContaining({ endpoint: 'dashboard-v1-dto', outcome: 'success', status: 200 }),
    expect.objectContaining({ endpoint: 'dashboard-v1-dto', outcome: 'success', status: 200 }),
  ]);
  expect(JSON.stringify(result)).not.toMatch(/authorization|cookie|password|responseBody/i);

  const browserNetwork = await networkEvidence.snapshot();
  expect(browserNetwork.some((entry) => entry.url.includes('/api/ds/query'))).toBe(false);
  expect(browserNetwork.some((entry) => entry.url.includes('/public/app/plugins'))).toBe(false);
  const resources = await captureResourceEvidence(page, 'task7-component-unmounted');
  expect(resources.iframes).toEqual({ current: 0, observations: [] });
  expect(resources.dom).toMatchObject({ iframeElements: 0, portalRoots: 0 });
  expect(resources.page.mutationObserver).toBe(0);
  expect(Object.values(resources.instance).every((count) => count === 0)).toBe(true);
  await consoleGuard.assertClean();
});
