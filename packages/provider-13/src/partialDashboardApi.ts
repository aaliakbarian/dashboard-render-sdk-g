import {
  discoverStableGrafana13DashboardV1,
  retrieveGrafana13DashboardV1Dto,
  validRequestId,
  validateDashboardLoadInput,
  type DashboardStageResult,
} from './dashboardApi';
import { verifyGrafana13Target } from './health';
import type { Grafana13PartialDashboardLoadInput, Grafana13PartialDashboardLoadResult } from './partialContracts';
import { partialPreflightGrafana13DashboardV1 } from './partialPreflight';

type NonRenderableResult = Exclude<Grafana13PartialDashboardLoadResult, { readonly kind: 'renderable' }>;
type Cancelled = Extract<NonRenderableResult, { readonly kind: 'cancelled' }>;
type Failure = Extract<NonRenderableResult, { readonly kind: 'failure' }>;

function cancelled(stage: Cancelled['stage'], requestId: string): Cancelled {
  return Object.freeze({ kind: 'cancelled', requestId, stage });
}

/** Owns just this stage's listener and consumes work even if host transport ignores abort. */
function runStage<T>(
  input: Grafana13PartialDashboardLoadInput,
  stage: Cancelled['stage'],
  requestId: string,
  run: () => Promise<T>
): Promise<T | Cancelled | Failure> {
  if (input.signal.aborted) return Promise.resolve(cancelled(stage, requestId));
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: T | Cancelled | Failure) => {
      if (settled) return;
      settled = true;
      input.signal.removeEventListener('abort', onAbort);
      resolve(input.signal.aborted ? cancelled(stage, requestId) : result);
    };
    const onAbort = () => finish(cancelled(stage, requestId));
    const failed = () => finish(Object.freeze({
      error: Object.freeze({ code: 'dashboard.network-error', message: 'The host transport could not complete the dashboard request.', requestId, stage }), kind: 'failure',
    }));
    input.signal.addEventListener('abort', onAbort, { once: true });
    if (input.signal.aborted) { onAbort(); return; }
    try { void run().then(finish, failed); } catch { failed(); }
  });
}

function mapStageResult(result: Exclude<DashboardStageResult<unknown>, { readonly kind: 'success' }> | NonRenderableResult): NonRenderableResult {
  if (result.kind !== 'unsupported') return result;
  return Object.freeze({
    diagnostics: result.diagnostics, diagnosticsTruncated: result.diagnosticsTruncated,
    kind: 'unsupported-dashboard', reason: result.diagnostics.some(({ code }) => code === 'dashboard.schema-unsupported') ? 'dashboard-schema' : 'dashboard-profile',
  });
}

export async function retrieveAndClassifyGrafana13DashboardV1(
  input: Grafana13PartialDashboardLoadInput
): Promise<Grafana13PartialDashboardLoadResult> {
  const validated = validateDashboardLoadInput(input);
  if (validated.kind === 'failure') return validated;
  let health: unknown;
  let requestIds: { readonly dashboard: string; readonly discovery: string } | undefined;
  try {
    health = input.requestIds.health;
    requestIds = validated.kind === 'success' ? validated.value.requestIds : {
      dashboard: input.requestIds.dashboard, discovery: input.requestIds.discovery,
    };
  } catch { health = undefined; }
  if (!validRequestId(health) || health === requestIds?.dashboard || health === requestIds?.discovery) return Object.freeze({
    error: Object.freeze({ code: 'dashboard.input-invalid', message: 'Dashboard load input is invalid.', path: '$.input', stage: 'input' }), kind: 'failure',
  });
  if (validated.kind === 'cancelled') return cancelled('health', health);
  if (validated.kind !== 'success') return mapStageResult(validated);
  const snapshot: Grafana13PartialDashboardLoadInput = Object.freeze({
    ...validated.value, requestIds: Object.freeze({ ...validated.value.requestIds, health }),
  });
  const target = await runStage(snapshot, 'health', health, () => verifyGrafana13Target(snapshot));
  if (target.kind !== 'success') return target;
  const discovery = await runStage(snapshot, 'discovery', snapshot.requestIds.discovery, () => discoverStableGrafana13DashboardV1(snapshot));
  if (discovery.kind !== 'success') return mapStageResult(discovery);
  const dashboard = await runStage(snapshot, 'dashboard-v1', snapshot.requestIds.dashboard, () => retrieveGrafana13DashboardV1Dto(snapshot, discovery.value));
  if (dashboard.kind !== 'success') return mapStageResult(dashboard);
  const partial = partialPreflightGrafana13DashboardV1(dashboard.value, snapshot.manifest);
  if (snapshot.signal.aborted) return cancelled('dashboard-v1', snapshot.requestIds.dashboard);
  if (partial.kind !== 'renderable') return partial;
  return Object.freeze({ dashboard: partial, kind: 'renderable', requestIds: snapshot.requestIds });
}
