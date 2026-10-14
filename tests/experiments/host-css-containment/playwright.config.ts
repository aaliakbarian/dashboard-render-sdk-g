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
    baseURL: 'http://localhost:5184',
    trace: 'off',
    viewport: { height: 1100, width: 1440 },
  },
  workers: 1,
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], browserName: 'chromium' } }],
  webServer: {
    command:
      'SHARED_COHORT_VARIANT=browser HOST_CSS_CONTAINMENT_PORT=5184 POC_VITE_HOST=0.0.0.0 corepack yarn vite build --config /workspace/experiments/styling/host-css-containment/vite.config.ts && SHARED_COHORT_VARIANT=browser HOST_CSS_CONTAINMENT_PORT=5184 POC_VITE_HOST=0.0.0.0 corepack yarn vite preview --config /workspace/experiments/styling/host-css-containment/vite.config.ts',
    reuseExistingServer: false,
    timeout: 120_000,
    url: 'http://localhost:5184',
  },
});
