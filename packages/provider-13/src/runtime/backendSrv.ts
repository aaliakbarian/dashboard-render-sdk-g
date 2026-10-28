import type {
  BackendSrv,
  BackendSrvRequest,
  FetchResponse,
} from '@grafana/runtime';
import type {
  HostTransportCapability,
  TransportHeader,
  TransportMethod,
  TransportQueryParameter,
  TransportResult,
} from '@dashboard-render-sdk-g/provider-contract';
import { Observable } from 'rxjs';

export type Grafana13BackendTransportErrorCode =
  | 'transport-cancelled'
  | 'transport-http-error'
  | 'transport-network-error'
  | 'transport-policy-error'
  | 'transport-response-malformed';

const ownedErrors = new WeakSet<object>();

export class Grafana13BackendTransportError extends Error {
  override readonly name = 'Grafana13BackendTransportError';
  constructor(
    readonly code: Grafana13BackendTransportErrorCode,
    message: string,
    readonly requestId?: string,
    readonly status: number = 500
  ) { super(message); ownedErrors.add(this); }
}

const forbiddenHeader = /^(?:authorization|cookie|forwarded|host|origin|proxy-authorization|set-cookie|x-api-key|x-auth-token|x-forwarded-.+|x-grafana-org-id|x-org-id|x-real-ip|x-scope-orgid|x-tenant-id|x-user-id)$/i;
let generatedRequestId = 0;

function isOwnedError(value: unknown): value is Grafana13BackendTransportError {
  return typeof value === 'object' && value !== null && ownedErrors.has(value);
}

function preprocessingError(): Grafana13BackendTransportError {
  return new Grafana13BackendTransportError(
    'transport-policy-error',
    'The Grafana Runtime request could not be safely normalized.'
  );
}

function pathAndQuery(url: string, params: BackendSrvRequest['params']): {
  readonly path: string;
  readonly query: readonly TransportQueryParameter[];
} {
  const rawPath = url.split('?')[0] ?? '';
  if (!url.startsWith('/') || url.startsWith('//') || url.includes('#') || /[\u0000-\u0020\u007f]/.test(url) ||
      /[\\%]|\/{2}|(?:^|\/)\.{1,2}(?:\/|$)/.test(rawPath)) {
    throw new Grafana13BackendTransportError(
      'transport-policy-error',
      'Grafana Runtime requested an invalid provider-relative path.'
    );
  }
  const parsed = new URL(url, 'https://provider.invalid');
  const query: TransportQueryParameter[] = [...parsed.searchParams.entries()];
  if (params) {
    for (const [name, raw] of Object.entries(params)) {
      if (raw === undefined || raw === null) continue;
      for (const value of Array.isArray(raw) ? raw : [raw]) query.push([name, String(value)]);
    }
  }
  return { path: parsed.pathname, query };
}

function requestHeaders(input: BackendSrvRequest['headers']): readonly TransportHeader[] {
  const entries = input instanceof Headers ? [...input.entries()] : Object.entries(input ?? {});
  return entries.map(([name, rawValue]) => {
    if (forbiddenHeader.test(name)) {
      throw new Grafana13BackendTransportError(
        'transport-policy-error',
        'Host-owned security or credential headers are forbidden at the provider boundary.'
      );
    }
    return [name, String(rawValue)] as const;
  });
}

function bodyFor(config: BackendSrvRequest, method: string): string | undefined {
  if (config.data === undefined || method === 'GET' || method === 'HEAD') return undefined;
  return typeof config.data === 'string' ? config.data : JSON.stringify(config.data);
}

function responseHeaders(entries: readonly TransportHeader[]): Headers {
  const headers = new Headers();
  for (const [name, value] of entries) headers.append(name, value);
  return headers;
}

function decodeBody(body: string, responseType: BackendSrvRequest['responseType']): unknown {
  if (responseType === 'text') return body;
  if (responseType === 'arraybuffer') return new TextEncoder().encode(body).buffer;
  if (responseType === 'blob') return new Blob([body]);
  return body === '' ? undefined : JSON.parse(body);
}

function optionalFrameData(data: Record<string, unknown>, values: unknown[][]): boolean {
  // The pinned decoder indexes these optional columns and iterates entity
  // indices / coerces enum indices. Reject malformed wire data before those
  // operations can throw into its empty-success fallback. Do not decode here.
  for (const key of ['entities', 'enums', 'nanos'] as const) {
    const columns = data[key];
    if (columns === undefined) continue;
    if (!Array.isArray(columns) || columns.length > values.length) return false;
    if (!columns.every((column: unknown, index: number) => {
      if (column === null) return true;
      const length = values[index]!.length;
      if (key === 'entities') {
        return !!column && typeof column === 'object' && !Array.isArray(column) &&
          Object.entries(column).every(([entity, indices]) => ['Inf', 'NegInf', 'Undef', 'NaN'].includes(entity) &&
            Array.isArray(indices) && indices.length <= length &&
            indices.every(i => Number.isSafeInteger(i) && i >= 0 && i < length));
      }
      if (!Array.isArray(column) || column.length > 10000) return false;
      return key === 'enums'
        ? column.every(value => typeof value === 'string') && values[index]!.every(value =>
          typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value < column.length)
        : column.length === length && column.every(value => Number.isSafeInteger(value) && value >= 0 && value <= 999999);
    })) return false;
  }
  return true;
}

function queryEnvelope(value: unknown): boolean {
  if (!value || typeof value !== 'object' || !('results' in value)) return false;
  const results = value.results;
  if (!results || typeof results !== 'object' || Array.isArray(results) || Object.keys(results).some(key => key !== 'A')) return false;
  if (!('A' in results)) return Object.keys(results).length === 0;
  const result = results.A;
  if (!result || typeof result !== 'object') return false;
  // This profile is frame-only. Empty/null legacy placeholders are inert, but
  // material legacy data activates unapproved decoder branches (even when
  // frames is empty), whose exceptions upstream can turn into empty success.
  for (const key of ['series', 'tables']) {
    const legacy = (result as Record<string, unknown>)[key];
    if (legacy != null && (!Array.isArray(legacy) || legacy.length !== 0)) return false;
  }
  const hasError = 'error' in result && typeof result.error === 'string';
  if ('error' in result && !hasError) return false;
  if (!('frames' in result)) return hasError;
  if (!Array.isArray(result.frames) || result.frames.length > 16) return false;
  // Validate wire structure only. DataFrame construction and metadata/labels
  // decoding remain exclusively the pinned Grafana decoder's responsibility.
  return result.frames.every(frame => {
    if (!frame || typeof frame !== 'object' || !frame.schema || !frame.data) return false;
    // A cache HIT adds a notice by spreading this optional metadata array.
    const notices = frame.schema.meta?.notices;
    if (notices != null && !Array.isArray(notices)) return false;
    const fields = frame.schema.fields; const values = frame.data.values;
    return Array.isArray(fields) && fields.length <= 8 && Array.isArray(values) && values.length === fields.length &&
      fields.every((field: unknown) => !!field && typeof field === 'object' && 'name' in field && typeof field.name === 'string' && 'type' in field && typeof field.type === 'string') &&
      values.every((column: unknown) => Array.isArray(column) && column.length <= 10000 && column.length === values[0]?.length) &&
      optionalFrameData(frame.data, values);
  });
}

function mapFailure(result: Exclude<TransportResult, { kind: 'response' }>): never {
  switch (result.kind) {
    case 'cancelled':
      throw new Grafana13BackendTransportError(
        'transport-cancelled', 'The host transport request was cancelled.', result.requestId
      );
    case 'network-error':
      throw new Grafana13BackendTransportError(
        'transport-network-error', 'The host transport request failed.', result.requestId
      );
    case 'policy-error':
      throw new Grafana13BackendTransportError(
        'transport-policy-error', 'The host transport rejected the provider request.', result.requestId
      );
  }
}

export function createGrafana13BackendSrv(capability: HostTransportCapability): BackendSrv {
  const execute = async <T>(config: BackendSrvRequest, suppliedSignal?: AbortSignal): Promise<FetchResponse<T>> => {
    let prepared: {
      readonly body: string | undefined;
      readonly headers: readonly TransportHeader[];
      readonly method: TransportMethod;
      readonly path: string;
      readonly query: readonly TransportQueryParameter[];
      readonly requestId: string;
      readonly responseType: BackendSrvRequest['responseType'];
      readonly signal: AbortSignal;
      readonly url: string;
    };
    try {
      const requestId = config.requestId ?? `provider-13-runtime-${++generatedRequestId}`;
      const responseType = config.responseType;
      const signal = suppliedSignal ?? config.abortSignal ?? new AbortController().signal;
      const url = config.url;
      const { path, query } = pathAndQuery(url, config.params);
      const method = (config.method ?? 'GET').toUpperCase() as TransportMethod;
      prepared = {
        body: bodyFor(config, method),
        headers: requestHeaders(config.headers),
        method,
        path,
        query,
        requestId,
        responseType,
        signal,
        url,
      };
    } catch (error) {
      if (isOwnedError(error)) throw error;
      throw preprocessingError();
    }
    const { body, headers, method, path, query, requestId, responseType, signal, url } = prepared;
    let result: TransportResult;
    try {
      result = await capability.execute({
        ...(body === undefined ? {} : { body }),
        headers,
        method,
        path,
        query,
        requestId,
        signal,
      });
    } catch {
      throw new Grafana13BackendTransportError(
        'transport-network-error', 'The host transport request failed.', requestId
      );
    }
    if (result.kind !== 'response') return mapFailure(result);
    if (result.response.status < 200 || result.response.status > 299) {
      throw new Grafana13BackendTransportError(
        'transport-http-error',
        `The Grafana request failed with HTTP ${result.response.status}.`,
        requestId,
        result.response.status
      );
    }
    let data: T;
    try {
      if (path === '/api/ds/query' && result.response.body.length > 1_048_576) throw new Error();
      data = decodeBody(result.response.body, responseType) as T;
      if (path === '/api/ds/query' && !queryEnvelope(data)) throw new Error();
    } catch {
      throw new Grafana13BackendTransportError(
        'transport-response-malformed', 'Grafana returned a malformed response.', requestId,
        path === '/api/ds/query' ? 500 : result.response.status
      );
    }
    return {
      config,
      data,
      headers: responseHeaders(result.response.headers),
      ok: true,
      redirected: false,
      status: result.response.status,
      statusText: '',
      type: 'basic',
      url,
    };
  };
  const data = async <T>(config: BackendSrvRequest): Promise<T> => (await execute<T>(config)).data;
  const buildAndRun = async <T>(build: () => BackendSrvRequest): Promise<T> => {
    let config: BackendSrvRequest;
    try {
      config = build();
    } catch {
      throw preprocessingError();
    }
    return data<T>(config);
  };
  return {
    get: <T>(url: string, params?: unknown, requestId?: string, options?: Partial<BackendSrvRequest>) =>
      buildAndRun<T>(() => ({ ...options, method: 'GET', params: params as BackendSrvRequest['params'], requestId, url })),
    delete: <T>(url: string, value?: unknown, options?: Partial<BackendSrvRequest>) => buildAndRun<T>(() => ({ ...options, data: value, method: 'DELETE', url })),
    post: <T>(url: string, value?: unknown, options?: Partial<BackendSrvRequest>) => buildAndRun<T>(() => ({ ...options, data: value, method: 'POST', url })),
    patch: <T>(url: string, value?: unknown, options?: Partial<BackendSrvRequest>) => buildAndRun<T>(() => ({ ...options, data: value, method: 'PATCH', url })),
    put: <T>(url: string, value?: unknown, options?: Partial<BackendSrvRequest>) => buildAndRun<T>(() => ({ ...options, data: value, method: 'PUT', url })),
    request: data,
    datasourceRequest: execute,
    fetch: <T>(options: BackendSrvRequest) => new Observable<FetchResponse<T>>((subscriber) => {
      // The runtime supplies no signal on this pinned query branch. Own only
      // that missing controller; a supplied signal crosses the boundary intact.
      let controller: AbortController | undefined;
      let signal: AbortSignal;
      try {
        const supplied = options.abortSignal;
        controller = supplied ? undefined : new AbortController();
        signal = supplied ?? controller!.signal;
      } catch { subscriber.error(preprocessingError()); return; }
      void execute<T>(options, signal).then(
        (response) => { if (!subscriber.closed) { subscriber.next(response); subscriber.complete(); } },
        (error: unknown) => {
          if (!subscriber.closed) subscriber.error(error);
        }
      );
      return () => controller?.abort();
    }),
    chunked: (_options: BackendSrvRequest) => new Observable((subscriber) => {
      subscriber.error(new Grafana13BackendTransportError(
        'transport-policy-error', 'Chunked requests are outside the Text-only provider boundary.'
      ));
    }),
  };
}
