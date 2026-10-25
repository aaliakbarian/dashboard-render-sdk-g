import type {
  ManifestValidationResult,
  RendererProvider,
} from '@dashboard-render-sdk-g/provider-contract';

export interface CoreSdkConfiguration {
  readonly provider: RendererProvider;
}

export type ProviderMetadataInspectionResult = ManifestValidationResult;
