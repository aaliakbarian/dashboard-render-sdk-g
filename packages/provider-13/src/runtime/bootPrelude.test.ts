import { describe, expect, it } from 'vitest';

import { Grafana13RuntimeImportOrderError, installGrafana13BootPrelude } from './bootPrelude';

function target() {
  return { location: { origin: 'https://host.example' } };
}

describe('installGrafana13BootPrelude', () => {
  it('installs the exact minimal credential-free Grafana boot identity', () => {
    const window = target();
    const installation = installGrafana13BootPrelude(
      {
        basePath: '/grafana',
        locale: 'en-US',
        namespace: 'default',
        theme: 'light',
        timezone: 'browser',
      },
      window
    );

    expect(window).toHaveProperty('grafanaBootData', installation.bootData);
    expect(installation.bootData).toEqual({
      assets: { dark: '', light: '' },
      navTree: [],
      settings: {
        appSubUrl: '/grafana',
        appUrl: 'https://host.example/grafana/',
        buildInfo: { env: 'production', version: '13.2.3' },
        featureToggles: {},
        language: 'en-US',
        minRefreshInterval: '5s',
        namespace: 'default',
      },
      user: {
        language: 'en-US',
        lightTheme: true,
        theme: 'light',
        timezone: 'browser',
      },
    });
    expect(JSON.stringify(installation.bootData)).not.toMatch(
      /authorization|cookie|credential|password|token/i
    );
    expect(() => { (installation.bootData.settings as any).appSubUrl = '/other'; }).toThrow(TypeError);
    expect(() => { (installation.bootData.user as any).theme = 'dark'; }).toThrow(TypeError);
    (installation.bootData.settings.featureToggles as Record<string, boolean>).test = true;
    expect(installation.bootData.settings.featureToggles).toEqual({ test: true });
  });

  it('is idempotent only for the same identity and rejects pre-existing boot data', () => {
    const window = target();
    const config = {
      basePath: '/grafana',
      locale: 'en-US' as const,
      namespace: 'default',
      theme: 'light' as const,
      timezone: 'browser' as const,
    };
    const first = installGrafana13BootPrelude(config, window);
    expect(installGrafana13BootPrelude(config, window)).toBe(first);
    expect(() =>
      installGrafana13BootPrelude({ ...config, namespace: 'other' }, window)
    ).toThrow(Grafana13RuntimeImportOrderError);

    expect(() =>
      installGrafana13BootPrelude(config, {
        ...target(),
        grafanaBootData: { external: true },
      })
    ).toThrow(Grafana13RuntimeImportOrderError);
  });
});
