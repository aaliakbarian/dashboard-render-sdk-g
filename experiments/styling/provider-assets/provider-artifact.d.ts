// POC / EXPERIMENT / NOT FOR PRODUCTION
declare module 'provider-assets-artifact' {
  import type { HostReactContract } from '../../provider/react-externalized/compatibility.ts';

  export { createHostReactContract } from '../../provider/react-externalized/compatibility.ts';
  export type ProviderAssetPanelId = 'stat' | 'text' | 'timeseries';

  export function loadProviderAssetExperiment(options: {
    readonly assetBasePath: string;
    readonly host: HostReactContract;
    readonly panelIds?: readonly ProviderAssetPanelId[];
  }): Promise<{
    admission: Record<string, unknown>;
    implementation: typeof import('./providerRuntime.tsx');
  }>;
}
