// POC / EXPERIMENT / NOT FOR PRODUCTION
import { defineConfig, devices } from '@playwright/test';

// Make the experiment selector part of this dedicated harness rather than a
// caller convention. Both the Playwright worker and Vite web server inherit it.
process.env.POC_TEXT_RENDERER_ONLY_EXPERIMENT = '1';

export default defineConfig({
  fullyParallel: false,
  globalSetup: './globalSetup.ts',
  reporter: 'line',
  retries: 0,
  testDir: '../../e2e',
  testMatch: 'gate-a-text.spec.ts',
  use: {
    baseURL: 'http://localhost:5174',
    trace: 'off',
  },
  workers: 1,
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        browserName: 'chromium',
      },
    },
  ],
  webServer: {
    command:
      'corepack yarn workspace @grafana-react-sdk/poc-host dev --port 5174 --strictPort --force',
    reuseExistingServer: false,
    timeout: 30_000,
    url: 'http://localhost:5174',
  },
});
