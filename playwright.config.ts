import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'line',
  use: {
    baseURL: 'http://localhost:5173',
    // Native traces/HARs can retain cookies or headers. Task 4 writes only
    // explicitly sanitized network evidence through the test support layer.
    trace: 'off',
  },
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
    command: 'corepack yarn workspace @dashboard-render-sdk-g/poc-host dev',
    url: 'http://localhost:5173',
    reuseExistingServer: process.env.POC_REUSE_EXISTING_SERVER === '1',
    timeout: 30_000,
  },
});
