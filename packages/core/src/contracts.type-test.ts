import {
  PROVIDER_MANIFEST_SCHEMA_VERSION,
  type ManifestValidationErrorCode,
  type ManifestValidationResult,
  type ProviderCompatibilityManifest,
  type RendererProvider,
} from '@dashboard-render-sdk-g/provider-contract';

import type {
  CoreSdkConfiguration,
  ProviderMetadataInspectionResult,
} from './index';

const providerNeutralManifest = {
  capabilities: {
    datasources: [],
    panels: [],
    transformations: {
      allowEmptyPipeline: true,
      ids: [],
      maxChainLength: 0,
    },
  },
  dashboards: {
    apis: [{ group: 'dashboard.example.invalid', version: 'v1' }],
    lookup: 'uid',
    schemas: [{ family: 'v1', schemaVersion: 1 }],
  },
  host: {
    reactDomVersion: '19.2.8',
    reactVersion: '19.2.8',
  },
  provenance: {
    recordId: 'synthetic-provider-neutral-provenance',
  },
  provider: {
    buildId: 'synthetic-build',
    id: 'synthetic-provider',
    supportTier: 'experimental',
    version: '1.0.0',
  },
  runtimeDependencies: [],
  schemaVersion: PROVIDER_MANIFEST_SCHEMA_VERSION,
  target: {
    cells: [
      {
        edition: 'default',
        source: {
          repository: 'https://example.invalid/provider',
          revision: 'synthetic-revision',
        },
        version: '1.0.0',
      },
    ],
    family: 'synthetic-dashboard-provider',
  },
} satisfies ProviderCompatibilityManifest;

const provider = { manifest: providerNeutralManifest } satisfies RendererProvider;
const configuration = { provider } satisfies CoreSdkConfiguration;

const canonicalResult: ManifestValidationResult = {
  manifest: providerNeutralManifest,
  valid: true,
};
const coreResult: ProviderMetadataInspectionResult = canonicalResult;
const canonicalRoundTrip: ManifestValidationResult = coreResult;

function narrowInspectionResult(result: ProviderMetadataInspectionResult) {
  if (result.valid) {
    const manifest: ProviderCompatibilityManifest = result.manifest;
    // @ts-expect-error Structural validity is not runtime compatibility.
    void result.compatible;
    // @ts-expect-error Structural validity is not runtime admission.
    void result.admitted;
    // @ts-expect-error Structural validity is not project verification.
    void result.verified;
    // @ts-expect-error Metadata inspection does not produce a runtime lease.
    void result.runtimeLease;
    // @ts-expect-error Metadata inspection does not produce a renderer.
    void result.renderer;
    void manifest;
    return;
  }

  const firstError = result.errors[0];
  if (firstError !== undefined) {
    const code: ManifestValidationErrorCode = firstError.code;
    const path: string = firstError.path;
    const message: string = firstError.message;
    void code;
    void path;
    void message;
  }
}

// @ts-expect-error An explicit provider is required.
const missingProviderConfiguration: CoreSdkConfiguration = {};

void canonicalRoundTrip;
void configuration;
void missingProviderConfiguration;
void narrowInspectionResult;
