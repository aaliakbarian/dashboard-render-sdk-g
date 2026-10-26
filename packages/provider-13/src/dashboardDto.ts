import {
  GRAFANA_13_DASHBOARD_SCHEMA_VERSION,
  type Grafana13DashboardFailure,
  type Grafana13DashboardV1,
  type Grafana13JsonObject,
  type Grafana13JsonValue,
  type Grafana13PreflightDiagnostic,
} from './contracts';
import { cloneBoundedJson, type DashboardStageResult } from './dashboardApi';

const MAX_BODY_LENGTH = 1_048_576;
const MAX_PANELS = 256;
const envelopeKeys = new Set(['access', 'apiVersion', 'kind', 'metadata', 'spec', 'status']);
const metadataKeys = new Set([
  'annotations', 'creationTimestamp', 'deletionTimestamp', 'generation', 'labels',
  'managedFields', 'name', 'namespace', 'resourceVersion', 'uid',
]);
const accessKeys = new Set([
  'annotationsPermissions', 'canAdmin', 'canDelete', 'canEdit', 'canSave', 'canShare',
  'canStar', 'isPublic', 'slug', 'url',
]);
const booleanAccessKeys = [
  'canAdmin', 'canDelete', 'canEdit', 'canSave', 'canShare', 'canStar', 'isPublic',
] as const;
const requiredBooleanAccessKeys = [
  'canAdmin', 'canDelete', 'canEdit', 'canSave', 'canStar', 'isPublic',
] as const;

function frozen<T extends object>(value: T): Readonly<T> {
  return Object.freeze(value);
}

function failure(error: Grafana13DashboardFailure): DashboardStageResult<never> {
  return frozen({ error: frozen(error), kind: 'failure' as const });
}

function malformed(requestId: string): DashboardStageResult<never> {
  return failure({
    code: 'dashboard.response-malformed',
    message: 'Grafana returned a malformed dashboard DTO.',
    requestId,
    stage: 'dashboard-v1',
  });
}

function diagnosticUnsupported(
  code: 'dashboard.conversion-unsupported' | 'dashboard.schema-unsupported',
  path: string,
  requestId: string,
  message: string
): DashboardStageResult<never> {
  const diagnostic: Grafana13PreflightDiagnostic = frozen({ code, message, path });
  return frozen({
    diagnostics: frozen([diagnostic]),
    diagnosticsTruncated: false,
    kind: 'unsupported' as const,
    requestId,
    stage: 'dashboard-v1' as const,
  });
}

function identityFailure(path: string, requestId: string): DashboardStageResult<never> {
  return failure({
    code: 'dashboard.identity-mismatch',
    message: 'The dashboard DTO identity does not match the request.',
    path,
    requestId,
    stage: 'dashboard-v1',
  });
}

function isObject(value: Grafana13JsonValue | undefined): value is Readonly<Record<string, Grafana13JsonValue>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function own(object: Readonly<Record<string, Grafana13JsonValue>>, key: string): Grafana13JsonValue | undefined {
  return Object.prototype.hasOwnProperty.call(object, key) ? object[key] : undefined;
}

function hasOnlyKeys(object: Readonly<Record<string, Grafana13JsonValue>>, allowed: ReadonlySet<string>): boolean {
  return Object.keys(object).every((key) => allowed.has(key));
}

function decodeAccess(
  raw: Grafana13JsonValue | undefined
): Grafana13DashboardV1['access'] | undefined {
  if (!isObject(raw) || !hasOnlyKeys(raw, accessKeys)) return undefined;
  const output: Record<string, boolean | string | Grafana13JsonObject> = {};
  for (const key of booleanAccessKeys) {
    const value = own(raw, key);
    if (value !== undefined) {
      if (typeof value !== 'boolean') return undefined;
      output[key] = value;
    }
  }
  if (requiredBooleanAccessKeys.some((key) => typeof own(raw, key) !== 'boolean')) return undefined;
  for (const key of ['slug', 'url'] as const) {
    const value = own(raw, key);
    if (value !== undefined) {
      if (typeof value !== 'string') return undefined;
      output[key] = value;
    }
  }
  const permissions = own(raw, 'annotationsPermissions');
  if (permissions !== undefined) {
    if (permissions !== null && !isObject(permissions)) return undefined;
    if (permissions !== null) output.annotationsPermissions = permissions as Grafana13JsonObject;
  }
  return frozen(output) as Grafana13DashboardV1['access'];
}

export function decodeGrafana13DashboardV1Body(
  body: string,
  expected: { readonly namespace: string; readonly uid: string; readonly requestId: string }
): DashboardStageResult<Grafana13DashboardV1> {
  let requestId: string;
  try {
    requestId = expected.requestId;
  } catch {
    requestId = 'invalid-request';
  }
  if (typeof requestId !== 'string') requestId = 'invalid-request';
  if (typeof body !== 'string' || body.length > MAX_BODY_LENGTH) return malformed(requestId);
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return malformed(requestId);
  }
  return decodeGrafana13DashboardV1Value(parsed, expected);
}

export function decodeGrafana13DashboardV1Value(
  value: unknown,
  expected: { readonly namespace: string; readonly uid: string; readonly requestId: string }
): DashboardStageResult<Grafana13DashboardV1> {
  let expectedNamespace: string;
  let expectedUid: string;
  let requestId: string;
  try {
    expectedNamespace = expected.namespace;
    expectedUid = expected.uid;
    requestId = expected.requestId;
  } catch {
    return malformed('invalid-request');
  }
  if (typeof expectedNamespace !== 'string' || typeof expectedUid !== 'string' || typeof requestId !== 'string') {
    return malformed('invalid-request');
  }
  const cloned = cloneBoundedJson(value);
  if (!cloned.ok || !isObject(cloned.value) || !hasOnlyKeys(cloned.value, envelopeKeys)) {
    return malformed(requestId);
  }
  if (
    own(cloned.value, 'apiVersion') !== 'dashboard.grafana.app/v1' ||
    own(cloned.value, 'kind') !== 'DashboardWithAccessInfo'
  ) return malformed(requestId);

  const metadataRaw = own(cloned.value, 'metadata');
  const specRaw = own(cloned.value, 'spec');
  const access = decodeAccess(own(cloned.value, 'access'));
  if (
    !isObject(metadataRaw) ||
    !hasOnlyKeys(metadataRaw, metadataKeys) ||
    !isObject(specRaw) ||
    !access
  ) return malformed(requestId);

  const name = own(metadataRaw, 'name');
  const namespace = own(metadataRaw, 'namespace');
  if (typeof name !== 'string' || typeof namespace !== 'string') return malformed(requestId);
  if (name !== expectedUid) return identityFailure('$.metadata.name', requestId);
  if (namespace !== expectedNamespace) return identityFailure('$.metadata.namespace', requestId);

  const generation = own(metadataRaw, 'generation');
  const resourceVersion = own(metadataRaw, 'resourceVersion');
  if (generation !== undefined && (!Number.isSafeInteger(generation) || (generation as number) < 0)) {
    return malformed(requestId);
  }
  if (resourceVersion !== undefined && typeof resourceVersion !== 'string') {
    return malformed(requestId);
  }

  const panels = own(specRaw, 'panels');
  const schemaVersion = own(specRaw, 'schemaVersion');
  if (!Array.isArray(panels) || panels.length > MAX_PANELS || !Number.isSafeInteger(schemaVersion)) {
    return malformed(requestId);
  }
  if (schemaVersion !== GRAFANA_13_DASHBOARD_SCHEMA_VERSION) {
    return diagnosticUnsupported(
      'dashboard.schema-unsupported',
      '$.spec.schemaVersion',
      requestId,
      'Only V1 dashboard schemaVersion 42 is supported by this provider profile.'
    );
  }

  const statusRaw = own(cloned.value, 'status');
  let status: Grafana13DashboardV1['status'];
  if (statusRaw !== undefined) {
    if (!isObject(statusRaw) || !hasOnlyKeys(statusRaw, new Set(['conversion']))) {
      return malformed(requestId);
    }
    const conversionRaw = own(statusRaw, 'conversion');
    if (conversionRaw !== undefined) {
      if (!isObject(conversionRaw)) return malformed(requestId);
      const failed = own(conversionRaw, 'failed');
      const storedVersion = own(conversionRaw, 'storedVersion');
      const error = own(conversionRaw, 'error');
      if (
        typeof failed !== 'boolean' ||
        (storedVersion !== undefined && typeof storedVersion !== 'string') ||
        (error !== undefined && typeof error !== 'string')
      ) return malformed(requestId);
      if (failed) {
        return diagnosticUnsupported(
          'dashboard.conversion-unsupported',
          '$.status.conversion.failed',
          requestId,
          'Grafana reported that dashboard conversion failed.'
        );
      }
      status = frozen({
        conversion: frozen({
          failed: false as const,
          ...(typeof storedVersion === 'string' ? { storedVersion } : {}),
        }),
      });
    } else {
      status = frozen({});
    }
  }

  const metadata = frozen({
    ...(typeof generation === 'number' ? { generation } : {}),
    name,
    namespace,
    ...(typeof resourceVersion === 'string' ? { resourceVersion } : {}),
  });
  const dashboard: Grafana13DashboardV1 = frozen({
    access,
    apiVersion: 'dashboard.grafana.app/v1' as const,
    family: 'v1' as const,
    kind: 'DashboardWithAccessInfo' as const,
    metadata,
    spec: specRaw as Grafana13DashboardV1['spec'],
    ...(status === undefined ? {} : { status }),
  });
  return frozen({ kind: 'success' as const, value: dashboard });
}
