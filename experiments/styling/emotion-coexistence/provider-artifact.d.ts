// POC / EXPERIMENT / NOT FOR PRODUCTION
declare module 'emotion-coexistence-provider-artifact' {
  import type { EmotionCache } from '@emotion/cache';
  import type { Context, ComponentType } from 'react';
  import type { HostReactContract } from '../../provider/react-externalized/compatibility.ts';

  export { createHostReactContract } from '../../provider/react-externalized/compatibility.ts';

  export function loadEmotionCoexistenceProvider(options: { readonly host: HostReactContract }): Promise<{
    readonly admission: Record<string, boolean> & { readonly versionCell: object };
    readonly implementation: {
      readonly EmotionCoexistenceProviderApp: ComponentType<{ readonly portalTarget: Element }>;
      readonly inspectEmotionCoexistenceProvider: (hostCache?: EmotionCache) => {
        readonly cacheObjectsDistinct: {
          readonly hostVsProvider: boolean;
          readonly hostVsProviderCss: boolean;
          readonly providerVsProviderCss: boolean;
        };
        readonly caches: {
          readonly provider: { readonly id: string; readonly inserted: number; readonly key: string; readonly tags: number };
          readonly providerCss: { readonly id: string; readonly inserted: number; readonly key: string; readonly tags: number };
        };
        readonly cohort: {
          readonly pluginEvents: Array<{ pluginId?: string; type: string }>;
          readonly runtime: { readonly moduleIdentities?: Record<string, { copies: number; version: string }> };
          readonly scenes: Array<{ active: boolean; uid: string }>;
        };
      };
      readonly resizeEmotionProvider: () => void;
      readonly switchEmotionProviderUid: () => void;
      readonly toggleEmotionProviderSecondary: () => void;
    };
  }>;
}
