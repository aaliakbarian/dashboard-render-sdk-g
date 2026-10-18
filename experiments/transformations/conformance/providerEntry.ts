// POC / EXPERIMENT / NOT FOR PRODUCTION
import {
  createHostReactContract,
  loadStyleLifecycleProvider,
} from '../../styling/style-lifecycle/providerEntry.ts';
import type { HostReactContract } from '../../provider/react-externalized/compatibility.ts';

export { createHostReactContract };

export async function loadTransformationConformanceProvider(options: {
  readonly assetBasePath: string;
  readonly host: HostReactContract;
  readonly nonce: string;
}) {
  const loaded = await loadStyleLifecycleProvider({
    assetBasePath: options.assetBasePath,
    host: options.host,
    nonce: options.nonce,
  });
  const probe = await import('./runtimeProbe.ts');
  return Object.freeze({
    admission: loaded.admission,
    implementation: Object.freeze({
      ...loaded.implementation,
      inspectTransformationProvider: probe.inspectTransformationProvider,
      probeTransformationPipeline: probe.probeTransformationPipeline,
      runRealTransformationParity: probe.runRealTransformationParity,
      transformationProviderCommand: probe.transformationProviderCommand,
    }),
  });
}
