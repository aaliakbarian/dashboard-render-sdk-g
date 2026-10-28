import type {
  HostTransportExecutor, HostTransportResponse, TransportRequest,
} from '@dashboard-render-sdk-g/provider-contract';

type FetchImplementation = (
  input: string, init: RequestInit
) => Promise<Pick<Response, 'headers' | 'status' | 'text'>>;

const datasourceType = 'grafana-testdata-datasource';
const datasourceUid = 'grsdk-testdata';
const dashboardDtoPath =
  /^\/apis\/dashboard\.grafana\.app\/v1\/namespaces\/default\/dashboards\/[A-Za-z0-9_-]{1,40}\/dto$/;
const sensitiveResponseHeaders = new Set([
  'set-cookie', 'set-cookie2', 'authorization', 'proxy-authorization',
  'authentication-info', 'proxy-authentication-info',
]);
const positive = (value: unknown, max: number): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0 && value <= max;
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function keys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  return Object.keys(value).every(key => allowed.includes(key));
}
function headersAllowed(request: TransportRequest): boolean {
  const seen = new Set<string>();
  for (const [rawName, value] of request.headers ?? []) {
    const name = rawName.toLowerCase();
    if (seen.has(name)) return false;
    seen.add(name);
    switch (name) {
      case 'x-plugin-id': if (value !== datasourceType) return false; break;
      case 'x-datasource-uid': if (value !== datasourceUid) return false; break;
      case 'content-type': if (value !== 'application/json') return false; break;
      case 'x-dashboard-uid': if (!/^[A-Za-z0-9_-]{1,40}$/.test(value)) return false; break;
      case 'x-panel-id': if (!/^[1-9][0-9]{0,9}$/.test(value) || Number(value) > 2147483647) return false; break;
      case 'x-panel-plugin-id': if (!['stat', 'timeseries', 'table', 'gauge', 'bargauge', 'piechart', 'barchart'].includes(value)) return false; break;
      case 'x-dashboard-title':
      case 'x-panel-title': if (!/^[\x20-\x7e]{1,256}$/.test(value)) return false; break;
      default: return false;
    }
  }
  return true;
}
function bodyAllowed(body: string | undefined): boolean {
  if (typeof body !== 'string' || body.length > 16384) return false;
  const value: unknown = JSON.parse(body);
  if (!record(value) || !keys(value, ['queries', 'from', 'to'])) return false;
  if (![value.from, value.to].every(time => typeof time === 'string' && /^[0-9]{1,16}$/.test(time) && Number.isSafeInteger(Number(time)))) return false;
  if (Number(value.from) >= Number(value.to) || Number(value.to) - Number(value.from) > 86400000) return false;
  if (!Array.isArray(value.queries) || value.queries.length !== 1) return false;
  const query = value.queries[0];
  if (!record(query) || !keys(query, ['refId', 'scenarioId', 'alias', 'pulseWave', 'datasource', 'datasourceId', 'intervalMs', 'maxDataPoints'])) return false;
  if (query.refId !== 'A' || query.scenarioId !== 'predictable_pulse' || typeof query.alias !== 'string' || !/^[\x20-\x7e]{0,256}$/.test(query.alias)) return false;
  if (!record(query.datasource) || !keys(query.datasource, ['type', 'uid']) || query.datasource.type !== datasourceType || query.datasource.uid !== datasourceUid) return false;
  if (query.datasourceId !== undefined && !positive(query.datasourceId, 2147483647)) return false;
  if (!positive(query.intervalMs, 86400000) || !positive(query.maxDataPoints, 10000)) return false;
  const pulse = query.pulseWave;
  return record(pulse) && keys(pulse, ['offCount', 'offValue', 'onCount', 'onValue', 'timeStep']) &&
    pulse.offCount === 5 && pulse.offValue === 10 && pulse.onCount === 5 && pulse.onValue === 90 && pulse.timeStep === 1;
}

/** Demo-owned authorization matching the production host policy; provider checks grant no authority. */
function isAllowedRequest(request: TransportRequest): boolean {
  try {
    if (request.method === 'GET') {
      const headers = request.headers ?? [];
      const headersAllowed = headers.length === 0 || (headers.length === 1 &&
        headers[0]![0].toLowerCase() === 'accept' && headers[0]![1] === 'application/json');
      return request.body === undefined && (request.query?.length ?? 0) === 0 &&
        headersAllowed && (request.path === '/api/health' ||
          request.path === '/apis/dashboard.grafana.app/' || request.path === '/api/frontend/settings' ||
          dashboardDtoPath.test(request.path));
    }
    if (request.path !== '/api/ds/query' || request.method !== 'POST' || !headersAllowed(request)) return false;
    const query = request.query ?? [];
    if (query.length < 1 || query.length > 2) return false;
    const seen = new Set<string>();
    for (const [name, value] of query) {
      if (seen.has(name)) return false;
      seen.add(name);
      if (name === 'ds_type') { if (value !== datasourceType) return false; }
      else if (name === 'requestId') { if (!/^[A-Za-z0-9_-]{1,128}$/.test(value) || value !== request.requestId) return false; }
      else return false;
    }
    return seen.has('ds_type') && bodyAllowed(request.body);
  } catch { return false; }
}

export function createDemoBrowserExecutor(
  origin: string,
  fetchImplementation: FetchImplementation = globalThis.fetch.bind(globalThis)
): HostTransportExecutor {
  return async (request): Promise<HostTransportResponse> => {
    if (!isAllowedRequest(request)) throw new Error('The demo transport policy rejected the request.');
    const url = new URL(`/grafana${request.path}`, origin);
    for (const [name, value] of request.query ?? []) url.searchParams.append(name, value);
    const headers = new Headers(request.headers?.map(([name, value]) => [name, value]));
    if (request.method === 'POST') headers.set('Content-Type', 'application/json');
    const response = await fetchImplementation(`${url.pathname}${url.search}`, {
      ...(request.body === undefined ? {} : { body: request.body }),
      credentials: 'same-origin', headers, method: request.method, redirect: 'error', signal: request.signal,
    });
    return Object.freeze({
      body: await response.text(),
      headers: Object.freeze([...response.headers.entries()]
        .filter(([name]) => !sensitiveResponseHeaders.has(name.toLowerCase()))
        .map(([name, value]) => Object.freeze([name, value] as const))),
      status: response.status,
    });
  };
}
