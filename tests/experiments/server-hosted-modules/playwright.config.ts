// POC / NOT FOR PRODUCTION
// Isolates the bounded Phase 1 server-hosted-module experiment from the
// repository's normal browser suite while retaining its container-first setup.
import { defineConfig } from '@playwright/test';

import baseConfig from '../../../playwright.config';

export default defineConfig(baseConfig, {
  testDir: '.',
  testMatch: '**/*.spec.ts',
});
