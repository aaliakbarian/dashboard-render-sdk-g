// POC / EXPERIMENT / NOT FOR PRODUCTION
declare module 'portal-focus-provider-artifact' {
  import type { ComponentType } from 'react';
  import type { HostReactContract } from '../../provider/react-externalized/compatibility.ts';
  export { createHostReactContract } from '../../provider/react-externalized/compatibility.ts';
  export function loadPortalFocusProvider(options: { readonly host: HostReactContract }): Promise<{
    readonly admission: Record<string, boolean> & { readonly versionCell: object };
    readonly implementation: {
      readonly PortalFocusProviderApp: ComponentType;
      readonly inspectPortalFocusProvider: (hostCache?: object) => Record<string, unknown>;
      readonly portalProviderCommand: (command: 'closeAll' | 'mountPrimary' | 'resize' | 'switchUidWithOpenModal' | 'togglePrimary' | 'toggleSecondary') => void;
    };
  }>;
}
