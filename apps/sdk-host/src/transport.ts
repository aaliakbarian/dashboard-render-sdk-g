import type {
  HostTransportExecutor,
  HostTransportResponse,
  TransportRequest,
} from '@dashboard-render-sdk-g/provider-contract';
import { isSdkHostDatasourceRequestAllowed } from './queryTransportPolicy';

type FetchImplementation = (
  input: string,
  init: RequestInit
) => Promise<Pick<Response, 'headers' | 'status' | 'text'>>;

const dashboardDtoPath =
  /^\/apis\/dashboard\.grafana\.app\/v1\/namespaces\/default\/dashboards\/[A-Za-z0-9_-]{1,40}\/dto$/;

function isAllowedRequest(request: TransportRequest): boolean {
  return isSdkHostDatasourceRequestAllowed(request) || (
    request.method === 'GET' &&
    request.body === undefined &&
    (request.query === undefined || request.query.length === 0) &&
    (request.path === '/api/health' ||
      request.path === '/apis/dashboard.grafana.app/' ||
      dashboardDtoPath.test(request.path))
  );
}

export function createSdkHostBrowserExecutor(
  origin: string,
  fetchImplementation: FetchImplementation = globalThis.fetch.bind(globalThis)
): HostTransportExecutor {
  return async (request): Promise<HostTransportResponse> => {
    if (!isAllowedRequest(request)) {
      throw new Error('The SDK host read-only transport policy rejected the request.');
    }

    const url = new URL(`/grafana${request.path}`, origin);
    for (const [name, value] of request.query ?? []) url.searchParams.append(name, value);
    const headers = new Headers(request.headers?.map(([name, value]) => [name, value]));
    if (request.method === 'POST') headers.set('Content-Type', 'application/json');
    const response = await fetchImplementation(`${url.pathname}${url.search}`, {
      ...(request.body === undefined ? {} : { body: request.body }),
      credentials: 'same-origin',
      headers,
      method: request.method,
      redirect: 'error',
      signal: request.signal,
    });
    return Object.freeze({
      body: await response.text(),
      headers: Object.freeze(
        [...response.headers.entries()]
          .filter(([name]) => !['set-cookie', 'set-cookie2'].includes(name.toLowerCase()))
          .map(([name, value]) => Object.freeze([name, value] as const))
      ),
      status: response.status,
    });
  };
}
