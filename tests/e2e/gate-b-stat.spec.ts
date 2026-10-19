import { expect, test } from '@playwright/test';
import type { PocQueryEvidenceEvent } from '@dashboard-render-sdk-g/poc-compat';
import { mkdir, writeFile } from 'node:fs/promises';

import { authenticateGrafanaFixture } from './support/grafanaAuth';
import { installConsoleGuard } from './support/consoleGuard';
import { installNetworkEvidence } from './support/networkEvidence';
import { captureResourceEvidence, installResourceEvidence } from './support/resourceEvidence';

test.use({ locale: 'en-US', trace: 'off' });

type QueryEvent = Extract<PocQueryEvidenceEvent, { type: 'query' }>;

function isQueryEvent(event: PocQueryEvidenceEvent): event is QueryEvent {
  return event.type === 'query';
}

test('renders the real query-backed Grafana Stat panel and refreshes it', async ({ page }) => {
  test.skip(
    !process.env.POC_GRAFANA_VERIFY_USER || !process.env.POC_GRAFANA_VERIFY_PASSWORD,
    'local disposable Grafana fixture credentials are required'
  );

  const session = await authenticateGrafanaFixture(page);
  try {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.stack ?? error.message));
    const consoleGuard = await installConsoleGuard(page);
    const networkEvidence = installNetworkEvidence(page);
    await installResourceEvidence(page);
    const firstQueryStarted = page.waitForRequest((request) =>
      request.url().includes('/grafana/api/ds/query')
    );
    await page.goto('/?gate=b');
    const firstQueryRequest = await firstQueryStarted;

    const statPanel = page.getByRole('region', { name: 'Stat — predictable pulse' });
    await expect(statPanel).toBeVisible({ timeout: 15_000 });
    try {
      await expect(statPanel).toContainText(/(?:10|90)%/);
    } catch (error: unknown) {
      const diagnostics = await page.evaluate(async () => {
        const path = '/src/App.tsx';
        const module = await import(/* @vite-ignore */ path);
        return module.inspectGateBHost();
      });
      throw new Error(
        `Gate B Stat did not render: ${JSON.stringify({ console: await consoleGuard.snapshot(), diagnostics, pageErrors })}`,
        { cause: error }
      );
    }
    expect(await page.locator('iframe').count()).toBe(0);
    expect(await page.getByRole('navigation').count()).toBe(0);
    expect(`${new URL(page.url()).pathname}${new URL(page.url()).search}`).toBe('/?gate=b');

    const firstNetwork = await networkEvidence.snapshot();
    const firstQueries = firstNetwork.filter(
      (event) => event.type === 'request' && event.url.includes('/grafana/api/ds/query')
    );
    expect(firstQueries.length).toBeGreaterThanOrEqual(1);
    const firstQueryBody = firstQueryRequest.postDataJSON() as {
      from?: string;
      queries?: Array<{
        datasource?: { type?: string; uid?: string };
        refId?: string;
        scenarioId?: string;
      }>;
      to?: string;
    };
    expect(firstQueryBody.from).toMatch(/^\d+$/);
    expect(firstQueryBody.to).toMatch(/^\d+$/);
    expect(firstQueryBody.queries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          datasource: {
            type: 'grafana-testdata-datasource',
            uid: 'grsdk-testdata',
          },
          refId: 'A',
          scenarioId: 'predictable_pulse',
        }),
      ])
    );
    const firstQueryHeaders = await firstQueryRequest.allHeaders();
    expect(firstQueryHeaders['x-dashboard-uid']).toBe('grsdk-phase0-poc');
    expect(firstQueryHeaders['x-panel-id']).toBe('2');
    expect(firstQueryHeaders['x-panel-plugin-id']).toBe('stat');

    await expect
      .poll(async () => {
        const { queryEvents } = await page.evaluate(async () => {
          const path = '/src/App.tsx';
          const module = await import(/* @vite-ignore */ path);
          return module.inspectGateBHost();
        });
        const typedQueryEvents = queryEvents as readonly PocQueryEvidenceEvent[];
        const started = typedQueryEvents
          .filter(isQueryEvent)
          .filter((event) => event.outcome === 'start');
        const completed = new Set(
          typedQueryEvents
            .filter(isQueryEvent)
            .filter((event) => event.outcome === 'success')
            .map(({ requestId }) => requestId)
        );
        return started.length > 0 && started.every(({ requestId }) => completed.has(requestId));
      })
      .toBe(true);
    const beforeRefreshInspection = await page.evaluate(async () => {
      const path = '/src/App.tsx';
      const module = await import(/* @vite-ignore */ path);
      return module.inspectGateBHost();
    });
    const beforeRefreshQueryEvents =
      beforeRefreshInspection.queryEvents as readonly PocQueryEvidenceEvent[];
    const initialRequestIds = new Set(
      beforeRefreshQueryEvents
        .filter(isQueryEvent)
        .filter((event) => event.outcome === 'start')
        .map(({ requestId }) => requestId)
    );
    const initialEventCounts = new Map(
      [...initialRequestIds].map((requestId) => [
        requestId,
        beforeRefreshQueryEvents.filter(
          (event) => isQueryEvent(event) && event.requestId === requestId
        ).length,
      ])
    );

    const refreshResponse = page.waitForResponse(
      (response) => response.url().includes('/grafana/api/ds/query') && response.status() === 200
    );
    await page.getByTestId('gate-b-refresh').click();
    const refreshed = await refreshResponse;
    const refreshRequestId = new URL(refreshed.url()).searchParams.get('requestId');
    expect(refreshRequestId).toBeTruthy();
    expect(initialRequestIds.has(refreshRequestId!)).toBe(false);
    await expect
      .poll(async () => {
        const network = await networkEvidence.snapshot();
        return network.filter(
          (event) => event.type === 'request' && event.url.includes('/grafana/api/ds/query')
        ).length;
      })
      .toBe(firstQueries.length + 1);

    const inspection = await page.evaluate(async () => {
      const path = '/src/App.tsx';
      const module = await import(/* @vite-ignore */ path);
      return module.inspectGateBHost();
    });
    const queryEvents = inspection.queryEvents as readonly PocQueryEvidenceEvent[];
    expect(inspection.statPlugin).toMatchObject({
      id: 'stat',
      module: 'public/app/plugins/panel/stat/module.tsx',
      version: '13.2.3',
    });
    expect(inspection.conversionEvents.at(-1)).toEqual(
      expect.objectContaining({ panelCount: 2, panelTypes: ['text', 'stat'] })
    );
    expect(queryEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ panelId: 2, state: 'Loading', type: 'query' }),
        expect.objectContaining({ outcome: 'success', panelId: 2, state: 'Done', type: 'query' }),
      ])
    );
    expect(
      queryEvents
        .filter(isQueryEvent)
        .filter((event) => event.requestId === refreshRequestId)
        .map(({ outcome, state, type }) => ({ outcome, state, type }))
    ).toEqual([
      { outcome: 'start', state: 'Loading', type: 'query' },
      { outcome: 'success', state: 'Done', type: 'query' },
    ]);
    for (const [requestId, count] of initialEventCounts) {
      expect(
        queryEvents.filter((event) => isQueryEvent(event) && event.requestId === requestId)
      ).toHaveLength(count);
    }
    const successfulRequestIds = new Set(
      queryEvents
        .filter(isQueryEvent)
        .filter((event) => event.outcome === 'success')
        .map((event) => event.requestId)
        .filter((requestId): requestId is string => typeof requestId === 'string')
    );
    expect(successfulRequestIds.size).toBeGreaterThanOrEqual(firstQueries.length + 1);
    expect(inspection.pluginEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ cache: 'miss', pluginId: 'stat', type: 'start' }),
        expect.objectContaining({ pluginId: 'stat', type: 'cache-hit' }),
        expect.objectContaining({ pluginId: 'stat', type: 'success' }),
      ])
    );
    expect(inspection.runtime).toMatchObject({
      activeDashboardScopes: 1,
      activeLeases: 1,
      moduleIdentities: {
        react: { copies: 1, version: '19.2.8' },
        'react-dom': { copies: 1, version: '19.2.8' },
      },
      queryRuntimeStatus: 'ready',
      status: 'ready',
    });
    expect(inspection.statScene).toEqual({
      colorMode: 'background',
      reduction: { calcs: ['lastNotNull'], fields: '', values: false },
      thresholds: {
        mode: 'absolute',
        steps: [
          { color: 'green', value: -Infinity },
          { color: 'orange', value: 50 },
          { color: 'red', value: 80 },
        ],
      },
      unit: 'percent',
    });

    const valueElement = statPanel.getByText(/^(?:10|90)%$/).first();
    await expect(valueElement).toBeVisible();
    await expect(statPanel.locator('canvas')).toHaveCount(1);
    const renderedValue = await valueElement.textContent();
    const background = await valueElement.evaluate((element) => {
      let current: HTMLElement | null = element as HTMLElement;
      while (current && !getComputedStyle(current).backgroundImage.includes('gradient')) {
        current = current.parentElement;
      }
      return current ? getComputedStyle(current).backgroundImage : '';
    });
    if (renderedValue === '10%') {
      expect(background).toBe(
        'linear-gradient(120deg, rgb(107, 188, 108), rgb(106, 177, 82))'
      );
    } else {
      expect(renderedValue).toBe('90%');
      expect(background).toBe(
        'linear-gradient(120deg, rgb(231, 96, 94), rgb(226, 63, 104))'
      );
    }
    const hostStyle = await page.getByTestId('host-style-sentinel').evaluate((element) => ({
      color: getComputedStyle(element).color,
      fontFamily: getComputedStyle(element).fontFamily,
    }));
    expect(hostStyle.color).toBe('rgb(23, 36, 62)');
    expect(hostStyle.fontFamily).toContain('Inter');
    expect(await page.locator('style[data-emotion]').count()).toBeGreaterThan(0);

    await page.evaluate(async () => {
      const modulePath = '/src/main.tsx';
      const module = await import(/* @vite-ignore */ modulePath);
      module.unmountPocHost();
      await Promise.resolve();
    });
    const released = await captureResourceEvidence(page, 'gate-b-released');
    expect(released.dom).toMatchObject({ iframeElements: 0, portalChildren: 0, portalRoots: 0 });
    expect(Object.values(released.instance).every((count) => count === 0)).toBe(true);

    const queryCountBeforeRemount = (await networkEvidence.snapshot()).filter(
      (event) => event.type === 'request' && event.url.includes('/grafana/api/ds/query')
    ).length;
    await page.evaluate(async () => {
      const modulePath = '/src/main.tsx';
      const module = await import(/* @vite-ignore */ modulePath);
      const root = document.querySelector<HTMLElement>('#root');
      if (!root) throw new Error('POC host root is missing.');
      module.mountPocHost(root);
    });
    const remountedStat = page.getByRole('region', { name: 'Stat — predictable pulse' });
    await expect(remountedStat).toContainText(/(?:10|90)%/, { timeout: 15_000 });
    await expect
      .poll(async () =>
        (await networkEvidence.snapshot()).filter(
          (event) => event.type === 'request' && event.url.includes('/grafana/api/ds/query')
        ).length
      )
      .toBeGreaterThan(queryCountBeforeRemount);
    await page.evaluate(async () => {
      const modulePath = '/src/main.tsx';
      const module = await import(/* @vite-ignore */ modulePath);
      module.unmountPocHost();
      await Promise.resolve();
    });
    const remountReleased = await captureResourceEvidence(page, 'gate-b-remount-released');
    expect(Object.values(remountReleased.instance).every((count) => count === 0)).toBe(true);
    await consoleGuard.assertClean();

    const networkSummary = (await networkEvidence.snapshot())
      .filter((event) => event.url.includes('/grafana/'))
      .map((event) => ({
        ...(event.type === 'request' ? { method: event.method } : {}),
        ...(event.type === 'response' ? { status: event.status } : {}),
        type: event.type,
        url: event.url,
      }));
    const unexpectedGrafanaPaths = networkSummary
      .map(({ url }) => new URL(url).pathname)
      .filter(
        (path) =>
          !path.startsWith('/grafana/apis/dashboard.grafana.app/') &&
          path !== '/grafana/api/frontend/settings' &&
          path !== '/grafana/api/ds/query'
      );
    expect(unexpectedGrafanaPaths).toEqual([]);
    await mkdir('artifacts/playwright', { recursive: true });
    await writeFile(
      'artifacts/playwright/gate-b-stat.json',
      `${JSON.stringify(
        {
          inspection,
          network: networkSummary,
          released,
          remountReleased,
          renderedValue,
          style: { background, hostStyle },
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
