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
    baseURL: 'http://localhost:5182',
    trace: 'off',
    viewport: { height: 1100, width: 1440 },
  },
  workers: 1,
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], browserName: 'chromium' } }],
  webServer: {
    command: [
      'REACT_EXTERNALIZED_VARIANT=provider corepack yarn vite build --config /workspace/experiments/provider/react-externalized/vite.provider.config.ts',
      'REACT_EXTERNALIZED_VARIANT=host corepack yarn vite build --config /workspace/experiments/provider/react-externalized/vite.host.config.ts',
      'POC_VITE_HOST=0.0.0.0 corepack yarn vite preview --config /workspace/experiments/provider/react-externalized/vite.host.config.ts',
    ].join(' && '),
    reuseExistingServer: false,
    timeout: 45_000,
    url: 'http://localhost:5182',
  },
});
