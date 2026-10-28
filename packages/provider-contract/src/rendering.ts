import type { ManifestValidationSuccess } from './manifestValidation';
import type { HostTransportCapability } from './transport';

export interface HostReactRuntime {
  readonly versions: {
    readonly react: string;
    readonly reactDom: string;
  };
  readonly identities: {
    readonly react: object;
    readonly reactDom: object;
    readonly reactDomClient: object;
    readonly jsxRuntime: object;
    readonly jsxDevRuntime: object;
  };
}

export type DashboardRenderFailureCode =
  | 'dashboard-input-invalid'
  | 'transport-policy-error'
  | 'network-error'
  | 'unauthorized'
  | 'forbidden'
  | 'not-found'
  | 'http-error'
  | 'response-malformed'
  | 'runtime-react-incompatible'
  | 'runtime-identity-conflict'
  | 'runtime-initialization-failed'
  | 'panel-render-failed';

export interface DashboardRenderFailure {
  readonly code: DashboardRenderFailureCode;
  readonly uid: string;
  readonly requestId?: string;
  readonly status?: number;
  readonly message: string;
}

export type DashboardRenderStatus =
  | { readonly kind: 'loading'; readonly uid: string }
  | {
      readonly kind: 'ready';
      readonly uid: string;
      readonly supportedPanelCount: number;
      readonly unsupportedPanelCount: number;
    }
  | {
      readonly kind: 'unsupported-dashboard';
      readonly uid: string;
      readonly reason: 'target-version' | 'dashboard-schema' | 'dashboard-profile';
    }
  | { readonly kind: 'error'; readonly uid: string; readonly error: DashboardRenderFailure };

export interface ProviderDashboardRendererProps {
  readonly hostReact: HostReactRuntime;
  readonly instanceId: string;
  readonly manifest: ManifestValidationSuccess;
  readonly namespace: string;
  readonly transport: HostTransportCapability;
  readonly uid: string;
  readonly onStatusChange?: (status: DashboardRenderStatus) => void;
}
