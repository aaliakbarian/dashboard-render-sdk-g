import type {
  HostTransportCapability,
  ManifestValidationSuccess,
  ProviderCompatibilityManifest,
} from '@dashboard-render-sdk-g/provider-contract';

import {
  GRAFANA_13_DASHBOARD_API_GROUP,
  GRAFANA_13_DASHBOARD_API_VERSION,
  GRAFANA_13_DASHBOARD_SCHEMA_VERSION,
  GRAFANA_13_STATIC_PREFLIGHT_PROFILE_ID,
  type Grafana13DashboardLoadInput,
  type Grafana13DashboardLoadResult,
  type Grafana13DashboardStage,
  type Grafana13JsonValue,
} from './contracts';
import { retrieveAndPreflightGrafana13DashboardV1 } from './dashboardApi';

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends
  (<Value>() => Value extends Right ? 1 : 2)
    ? true
    : false;
type Expect<Value extends true> = Value;

type _ApiGroup = Expect<
  Equal<typeof GRAFANA_13_DASHBOARD_API_GROUP, 'dashboard.grafana.app'>
>;
type _ApiVersion = Expect<Equal<typeof GRAFANA_13_DASHBOARD_API_VERSION, 'v1'>>;
type _SchemaVersion = Expect<Equal<typeof GRAFANA_13_DASHBOARD_SCHEMA_VERSION, 42>>;
type _Profile = Expect<
  Equal<
    typeof GRAFANA_13_STATIC_PREFLIGHT_PROFILE_ID,
    'grafana-13.2.3-v1-schema-42-static-v1'
  >
>;
type _Stages = Expect<
  Equal<Grafana13DashboardStage, 'input' | 'discovery' | 'dashboard-v1' | 'preflight'>
>;

declare const transport: HostTransportCapability;
declare const manifest: ManifestValidationSuccess;
declare const signal: AbortSignal;

const input: Grafana13DashboardLoadInput = {
  manifest,
  namespace: 'default',
  requestIds: { dashboard: 'dashboard-1', discovery: 'discovery-1' },
  signal,
  transport,
  uid: 'grsdk-phase0-poc-alt',
};

// @ts-expect-error input is immutable
input.uid = 'changed';

function acceptsInput(value: Grafana13DashboardLoadInput): void {
  void value;
}

declare const rawManifest: ProviderCompatibilityManifest;
// @ts-expect-error structural validation success is required, not a raw manifest
acceptsInput({ ...input, manifest: rawManifest });

function inspect(result: Grafana13DashboardLoadResult): string {
  if (result.kind === 'ready') {
    type _SchemaLiteral = Expect<Equal<typeof result.dashboard.spec.schemaVersion, 42>>;
    type _NoRuntimeAdmission = Expect<
      Equal<'runtimeAdmission' extends keyof typeof result.staticPreflight ? true : false, false>
    >;
    return result.dashboard.metadata.name;
  }
  if (result.kind === 'unsupported') return result.diagnostics[0]?.code ?? result.stage;
  if (result.kind === 'cancelled') return result.requestId;
  return result.error.code;
}

const json: Grafana13JsonValue = Object.freeze({
  array: Object.freeze([null, true, 1, 'value']),
});

void input;
void inspect;
void json;

const facadeResult: Promise<Grafana13DashboardLoadResult> =
  retrieveAndPreflightGrafana13DashboardV1(input);
void facadeResult;
