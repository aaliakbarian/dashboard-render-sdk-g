export const HOST_TRANSPORT_DESCRIPTOR_SCHEMA_VERSION = 1 as const;

export type TransportMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD';

export type TransportHeader = readonly [name: string, value: string];

export type TransportQueryParameter = readonly [name: string, value: string];

export interface HostTransportDescriptor {
  readonly schemaVersion: typeof HOST_TRANSPORT_DESCRIPTOR_SCHEMA_VERSION;
  readonly targetOrigin: string;
  readonly basePath: string;
  readonly securityScopeId: string;
  readonly requestPolicyId: string;
}

export interface TransportRequest {
  readonly requestId: string;
  readonly method: TransportMethod;
  readonly path: string;
  readonly query?: readonly TransportQueryParameter[];
  readonly headers?: readonly TransportHeader[];
  readonly body?: string;
  readonly signal: AbortSignal;
}

export interface HostTransportResponse {
  readonly status: number;
  readonly headers: readonly TransportHeader[];
  readonly body: string;
}

export type HostTransportExecutor = (
  request: TransportRequest
) => Promise<HostTransportResponse>;

export type TransportPolicyErrorCode =
  | 'invalid-request'
  | 'path-outside-capability'
  | 'credential-header-forbidden'
  | 'host-controlled-header-forbidden'
  | 'invalid-response';

export type TransportResult =
  | {
      readonly kind: 'response';
      readonly requestId: string;
      readonly response: HostTransportResponse;
    }
  | {
      readonly kind: 'cancelled';
      readonly requestId: string;
    }
  | {
      readonly kind: 'network-error';
      readonly requestId: string;
    }
  | {
      readonly kind: 'policy-error';
      readonly requestId?: string;
      readonly code: TransportPolicyErrorCode;
    };

export interface HostTransportCapability {
  readonly descriptor: HostTransportDescriptor;
  execute(request: TransportRequest): Promise<TransportResult>;
}
