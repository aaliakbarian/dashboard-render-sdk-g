// POC / EXPERIMENT / NOT FOR PRODUCTION
import { defineConfig, devices } from '@playwright/test';

process.env.POC_TESTDATA_RUNTIME_ONLY_EXPERIMENT = '1';

export default defineConfig({
  fullyParallel: false,
  globalSetup: './globalSetup.ts',
  reporter: 'line',
  retries: 0,
  testDir: '../../e2e',
  testMatch: [
    'task10-testdata-query.spec.ts',
    'gate-b-stat.spec.ts',
    'gate-b-stat-failures.spec.ts',
    'gate-c-timeseries.spec.ts',
    'gate-c-lifecycle.spec.ts',
    'gate-c-failures.spec.ts',
    'gate-c-two-instances.spec.ts',
  ],
  use: {
    baseURL: 'http://localhost:5175',
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
      'corepack yarn workspace @dashboard-render-sdk-g/poc-host dev --port 5175 --strictPort --force',
    reuseExistingServer: false,
    timeout: 30_000,
    url: 'http://localhost:5175',
  },
});
