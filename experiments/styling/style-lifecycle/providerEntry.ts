// POC / EXPERIMENT / NOT FOR PRODUCTION
import createCache, { type EmotionCache } from '@emotion/cache';

import {
  createHostReactContract,
  loadStrictCspProvider,
  type StrictCspPanelId,
} from '../../security/strict-csp/providerEntry.ts';
import { validateHostReactContract, type HostReactContract } from '../../provider/react-externalized/compatibility.ts';
import { normalizeProviderAssetBase } from '../provider-assets/assetPolicy.ts';
import { normalizeStrictCspNonce } from '../../security/strict-csp/cspPolicy.ts';

export { createHostReactContract };
export type StyleLifecyclePanelId = StrictCspPanelId;

declare global {
  // eslint-disable-next-line no-var
  var __STYLE_LIFECYCLE_PROVIDER_CACHE__: EmotionCache | undefined;
  // eslint-disable-next-line no-var
  var __STYLE_LIFECYCLE_INIT_EVENTS__: string[] | undefined;
  // eslint-disable-next-line no-var
  var __STYLE_LIFECYCLE_FAIL_FIRST_PANEL__: StyleLifecyclePanelId | undefined;
  // eslint-disable-next-line no-var
  var __STYLE_LIFECYCLE_START_DORMANT__: boolean | undefined;
}

function record(step: string) {
  globalThis.__STYLE_LIFECYCLE_INIT_EVENTS__ ??= [];
  globalThis.__STYLE_LIFECYCLE_INIT_EVENTS__.push(step);
}

export async function loadStyleLifecycleProvider(options: {
  readonly assetBasePath: string;
  readonly host: HostReactContract;
  readonly nonce: string;
  readonly failFirstPanel?: StyleLifecyclePanelId;
  readonly panelIds?: readonly StyleLifecyclePanelId[];
  readonly startDormant?: boolean;
}) {
  record('provider-admission-start');
  const admission = validateHostReactContract(options.host);
  record('provider-admission-complete');

  const nonce = normalizeStrictCspNonce(options.nonce);
  const assetBasePath = normalizeProviderAssetBase(options.assetBasePath);
  if (globalThis.__zod_globalConfig?.jitless !== true) {
    throw new Error('csp.zod-jitless-late: the host prelude must configure Zod before provider admission.');
  }
  record('zod-jitless-confirmed');
  record('asset-base-validated');

  globalThis.__STYLE_LIFECYCLE_PROVIDER_CACHE__ ??= createCache({ key: 'grsdk-provider', nonce });
  if (globalThis.__STYLE_LIFECYCLE_PROVIDER_CACHE__.nonce !== nonce) {
    throw new Error('csp.provider-cache-nonce-conflict: the provider cache belongs to another document nonce.');
  }
  record('provider-emotion-cache-ready');

  globalThis.__STYLE_LIFECYCLE_FAIL_FIRST_PANEL__ = options.failFirstPanel;
  globalThis.__STYLE_LIFECYCLE_START_DORMANT__ = options.startDormant;

  const loaded = await loadStrictCspProvider({
    assetBasePath,
    host: options.host,
    nonce,
    panelIds: options.panelIds,
  });
  record('grafana-provider-implementation-loaded');
  const lifecycle = await import('./runtimeProbe.ts');

  return Object.freeze({
    admission,
    implementation: Object.freeze({
      ...loaded.implementation,
      inspectStyleLifecycleProvider: lifecycle.inspectStyleLifecycleProvider,
      probeIncompatibleRuntimeIdentity: lifecycle.probeIncompatibleRuntimeIdentity,
      styleLifecycleProviderCommand: lifecycle.styleLifecycleProviderCommand,
    }),
  });
}
