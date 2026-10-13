// POC / EXPERIMENT / NOT FOR PRODUCTION
import { chromium, type FullConfig } from '@playwright/test';

import { authenticateGrafanaFixture } from '../../e2e/support/grafanaAuth';

export default async function prewarmTestDataRuntimeProvider(config: FullConfig) {
  if (!process.env.POC_GRAFANA_VERIFY_USER || !process.env.POC_GRAFANA_VERIFY_PASSWORD) return;

  const browser = await chromium.launch();
  const baseURL = config.projects[0]?.use.baseURL;
  if (typeof baseURL !== 'string') {
    await browser.close();
    throw new Error('The TestData runtime-only experiment requires a Playwright baseURL.');
  }
  const context = await browser.newContext({ baseURL, locale: 'en-US' });
  const page = await context.newPage();
  const session = await authenticateGrafanaFixture(page);
  try {
    await page.goto(baseURL);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        const loaded = await page.evaluate(async () => {
          const path = '/@fs/workspace/packages/poc-grafana-bridge/src/datasources/testdata.ts';
          const module = await import(/* @vite-ignore */ path);
          return typeof (await module.loadExactTestDataDataSourceClass()) === 'function';
        });
        if (loaded) return;
      } catch (error: unknown) {
        if (!/Execution context was destroyed|Target page, context or browser has been closed/.test(String(error))) {
          throw error;
        }
      }
      await page.waitForLoadState('domcontentloaded');
    }
    throw new Error('The TestData runtime-only provider optimizer prewarm did not settle.');
  } finally {
    await session.cleanup();
    await context.close();
    await browser.close();
  }
}
