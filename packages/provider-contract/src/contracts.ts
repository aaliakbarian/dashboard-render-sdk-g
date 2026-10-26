export const PROVIDER_MANIFEST_SCHEMA_VERSION = 1 as const;

export type ProviderSupportTier = 'experimental' | 'verified' | 'supported' | 'deprecated';

export interface ExactVersionedDependency {
  readonly id: string;
  readonly version: string;
}

export interface SourceProvenance {
  readonly repository: string;
  readonly tag?: string;
  readonly revision: string;
}

export interface TargetCompatibilityCell {
  readonly version: string;
  readonly edition: string;
  readonly source: SourceProvenance;
}

export interface CompatibilityObservations {
  readonly target?: {
    readonly family?: string;
    readonly version?: string;
    readonly edition?: string;
  };
  readonly host?: {
    readonly reactVersion?: string;
    readonly reactDomVersion?: string;
  };
  readonly runtimeDependencies?: readonly ExactVersionedDependency[];
}

export type CompatibilityEvaluationOutcome =
  | 'declared-requirements-match'
  | 'mismatch'
  | 'insufficient-evidence'
  | 'invalid-observations';

export type CompatibilityEvaluationCheckStatus =
  | 'match'
  | 'mismatch'
  | 'missing-evidence'
  | 'invalid-observation';

export interface CompatibilityEvaluationCheck {
  readonly path: string;
  readonly status: CompatibilityEvaluationCheckStatus;
  readonly expected?: string;
  readonly observed?: string;
}

export interface CompatibilityEvaluationResult {
  readonly outcome: CompatibilityEvaluationOutcome;
  readonly checks: readonly CompatibilityEvaluationCheck[];
  readonly matchedTargetCell?: TargetCompatibilityCell;
}

export interface ProviderCapabilities {
  readonly panels: readonly string[];
  readonly datasources: readonly string[];
  readonly transformations: {
    readonly ids: readonly string[];
    readonly allowEmptyPipeline: boolean;
    readonly maxChainLength: number;
  };
}

export interface ProviderCompatibilityManifest {
  readonly schemaVersion: typeof PROVIDER_MANIFEST_SCHEMA_VERSION;
  readonly provider: {
    readonly id: string;
    readonly version: string;
    readonly buildId: string;
    readonly supportTier: ProviderSupportTier;
  };
  readonly target: {
    readonly family: string;
    readonly cells: readonly TargetCompatibilityCell[];
  };
  readonly provenance: {
    readonly recordId: string;
  };
  readonly runtimeDependencies: readonly ExactVersionedDependency[];
  readonly host: {
    readonly reactVersion: string;
    readonly reactDomVersion: string;
  };
  readonly dashboards: {
    readonly apis: readonly {
      readonly group: string;
      readonly version: string;
    }[];
    readonly schemas: readonly {
      readonly family: string;
      readonly schemaVersion: number;
    }[];
    readonly lookup: string;
  };
  readonly capabilities: ProviderCapabilities;
}

export interface RuntimeIdentity {
  readonly schemaVersion: 1;
  readonly provider: {
    readonly id: string;
    readonly buildId: string;
    readonly manifestDigest: string;
  };
  readonly target: {
    readonly family: string;
    readonly observedCompatibilityId: string;
  };
  readonly cohort: {
    readonly runtimeDependencies: readonly ExactVersionedDependency[];
    /**
     * Opaque descriptive metadata supplied for later runtime admission. This
     * token does not prove physical React object identity or compatibility;
     * those checks belong to the runtime-admission boundary.
     */
    readonly reactRuntimeToken: string;
  };
  readonly isolationMode: 'single-compatible-realm-v1';
}

export interface RendererProvider {
  readonly manifest: ProviderCompatibilityManifest;
}
