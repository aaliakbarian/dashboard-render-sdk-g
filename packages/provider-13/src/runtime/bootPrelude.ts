export interface Grafana13BootPreludeConfig {
  readonly basePath: string;
  readonly locale: 'en-US';
  readonly namespace: string;
  readonly theme: 'light';
  readonly timezone: 'browser';
}

export interface Grafana13MinimalBootData {
  readonly assets: { readonly dark: ''; readonly light: '' };
  readonly navTree: readonly [];
  readonly settings: {
    readonly appSubUrl: string;
    readonly appUrl: string;
    readonly buildInfo: { readonly env: 'production'; readonly version: '13.2.3' };
    readonly featureToggles: Readonly<Record<string, boolean>>;
    readonly language: 'en-US';
    readonly minRefreshInterval: '5s';
    readonly namespace: string;
  };
  readonly user: {
    readonly language: 'en-US';
    readonly lightTheme: true;
    readonly theme: 'light';
    readonly timezone: 'browser';
  };
}

export interface Grafana13BootWindow {
  grafanaBootData?: unknown;
  readonly location: { readonly origin: string };
}

export interface Grafana13BootPreludeInstallation {
  readonly bootData: Grafana13MinimalBootData;
  readonly config: Grafana13BootPreludeConfig;
  readonly target: Grafana13BootWindow;
}

export class Grafana13RuntimeImportOrderError extends Error {
  override readonly name = 'Grafana13RuntimeImportOrderError';
  readonly code = 'runtime-import-order' as const;
}

const installations = new WeakMap<object, Grafana13BootPreludeInstallation>();

function lockExcept<T extends Record<string, unknown>>(
  value: T,
  mutableKeys: readonly (keyof T)[]
): T {
  const mutable = new Set<PropertyKey>(mutableKeys);
  for (const key of Object.keys(value)) {
    Object.defineProperty(value, key, {
      configurable: false,
      enumerable: true,
      value: value[key],
      writable: mutable.has(key),
    });
  }
  return Object.preventExtensions(value);
}

function normalizeBasePath(value: string): string {
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('?') || value.includes('#')) {
    throw new Grafana13RuntimeImportOrderError('The provider base path is invalid.');
  }
  return value === '/' ? '' : value.replace(/\/+$/, '');
}

function sameIdentity(left: Grafana13BootPreludeConfig, right: Grafana13BootPreludeConfig): boolean {
  return left.basePath === right.basePath && left.locale === right.locale &&
    left.namespace === right.namespace && left.theme === right.theme &&
    left.timezone === right.timezone;
}

export function installGrafana13BootPrelude(
  input: Grafana13BootPreludeConfig,
  target: Grafana13BootWindow
): Grafana13BootPreludeInstallation {
  const config = Object.freeze({ ...input, basePath: normalizeBasePath(input.basePath) || '/' });
  const existing = installations.get(target as object);
  if (existing) {
    if (!sameIdentity(existing.config, config)) {
      throw new Grafana13RuntimeImportOrderError(
        'This JavaScript realm already has an incompatible Grafana boot identity.'
      );
    }
    return existing;
  }
  if (target.grafanaBootData !== undefined) {
    throw new Grafana13RuntimeImportOrderError(
      'Grafana boot data already exists outside the provider runtime.'
    );
  }

  const appSubUrl = config.basePath === '/' ? '' : config.basePath;
  const settings = lockExcept({
    appSubUrl,
    appUrl: `${target.location.origin}${appSubUrl}/`,
    buildInfo: Object.freeze({ env: 'production' as const, version: '13.2.3' as const }),
    featureToggles: {} as Record<string, boolean>,
    language: config.locale,
    minRefreshInterval: '5s' as const,
    namespace: config.namespace,
  }, ['featureToggles']);
  const user = lockExcept({
    language: config.locale,
    lightTheme: true as const,
    theme: config.theme,
    timezone: config.timezone,
  }, ['lightTheme']);
  const bootData = Object.freeze({
    assets: Object.freeze({ dark: '', light: '' }),
    navTree: Object.freeze([]) as readonly [],
    // The pinned Runtime config writes normalized feature toggles back through
    // bootData.settings during module evaluation.
    settings,
    // Grafana Runtime writes the resolved theme polarity back to bootData.user.
    // Keep only this exact Runtime-owned surface mutable.
    user,
  } satisfies Grafana13MinimalBootData);
  target.grafanaBootData = bootData;
  const installation = Object.freeze({ bootData, config, target });
  installations.set(target as object, installation);
  return installation;
}
