import { isExactVersion, type TransportResult } from '@dashboard-render-sdk-g/provider-contract';

import { cloneBoundedJson } from './dashboardApi';
import type { Grafana13JsonObject } from './contracts';
import type { Grafana13PartialDashboardFailure, Grafana13PartialDashboardLoadInput, Grafana13PartialDashboardLoadResult } from './partialContracts';

type HealthResult = { readonly kind: 'success' } | Exclude<Grafana13PartialDashboardLoadResult, { readonly kind: 'renderable' }>;

function failure(error: Grafana13PartialDashboardFailure): HealthResult {
  return Object.freeze({ error: Object.freeze(error), kind: 'failure' });
}

/** Checks the reported version only; health commit/build metadata is not source attestation. */
export async function verifyGrafana13Target(input: Grafana13PartialDashboardLoadInput): Promise<HealthResult> {
  const requestId = input.requestIds.health;
  let result: TransportResult;
  try {
    result = await input.transport.execute({
      headers: Object.freeze([Object.freeze(['Accept', 'application/json'] as const)]),
      method: 'GET', path: '/api/health', requestId, signal: input.signal,
    });
  } catch {
    return failure({ code: 'dashboard.network-error', message: 'The host transport could not complete target verification.', requestId, stage: 'health' });
  }
  if (result.kind === 'cancelled') return Object.freeze({ kind: 'cancelled', requestId, stage: 'health' });
  if (result.kind === 'network-error') return failure({ code: 'dashboard.network-error', message: 'The host transport could not complete target verification.', requestId, stage: 'health' });
  if (result.kind === 'policy-error') return failure({ code: 'dashboard.transport-policy-error', message: 'The host transport rejected target verification.', requestId, stage: 'health', transportPolicyCode: result.code });
  if (result.response.status !== 200) return failure({
    code: result.response.status === 401 ? 'dashboard.unauthorized' : result.response.status === 403 ? 'dashboard.forbidden' : 'dashboard.http-error',
    message: 'Grafana rejected target verification.', requestId, stage: 'health', status: result.response.status,
  });
  let body: unknown;
  try {
    if (typeof result.response.body !== 'string' || result.response.body.length > 1_048_576) throw new Error();
    body = JSON.parse(result.response.body);
  } catch {
    body = undefined;
  }
  const cloned = cloneBoundedJson(body);
  const object = cloned.ok && typeof cloned.value === 'object' && cloned.value !== null && !Array.isArray(cloned.value)
    ? cloned.value as Grafana13JsonObject : undefined;
  const version = object?.version;
  if (typeof version !== 'string' || version.length > 128 || !isExactVersion(version)) return failure({
    code: 'dashboard.response-malformed', message: 'Grafana returned a malformed target verification response.', requestId, stage: 'health',
  });
  if (version !== '13.2.3') return Object.freeze({
    diagnostics: Object.freeze([Object.freeze({ code: 'dashboard.feature-unsupported', message: 'The reported Grafana version is unsupported.', path: '$.health.version' })]),
    diagnosticsTruncated: false, kind: 'unsupported-dashboard', reason: 'target-version',
  });
  return Object.freeze({ kind: 'success' });
}
