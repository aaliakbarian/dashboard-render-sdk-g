// POC / EXPERIMENT / NOT FOR PRODUCTION
import {
  createHostReactContract,
  loadReactExternalizedProvider,
  type HostReactContract,
} from '../../provider/react-externalized/compatibility.ts';

export { createHostReactContract };

export async function loadEmotionCoexistenceProvider(options: { readonly host: HostReactContract }) {
  return loadReactExternalizedProvider({
    host: options.host,
    loadImplementation: () => import('./providerRuntime.tsx'),
  });
}
