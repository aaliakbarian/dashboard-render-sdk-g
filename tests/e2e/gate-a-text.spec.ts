import { expect, test, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

import { authenticateGrafanaFixture } from './support/grafanaAuth';
import { installConsoleGuard } from './support/consoleGuard';
import { installNetworkEvidence } from './support/networkEvidence';
import {
  captureResourceEvidence,
  installResourceEvidence,
  writeResourceEvidence,
} from './support/resourceEvidence';

test.use({ locale: 'en-US', trace: 'off' });

async function inspectGateA(page: Page) {
  return page.evaluate(async () => {
    const modulePath = '/src/App.tsx';
    const module = await import(/* @vite-ignore */ modulePath);
    return module.inspectGateAHost();
  });
}

async function unmountHost(page: Page) {
  await page.evaluate(async () => {
    const modulePath = '/src/main.tsx';
    const module = await import(/* @vite-ignore */ modulePath);
    module.unmountPocHost();
    await Promise.resolve();
  });
}

async function remountHost(page: Page) {
  await page.evaluate(async () => {
    const modulePath = '/src/main.tsx';
    const module = await import(/* @vite-ignore */ modulePath);
    const root = document.querySelector<HTMLElement>('#root');
    if (!root) throw new Error('The Gate A host root is missing.');
    module.mountPocHost(root);
  });
}

test('renders the real Grafana Text panel from the dashboard UID with clean lifecycle', async ({
  page,
}) => {
  test.skip(
    !process.env.POC_GRAFANA_VERIFY_USER || !process.env.POC_GRAFANA_VERIFY_PASSWORD,
    'local disposable Grafana fixture credentials are required'
  );

  const session = await authenticateGrafanaFixture(page);
  try {
    const debugPageErrors: string[] = [];
    page.on('pageerror', (error) => debugPageErrors.push(error.stack ?? error.message));
    const consoleGuard = await installConsoleGuard(page);
    const networkEvidence = installNetworkEvidence(page);
    await installResourceEvidence(page);
    await page.goto('/?gate=a');
    const pageBaselineResources = await captureResourceEvidence(page, 'gate-a-page-baseline');

    await page.evaluate(() => {
      let iframeAdds = 0;
      const observer = new MutationObserver((records) => {
        for (const record of records) {
          for (const node of record.addedNodes) {
            if (!(node instanceof Element)) continue;
            iframeAdds +=
              (node.tagName.toLowerCase() === 'iframe' ? 1 : 0) +
              node.querySelectorAll('iframe').length;
          }
        }
      });
      observer.observe(document, { childList: true, subtree: true });
      Object.defineProperty(globalThis, '__POC_GATE_A_MUTATION_OBSERVER__', {
        configurable: true,
        value: {
          disconnect() {
            observer.disconnect();
            return { iframeAdds, remainingRecords: observer.takeRecords().length };
          },
        },
      });
    });

    const textPanel = page.getByTestId('TextPanel-converted-content');
    try {
      await page
        .locator('[data-poc-dashboard-error], [data-testid="TextPanel-converted-content"]')
        .first()
        .waitFor({ timeout: 10_000 });
    } catch (error: unknown) {
      throw new Error(
        `Gate A did not settle: ${JSON.stringify({ console: await consoleGuard.snapshot(), debugPageErrors, diagnostics: await inspectGateA(page) })}`,
        { cause: error }
      );
    }
    const dashboardErrorElement = page.locator('[data-poc-dashboard-error]');
    const dashboardError =
      (await dashboardErrorElement.count()) === 0
        ? null
        : await dashboardErrorElement.getAttribute('data-poc-dashboard-error');
    expect(dashboardError, `Gate A dashboard failed with ${dashboardError ?? 'no category'}.`).toBeNull();

    await expect(textPanel).toBeVisible();
    await expect(textPanel).toContainText('Dashboard Render SDK G POC');
    await expect(textPanel).toContainText('Native phase0 Text fixture for phase0.');
    await expect(textPanel.locator('strong')).toHaveText('phase0');
    await expect(page.getByRole('region', { name: 'Text — phase0' })).toBeVisible();
    expect(await textPanel.locator('script').count()).toBe(0);
    expect(await page.locator('iframe').count()).toBe(0);
    expect(await page.getByRole('navigation').count()).toBe(0);
    expect(`${new URL(page.url()).pathname}${new URL(page.url()).search}${new URL(page.url()).hash}`).toBe(
      '/?gate=a'
    );

    const panelBox = await page.getByRole('region', { name: 'Text — phase0' }).boundingBox();
    expect(panelBox?.width).toBeGreaterThan(200);
    expect(panelBox?.height).toBeGreaterThan(100);
    const primaryHostStyle = await page.getByTestId('host-style-sentinel').evaluate((element) => {
      const style = getComputedStyle(element);
      return { color: style.color, fontFamily: style.fontFamily };
    });
    expect(primaryHostStyle.color).toBe('rgb(23, 36, 62)');
    expect(primaryHostStyle.fontFamily).toContain('Inter');
    await expect(page.locator('body')).toHaveCSS('margin', '8px');
    const panelTypography = await textPanel.evaluate((element) => getComputedStyle(element).fontFamily);
    expect(panelTypography).toContain('Inter');

    const primaryInspection = await inspectGateA(page);
    expect(primaryInspection.runtime).toMatchObject({
      activeDashboardScopes: 1,
      activeLeases: 1,
      initializationSteps: [
        'host-config-validated',
        'boot-data-installed',
        'asset-policy-installed',
        'grafana-cohort-loaded',
        'text-option-editors-installed',
        'panel-catalog-installed',
        'theme-selected',
        'i18n-initialized',
        'backend-transport-installed',
        'app-events-installed',
        'location-policy-installed',
        'runtime-ready',
      ],
      moduleIdentities: {
        react: { copies: 1, version: '19.2.8' },
        'react-dom': { copies: 1, version: '19.2.8' },
      },
      portal: { activeReferences: 1, ownsRoot: true },
      status: 'ready',
    });
    expect(primaryInspection.plugin).toMatchObject({
      id: 'text',
      module: 'public/app/plugins/panel/text/v1/module.tsx',
      version: '13.2.3',
    });
    expect(primaryInspection.conversionEvents).toEqual([
      expect.objectContaining({
        layout: 'grid',
        outcome: 'success',
        panelCount: 1,
        panelTypes: ['text'],
        uid: 'grsdk-phase0-poc',
      }),
    ]);
    expect(primaryInspection.pluginEvents).toEqual([
      expect.objectContaining({ cache: 'miss', pluginId: 'text', strategy: 'P1-direct-source', type: 'start' }),
      { pluginId: 'text', type: 'cache-hit' },
      expect.objectContaining({ pluginId: 'text', type: 'success', version: '13.2.3' }),
    ]);
    expect(primaryInspection.scenes).toEqual([{ active: true, uid: 'grsdk-phase0-poc' }]);
    expect(primaryInspection.theme).toEqual({ isLight: true });

    const mountedResources = await captureResourceEvidence(page, 'gate-a-primary-mounted');
    expect(mountedResources.dom).toMatchObject({ iframeElements: 0, portalChildren: 0, portalRoots: 1 });
    expect(mountedResources.dom.emotionStyleElements).toBeGreaterThan(0);
    const mutationObserverCreations = await page.evaluate(() =>
      (
        globalThis as typeof globalThis & {
          __POC_RESOURCE_EVIDENCE__?: { mutationObserverCreations(): string[] };
        }
      ).__POC_RESOURCE_EVIDENCE__?.mutationObserverCreations()
    );
    expect(mutationObserverCreations).toHaveLength(2);
    expect(mutationObserverCreations?.[1]).toContain(
      'InjectedScript._setupGlobalListenersRemovalDetection'
    );
    expect(mountedResources.page.mutationObserver).toBe(
      pageBaselineResources.page.mutationObserver + 2
    );

    await page.getByTestId('gate-a-switch-uid').click();
    await expect(textPanel).toContainText('Native phase0-alt lifecycle fixture.');
    await expect(page.getByRole('region', { name: 'Alternate Text sentinel' })).toBeVisible();
    await expect(textPanel).not.toContainText('Native phase0 Text fixture');
    const uidInspection = await inspectGateA(page);
    expect(uidInspection.conversionEvents.at(-1)).toEqual(
      expect.objectContaining({
        outcome: 'success',
        panelCount: 1,
        panelTypes: ['text'],
        uid: 'grsdk-phase0-poc-alt',
      })
    );
    expect(uidInspection.scenes).toEqual([
      { active: false, uid: 'grsdk-phase0-poc' },
      { active: true, uid: 'grsdk-phase0-poc-alt' },
    ]);

    await unmountHost(page);
    await expect(page.locator('#root')).toBeEmpty();
    const firstUnmountInspection = await inspectGateA(page);
    expect(firstUnmountInspection.runtime).toMatchObject({
      activeDashboardScopes: 0,
      activeLeases: 0,
      portal: { activeReferences: 0, ownsRoot: false },
    });
    expect(
      firstUnmountInspection.scenes.every((scene: { active: boolean }) => !scene.active)
    ).toBe(true);
    const firstUnmountResources = await captureResourceEvidence(page, 'gate-a-first-unmount');
    expect(firstUnmountResources.dom).toMatchObject({ iframeElements: 0, portalChildren: 0, portalRoots: 0 });
    expect(Object.values(firstUnmountResources.instance).every((count) => count === 0)).toBe(true);

    await remountHost(page);
    await expect(textPanel).toContainText('Native phase0 Text fixture for phase0.');
    const remountHostStyle = await page.getByTestId('host-style-sentinel').evaluate((element) => {
      const style = getComputedStyle(element);
      return { color: style.color, fontFamily: style.fontFamily };
    });
    expect(remountHostStyle).toEqual(primaryHostStyle);
    const remountedResources = await captureResourceEvidence(page, 'gate-a-remounted');
    expect(remountedResources.dom.portalRoots).toBe(1);
    expect(remountedResources.dom.emotionStyleElements).toBe(mountedResources.dom.emotionStyleElements);
    const remountInspection = await inspectGateA(page);
    expect(remountInspection.pluginEvents).toEqual(primaryInspection.pluginEvents);
    expect(remountInspection.scenes.at(-1)).toEqual({ active: true, uid: 'grsdk-phase0-poc' });

    const sourceResources = await page.evaluate(() =>
      performance
        .getEntriesByType('resource')
        .map(({ name }) => new URL(name).pathname)
        .filter((path) =>
          /poc-grafana-bridge|plugins\/panel\/text|text-renderer-only|rendererOnly|task8Text|monaco|codicon|worker/i.test(
            path
          )
        )
    );
    if (process.env.POC_TEXT_RENDERER_ONLY_EXPERIMENT === '1') {
      const cohortIdentity = await page.evaluate(async () => {
        const identityPath =
          '/@fs/workspace/experiments/bundle/text-renderer-only/browserCohortIdentity.ts';
        const module = await import(/* @vite-ignore */ identityPath);
        return module.inspectTextRendererCohortIdentity();
      });
      expect(cohortIdentity).toEqual({ config: true, panelPlugin: true, useStyles2: true });
      expect(
        sourceResources.some(
          (path) =>
            path.includes('/experiments/bundle/text-renderer-only/rendererOnly.ts') ||
            /\/assets\/rendererOnly-[^/]+\.js$/.test(path)
        )
      ).toBe(true);
      expect(
        sourceResources.some((path) =>
          path.includes('poc-pinned-grafana-source:text-renderer-only:v1/TextPanel.tsx')
        )
      ).toBe(true);
      expect(
        sourceResources.some((path) => path.includes('/public/app/plugins/panel/text/v1/module.tsx'))
      ).toBe(false);
    } else {
      expect(sourceResources).toEqual(
        expect.arrayContaining([
          expect.stringContaining('/packages/poc-grafana-bridge/src/panels/text.ts'),
          expect.stringContaining('/public/app/plugins/panel/text/v1/module.tsx'),
        ])
      );
    }
    expect(sourceResources.some((path) => /monaco|codicon|worker/i.test(path))).toBe(false);
    expect(sourceResources.some((path) => path.includes('/text/v2/'))).toBe(false);

    await unmountHost(page);
    const mutationEvidence = await page.evaluate(() => {
      const target = globalThis as typeof globalThis & {
        __POC_GATE_A_MUTATION_OBSERVER__?: {
          disconnect(): { iframeAdds: number; remainingRecords: number };
        };
      };
      const result = target.__POC_GATE_A_MUTATION_OBSERVER__?.disconnect();
      delete target.__POC_GATE_A_MUTATION_OBSERVER__;
      return result;
    });
    expect(mutationEvidence).toEqual({ iframeAdds: 0, remainingRecords: 0 });
    const finalResources = await captureResourceEvidence(page, 'gate-a-final-unmount');
    expect(finalResources.dom).toMatchObject({ iframeElements: 0, portalChildren: 0, portalRoots: 0 });
    expect(finalResources.iframes).toEqual({ current: 0, observations: [] });
    expect(Object.values(finalResources.instance).every((count) => count === 0)).toBe(true);
    expect(finalResources.page.mutationObserver).toBe(
      pageBaselineResources.page.mutationObserver + 1
    );
    expect(
      await page.evaluate(() =>
        (
          globalThis as typeof globalThis & {
            __POC_RESOURCE_EVIDENCE__?: { mutationObserverCreations(): string[] };
          }
        ).__POC_RESOURCE_EVIDENCE__?.mutationObserverCreations().length
      )
    ).toBe(2);
    const resizeObserverEvents = await page.evaluate(() =>
      (
        globalThis as typeof globalThis & {
          __POC_RESOURCE_EVIDENCE__?: {
            resizeObserverEvents(): Array<{ event: string; stack?: string }>;
          };
        }
      ).__POC_RESOURCE_EVIDENCE__?.resizeObserverEvents()
    );
    expect(
      finalResources.page.resizeObserver,
      `ResizeObserver events: ${JSON.stringify(resizeObserverEvents)}`
    ).toBe(firstUnmountResources.page.resizeObserver);
    expect(finalResources.page).toMatchObject({
      animationFrame: firstUnmountResources.page.animationFrame,
      fetch: firstUnmountResources.page.fetch,
      interval: firstUnmountResources.page.interval,
      portal: firstUnmountResources.page.portal,
      portalChild: firstUnmountResources.page.portalChild,
      sceneActivation: firstUnmountResources.page.sceneActivation,
      subscription: firstUnmountResources.page.subscription,
      timeout: firstUnmountResources.page.timeout,
    });

    const browserNetwork = await networkEvidence.snapshot();
    const grafanaRequests = browserNetwork.filter(
      (entry) => entry.type === 'request' && entry.url.includes('/grafana/')
    );
    expect(grafanaRequests.some((entry) => entry.url.includes('/api/ds/query'))).toBe(false);
    expect(grafanaRequests.some((entry) => entry.url.includes('/api/dashboards/uid/'))).toBe(false);
    expect(grafanaRequests.some((entry) => entry.url.includes('/public/app/plugins/'))).toBe(false);
    expect(
      grafanaRequests.every((entry) => entry.url.includes('/apis/dashboard.grafana.app/'))
    ).toBe(true);
    expect(grafanaRequests.filter((entry) => entry.url.includes('/apis/dashboard.grafana.app/'))).toHaveLength(4);
    expect(JSON.stringify({ browserNetwork, primaryInspection, remountInspection })).not.toMatch(
      /Bearer |authorization|cookie|password|service.?account|responseBody|queryText/i
    );

    expect(debugPageErrors).toEqual([]);
    await consoleGuard.assertClean();
    await mkdir('artifacts/playwright', { recursive: true });
    await writeFile(
      'artifacts/playwright/gate-a-text.json',
      `${JSON.stringify(
        {
          assets: sourceResources,
          lifecycle: {
            firstUnmount: firstUnmountInspection.runtime,
            primary: primaryInspection,
            remount: remountInspection,
            uidChange: uidInspection.scenes,
          },
          mutationEvidence,
          panelBox,
          styles: { panelTypography, primaryHostStyle, remountHostStyle },
        },
        null,
        2
      )}\n`,
      'utf8'
    );
    await networkEvidence.write('artifacts/playwright/gate-a-text-network.json');
    await writeResourceEvidence('artifacts/playwright/gate-a-text-resources.json', [
      pageBaselineResources,
      mountedResources,
      firstUnmountResources,
      remountedResources,
      finalResources,
    ]);
  } finally {
    await session.cleanup();
  }
});
