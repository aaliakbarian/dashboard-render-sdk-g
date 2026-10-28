import type { BackendSrv } from '@grafana/runtime';
import type { Context } from 'react';

import type { Grafana13TextPanelCatalog } from '../panels/catalog';
import {
  Grafana13RuntimeImportOrderError,
  type Grafana13BootPreludeInstallation,
  type Grafana13BootWindow,
} from './bootPrelude';

export { Grafana13RuntimeImportOrderError } from './bootPrelude';

export const GRAFANA_13_RUNTIME_VERSIONS = Object.freeze({
  '@grafana/data': '13.2.3',
  '@grafana/i18n': '13.2.3',
  '@grafana/runtime': '13.2.3',
  '@grafana/scenes': '8.13.5',
  '@grafana/ui': '13.2.3',
} as const);

interface EventBus {
  publish(event: { readonly type?: string }): void;
  removeAllListeners(): void;
}

export interface Grafana13RuntimeModule {
  readonly config: {
    readonly appSubUrl: string;
    readonly bootData: unknown;
    readonly namespace: string;
    readonly theme2: { readonly isLight: boolean };
  };
  readonly locationService: Record<string, unknown>;
  getAppEvents(): unknown;
  getBackendSrv(): BackendSrv;
  getPluginImportUtils(): Grafana13TextPanelCatalog;
  setAppEvents(events: EventBus): void;
  setBackendSrv(backend: BackendSrv): void;
  setPluginImportUtils(catalog: Grafana13TextPanelCatalog): void;
}

export interface Grafana13DataModule {
  readonly EventBusSrv: new () => EventBus;
  readonly ThemeContext: Context<{ readonly isLight: boolean }>;
}

export interface Grafana13I18nModule {
  initPluginTranslations(
    id: string,
    loaders: Array<(language: string) => Promise<unknown>>
  ): Promise<{ readonly language: string }>;
}

export interface Grafana13ScenesModule {
  readonly ConstantVariable: new (state: Record<string, unknown>) => any;
  readonly SceneGridItem: new (state: Record<string, unknown>) => any;
  readonly SceneGridLayout: new (state: Record<string, unknown>) => any;
  readonly SceneObjectBase: new (state: Record<string, unknown>) => any;
  readonly SceneReactObject: new (state: Record<string, unknown>) => any;
  readonly SceneTimeRange: new (state: Record<string, unknown>) => any;
  readonly SceneVariableSet: new (state: Record<string, unknown>) => any;
  readonly VizPanel: new (state: Record<string, unknown>) => any;
  readonly loadResources: (language: string) => Promise<unknown>;
}

export interface Grafana13RuntimeCohort {
  readonly data: Grafana13DataModule;
  readonly i18n: Grafana13I18nModule;
  readonly runtime: Grafana13RuntimeModule;
  readonly scenes: Grafana13ScenesModule;
  readonly ui: Record<string, unknown>;
  readonly versions: typeof GRAFANA_13_RUNTIME_VERSIONS;
}

export type Grafana13ModuleImporter = (specifier: string) => Promise<unknown>;

async function defaultImporter(specifier: string): Promise<unknown> {
  switch (specifier) {
    case '@grafana/runtime': return import('@grafana/runtime');
    case '@grafana/data': return import('@grafana/data');
    case '@grafana/i18n': return import('@grafana/i18n');
    case '@grafana/scenes': return import('@grafana/scenes');
    case '@grafana/ui': return import('@grafana/ui');
    default: throw new Grafana13RuntimeImportOrderError('An unapproved Grafana module was requested.');
  }
}

export async function loadGrafana13RuntimeCohort(options: {
  readonly importer?: Grafana13ModuleImporter;
  readonly prelude?: Grafana13BootPreludeInstallation;
  readonly target: Grafana13BootWindow;
}): Promise<Grafana13RuntimeCohort> {
  const { prelude, target } = options;
  if (!prelude || prelude.target !== target || target.grafanaBootData !== prelude.bootData) {
    throw new Grafana13RuntimeImportOrderError(
      'The boot prelude must be installed before Grafana Runtime is imported.'
    );
  }
  const importer = options.importer ?? defaultImporter;
  const runtime = (await importer('@grafana/runtime')) as Grafana13RuntimeModule;
  const expectedAppSubUrl = prelude.config.basePath === '/' ? '' : prelude.config.basePath;
  if (
    runtime.config?.bootData !== prelude.bootData ||
    runtime.config.appSubUrl !== expectedAppSubUrl ||
    runtime.config.namespace !== prelude.config.namespace
  ) {
    throw new Grafana13RuntimeImportOrderError(
      'Grafana Runtime captured an incompatible or pre-existing boot identity.'
    );
  }
  const data = (await importer('@grafana/data')) as Grafana13DataModule;
  const i18n = (await importer('@grafana/i18n')) as Grafana13I18nModule;
  const scenes = (await importer('@grafana/scenes')) as Grafana13ScenesModule;
  const ui = (await importer('@grafana/ui')) as Record<string, unknown>;
  return Object.freeze({
    data,
    i18n,
    runtime,
    scenes,
    ui,
    versions: GRAFANA_13_RUNTIME_VERSIONS,
  });
}
