import {
  HOST_TRANSPORT_DESCRIPTOR_SCHEMA_VERSION,
  type HostTransportCapability,
  type HostTransportDescriptor,
  type HostTransportExecutor,
  type HostTransportResponse,
  type TransportHeader,
  type TransportMethod,
  type TransportPolicyErrorCode,
  type TransportQueryParameter,
  type TransportRequest,
  type TransportResult,
} from './index';

type Assert<T extends true> = T;
type IsExact<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? (<T>() => T extends B ? 1 : 2) extends <T>() => T extends A ? 1 : 2
      ? true
      : false
    : false;

type ExecutorInput = Parameters<HostTransportExecutor>[0];
type ExecutorOutput = Awaited<ReturnType<HostTransportExecutor>>;
type CapabilityOutput = Awaited<ReturnType<HostTransportCapability['execute']>>;

type _ExecutorReceivesTransportRequest = Assert<IsExact<ExecutorInput, TransportRequest>>;
type _ExecutorReturnsRawResponse = Assert<IsExact<ExecutorOutput, HostTransportResponse>>;
type _CapabilityReturnsNormalizedResult = Assert<IsExact<CapabilityOutput, TransportResult>>;

const descriptor: HostTransportDescriptor = {
  basePath: '/grafana',
  requestPolicyId: 'browser-session-policy-v1',
  schemaVersion: HOST_TRANSPORT_DESCRIPTOR_SCHEMA_VERSION,
  securityScopeId: 'organization-1',
  targetOrigin: 'https://example.invalid',
};

declare const signal: AbortSignal;
const request: TransportRequest = {
  body: '{}',
  headers: [['content-type', 'application/json']],
  method: 'POST',
  path: '/api/ds/query',
  query: [['limit', '10']],
  requestId: 'request-1',
  signal,
};

const methods: readonly TransportMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'];
const policyCodes: readonly TransportPolicyErrorCode[] = [
  'invalid-request',
  'path-outside-capability',
  'credential-header-forbidden',
  'host-controlled-header-forbidden',
  'invalid-response',
];
const resultKinds: readonly TransportResult['kind'][] = [
  'response',
  'cancelled',
  'network-error',
  'policy-error',
];

declare const header: TransportHeader;
declare const query: TransportQueryParameter;
declare const capability: HostTransportCapability;
declare const response: HostTransportResponse;
declare const result: TransportResult;

// @ts-expect-error Transport methods are a closed vocabulary.
const invalidMethod: TransportMethod = 'OPTIONS';
// @ts-expect-error Transport policy errors are a closed vocabulary.
const invalidPolicyCode: TransportPolicyErrorCode = 'unauthorized';
// @ts-expect-error Transport result kinds are a closed vocabulary.
const invalidResultKind: TransportResult['kind'] = 'http-error';

// @ts-expect-error AbortSignal is required.
const requestWithoutSignal: TransportRequest = { method: 'GET', path: '/', requestId: 'request-2' };
// @ts-expect-error Executor returns a raw response, not a normalized result.
const executorReturningResult: HostTransportExecutor = async () => ({
  kind: 'cancelled',
  requestId: 'request-3',
});

// @ts-expect-error Descriptor fields are readonly.
descriptor.basePath = '/other';
// @ts-expect-error Request fields are readonly.
request.path = '/other';
// @ts-expect-error Request tuple arrays are readonly.
request.headers!.push(['accept', 'application/json']);
// @ts-expect-error Header tuples are readonly.
header[0] = 'authorization';
// @ts-expect-error Query tuples are readonly.
query[1] = 'other';
// @ts-expect-error Capability descriptor is readonly.
capability.descriptor = descriptor;
// @ts-expect-error Raw response fields are readonly.
response.status = 204;
if (result.kind === 'response') {
  // @ts-expect-error Normalized response fields are readonly.
  result.response.body = 'mutated';
}

// @ts-expect-error Provider requests never select browser credential mode.
request.credentials;
// @ts-expect-error Provider requests never carry a fetch implementation.
request.fetch;
// @ts-expect-error Provider requests never expose browser Response objects.
request.response;
// @ts-expect-error Capabilities do not expose the trusted executor.
capability.executor;
// @ts-expect-error Capabilities do not perform runtime admission.
capability.admit;
// @ts-expect-error Capabilities do not construct runtime identity.
capability.runtimeIdentity;
// @ts-expect-error Capabilities do not define retry behavior.
capability.retry;
// @ts-expect-error Capabilities do not define caches.
capability.cache;
// @ts-expect-error Capabilities do not expose observability services.
capability.observability;
// @ts-expect-error Provider-neutral transport has no Grafana BackendSrv.
capability.backendSrv;

void descriptor;
void request;
void methods;
void policyCodes;
void resultKinds;
void invalidMethod;
void invalidPolicyCode;
void invalidResultKind;
void requestWithoutSignal;
void executorReturningResult;
