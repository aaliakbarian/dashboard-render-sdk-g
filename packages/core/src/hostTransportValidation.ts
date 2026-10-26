import {
  HOST_TRANSPORT_DESCRIPTOR_SCHEMA_VERSION,
  type HostTransportDescriptor,
  type HostTransportResponse,
  type TransportHeader,
  type TransportMethod,
  type TransportPolicyErrorCode,
  type TransportQueryParameter,
  type TransportRequest,
} from '@dashboard-render-sdk-g/provider-contract';

export const MAX_CONTAINER_PROPERTIES = 1_024;
export const MAX_VALIDATION_DIAGNOSTICS = 100;
export const MAX_ORIGIN_LENGTH = 2_048;
export const MAX_PATH_LENGTH = 8_192;
export const MAX_OPAQUE_ID_LENGTH = 256;
export const MAX_ARRAY_LENGTH = 1_024;
export const MAX_HEADER_NAME_LENGTH = 256;
export const MAX_HEADER_VALUE_LENGTH = 8_192;

export interface HostTransportValidationError {
  readonly code: 'invalid-descriptor';
  readonly path: string;
  readonly message: string;
}

export type DescriptorValidationResult =
  | { readonly valid: true; readonly descriptor: HostTransportDescriptor }
  | { readonly valid: false; readonly errors: readonly HostTransportValidationError[] };

type MutableError = {
  code: 'invalid-descriptor';
  path: string;
  message: string;
};

type InspectedRecord = {
  readonly values: ReadonlyMap<string, unknown>;
  readonly structurallyValid: boolean;
};

export type RequestValidationResult =
  | { readonly valid: true; readonly request: TransportRequest }
  | {
      readonly valid: false;
      readonly code: TransportPolicyErrorCode;
      readonly requestId?: string;
    };

type ShapeInspection =
  | { readonly valid: true; readonly values: ReadonlyMap<string, unknown> }
  | { readonly valid: false };

type ArrayInspection =
  | { readonly valid: true; readonly values: readonly unknown[] }
  | { readonly valid: false };

const descriptorFields = [
  'schemaVersion',
  'targetOrigin',
  'basePath',
  'securityScopeId',
  'requestPolicyId',
] as const;
const descriptorFieldSet = new Set<string>(descriptorFields);
const requestFieldSet = new Set([
  'requestId',
  'method',
  'path',
  'query',
  'headers',
  'body',
  'signal',
]);
const responseFieldSet = new Set(['status', 'headers', 'body']);
const methods = new Set<TransportMethod>(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD']);
const credentialHeaders = new Set([
  'authorization',
  'cookie',
  'proxy-authorization',
  'x-api-key',
  'x-auth-token',
]);
const hostControlledHeaders = new Set([
  'host',
  'origin',
  'forwarded',
  'x-real-ip',
  'x-grafana-org-id',
  'x-scope-orgid',
  'x-org-id',
  'x-tenant-id',
  'x-user-id',
]);
const sensitiveResponseHeaders = new Set([
  'set-cookie',
  'set-cookie2',
  'authorization',
  'proxy-authorization',
  'authentication-info',
  'proxy-authentication-info',
]);
const headerNamePattern = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;

function addError(errors: MutableError[], path: string, message: string): void {
  if (errors.length >= MAX_VALIDATION_DIAGNOSTICS) return;
  errors.push({ code: 'invalid-descriptor', path, message });
}

function inspectRecord(value: unknown, errors: MutableError[]): InspectedRecord | undefined {
  if (typeof value !== 'object' || value === null) {
    addError(errors, '$', 'Transport descriptor must be a plain object.');
    return undefined;
  }

  let isArray: boolean;
  let prototype: object | null;
  let keys: readonly (string | symbol)[];
  try {
    isArray = Array.isArray(value);
    prototype = Object.getPrototypeOf(value);
    keys = Reflect.ownKeys(value);
  } catch {
    addError(errors, '$', 'Transport descriptor could not be inspected safely.');
    return undefined;
  }
  if (isArray) {
    addError(errors, '$', 'Transport descriptor must be a plain object.');
    return undefined;
  }
  if (prototype !== Object.prototype && prototype !== null) {
    addError(errors, '$', 'Transport descriptor must be a plain object.');
    return undefined;
  }
  if (keys.length > MAX_CONTAINER_PROPERTIES) {
    addError(errors, '$', 'Transport descriptor exceeds the property-count limit.');
    return undefined;
  }

  const values = new Map<string, unknown>();
  let structurallyValid = true;
  const orderedKeys = [...keys].sort((left, right) => String(left).localeCompare(String(right)));
  for (const key of orderedKeys) {
    if (errors.length >= MAX_VALIDATION_DIAGNOSTICS) break;
    if (typeof key === 'symbol') {
      addError(errors, '$', 'Transport descriptor contains a symbol-keyed property.');
      structurallyValid = false;
      continue;
    }
    if (!descriptorFieldSet.has(key)) {
      addError(errors, '$', 'Transport descriptor contains an unknown field.');
      structurallyValid = false;
      continue;
    }
    const path = `$.${key}`;
    let property: PropertyDescriptor | undefined;
    try {
      property = Object.getOwnPropertyDescriptor(value, key);
    } catch {
      addError(errors, path, 'Transport descriptor property could not be inspected safely.');
      structurallyValid = false;
      continue;
    }
    if (!property || !property.enumerable || !('value' in property)) {
      addError(errors, path, 'Transport descriptor fields must be enumerable data properties.');
      structurallyValid = false;
      continue;
    }
    values.set(key, property.value);
  }
  return { structurallyValid, values };
}

function normalizeOrigin(value: unknown, errors: MutableError[]): string | undefined {
  const path = '$.targetOrigin';
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > MAX_ORIGIN_LENGTH ||
    value.includes('@') ||
    value.includes('\\') ||
    /[\u0000-\u001f\u007f]/.test(value) ||
    /:\/?$/.test(value) ||
    !/^https?:\/\/[^/?#\s]+\/?$/i.test(value)
  ) {
    addError(errors, path, 'Transport target origin must be a bounded HTTP(S) origin string.');
    return undefined;
  }
  try {
    const parsed = new URL(value);
    if (
      (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') ||
      parsed.username !== '' ||
      parsed.password !== '' ||
      parsed.pathname !== '/' ||
      parsed.search !== '' ||
      parsed.hash !== '' ||
      parsed.origin === 'null'
    ) {
      addError(errors, path, 'Transport target origin must be an exact HTTP(S) origin.');
      return undefined;
    }
    return parsed.origin;
  } catch {
    addError(errors, path, 'Transport target origin must be an exact HTTP(S) origin.');
    return undefined;
  }
}

function normalizePath(value: unknown, errors: MutableError[]): string | undefined {
  const path = '$.basePath';
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > MAX_PATH_LENGTH ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('?') ||
    value.includes('#') ||
    value.includes('\\') ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    addError(errors, path, 'Transport base path must be a bounded root-relative path.');
    return undefined;
  }
  if (value !== '/' && value.includes('//')) {
    addError(errors, path, 'Transport base path must not contain empty segments.');
    return undefined;
  }

  const hasTrailingSlash = value.length > 1 && value.endsWith('/');
  const rawSegments = value.slice(1, hasTrailingSlash ? -1 : undefined).split('/');
  const normalized: string[] = [];
  for (const segment of rawSegments) {
    if (segment === '' && value !== '/') {
      addError(errors, path, 'Transport base path must not contain empty segments.');
      return undefined;
    }
    let decoded: string;
    let encoded: string;
    try {
      decoded = decodeURIComponent(segment);
      encoded = encodeURIComponent(decoded);
    } catch {
      addError(errors, path, 'Transport base path contains invalid percent encoding.');
      return undefined;
    }
    if (
      decoded === '.' ||
      decoded === '..' ||
      decoded.includes('/') ||
      decoded.includes('\\') ||
      /%[0-9a-f]{2}/i.test(decoded)
    ) {
      addError(errors, path, 'Transport base path contains an ambiguous or unsafe segment.');
      return undefined;
    }
    if (decoded !== '') normalized.push(encoded);
  }
  return normalized.length === 0 ? '/' : `/${normalized.join('/')}`;
}

function normalizeOpaqueId(
  value: unknown,
  field: 'securityScopeId' | 'requestPolicyId',
  errors: MutableError[]
): string | undefined {
  const path = `$.${field}`;
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > MAX_OPAQUE_ID_LENGTH ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    addError(errors, path, 'Transport opaque identifiers must be bounded non-secret strings.');
    return undefined;
  }
  return value;
}

function freezeErrors(errors: MutableError[]): readonly HostTransportValidationError[] {
  return Object.freeze(errors.map((error) => Object.freeze({ ...error })));
}

export function validateHostTransportDescriptor(value: unknown): DescriptorValidationResult {
  const errors: MutableError[] = [];
  const inspected = inspectRecord(value, errors);
  if (!inspected) return Object.freeze({ errors: freezeErrors(errors), valid: false });

  const schemaVersion = inspected.values.get('schemaVersion');
  if (schemaVersion !== HOST_TRANSPORT_DESCRIPTOR_SCHEMA_VERSION) {
    addError(errors, '$.schemaVersion', 'Transport descriptor schema version is unsupported.');
  }
  const targetOrigin = normalizeOrigin(inspected.values.get('targetOrigin'), errors);
  const basePath = normalizePath(inspected.values.get('basePath'), errors);
  const securityScopeId = normalizeOpaqueId(
    inspected.values.get('securityScopeId'),
    'securityScopeId',
    errors
  );
  const requestPolicyId = normalizeOpaqueId(
    inspected.values.get('requestPolicyId'),
    'requestPolicyId',
    errors
  );

  if (
    !inspected.structurallyValid ||
    errors.length > 0 ||
    targetOrigin === undefined ||
    basePath === undefined ||
    securityScopeId === undefined ||
    requestPolicyId === undefined
  ) {
    return Object.freeze({ errors: freezeErrors(errors), valid: false });
  }

  return Object.freeze({
    descriptor: Object.freeze({
      basePath,
      requestPolicyId,
      schemaVersion: HOST_TRANSPORT_DESCRIPTOR_SCHEMA_VERSION,
      securityScopeId,
      targetOrigin,
    }),
    valid: true,
  });
}

function inspectFixedRecord(value: unknown, allowedFields: ReadonlySet<string>): ShapeInspection {
  if (typeof value !== 'object' || value === null) return { valid: false };
  let isArray: boolean;
  let prototype: object | null;
  let keys: readonly (string | symbol)[];
  try {
    isArray = Array.isArray(value);
    prototype = Object.getPrototypeOf(value);
    keys = Reflect.ownKeys(value);
  } catch {
    return { valid: false };
  }
  if (
    isArray ||
    (prototype !== Object.prototype && prototype !== null) ||
    keys.length > MAX_CONTAINER_PROPERTIES
  ) {
    return { valid: false };
  }

  const values = new Map<string, unknown>();
  for (const key of keys) {
    if (typeof key !== 'string' || !allowedFields.has(key)) return { valid: false };
    let property: PropertyDescriptor | undefined;
    try {
      property = Object.getOwnPropertyDescriptor(value, key);
    } catch {
      return { valid: false };
    }
    if (!property || !property.enumerable || !('value' in property)) return { valid: false };
    values.set(key, property.value);
  }
  return { valid: true, values };
}

function inspectDenseArray(value: unknown, expectedLength?: number): ArrayInspection {
  if (typeof value !== 'object' || value === null) return { valid: false };
  let isArray: boolean;
  let keys: readonly (string | symbol)[];
  let lengthProperty: PropertyDescriptor | undefined;
  try {
    isArray = Array.isArray(value);
    keys = Reflect.ownKeys(value);
    lengthProperty = Object.getOwnPropertyDescriptor(value, 'length');
  } catch {
    return { valid: false };
  }
  if (
    !isArray ||
    !lengthProperty ||
    !('value' in lengthProperty) ||
    typeof lengthProperty.value !== 'number' ||
    !Number.isSafeInteger(lengthProperty.value) ||
    lengthProperty.value < 0
  ) {
    return { valid: false };
  }
  const length = lengthProperty.value;
  if (length > MAX_ARRAY_LENGTH || (expectedLength !== undefined && length !== expectedLength)) {
    return { valid: false };
  }
  const elementKeys = keys.filter((key) => key !== 'length');
  if (elementKeys.length > MAX_CONTAINER_PROPERTIES || elementKeys.length !== length) {
    return { valid: false };
  }

  const values: unknown[] = [];
  for (let index = 0; index < length; index += 1) {
    const key = String(index);
    if (!elementKeys.includes(key)) return { valid: false };
    let property: PropertyDescriptor | undefined;
    try {
      property = Object.getOwnPropertyDescriptor(value, key);
    } catch {
      return { valid: false };
    }
    if (!property || !property.enumerable || !('value' in property)) return { valid: false };
    values.push(property.value);
  }
  if (elementKeys.some((key) => typeof key !== 'string' || !/^(0|[1-9]\d*)$/.test(key))) {
    return { valid: false };
  }
  return { valid: true, values };
}

function normalizeRequestId(value: unknown): string | undefined {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > MAX_OPAQUE_ID_LENGTH ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    return undefined;
  }
  return value;
}

function normalizeRequestPath(
  value: unknown,
  basePath: string
): { readonly valid: true; readonly path: string } | {
  readonly valid: false;
  readonly code: 'invalid-request' | 'path-outside-capability';
} {
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_PATH_LENGTH) {
    return { code: 'invalid-request', valid: false };
  }
  if (/^[A-Za-z][A-Za-z\d+.-]*:/.test(value) || value.startsWith('//')) {
    return { code: 'path-outside-capability', valid: false };
  }
  if (!value.startsWith('/') || value.includes('?') || value.includes('#')) {
    return { code: 'invalid-request', valid: false };
  }
  if (value.includes('\\')) return { code: 'path-outside-capability', valid: false };
  if (/[\u0000-\u001f\u007f]/.test(value) || (value !== '/' && value.includes('//'))) {
    return { code: 'invalid-request', valid: false };
  }

  const trailingSlash = value.length > 1 && value.endsWith('/');
  const rawSegments = value.slice(1, trailingSlash ? -1 : undefined).split('/');
  const segments: string[] = [];
  for (const segment of rawSegments) {
    if (segment === '' && value !== '/') return { code: 'invalid-request', valid: false };
    let decoded: string;
    let encoded: string;
    try {
      decoded = decodeURIComponent(segment);
      encoded = encodeURIComponent(decoded);
    } catch {
      return { code: 'invalid-request', valid: false };
    }
    if (
      decoded === '.' ||
      decoded === '..' ||
      decoded.includes('/') ||
      decoded.includes('\\') ||
      /%[0-9a-f]{2}/i.test(decoded)
    ) {
      return { code: 'path-outside-capability', valid: false };
    }
    if (decoded !== '') segments.push(encoded);
  }
  const path = segments.length === 0 ? '/' : `/${segments.join('/')}${trailingSlash ? '/' : ''}`;
  if (basePath !== '/' && (path === basePath || path.startsWith(`${basePath}/`))) {
    return { code: 'path-outside-capability', valid: false };
  }
  return { path, valid: true };
}

function normalizeTupleArray(
  value: unknown,
  kind: 'query' | 'headers'
):
  | { readonly valid: true; readonly tuples: readonly (readonly [string, string])[] }
  | { readonly valid: false; readonly code: TransportPolicyErrorCode } {
  const array = inspectDenseArray(value);
  if (!array.valid) return { code: 'invalid-request', valid: false };
  const tuples: (readonly [string, string])[] = [];
  for (const entry of array.values) {
    const tuple = inspectDenseArray(entry, 2);
    if (!tuple.valid) return { code: 'invalid-request', valid: false };
    const [rawName, rawValue] = tuple.values;
    if (typeof rawName !== 'string' || typeof rawValue !== 'string') {
      return { code: 'invalid-request', valid: false };
    }
    if (kind === 'query') {
      if (rawName.length > MAX_PATH_LENGTH || rawValue.length > MAX_PATH_LENGTH) {
        return { code: 'invalid-request', valid: false };
      }
      tuples.push(Object.freeze([rawName, rawValue]));
      continue;
    }

    if (
      rawName.length === 0 ||
      rawName.length > MAX_HEADER_NAME_LENGTH ||
      !headerNamePattern.test(rawName) ||
      rawValue.length > MAX_HEADER_VALUE_LENGTH ||
      /[\u0000-\u0008\u000a-\u001f\u007f]/.test(rawValue)
    ) {
      return { code: 'invalid-request', valid: false };
    }
    const name = rawName.toLowerCase();
    if (credentialHeaders.has(name)) {
      return { code: 'credential-header-forbidden', valid: false };
    }
    if (hostControlledHeaders.has(name) || name.startsWith('x-forwarded-')) {
      return { code: 'host-controlled-header-forbidden', valid: false };
    }
    tuples.push(Object.freeze([name, rawValue]));
  }
  return { tuples: Object.freeze(tuples), valid: true };
}

function isNativeAbortSignal(value: unknown): value is AbortSignal {
  if (typeof value !== 'object' || value === null) return false;
  try {
    const getter = Object.getOwnPropertyDescriptor(AbortSignal.prototype, 'aborted')?.get;
    return typeof getter === 'function' && typeof getter.call(value) === 'boolean';
  } catch {
    return false;
  }
}

function invalidRequest(
  code: TransportPolicyErrorCode,
  requestId: string | undefined
): RequestValidationResult {
  return requestId === undefined
    ? Object.freeze({ code, valid: false })
    : Object.freeze({ code, requestId, valid: false });
}

export function validateAndNormalizeTransportRequest(
  value: unknown,
  descriptor: HostTransportDescriptor
): RequestValidationResult {
  const inspected = inspectFixedRecord(value, requestFieldSet);
  if (!inspected.valid) return invalidRequest('invalid-request', undefined);

  const requestId = normalizeRequestId(inspected.values.get('requestId'));
  if (requestId === undefined) return invalidRequest('invalid-request', undefined);

  const method = inspected.values.get('method');
  if (typeof method !== 'string' || !methods.has(method as TransportMethod)) {
    return invalidRequest('invalid-request', requestId);
  }

  const normalizedPath = normalizeRequestPath(inspected.values.get('path'), descriptor.basePath);
  if (!normalizedPath.valid) return invalidRequest(normalizedPath.code, requestId);

  const queryValue = inspected.values.get('query');
  const query =
    queryValue === undefined ? undefined : normalizeTupleArray(queryValue, 'query');
  if (query !== undefined && !query.valid) return invalidRequest(query.code, requestId);

  const headersValue = inspected.values.get('headers');
  const headers =
    headersValue === undefined ? undefined : normalizeTupleArray(headersValue, 'headers');
  if (headers !== undefined && !headers.valid) return invalidRequest(headers.code, requestId);

  const body = inspected.values.get('body');
  if (body !== undefined && typeof body !== 'string') {
    return invalidRequest('invalid-request', requestId);
  }

  const signal = inspected.values.get('signal');
  if (!isNativeAbortSignal(signal)) return invalidRequest('invalid-request', requestId);

  const request: {
    requestId: string;
    method: TransportMethod;
    path: string;
    query?: readonly TransportQueryParameter[];
    headers?: readonly TransportHeader[];
    body?: string;
    signal: AbortSignal;
  } = {
    method: method as TransportMethod,
    path: normalizedPath.path,
    requestId,
    signal,
  };
  if (query?.valid) request.query = query.tuples as readonly TransportQueryParameter[];
  if (headers?.valid) request.headers = headers.tuples as readonly TransportHeader[];
  if (body !== undefined) request.body = body;
  return Object.freeze({ request: Object.freeze(request), valid: true });
}

export type ResponseValidationResult =
  | { readonly valid: true; readonly response: HostTransportResponse }
  | { readonly valid: false };

function normalizeResponseHeaders(value: unknown): readonly TransportHeader[] | undefined {
  const array = inspectDenseArray(value);
  if (!array.valid) return undefined;
  const headers: TransportHeader[] = [];
  for (const entry of array.values) {
    const tuple = inspectDenseArray(entry, 2);
    if (!tuple.valid) return undefined;
    const [rawName, rawValue] = tuple.values;
    if (
      typeof rawName !== 'string' ||
      typeof rawValue !== 'string' ||
      rawName.length === 0 ||
      rawName.length > MAX_HEADER_NAME_LENGTH ||
      !headerNamePattern.test(rawName) ||
      rawValue.length > MAX_HEADER_VALUE_LENGTH ||
      /[\u0000-\u0008\u000a-\u001f\u007f]/.test(rawValue)
    ) {
      return undefined;
    }
    const name = rawName.toLowerCase();
    if (!sensitiveResponseHeaders.has(name)) headers.push(Object.freeze([name, rawValue]));
  }
  return Object.freeze(headers);
}

export function validateAndNormalizeHostTransportResponse(
  value: unknown
): ResponseValidationResult {
  const inspected = inspectFixedRecord(value, responseFieldSet);
  if (!inspected.valid) return Object.freeze({ valid: false });
  const status = inspected.values.get('status');
  const headers = normalizeResponseHeaders(inspected.values.get('headers'));
  const body = inspected.values.get('body');
  if (
    typeof status !== 'number' ||
    !Number.isInteger(status) ||
    status < 100 ||
    status > 599 ||
    headers === undefined ||
    typeof body !== 'string'
  ) {
    return Object.freeze({ valid: false });
  }
  return Object.freeze({
    response: Object.freeze({ body, headers, status }),
    valid: true,
  });
}

export function readNativeAbortSignal(signal: AbortSignal): boolean {
  const getter = Object.getOwnPropertyDescriptor(AbortSignal.prototype, 'aborted')?.get;
  if (typeof getter !== 'function') return true;
  try {
    return getter.call(signal) as boolean;
  } catch {
    return true;
  }
}
