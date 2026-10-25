import { validateProviderCompatibilityManifest } from '@dashboard-render-sdk-g/provider-contract';

import type {
  CoreSdkConfiguration,
  ProviderMetadataInspectionResult,
} from './contracts';

/**
 * Structurally validates the manifest exposed by one explicitly configured
 * provider. A successful result does not prove runtime compatibility, admit a
 * runtime, or initialize provider code.
 *
 * The provider is trusted host-supplied executable configuration. Core reads
 * its manifest property exactly once but does not sandbox arbitrary provider
 * objects or throwing getters. The manifest value itself is handled by the
 * canonical provider-contract validator. Authentication and authorized
 * connectivity remain host-owned, and this operation keeps no registry or
 * process-wide state.
 */
export function inspectConfiguredProvider(
  configuration: CoreSdkConfiguration
): ProviderMetadataInspectionResult {
  const manifest = configuration.provider.manifest;
  return validateProviderCompatibilityManifest(manifest);
}
