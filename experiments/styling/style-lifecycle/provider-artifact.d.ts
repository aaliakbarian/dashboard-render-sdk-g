// POC / EXPERIMENT / NOT FOR PRODUCTION
declare module 'style-lifecycle-provider-artifact' {
  import type { ComponentType } from 'react';
  import type { HostReactContract } from '../../provider/react-externalized/compatibility.ts';

  export { createHostReactContract } from '../../provider/react-externalized/compatibility.ts';
  export function loadStyleLifecycleProvider(options: {
    readonly assetBasePath: string;
    readonly failFirstPanel?: 'stat' | 'text' | 'timeseries';
    readonly host: HostReactContract;
    readonly nonce: string;
    readonly panelIds?: readonly ('stat' | 'text' | 'timeseries')[];
    readonly startDormant?: boolean;
  }): Promise<{
    readonly admission: Record<string, unknown>;
    readonly implementation: {
      readonly StrictCspProviderApp: ComponentType;
      readonly inspectStyleLifecycleProvider: () => Record<string, unknown>;
      readonly probeIncompatibleRuntimeIdentity: () => Promise<Record<string, unknown>>;
      readonly styleLifecycleProviderCommand: (command: 'closeAll' | 'mountPrimary' | 'refresh' | 'resize' | 'switchUidWithOpenModal' | 'timeRange' | 'togglePrimary' | 'toggleSecondary') => void;
    };
  }>;
}
