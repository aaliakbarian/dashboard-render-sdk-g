// POC / EXPERIMENT / NOT FOR PRODUCTION
declare module 'strict-csp-provider-artifact' {
  import type { HostReactContract } from '../../provider/react-externalized/compatibility.ts';

  export { createHostReactContract } from '../../provider/react-externalized/compatibility.ts';
  export type StrictCspPanelId = 'stat' | 'text' | 'timeseries';

  export function loadStrictCspProvider(options: {
    readonly assetBasePath: string;
    readonly host: HostReactContract;
    readonly nonce: string;
    readonly panelIds?: readonly StrictCspPanelId[];
  }): Promise<{
    admission: Record<string, unknown>;
    implementation: typeof import('./providerRuntime.tsx');
  }>;
}
