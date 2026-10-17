// POC / EXPERIMENT / NOT FOR PRODUCTION
import {
  createHostReactContract,
  loadReactExternalizedProvider,
  type HostReactContract,
} from '../../provider/react-externalized/compatibility.ts';

import { normalizeProviderAssetBase } from './assetPolicy.ts';

export { createHostReactContract };

declare global {
  // eslint-disable-next-line no-var
  var __PROVIDER_ASSET_EXPERIMENT_CONFIG__: {
    readonly assetBasePath: string;
    readonly panelIds: readonly ProviderAssetPanelId[];
  } | undefined;
}

export type ProviderAssetPanelId = 'stat' | 'text' | 'timeseries';

let configuredAssetBase: string | undefined;

export async function loadProviderAssetExperiment(options: {
  readonly assetBasePath: string;
  readonly host: HostReactContract;
  readonly panelIds?: readonly ProviderAssetPanelId[];
}) {
  const assetBasePath = normalizeProviderAssetBase(options.assetBasePath);
  if (configuredAssetBase && configuredAssetBase !== assetBasePath) {
    throw new Error(`asset.base-conflict: ${configuredAssetBase} is already active.`);
  }
  configuredAssetBase = assetBasePath;
  const panelIds = options.panelIds ?? ['text', 'stat', 'timeseries'];
  globalThis.__PROVIDER_ASSET_EXPERIMENT_CONFIG__ = { assetBasePath, panelIds };
  return loadReactExternalizedProvider({
    host: options.host,
    loadImplementation: () => import('./providerRuntime.tsx'),
  });
}
