import type {
  HostTransportCapability,
  ManifestValidationSuccess,
  TransportPolicyErrorCode,
} from '@dashboard-render-sdk-g/provider-contract';

export const GRAFANA_13_DASHBOARD_API_GROUP = 'dashboard.grafana.app' as const;
export const GRAFANA_13_DASHBOARD_API_VERSION = 'v1' as const;
export const GRAFANA_13_DASHBOARD_SCHEMA_VERSION = 42 as const;
export const GRAFANA_13_STATIC_PREFLIGHT_PROFILE_ID =
  'grafana-13.2.3-v1-schema-42-static-v1' as const;

export type Grafana13JsonPrimitive = string | number | boolean | null;

export interface Grafana13JsonObject {
  readonly [key: string]: Grafana13JsonValue;
}

export type Grafana13JsonValue =
  | Grafana13JsonPrimitive
  | Grafana13JsonObject
  | readonly Grafana13JsonValue[];

export interface Grafana13DashboardRequestIds {
  readonly discovery: string;
  readonly dashboard: string;
}

export interface Grafana13DashboardLoadInput {
  readonly transport: HostTransportCapability;
  readonly manifest: ManifestValidationSuccess;
  readonly namespace: string;
  readonly uid: string;
  readonly requestIds: Grafana13DashboardRequestIds;
  readonly signal: AbortSignal;
}

export interface Grafana13DashboardV1 {
  readonly family: 'v1';
  readonly apiVersion: 'dashboard.grafana.app/v1';
  readonly kind: 'DashboardWithAccessInfo';
  readonly metadata: {
    readonly name: string;
    readonly namespace: string;
    readonly generation?: number;
    readonly resourceVersion?: string;
  };
  readonly access: {
    readonly canSave: boolean;
    readonly canEdit: boolean;
    readonly canDelete: boolean;
    readonly canStar: boolean;
    readonly canAdmin: boolean;
    readonly isPublic: boolean;
    readonly url?: string;
    readonly slug?: string;
    readonly canShare?: boolean;
    readonly annotationsPermissions?: Grafana13JsonObject;
  };
  readonly spec: Grafana13JsonObject & {
    readonly panels: readonly Grafana13JsonObject[];
    readonly schemaVersion: typeof GRAFANA_13_DASHBOARD_SCHEMA_VERSION;
  };
  readonly status?: {
    readonly conversion?: {
      readonly failed: false;
      readonly storedVersion?: string;
    };
  };
}

export interface Grafana13DashboardInventory {
  readonly panelCount: number;
  readonly panels: readonly {
    readonly index: number;
    readonly id: number;
    readonly type: string;
  }[];
  readonly panelTypes: readonly string[];
  readonly datasourceTypes: readonly string[];
  readonly transformationIds: readonly string[];
  readonly variableKinds: readonly string[];
  readonly layout: 'flat-grid' | 'unsupported';
  readonly annotationPolicy: 'none' | 'canonical-builtin-omitted' | 'unsupported';
}

export type Grafana13DashboardStage = 'input' | 'discovery' | 'dashboard-v1' | 'preflight';

export type Grafana13DashboardFailureCode =
  | 'dashboard.input-invalid'
  | 'dashboard.transport-policy-error'
  | 'dashboard.network-error'
  | 'dashboard.unauthorized'
  | 'dashboard.forbidden'
  | 'dashboard.not-found'
  | 'dashboard.http-error'
  | 'dashboard.response-malformed'
  | 'dashboard.identity-mismatch';

export interface Grafana13DashboardFailure {
  readonly code: Grafana13DashboardFailureCode;
  readonly stage: Grafana13DashboardStage;
  readonly requestId?: string;
  readonly status?: number;
  readonly path?: string;
  readonly transportPolicyCode?: TransportPolicyErrorCode;
  readonly message: string;
}

export type Grafana13PreflightDiagnosticCode =
  | 'dashboard.api-unsupported'
  | 'dashboard.conversion-unsupported'
  | 'dashboard.schema-unsupported'
  | 'dashboard.layout-unsupported'
  | 'dashboard.feature-unsupported'
  | 'dashboard.manifest-declaration-missing'
  | 'panel.unsupported'
  | 'panel.profile-unsupported'
  | 'datasource.unsupported'
  | 'datasource.profile-unsupported'
  | 'transformation.unsupported'
  | 'transformation.profile-unsupported';

export interface Grafana13PreflightDiagnostic {
  readonly code: Grafana13PreflightDiagnosticCode;
  readonly path: string;
  readonly capabilityId?: string;
  readonly message: string;
}

export type Grafana13DashboardLoadResult =
  | {
      readonly kind: 'ready';
      readonly requestIds: Grafana13DashboardRequestIds;
      readonly dashboard: Grafana13DashboardV1;
      readonly inventory: Grafana13DashboardInventory;
      readonly staticPreflight: {
        readonly profileId: typeof GRAFANA_13_STATIC_PREFLIGHT_PROFILE_ID;
        readonly outcome: 'declared-requirements-match';
        readonly providerId: string;
        readonly providerBuildId: string;
      };
    }
  | {
      readonly kind: 'unsupported';
      readonly stage: 'discovery' | 'dashboard-v1' | 'preflight';
      readonly requestId: string;
      readonly diagnostics: readonly Grafana13PreflightDiagnostic[];
      readonly diagnosticsTruncated: boolean;
      readonly inventory?: Grafana13DashboardInventory;
    }
  | {
      readonly kind: 'cancelled';
      readonly stage: 'discovery' | 'dashboard-v1';
      readonly requestId: string;
    }
  | {
      readonly kind: 'failure';
      readonly error: Grafana13DashboardFailure;
    };
