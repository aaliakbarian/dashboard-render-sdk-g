import { expect, test } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

import { authenticateGrafanaFixture } from './support/grafanaAuth';
import { installConsoleGuard } from './support/consoleGuard';
import {
  installNetworkEvidence,
  type BrowserNetworkEvidenceEvent,
} from './support/networkEvidence';
import { captureResourceEvidence, installResourceEvidence } from './support/resourceEvidence';

test.use({ locale: 'en-US', trace: 'off' });

test('runs the real TestData Predictable Pulse query through the Task 7 SceneQueryRunner', async ({
  page,
}) => {
  test.skip(
    !process.env.POC_GRAFANA_VERIFY_USER || !process.env.POC_GRAFANA_VERIFY_PASSWORD,
    'local disposable Grafana fixture credentials are required'
  );

  const session = await authenticateGrafanaFixture(page);
  try {
    const consoleGuard = await installConsoleGuard(page);
    const networkEvidence = installNetworkEvidence(page);
    await installResourceEvidence(page);
    await page.goto('/');
    const baseline = await captureResourceEvidence(page, 'task10-baseline');

    const result = await page.evaluate(async () => {
      const probePath = '/@fs/workspace/tests/e2e/support/task10QueryProbe.ts';
      const probe = await import(/* @vite-ignore */ probePath);
      return probe.runTask10QueryProbe();
    });

    expect(result).toMatchObject({
      cancellation: { staleDonePublished: false, transitions: ['Loading'] },
      datasource: {
        name: 'Dashboard Render SDK G POC TestData',
        type: 'grafana-testdata-datasource',
        uid: 'grsdk-testdata',
      },
      iframeCount: 0,
      moduleIdentity:
        'public/app/plugins/datasource/grafana-testdata-datasource/module.tsx',
      repeatedRuntimeIdentity: true,
      runtimeAfter: { activeLeases: 0, queryRuntimeStatus: 'ready', status: 'ready' },
      runtimeDuring: {
        activeLeases: 1,
        queryRuntimeStatus: 'ready',
        status: 'ready',
      },
      success: {
        dashboardUid: 'grsdk-phase0-poc',
        panelId: 2,
        state: 'Done',
        timezone: 'browser',
      },
    });
    expect(result.success.series).toBeGreaterThan(0);
    expect(result.success.fields).toBeGreaterThan(0);
    expect(result.success.points).toBeGreaterThan(0);
    expect(result.refresh.state).toBe('Done');
    expect(result.refresh.requestId).not.toBe(result.success.requestId);
    expect(result.generation.state).toBe('Done');
    expect(result.successTransitions).toEqual(['Loading', 'Done', 'Loading', 'Done']);
    expect(result.runtimeDuring.initializationSteps).toEqual(
      expect.arrayContaining([
        'frontend-settings-loaded',
        'template-service-installed',
        'datasource-service-installed',
        'testdata-instance-loaded',
        'testdata-runtime-instance-registered',
        'run-request-installed',
        'query-runtime-ready',
      ])
    );
    expect(result.queryEvidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ outcome: 'success', type: 'settings' }),
        expect.objectContaining({ cache: 'miss', outcome: 'start', type: 'datasource-load' }),
        expect.objectContaining({ cache: 'miss', outcome: 'success', type: 'datasource-load' }),
        expect.objectContaining({ outcome: 'start', panelId: 2, state: 'Loading', type: 'query' }),
        expect.objectContaining({ outcome: 'success', panelId: 2, state: 'Done', type: 'query' }),
        expect.objectContaining({ outcome: 'cancelled', panelId: 2, type: 'query' }),
      ])
    );
    expect(result.transport).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ endpoint: 'frontend-settings', outcome: 'success', status: 200 }),
        expect.objectContaining({ endpoint: 'datasource-query', outcome: 'success', status: 200 }),
        expect.objectContaining({ endpoint: 'datasource-query', outcome: 'cancelled' }),
      ])
    );

    if (process.env.POC_TESTDATA_RUNTIME_ONLY_EXPERIMENT === '1') {
      const experiment = await page.evaluate(async () => {
        const identityPath =
          '/@fs/workspace/experiments/bundle/testdata-runtime-only/browserCohortIdentity.ts';
        const identity = await import(/* @vite-ignore */ identityPath);
        return {
          cohort: identity.inspectTestDataRuntimeCohortIdentity(),
          resources: performance.getEntriesByType('resource').map((entry) => entry.name),
        };
      });
      expect(experiment.cohort).toEqual({
        data: true,
        react: true,
        reactDom: true,
        runtime: true,
        rxjs: true,
        superclass: true,
      });
      expect(
        experiment.resources.some((url) =>
          url.includes('/experiments/bundle/testdata-runtime-only/providerMetadata.ts')
        )
      ).toBe(true);
      expect(
        experiment.resources.some((url) =>
          /grafana-testdata-datasource\/(?:module|QueryEditor|ConfigEditor)\.tsx/.test(url)
        )
      ).toBe(false);
    }

    const network = await networkEvidence.snapshot();
    const queryRequests = network.filter(
      (
        event
      ): event is Extract<BrowserNetworkEvidenceEvent, { type: 'request' }> =>
        event.type === 'request' &&
        event.method === 'POST' &&
        event.url.includes('/grafana/api/ds/query')
    );
    expect(queryRequests.length).toBeGreaterThanOrEqual(4);
    expect(queryRequests.every((event) => !('authorization' in event.headers))).toBe(true);
    expect(queryRequests.every((event) => !('cookie' in event.headers))).toBe(true);
    expect(network.some((event) => event.url.includes('/api/dashboards/uid/'))).toBe(false);
    expect(await page.locator('iframe').count()).toBe(0);
    expect(await page.getByRole('navigation').count()).toBe(0);
    expect(`${new URL(page.url()).pathname}${new URL(page.url()).search}`).toBe('/');

    const finalResources = await captureResourceEvidence(page, 'task10-released');
    expect(finalResources.dom).toMatchObject({ iframeElements: 0, portalChildren: 0, portalRoots: 0 });
    expect(Object.values(finalResources.instance).every((count) => count === 0)).toBe(true);
    expect(finalResources.page).toMatchObject({
      animationFrame: baseline.page.animationFrame,
      portal: baseline.page.portal,
      portalChild: baseline.page.portalChild,
      resizeObserver: baseline.page.resizeObserver,
      sceneActivation: baseline.page.sceneActivation,
      subscription: baseline.page.subscription,
    });

    expect(JSON.stringify(result)).not.toMatch(
      /Bearer |authorization|cookie|password|service.?account|responseBody|queryText/i
    );
    await consoleGuard.assertClean();

    const networkSummary = network
      .filter((event) => event.url.includes('/grafana/'))
      .map((event) => ({
        ...(event.type === 'request' ? { method: event.method } : {}),
        ...(event.type === 'response' ? { status: event.status } : {}),
        type: event.type,
        url: event.url,
      }));
    await mkdir('artifacts/playwright', { recursive: true });
    await writeFile(
      'artifacts/playwright/task-10-testdata-query.json',
      `${JSON.stringify(
        {
          cancellation: result.cancellation,
          datasource: result.datasource,
          moduleIdentity: result.moduleIdentity,
          network: networkSummary,
          queryEvidence: result.queryEvidence,
          refresh: result.refresh,
          success: result.success,
          transport: result.transport,
        },
        null,
        2
      )}\n`,
      'utf8'
    );
  } finally {
    await session.cleanup();
  }
});
