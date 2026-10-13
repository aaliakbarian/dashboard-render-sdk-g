// POC / EXPERIMENT / NOT FOR PRODUCTION
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  fullyParallel: false,
  reporter: 'line',
  retries: 0,
  testDir: '.',
  testMatch: 'browser.spec.ts',
  timeout: 60_000,
  use: {
    baseURL: 'http://localhost:5181',
    trace: 'off',
    viewport: { height: 1100, width: 1440 },
  },
  workers: 1,
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], browserName: 'chromium' } }],
  webServer: {
    command:
      'SHARED_COHORT_VARIANT=browser SHARED_COHORT_PORT=5181 POC_VITE_HOST=0.0.0.0 corepack yarn vite preview --config /workspace/experiments/bundle/shared-grafana-cohort/vite.config.ts',
    reuseExistingServer: false,
    timeout: 30_000,
    url: 'http://localhost:5181',
  },
});
