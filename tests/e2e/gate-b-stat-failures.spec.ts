import { expect, test } from '@playwright/test';
import type {
  PocQueryEvidenceEvent,
  PocTransportEvidenceEvent,
} from '@dashboard-render-sdk-g/poc-compat';
import { mkdir, writeFile } from 'node:fs/promises';

import { authenticateGrafanaFixture } from './support/grafanaAuth';
import { installConsoleGuard } from './support/consoleGuard';
import {
  installNetworkEvidence,
  type BrowserNetworkEvidenceEvent,
} from './support/networkEvidence';
import { captureResourceEvidence, installResourceEvidence } from './support/resourceEvidence';

test.use({ locale: 'en-US', trace: 'off' });

type QueryEvent = Extract<PocQueryEvidenceEvent, { type: 'query' }>;
type NetworkResponseEvent = Extract<BrowserNetworkEvidenceEvent, { type: 'response' }>;

function isQueryEvent(event: PocQueryEvidenceEvent): event is QueryEvent {
  return event.type === 'query';
}

function isNetworkResponse(event: BrowserNetworkEvidenceEvent): event is NetworkResponseEvent {
  return event.type === 'response';
}

async function inspectGateB(page: import('@playwright/test').Page) {
  return page.evaluate(async () => {
    const path = '/src/App.tsx';
    const module = await import(/* @vite-ignore */ path);
    return module.inspectGateBHost();
  });
}

async function unmount(page: import('@playwright/test').Page) {
  await page.evaluate(async () => {
    const modulePath = '/src/main.tsx';
    const module = await import(/* @vite-ignore */ modulePath);
    module.unmountPocHost();
    await Promise.resolve();
  });
}

test('cancels a real slow Stat query on UID change without stale publication', async ({ page }) => {
  test.skip(
    !process.env.POC_GRAFANA_VERIFY_USER || !process.env.POC_GRAFANA_VERIFY_PASSWORD,
    'local disposable Grafana fixture credentials are required'
  );

  const session = await authenticateGrafanaFixture(page);
  try {
    const consoleGuard = await installConsoleGuard(page);
    const networkEvidence = installNetworkEvidence(page);
    await installResourceEvidence(page);
    const queryStarted = page.waitForRequest((request) =>
      request.url().includes('/grafana/api/ds/query')
    );
    await page.goto('/?gate=b&gateBQuery=slow');
    await queryStarted;
    await page.getByTestId('gate-b-switch-uid').click();
    await expect(page.getByRole('region', { name: 'Alternate Text sentinel' })).toContainText(
      'phase0-alt',
      { timeout: 15_000 }
    );
    await expect(page.getByRole('region', { name: 'Stat — predictable pulse' })).toHaveCount(0);

    await expect
      .poll(async () => {
        const inspection = await inspectGateB(page);
        const queryEvents = inspection.queryEvents as readonly PocQueryEvidenceEvent[];
        return queryEvents.some(
          (event) => isQueryEvent(event) && event.outcome === 'cancelled' && event.panelId === 2
        );
      }, { timeout: 10_000 })
      .toBe(true);
    const evidence = await inspectGateB(page);
    const queryEvents = evidence.queryEvents as readonly PocQueryEvidenceEvent[];
    const cancelledIds = new Set(
      queryEvents
        .filter(isQueryEvent)
        .filter((event) => event.outcome === 'cancelled')
        .map(({ requestId }) => requestId)
    );
    expect(cancelledIds.size).toBeGreaterThan(0);
    expect(
      queryEvents.some(
        (event) =>
          isQueryEvent(event) && event.outcome === 'success' && cancelledIds.has(event.requestId)
      )
    ).toBe(false);
    expect(evidence.transport).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ endpoint: 'datasource-query', outcome: 'cancelled' }),
      ])
    );
    expect(await page.locator('iframe').count()).toBe(0);

    const cancelledBeforeUnmount = queryEvents.filter(
      (event) => isQueryEvent(event) && event.outcome === 'cancelled'
    ).length;
    const remountQueryStarted = page.waitForRequest((request) =>
      request.url().includes('/grafana/api/ds/query')
    );
    await page.getByTestId('gate-b-switch-uid').click();
    await remountQueryStarted;
    await unmount(page);
    await expect
      .poll(async () => {
        const afterUnmount = await inspectGateB(page);
        const afterUnmountEvents = afterUnmount.queryEvents as readonly PocQueryEvidenceEvent[];
        return afterUnmountEvents.filter(
          (event) => isQueryEvent(event) && event.outcome === 'cancelled'
        ).length;
      })
      .toBeGreaterThan(cancelledBeforeUnmount);
    const released = await captureResourceEvidence(page, 'gate-b-cancellation-released');
    expect(Object.values(released.instance).every((count) => count === 0)).toBe(true);
    await consoleGuard.assertClean();
  } finally {
    await session.cleanup();
  }
});

test('isolates a real TestData server failure from the Text panel and host', async ({ page }) => {
  test.skip(
    !process.env.POC_GRAFANA_VERIFY_USER || !process.env.POC_GRAFANA_VERIFY_PASSWORD,
    'local disposable Grafana fixture credentials are required'
  );

  const session = await authenticateGrafanaFixture(page);
  try {
    const consoleGuard = await installConsoleGuard(page, [
      {
        justification:
          'This test deliberately sends TestData server_panic queries and independently asserts their HTTP 500 responses.',
        pattern: /console-error: Failed to load resource:.*500 \(Internal Server Error\)/,
      },
    ]);
    const networkEvidence = installNetworkEvidence(page);
    await installResourceEvidence(page);
    await page.goto('/?gate=b&gateBQuery=server-error');

    await expect
      .poll(async () => {
        const evidence = await inspectGateB(page);
        const queryEvents = evidence.queryEvents as readonly PocQueryEvidenceEvent[];
        return queryEvents.some(
          (event) =>
            isQueryEvent(event) &&
            event.outcome === 'failure' &&
            event.panelId === 2 &&
            event.state === 'Error'
        );
      }, { timeout: 15_000 })
      .toBe(true);
    await expect
      .poll(async () => {
        const network = await networkEvidence.snapshot();
        return network
          .filter(isNetworkResponse)
          .find((event) => event.url.includes('/grafana/api/ds/query'))?.status;
      })
      .toBe(500);
    await expect
      .poll(async () => {
        const evidence = await inspectGateB(page);
        const transport = evidence.transport as readonly PocTransportEvidenceEvent[];
        return transport.some(
          (event) =>
            event.endpoint === 'datasource-query' &&
            event.outcome === 'http-error' &&
            event.status === 500
        );
      })
      .toBe(true);
    const failureEvidence = await inspectGateB(page);
    const failureQueryEvents = failureEvidence.queryEvents as readonly PocQueryEvidenceEvent[];
    const failureTransport =
      failureEvidence.transport as readonly PocTransportEvidenceEvent[];
    expect(failureQueryEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ outcome: 'failure', panelId: 2, state: 'Error', type: 'query' }),
      ])
    );
    expect(failureTransport).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          endpoint: 'datasource-query',
          outcome: 'http-error',
          status: 500,
        }),
      ])
    );
    const network = await networkEvidence.snapshot();
    expect(network).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: 500,
          type: 'response',
          url: expect.stringContaining('/grafana/api/ds/query'),
        }),
      ])
    );
    const failedStatPanel = page.getByRole('region', { name: 'Stat — predictable pulse' });
    await expect(failedStatPanel).toBeVisible();
    await expect(failedStatPanel.getByRole('button', { name: 'Panel status' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Text — phase0' })).toContainText('Native phase0');
    await expect(page.getByTestId('host-style-sentinel')).toBeVisible();
    await expect(page.locator('[data-poc-dashboard-error]')).toHaveCount(0);
    expect(await page.locator('iframe').count()).toBe(0);

    await mkdir('artifacts/playwright', { recursive: true });
    await writeFile(
      'artifacts/playwright/gate-b-stat-failure.json',
      `${JSON.stringify(
        {
          queryEvents: failureQueryEvents,
          transport: failureTransport,
          visible: { host: true, panelStatus: true, textPanel: true },
        },
        null,
        2
      )}\n`,
      'utf8'
    );

    await unmount(page);
    const released = await captureResourceEvidence(page, 'gate-b-failure-released');
    expect(Object.values(released.instance).every((count) => count === 0)).toBe(true);
    await consoleGuard.assertClean();
  } finally {
    await session.cleanup();
  }
});
