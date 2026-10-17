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
    baseURL: 'http://localhost:5186',
    trace: 'off',
    viewport: { height: 1200, width: 1440 },
  },
  workers: 1,
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], browserName: 'chromium' } }],
  webServer: {
    command: [
      'EMOTION_COEXISTENCE_VARIANT=provider corepack yarn vite build --config /workspace/experiments/styling/emotion-coexistence/vite.provider.config.ts',
      'EMOTION_COEXISTENCE_VARIANT=host corepack yarn vite build --config /workspace/experiments/styling/emotion-coexistence/vite.host.config.ts',
      'POC_VITE_HOST=0.0.0.0 corepack yarn vite preview --config /workspace/experiments/styling/emotion-coexistence/vite.host.config.ts',
    ].join(' && '),
    reuseExistingServer: false,
    timeout: 120_000,
    url: 'http://localhost:5186',
  },
});
