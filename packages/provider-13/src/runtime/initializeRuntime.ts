import type { HostTransportCapability } from '@dashboard-render-sdk-g/provider-contract';

import type { Grafana13TextPanelCatalog } from '../panels/catalog';
import { createGrafana13BackendSrv } from './backendSrv';
import { installGrafana13BootPrelude, type Grafana13BootWindow } from './bootPrelude';
import {
  loadGrafana13RuntimeCohort,
  type Grafana13RuntimeCohort,
} from './cohort';
import type {
  Grafana13RuntimeAcquireRequest,
  Grafana13RuntimeInitialization,
} from './coordinator';
import type { Grafana13ProviderValues } from './providers';
import type { Grafana13QueryRuntime } from './installQueryRuntime';
import { Grafana13RuntimeInitializationError } from './coordinator';

export class Grafana13NavigationUnsupportedError extends Error {
  override readonly name = 'Grafana13NavigationUnsupportedError';
  readonly code = 'navigation-unsupported' as const;
  constructor() { super('Grafana navigation is unavailable in the standalone provider.'); }
}

function installReadOnlyLocationPolicy(service: Record<string, unknown>): void {
  const reject = () => { throw new Grafana13NavigationUnsupportedError(); };
  for (const method of ['go', 'goBack', 'goForward', 'partial', 'push', 'reload', 'replace', 'update']) {
    if (typeof service[method] === 'function') service[method] = reject;
  }
  const getHistory = service.getHistory;
  const history = typeof getHistory === 'function'
    ? (getHistory as () => Record<string, unknown>).call(service)
    : undefined;
  if (history) {
    for (const method of ['go', 'goBack', 'goForward', 'push', 'replace']) {
      if (typeof history[method] === 'function') history[method] = reject;
    }
  }
}

export interface Grafana13RuntimeEnvironment {
  readonly loadQueryRuntime?: (options: { readonly backendSrv: ReturnType<typeof createGrafana13BackendSrv>; readonly panelCatalog: Grafana13TextPanelCatalog }) => Promise<Grafana13QueryRuntime>;
  readonly loadCohort?: typeof loadGrafana13RuntimeCohort;
  readonly panelCatalog: Grafana13TextPanelCatalog;
  readonly window: Grafana13BootWindow;
}

export interface Grafana13InitializedRuntime extends Grafana13RuntimeInitialization {
  acquireQueryRuntime(): Promise<Grafana13QueryRuntime>;
  readonly backendSrv: ReturnType<typeof createGrafana13BackendSrv>;
  readonly cohort: Grafana13RuntimeCohort;
  readonly providerValues: Grafana13ProviderValues;
}

export async function initializeGrafana13Runtime(
  request: Grafana13RuntimeAcquireRequest,
  environment: Grafana13RuntimeEnvironment
): Promise<Grafana13InitializedRuntime> {
  const prelude = installGrafana13BootPrelude(
    {
      basePath: request.transport.descriptor.basePath,
      locale: 'en-US',
      namespace: request.namespace,
      theme: 'light',
      timezone: 'browser',
    },
    environment.window
  );
  const cohort = await (environment.loadCohort ?? loadGrafana13RuntimeCohort)({
    prelude,
    target: environment.window,
  });

  cohort.runtime.setPluginImportUtils(environment.panelCatalog);
  if (cohort.runtime.getPluginImportUtils() !== environment.panelCatalog) {
    throw new Error('Grafana Runtime did not retain the closed Text catalogue.');
  }
  const backendSrv = createGrafana13BackendSrv(request.transport);
  cohort.runtime.setBackendSrv(backendSrv);
  if (cohort.runtime.getBackendSrv() !== backendSrv) {
    throw new Error('Grafana Runtime did not retain the host transport adapter.');
  }
  const events = new cohort.data.EventBusSrv();
  cohort.runtime.setAppEvents(events);
  if (cohort.runtime.getAppEvents() !== events) {
    throw new Error('Grafana Runtime did not retain the bounded event bus.');
  }
  const translations = await cohort.i18n.initPluginTranslations(
    'grafana-scenes',
    [cohort.scenes.loadResources]
  );
  if (translations.language !== 'en-US') {
    throw new Error('The provider requires the en-US Grafana/Scenes locale.');
  }
  const theme = cohort.runtime.config.theme2;
  if (!theme || theme.isLight !== true) {
    throw new Error('The provider requires Grafana Runtime to create the light theme.');
  }
  installReadOnlyLocationPolicy(cohort.runtime.locationService);
  let queryRuntime: Promise<Grafana13QueryRuntime> | undefined;
  return Object.freeze({
    acquireQueryRuntime() {
      const load = environment.loadQueryRuntime ?? (options => import('./installQueryRuntime').then(module => module.installGrafana13QueryRuntime(options)));
      if (!queryRuntime) queryRuntime = Promise.resolve().then(() => load({ backendSrv, panelCatalog: environment.panelCatalog }))
        .catch(() => { queryRuntime = undefined; throw new Grafana13RuntimeInitializationError(); });
      return queryRuntime;
    },
    backendSrv,
    cohort,
    providerValues: Object.freeze({ ThemeContext: cohort.data.ThemeContext, theme }),
  });
}

export function createGrafana13RuntimeInitializer(environment: {
  readonly panelCatalog: Grafana13TextPanelCatalog;
  readonly window: Grafana13BootWindow;
}) {
  return (request: Grafana13RuntimeAcquireRequest) => initializeGrafana13Runtime(request, environment);
}
