import { describe, expect, it, vi } from 'vitest';

import { installGrafana13BootPrelude } from './bootPrelude';
import { Grafana13RuntimeImportOrderError, loadGrafana13RuntimeCohort } from './cohort';

function windowTarget() {
  return { location: { origin: 'https://host.example' } };
}

describe('loadGrafana13RuntimeCohort', () => {
  it('fails before invoking an importer when the prelude is missing', async () => {
    const importer = vi.fn();
    await expect(
      loadGrafana13RuntimeCohort({ importer, target: windowTarget() })
    ).rejects.toBeInstanceOf(Grafana13RuntimeImportOrderError);
    expect(importer).not.toHaveBeenCalled();
  });

  it('imports Runtime first and verifies the exact captured boot object', async () => {
    const target = windowTarget();
    const prelude = installGrafana13BootPrelude(
      {
        basePath: '/grafana',
        locale: 'en-US',
        namespace: 'default',
        theme: 'light',
        timezone: 'browser',
      },
      target
    );
    const imports: string[] = [];
    const modules = {
      '@grafana/runtime': {
        config: {
          appSubUrl: '/grafana',
          bootData: prelude.bootData,
          namespace: 'default',
          theme2: { isLight: true },
        },
      },
      '@grafana/data': { EventBusSrv: class {} },
      '@grafana/i18n': { initPluginTranslations: vi.fn() },
      '@grafana/scenes': { loadResources: vi.fn() },
      '@grafana/ui': { identity: 'ui' },
    };
    const cohort = await loadGrafana13RuntimeCohort({
      importer: async (specifier) => {
        imports.push(specifier);
        return modules[specifier as keyof typeof modules];
      },
      prelude,
      target,
    });
    expect(imports[0]).toBe('@grafana/runtime');
    expect(imports.slice(1)).toEqual([
      '@grafana/data',
      '@grafana/i18n',
      '@grafana/scenes',
      '@grafana/ui',
    ]);
    expect(cohort.runtime).toBe(modules['@grafana/runtime']);
    expect(cohort.versions).toEqual({
      '@grafana/data': '13.2.3',
      '@grafana/i18n': '13.2.3',
      '@grafana/runtime': '13.2.3',
      '@grafana/scenes': '8.13.5',
      '@grafana/ui': '13.2.3',
    });
  });

  it('rejects a Runtime module that captured boot data before the prelude', async () => {
    const target = windowTarget();
    const prelude = installGrafana13BootPrelude(
      {
        basePath: '/',
        locale: 'en-US',
        namespace: 'default',
        theme: 'light',
        timezone: 'browser',
      },
      target
    );
    await expect(
      loadGrafana13RuntimeCohort({
        importer: async () => ({
          config: {
            appSubUrl: '',
            bootData: {},
            namespace: 'default',
            theme2: { isLight: true },
          },
        }),
        prelude,
        target,
      })
    ).rejects.toBeInstanceOf(Grafana13RuntimeImportOrderError);
  });
});
