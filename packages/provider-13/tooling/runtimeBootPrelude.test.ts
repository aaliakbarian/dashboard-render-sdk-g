import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { runInNewContext } from 'node:vm';

import { describe, expect, it } from 'vitest';

import {
  installGrafana13BootPrelude,
  type Grafana13BootWindow,
} from '../src/runtime/bootPrelude';

describe('Grafana 13 production Runtime boot prelude', () => {
  it('permits the exact pinned Runtime config import mutations', () => {
    const target = {
      location: {
        href: 'https://host.example/', origin: 'https://host.example', search: '',
      },
    } as unknown as Grafana13BootWindow;
    Object.defineProperty(globalThis, 'window', { configurable: true, value: target });
    const installation = installGrafana13BootPrelude(
      {
        basePath: '/grafana', locale: 'en-US', namespace: 'default',
        theme: 'light', timezone: 'browser',
      },
      target
    );

    const require = createRequire(import.meta.url);
    const runtimePackage = require.resolve('@grafana/runtime/package.json');
    const configPath = join(dirname(runtimePackage), 'dist/esm/config.mjs');
    const productionSource = readFileSync(configPath, 'utf8')
      .replace("import { merge } from 'lodash';", '')
      .replace("import { systemDateFormats, getThemeById, store } from '@grafana/data';", '')
      .replace('export { GrafanaBootConfig, config };', 'config;');
    const context: Record<string, unknown> = {
      URLSearchParams, Set, console,
      getThemeById: () => ({ isLight: true, v1: {} }),
      merge: (destination: object, source: object) => Object.assign(destination, source),
      process: { env: { NODE_ENV: 'test' } },
      store: { get: () => undefined },
      systemDateFormats: { update: () => undefined },
      window: target,
    };

    const runtimeConfig = runInNewContext(productionSource, context, { filename: configPath }) as {
      readonly bootData: typeof installation.bootData;
      readonly featureToggles: Record<string, boolean>;
      readonly theme2: { readonly isLight: boolean };
    };

    expect(runtimeConfig.bootData).toBe(installation.bootData);
    expect(runtimeConfig.bootData.settings.featureToggles).toBe(runtimeConfig.featureToggles);
    expect(runtimeConfig.bootData.user.lightTheme).toBe(runtimeConfig.theme2.isLight);
    expect(Object.isFrozen(installation.bootData)).toBe(true);
    expect(Object.isFrozen(installation.bootData.settings)).toBe(false);
    expect(Object.isFrozen(installation.bootData.settings.featureToggles)).toBe(false);
    expect(Object.isFrozen(installation.bootData.user)).toBe(false);
  });
});
