// POC / EXPERIMENT / NOT FOR PRODUCTION
import { chromium, type FullConfig } from '@playwright/test';

import { authenticateGrafanaFixture } from '../../e2e/support/grafanaAuth';

/**
 * Vite discovers the deliberately dynamic provider entry only when Gate A asks
 * for Text. Prime that development-only optimizer boundary before evidence
 * collection; the measured renderer artifact and production build do not use
 * Vite dependency optimization.
 */
export default async function prewarmTextRendererProvider(config: FullConfig) {
  if (!process.env.POC_GRAFANA_VERIFY_USER || !process.env.POC_GRAFANA_VERIFY_PASSWORD) return;

  const browser = await chromium.launch();
  const baseURL = config.projects[0]?.use.baseURL;
  if (typeof baseURL !== 'string') {
    await browser.close();
    throw new Error('The Text renderer-only experiment requires a Playwright baseURL.');
  }
  const context = await browser.newContext({ baseURL, locale: 'en-US' });
  const page = await context.newPage();
  const browserErrors: string[] = [];
  page.on('pageerror', (error) => browserErrors.push(error.message));

  const session = await authenticateGrafanaFixture(page);
  try {
    await page.goto(`${baseURL}/?gate=a`);
    // Vite invalidates while discovering this deliberately dynamic source
    // boundary. Retry the exact bridge loader across that development-only
    // invalidation and require the imported plugin to identify as Text. The
    // actual Gate A test performs every dashboard/render/lifecycle assertion
    // in a fresh context after optimization has settled.
    let loaded = false;
    for (let attempt = 0; attempt < 5 && !loaded; attempt += 1) {
      try {
        loaded = await page.evaluate(async () => {
          const modulePath = '/@fs/workspace/packages/poc-grafana-bridge/src/panels/text.ts';
          const module = await import(/* @vite-ignore */ modulePath);
          const plugin = await module.loadExactTextPanelPlugin();
          const identityPath =
            '/@fs/workspace/experiments/bundle/text-renderer-only/browserCohortIdentity.ts';
          const identityModule = await import(/* @vite-ignore */ identityPath);
          const identity = identityModule.inspectTextRendererCohortIdentity();
          return (
            typeof plugin === 'object' &&
            plugin !== null &&
            'panel' in plugin &&
            identity.config === true &&
            identity.panelPlugin === true &&
            identity.useStyles2 === true
          );
        });
      } catch (error: unknown) {
        if (!/Execution context was destroyed|Target page, context or browser has been closed/.test(String(error))) {
          throw error;
        }
      }
      if (!loaded) await page.waitForLoadState('domcontentloaded');
    }
    if (!loaded) {
      throw new Error(`Text renderer provider prewarm did not settle: ${browserErrors.join(' | ')}`);
    }
  } finally {
    await session.cleanup();
    await context.close();
    await browser.close();
  }
}
