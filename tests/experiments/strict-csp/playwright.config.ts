// POC / EXPERIMENT / NOT FOR PRODUCTION
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  fullyParallel: false,
  reporter: 'line',
  retries: 0,
  testDir: '.',
  testMatch: 'browser.spec.ts',
  timeout: 180_000,
  use: {
    baseURL: 'http://localhost:5192',
    trace: 'off',
    viewport: { height: 1200, width: 1440 },
  },
  workers: 1,
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], browserName: 'chromium' } }],
  webServer: {
    command: 'node --experimental-strip-types /workspace/experiments/security/strict-csp/serveProfiles.ts',
    reuseExistingServer: false,
    timeout: 180_000,
    url: 'http://localhost:5192',
  },
});
