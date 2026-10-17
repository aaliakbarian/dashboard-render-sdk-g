// POC / EXPERIMENT / NOT FOR PRODUCTION
import type { EmotionCache } from '@emotion/cache';

import '../../styling/provider-assets/provider-assets.css';
import {
  PortalFocusProviderApp,
  inspectPortalFocusProvider,
  portalProviderCommand,
} from '../../styling/portal-focus-zindex/providerRuntime.tsx';

export const StrictCspProviderApp = PortalFocusProviderApp;
export const strictCspProviderCommand = portalProviderCommand;
export function inspectStrictCspProvider(hostCache?: EmotionCache) {
  return inspectPortalFocusProvider(hostCache);
}
