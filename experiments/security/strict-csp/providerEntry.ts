// POC / EXPERIMENT / NOT FOR PRODUCTION
import { cache as providerCssCache } from '@emotion/css';

import {
  createHostReactContract,
  loadReactExternalizedProvider,
  validateHostReactContract,
  type HostReactContract,
} from '../../provider/react-externalized/compatibility.ts';
import { normalizeProviderAssetBase } from '../../styling/provider-assets/assetPolicy.ts';
import { normalizeStrictCspNonce } from './cspPolicy.ts';

export { createHostReactContract };

export type StrictCspPanelId = 'stat' | 'text' | 'timeseries';

declare global {
  // eslint-disable-next-line no-var
  var __PROVIDER_ASSET_EXPERIMENT_CONFIG__: {
    readonly assetBasePath: string;
    readonly panelIds: readonly StrictCspPanelId[];
  } | undefined;
  // eslint-disable-next-line no-var
  var __STRICT_CSP_PROVIDER_CONFIG__: {
    readonly nonce: string;
  } | undefined;
  // Zod 4 documents this realm-shared configuration as the pre-import path
  // for strict CSP environments that must never execute its eval probe.
  // eslint-disable-next-line no-var
  var __zod_globalConfig: { jitless?: boolean } | undefined;
}

function configureProviderCssNonce(nonce: string) {
  const configured = globalThis.__STRICT_CSP_PROVIDER_CONFIG__;
  if (configured && configured.nonce !== nonce) {
    throw new Error('csp.nonce-conflict: a different response nonce already owns this provider realm.');
  }
  const incompatibleTag = providerCssCache.sheet.tags.find((tag) => tag.nonce !== nonce);
  if (incompatibleTag) {
    throw new Error('csp.emotion-css-already-emitted: provider CSS existed before nonce configuration.');
  }
  providerCssCache.nonce = nonce;
  providerCssCache.sheet.nonce = nonce;
  globalThis.__STRICT_CSP_PROVIDER_CONFIG__ = { nonce };
}

export async function loadStrictCspProvider(options: {
  readonly assetBasePath: string;
  readonly host: HostReactContract;
  readonly nonce: string;
  readonly panelIds?: readonly StrictCspPanelId[];
}) {
  validateHostReactContract(options.host);
  const nonce = normalizeStrictCspNonce(options.nonce);
  const assetBasePath = normalizeProviderAssetBase(options.assetBasePath);
  const panelIds = options.panelIds ?? ['text', 'stat', 'timeseries'];
  globalThis.__zod_globalConfig ??= {};
  globalThis.__zod_globalConfig.jitless = true;
  configureProviderCssNonce(nonce);
  globalThis.__PROVIDER_ASSET_EXPERIMENT_CONFIG__ = { assetBasePath, panelIds };
  return loadReactExternalizedProvider({
    host: options.host,
    loadImplementation: () => import('./providerRuntime.tsx'),
  });
}
