// POC / EXPERIMENT / NOT FOR PRODUCTION
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  fullyParallel: false,
  reporter: 'line',
  retries: 0,
  testDir: '.',
  testMatch: 'browser.spec.ts',
  timeout: 45_000,
  use: {
    baseURL: 'http://localhost:5180',
    trace: 'off',
    viewport: { height: 1000, width: 1440 },
  },
  workers: 1,
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], browserName: 'chromium' } }],
  webServer: {
    command:
      'LAZY_PANEL_VARIANT=browser LAZY_PANEL_PORT=5180 POC_VITE_HOST=0.0.0.0 corepack yarn vite preview --config /workspace/experiments/bundle/lazy-panel-chunks/vite.config.ts',
    reuseExistingServer: false,
    timeout: 30_000,
    url: 'http://localhost:5180',
  },
});
