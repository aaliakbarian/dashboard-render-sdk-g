// POC / EXPERIMENT / NOT FOR PRODUCTION
declare module 'transformation-conformance-provider-artifact' {
  import type { ComponentType } from 'react';
  import type { HostReactContract } from '../../provider/react-externalized/compatibility.ts';

  export { createHostReactContract } from '../../provider/react-externalized/compatibility.ts';
  export function loadTransformationConformanceProvider(options: {
    readonly assetBasePath: string;
    readonly host: HostReactContract;
    readonly nonce: string;
  }): Promise<{
    readonly admission: Record<string, unknown>;
    readonly implementation: {
      readonly StrictCspProviderApp: ComponentType;
      readonly inspectTransformationProvider: () => Record<string, unknown>;
      readonly probeTransformationPipeline: (input: unknown) => { readonly accepted: boolean; readonly category: string };
      readonly runRealTransformationParity: () => Promise<Record<string, unknown>>;
      readonly transformationProviderCommand: (command: 'mountPrimary' | 'refresh' | 'resize' | 'switchUidWithOpenModal' | 'timeRange' | 'togglePrimary' | 'toggleSecondary') => void;
    };
  }>;
}
