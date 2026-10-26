import type {
  ManifestValidationSuccess,
  TransportPolicyErrorCode,
  TransportResult,
} from '@dashboard-render-sdk-g/provider-contract';

import {
  GRAFANA_13_DASHBOARD_API_GROUP,
  GRAFANA_13_DASHBOARD_API_VERSION,
  type Grafana13DashboardFailure,
  type Grafana13DashboardLoadInput,
  type Grafana13DashboardLoadResult,
  type Grafana13JsonValue,
  type Grafana13PreflightDiagnostic,
} from './contracts';
import { decodeGrafana13DashboardV1Body } from './dashboardDto';
import { preflightGrafana13DashboardV1 } from './staticPreflight';

const MAX_BODY_LENGTH = 1_048_576;
const MAX_DEPTH = 32;
const MAX_NODES = 16_384;
const MAX_PROPERTIES = 1_024;
const MAX_ARRAY_LENGTH = 1_024;
const MAX_DISCOVERY_VERSIONS = 64;
const MAX_REQUEST_ID_LENGTH = 256;
const uidPattern = /^[A-Za-z0-9_-]{1,40}$/;
const namespacePattern = /^(?=.{1,63}$)[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
const controlPattern = /[\u0000-\u001f\u007f]/;

export interface ValidatedGrafana13DashboardLoadInput extends Grafana13DashboardLoadInput {}

type NonReadyDashboardResult = Exclude<Grafana13DashboardLoadResult, { readonly kind: 'ready' }>;

export type DashboardStageResult<T> =
  | { readonly kind: 'success'; readonly value: T }
  | NonReadyDashboardResult;

export interface Grafana13DashboardDiscovery {
  readonly advertisedVersions: readonly string[];
  readonly preferredVersion: string;
  readonly selectedVersion: 'v1';
}

type CloneState = {
  readonly ancestors: WeakSet<object>;
  visited: number;
};

type CloneResult =
  | { readonly ok: true; readonly value: Grafana13JsonValue }
  | { readonly ok: false };

function frozen<T extends object>(value: T): Readonly<T> {
  return Object.freeze(value);
}

function failure(error: Grafana13DashboardFailure): DashboardStageResult<never> {
  return frozen({ error: frozen(error), kind: 'failure' as const });
}

function malformed(stage: 'discovery' | 'dashboard-v1', requestId: string): DashboardStageResult<never> {
  return failure({
    code: 'dashboard.response-malformed',
    message: 'Grafana returned a malformed dashboard API response.',
    requestId,
    stage,
  });
}

function unsupportedDiscovery(
  requestId: string,
  path = '$.discovery'
): DashboardStageResult<never> {
  const diagnostic: Grafana13PreflightDiagnostic = frozen({
    code: 'dashboard.api-unsupported',
    message: 'Stable dashboard API v1 is not available for this provider request.',
    path,
  });
  return frozen({
    diagnostics: frozen([diagnostic]),
    diagnosticsTruncated: false,
    kind: 'unsupported' as const,
    requestId,
    stage: 'discovery' as const,
  });
}

function cloneJson(value: unknown, depth: number, state: CloneState): CloneResult {
  if (depth > MAX_DEPTH) return { ok: false };
  state.visited += 1;
  if (state.visited > MAX_NODES) return { ok: false };
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return { ok: true, value };
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? { ok: true, value } : { ok: false };
  }
  if (typeof value !== 'object') return { ok: false };

  let prototype: object | null;
  let keys: readonly PropertyKey[];
  try {
    prototype = Object.getPrototypeOf(value);
    keys = Reflect.ownKeys(value);
  } catch {
    return { ok: false };
  }
  if (state.ancestors.has(value)) return { ok: false };
  state.ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      if (prototype !== Array.prototype || value.length > MAX_ARRAY_LENGTH) return { ok: false };
      const elementKeys = keys.filter((key) => key !== 'length');
      if (elementKeys.length !== value.length || elementKeys.length > MAX_PROPERTIES) return { ok: false };
      const output: Grafana13JsonValue[] = [];
      for (let index = 0; index < value.length; index += 1) {
        const key = String(index);
        if (!elementKeys.includes(key)) return { ok: false };
        let descriptor: PropertyDescriptor | undefined;
        try {
          descriptor = Object.getOwnPropertyDescriptor(value, key);
        } catch {
          return { ok: false };
        }
        if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) return { ok: false };
        const cloned = cloneJson(descriptor.value, depth + 1, state);
        if (!cloned.ok) return cloned;
        output.push(cloned.value);
      }
      if (elementKeys.some((key) => typeof key !== 'string' || !/^(0|[1-9]\d*)$/.test(key))) {
        return { ok: false };
      }
      return { ok: true, value: frozen(output) };
    }

    if (prototype !== Object.prototype && prototype !== null) return { ok: false };
    if (keys.length > MAX_PROPERTIES || keys.some((key) => typeof key !== 'string')) {
      return { ok: false };
    }
    const output: Record<string, Grafana13JsonValue> = Object.create(null);
    for (const key of keys as readonly string[]) {
      let descriptor: PropertyDescriptor | undefined;
      try {
        descriptor = Object.getOwnPropertyDescriptor(value, key);
      } catch {
        return { ok: false };
      }
      if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) return { ok: false };
      const cloned = cloneJson(descriptor.value, depth + 1, state);
      if (!cloned.ok) return cloned;
      Object.defineProperty(output, key, {
        configurable: false,
        enumerable: true,
        value: cloned.value,
        writable: false,
      });
    }
    return { ok: true, value: frozen(output) };
  } finally {
    state.ancestors.delete(value);
  }
}

export function cloneBoundedJson(value: unknown): CloneResult {
  try {
    return cloneJson(value, 0, { ancestors: new WeakSet(), visited: 0 });
  } catch {
    return { ok: false };
  }
}

function isJsonObject(value: Grafana13JsonValue): value is Readonly<Record<string, Grafana13JsonValue>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function own(value: Readonly<Record<string, Grafana13JsonValue>>, key: string): Grafana13JsonValue | undefined {
  return Object.prototype.hasOwnProperty.call(value, key) ? value[key] : undefined;
}

function readVersionEntry(value: Grafana13JsonValue): { groupVersion: string; version: string } | undefined {
  if (!isJsonObject(value)) return undefined;
  const groupVersion = own(value, 'groupVersion');
  const version = own(value, 'version');
  if (typeof groupVersion !== 'string' || typeof version !== 'string') return undefined;
  if (groupVersion !== `${GRAFANA_13_DASHBOARD_API_GROUP}/${version}`) return undefined;
  return { groupVersion, version };
}

function validRequestId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= MAX_REQUEST_ID_LENGTH &&
    !controlPattern.test(value)
  );
}

function nativeSignalState(value: unknown): boolean | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  try {
    const getter = Object.getOwnPropertyDescriptor(AbortSignal.prototype, 'aborted')?.get;
    const aborted = getter?.call(value);
    return typeof aborted === 'boolean' ? aborted : undefined;
  } catch {
    return undefined;
  }
}

function hasDeclaredV1(manifest: ManifestValidationSuccess): boolean {
  return (
    manifest.manifest.dashboards.lookup === 'uid' &&
    manifest.manifest.dashboards.apis.some(
      ({ group, version }) =>
        group === GRAFANA_13_DASHBOARD_API_GROUP && version === GRAFANA_13_DASHBOARD_API_VERSION
    )
  );
}

export function validateDashboardLoadInput(
  input: Grafana13DashboardLoadInput
): DashboardStageResult<ValidatedGrafana13DashboardLoadInput> {
  let uid: unknown;
  let namespace: unknown;
  let requestIds: unknown;
  let signal: unknown;
  let manifest: unknown;
  let transport: unknown;
  try {
    uid = input.uid;
    namespace = input.namespace;
    requestIds = input.requestIds;
    signal = input.signal;
    manifest = input.manifest;
    transport = input.transport;
  } catch {
    return failure({
      code: 'dashboard.input-invalid',
      message: 'Dashboard load input is invalid.',
      path: '$.input',
      stage: 'input',
    });
  }
  let discoveryId: unknown;
  let dashboardId: unknown;
  try {
    discoveryId = requestIds && typeof requestIds === 'object'
      ? (requestIds as { readonly discovery?: unknown }).discovery
      : undefined;
    dashboardId = requestIds && typeof requestIds === 'object'
      ? (requestIds as { readonly dashboard?: unknown }).dashboard
      : undefined;
  } catch {
    discoveryId = undefined;
    dashboardId = undefined;
  }
  const signalState = nativeSignalState(signal);
  if (
    typeof uid !== 'string' ||
    !uidPattern.test(uid) ||
    typeof namespace !== 'string' ||
    !namespacePattern.test(namespace) ||
    !validRequestId(discoveryId) ||
    !validRequestId(dashboardId) ||
    discoveryId === dashboardId ||
    signalState === undefined
  ) {
    return failure({
      code: 'dashboard.input-invalid',
      message: 'Dashboard load input is invalid.',
      path: '$.input',
      stage: 'input',
    });
  }
  if (signalState) {
    return frozen({ kind: 'cancelled' as const, requestId: discoveryId, stage: 'discovery' as const });
  }
  const value: ValidatedGrafana13DashboardLoadInput = frozen({
    manifest: manifest as Grafana13DashboardLoadInput['manifest'],
    namespace,
    requestIds: frozen({ dashboard: dashboardId, discovery: discoveryId }),
    signal: signal as AbortSignal,
    transport: transport as Grafana13DashboardLoadInput['transport'],
    uid,
  });
  return frozen({ kind: 'success' as const, value });
}

export function decodeGrafana13DiscoveryBody(
  body: string,
  requestId: string
): DashboardStageResult<Grafana13DashboardDiscovery> {
  if (typeof body !== 'string' || body.length > MAX_BODY_LENGTH) return malformed('discovery', requestId);
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return malformed('discovery', requestId);
  }
  return decodeGrafana13DiscoveryValue(parsed, requestId);
}

export function decodeGrafana13DiscoveryValue(
  value: unknown,
  requestId: string
): DashboardStageResult<Grafana13DashboardDiscovery> {
  const cloned = cloneBoundedJson(value);
  if (!cloned.ok || !isJsonObject(cloned.value)) return malformed('discovery', requestId);
  const kind = own(cloned.value, 'kind');
  const name = own(cloned.value, 'name');
  const preferredRaw = own(cloned.value, 'preferredVersion');
  const versionsRaw = own(cloned.value, 'versions');
  const preferred = preferredRaw === undefined ? undefined : readVersionEntry(preferredRaw);
  if (
    kind !== 'APIGroup' ||
    name !== GRAFANA_13_DASHBOARD_API_GROUP ||
    !preferred ||
    !Array.isArray(versionsRaw) ||
    versionsRaw.length === 0 ||
    versionsRaw.length > MAX_DISCOVERY_VERSIONS
  ) return malformed('discovery', requestId);
  const versions: string[] = [];
  for (const valueEntry of versionsRaw) {
    const entry = readVersionEntry(valueEntry);
    if (!entry || versions.includes(entry.version)) return malformed('discovery', requestId);
    versions.push(entry.version);
  }
  if (!versions.includes(GRAFANA_13_DASHBOARD_API_VERSION)) {
    return unsupportedDiscovery(requestId, '$.versions');
  }
  const discovery: Grafana13DashboardDiscovery = frozen({
    advertisedVersions: frozen(versions),
    preferredVersion: preferred.version,
    selectedVersion: GRAFANA_13_DASHBOARD_API_VERSION,
  });
  return frozen({ kind: 'success' as const, value: discovery });
}

function transportFailure(
  result: Extract<TransportResult, { readonly kind: 'network-error' | 'policy-error' }>,
  requestId: string
): DashboardStageResult<never> {
  if (result.kind === 'network-error') {
    return failure({
      code: 'dashboard.network-error',
      message: 'The host transport could not complete the dashboard API request.',
      requestId,
      stage: 'discovery',
    });
  }
  return failure({
    code: 'dashboard.transport-policy-error',
    message: 'The host transport rejected the dashboard API request.',
    requestId,
    stage: 'discovery',
    transportPolicyCode: result.code as TransportPolicyErrorCode,
  });
}

export async function discoverStableGrafana13DashboardV1(
  input: ValidatedGrafana13DashboardLoadInput
): Promise<DashboardStageResult<Grafana13DashboardDiscovery>> {
  const requestId = input.requestIds.discovery;
  if (!hasDeclaredV1(input.manifest)) return unsupportedDiscovery(requestId, '$.manifest.dashboards');
  let result: TransportResult;
  try {
    result = await input.transport.execute({
      headers: frozen([frozen(['Accept', 'application/json'] as const)]),
      method: 'GET',
      path: '/apis/dashboard.grafana.app/',
      requestId,
      signal: input.signal,
    });
  } catch {
    return failure({
      code: 'dashboard.network-error',
      message: 'The host transport could not complete the dashboard API request.',
      requestId,
      stage: 'discovery',
    });
  }
  if (result.kind === 'cancelled') {
    return frozen({ kind: 'cancelled' as const, requestId, stage: 'discovery' as const });
  }
  if (result.kind === 'network-error' || result.kind === 'policy-error') {
    return transportFailure(result, requestId);
  }
  const { status } = result.response;
  if (status === 404) return unsupportedDiscovery(requestId);
  if (status !== 200) {
    const code = status === 401
      ? 'dashboard.unauthorized'
      : status === 403
        ? 'dashboard.forbidden'
        : 'dashboard.http-error';
    return failure({
      code,
      message: 'Grafana rejected the dashboard API discovery request.',
      requestId,
      stage: 'discovery',
      status,
    });
  }
  return decodeGrafana13DiscoveryBody(result.response.body, requestId);
}

export async function retrieveGrafana13DashboardV1Dto(
  input: ValidatedGrafana13DashboardLoadInput,
  _discovery: Grafana13DashboardDiscovery
): Promise<DashboardStageResult<import('./contracts').Grafana13DashboardV1>> {
  const requestId = input.requestIds.dashboard;
  let result: TransportResult;
  try {
    result = await input.transport.execute({
      headers: frozen([frozen(['Accept', 'application/json'] as const)]),
      method: 'GET',
      path: `/apis/dashboard.grafana.app/v1/namespaces/${input.namespace}/dashboards/${input.uid}/dto`,
      requestId,
      signal: input.signal,
    });
  } catch {
    return failure({
      code: 'dashboard.network-error',
      message: 'The host transport could not complete the dashboard DTO request.',
      requestId,
      stage: 'dashboard-v1',
    });
  }
  if (result.kind === 'cancelled') {
    return frozen({ kind: 'cancelled' as const, requestId, stage: 'dashboard-v1' as const });
  }
  if (result.kind === 'network-error') {
    return failure({
      code: 'dashboard.network-error',
      message: 'The host transport could not complete the dashboard DTO request.',
      requestId,
      stage: 'dashboard-v1',
    });
  }
  if (result.kind === 'policy-error') {
    return failure({
      code: 'dashboard.transport-policy-error',
      message: 'The host transport rejected the dashboard DTO request.',
      requestId,
      stage: 'dashboard-v1',
      transportPolicyCode: result.code,
    });
  }
  const { status } = result.response;
  if (status !== 200) {
    const code = status === 401
      ? 'dashboard.unauthorized'
      : status === 403
        ? 'dashboard.forbidden'
        : status === 404
          ? 'dashboard.not-found'
          : 'dashboard.http-error';
    return failure({
      code,
      message: 'Grafana rejected the dashboard DTO request.',
      requestId,
      stage: 'dashboard-v1',
      status,
    });
  }
  return decodeGrafana13DashboardV1Body(result.response.body, {
    namespace: input.namespace,
    requestId,
    uid: input.uid,
  });
}

export async function retrieveAndPreflightGrafana13DashboardV1(
  input: Grafana13DashboardLoadInput
): Promise<Grafana13DashboardLoadResult> {
  const validated = validateDashboardLoadInput(input);
  if (validated.kind !== 'success') return validated;
  const discovery = await discoverStableGrafana13DashboardV1(validated.value);
  if (discovery.kind !== 'success') return discovery;
  const dashboard = await retrieveGrafana13DashboardV1Dto(validated.value, discovery.value);
  if (dashboard.kind !== 'success') return dashboard;
  const preflight = preflightGrafana13DashboardV1(dashboard.value, validated.value.manifest);
  if (preflight.kind === 'unsupported') {
    return frozen({
      diagnostics: preflight.diagnostics,
      diagnosticsTruncated: preflight.diagnosticsTruncated,
      inventory: preflight.inventory,
      kind: 'unsupported' as const,
      requestId: validated.value.requestIds.dashboard,
      stage: 'preflight' as const,
    });
  }
  return frozen({
    dashboard: dashboard.value,
    inventory: preflight.inventory,
    kind: 'ready' as const,
    requestIds: frozen({
      dashboard: validated.value.requestIds.dashboard,
      discovery: validated.value.requestIds.discovery,
    }),
    staticPreflight: frozen({
      outcome: 'declared-requirements-match' as const,
      profileId: 'grafana-13.2.3-v1-schema-42-static-v1' as const,
      providerBuildId: validated.value.manifest.manifest.provider.buildId,
      providerId: validated.value.manifest.manifest.provider.id,
    }),
  });
}
