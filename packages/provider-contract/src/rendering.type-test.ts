import type {
  DashboardRenderFailure,
  DashboardRenderFailureCode,
  DashboardRenderStatus,
  HostReactRuntime,
  ProviderDashboardRendererProps,
} from './index';

declare const manifest: ProviderDashboardRendererProps['manifest'];
declare const transport: ProviderDashboardRendererProps['transport'];
declare const hostReact: HostReactRuntime;
declare const props: ProviderDashboardRendererProps;

const runtime: HostReactRuntime = {
  identities: {
    jsxDevRuntime: {},
    jsxRuntime: {},
    react: {},
    reactDom: {},
    reactDomClient: {},
  },
  versions: { react: '19.2.8', reactDom: '19.2.8' },
};

const failureCodes: readonly DashboardRenderFailureCode[] = [
  'dashboard-input-invalid',
  'transport-policy-error',
  'network-error',
  'unauthorized',
  'forbidden',
  'not-found',
  'http-error',
  'response-malformed',
  'runtime-react-incompatible',
  'runtime-identity-conflict',
  'runtime-initialization-failed',
  'panel-render-failed',
];

const statuses: readonly DashboardRenderStatus[] = [
  { kind: 'loading', uid: 'dashboard-a' },
  {
    kind: 'ready',
    uid: 'dashboard-a',
    supportedPanelCount: 1,
    unsupportedPanelCount: 2,
  },
  { kind: 'unsupported-dashboard', uid: 'dashboard-a', reason: 'dashboard-profile' },
  {
    kind: 'error',
    uid: 'dashboard-a',
    error: { code: 'network-error', uid: 'dashboard-a', message: 'Request failed' },
  },
];

const rendererProps: ProviderDashboardRendererProps = {
  hostReact: runtime,
  instanceId: 'instance-a',
  manifest,
  namespace: 'default',
  transport,
  uid: 'dashboard-a',
};

const mutableStatus: DashboardRenderStatus = { kind: 'loading', uid: 'dashboard-a' };
// @ts-expect-error Status values are immutable.
mutableStatus.uid = 'dashboard-b';

// @ts-expect-error The renderer requires its validated manifest.
const missingManifest: ProviderDashboardRendererProps = {
  hostReact: runtime,
  instanceId: 'instance-a',
  namespace: 'default',
  transport,
  uid: 'dashboard-a',
};

// @ts-expect-error The renderer requires host transport capability.
const missingTransport: ProviderDashboardRendererProps = {
  hostReact: runtime,
  instanceId: 'instance-a',
  manifest,
  namespace: 'default',
  uid: 'dashboard-a',
};

const primitiveIdentities: HostReactRuntime = {
  identities: {
    // @ts-expect-error Runtime module identities are opaque object references.
    jsxDevRuntime: 'jsx-dev',
    // @ts-expect-error Runtime module identities are opaque object references.
    jsxRuntime: 'jsx',
    // @ts-expect-error Runtime module identities are opaque object references.
    react: 'react',
    // @ts-expect-error Runtime module identities are opaque object references.
    reactDom: 'react-dom',
    // @ts-expect-error Runtime module identities are opaque object references.
    reactDomClient: 'react-dom-client',
  },
  versions: { react: '19.2.8', reactDom: '19.2.8' },
};

const failure: DashboardRenderFailure = {
  code: 'http-error',
  uid: 'dashboard-a',
  requestId: 'request-a',
  status: 503,
  message: 'Service unavailable',
};
// @ts-expect-error Sanitized failures do not expose thrown causes.
failure.cause;
// @ts-expect-error Sanitized failures do not expose raw response bodies.
failure.responseBody;
// @ts-expect-error Sanitized failures do not expose raw headers.
failure.headers;
// @ts-expect-error Sanitized failures do not expose credentials.
failure.credentials;

// @ts-expect-error The failure vocabulary is closed.
const invalidFailureCode: DashboardRenderFailureCode = 'raw-exception';
const invalidUnsupportedReason: DashboardRenderStatus = {
  kind: 'unsupported-dashboard',
  uid: 'dashboard-a',
  // @ts-expect-error Unsupported-dashboard reasons are closed and sanitized.
  reason: 'plugin-load-error',
};
// @ts-expect-error A failure always has a dashboard UID and sanitized message.
const missingFailureDetails: DashboardRenderFailure = { code: 'network-error' };
// @ts-expect-error The renderer requires its caller instance identity.
const missingInstanceId: ProviderDashboardRendererProps = {
  hostReact: runtime,
  manifest,
  namespace: 'default',
  transport,
  uid: 'dashboard-a',
};
// @ts-expect-error The renderer requires a dashboard UID.
const missingUid: ProviderDashboardRendererProps = {
  hostReact: runtime,
  instanceId: 'instance-a',
  manifest,
  namespace: 'default',
  transport,
};
// @ts-expect-error Renderer props are immutable.
props.uid = 'dashboard-b';
// @ts-expect-error Runtime version metadata is immutable.
hostReact.versions.react = '0.0.0';
// @ts-expect-error Identity references are immutable.
runtime.identities.react = {};

void failureCodes;
void statuses;
void rendererProps;
void mutableStatus;
void missingManifest;
void missingTransport;
void primitiveIdentities;
void failure;
void invalidFailureCode;
void invalidUnsupportedReason;
void missingFailureDetails;
void missingInstanceId;
void missingUid;
