import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/sdk-e2e',
  outputDir: '/tmp/dashboard-render-sdk-g-sdk-playwright',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'line',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], browserName: 'chromium' },
    },
  ],
  webServer: {
    command: 'corepack yarn build:sdk-slice && corepack yarn workspace @dashboard-render-sdk-g/sdk-host preview',
    url: 'http://localhost:5173',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
