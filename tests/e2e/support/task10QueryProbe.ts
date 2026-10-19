import type { PanelData } from '@grafana/data';
import type { SceneGridItem, SceneQueryRunner, VizPanel } from '@grafana/scenes';

import {
  TESTDATA_MODULE_IDENTITY,
  loadExactTestDataDataSourceClass,
} from '@dashboard-render-sdk-g/poc-grafana-bridge';

import {
  acquirePocRuntime,
  createPocQueryEvidenceRecorder,
  inspectPocRuntime,
  loadPocSceneConversion,
} from '../../../packages/poc-compat/src/index';

const STAT_ONLY_CATALOG = { identity: 'task10-stat-query-only', panelIds: ['stat'] } as const;

function getStatRunner(root: {
  state: { body: { state: { children: readonly unknown[] } }; legacyPanelIds: readonly number[] };
}): SceneQueryRunner {
  const index = root.state.legacyPanelIds.indexOf(2);
  const gridItem = root.state.body.state.children[index] as SceneGridItem | undefined;
  const panel = gridItem?.state.body as VizPanel | undefined;
  const runner = panel?.state.$data;
  if (!runner || !('runQueries' in runner)) {
    throw new Error('Task 10 expected fixture panel 2 to own a SceneQueryRunner.');
  }
  return runner as SceneQueryRunner;
}

function waitForPanelData(
  runner: SceneQueryRunner,
  predicate: (data: PanelData) => boolean,
  timeoutMs = 10_000
): Promise<PanelData> {
  const current = runner.state.data;
  if (current && predicate(current)) return Promise.resolve(current);

  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      subscription.unsubscribe();
      reject(new Error('Timed out waiting for SceneQueryRunner data.'));
    }, timeoutMs);
    const subscription = runner.subscribeToState((state) => {
      if (state.data && String(state.data.state) === 'Error') {
        window.clearTimeout(timeout);
        subscription.unsubscribe();
        reject(new Error('SceneQueryRunner entered Error.'));
        return;
      }
      if (!state.data || !predicate(state.data)) return;
      window.clearTimeout(timeout);
      subscription.unsubscribe();
      resolve(state.data);
    });
  });
}

async function waitForCancellation(
  transportSnapshot: () => ReadonlyArray<{ endpoint: string; outcome: string }>,
  querySnapshot: () => readonly unknown[]
): Promise<void> {
  const startedAt = performance.now();
  while (performance.now() - startedAt < 5_000) {
    if (
      transportSnapshot().some(
        (event) => event.endpoint === 'datasource-query' && event.outcome === 'cancelled'
      )
    ) {
      return;
    }
    await new Promise((resolve) => window.setTimeout(resolve, 25));
  }
  throw new Error(
    `Timed out waiting for the datasource query cancellation evidence: ${JSON.stringify({
      query: querySnapshot(),
      transport: transportSnapshot(),
    })}`
  );
}

function summarize(data: PanelData) {
  const fields = data.series.reduce((count, frame) => count + frame.fields.length, 0);
  const points = data.series.reduce(
    (count, frame) => count + (frame.fields[0]?.values.length ?? 0),
    0
  );
  return {
    dashboardUid: data.request?.dashboardUID,
    fields,
    panelId: data.request?.panelId,
    points,
    requestId: data.request?.requestId,
    series: data.series.length,
    state: String(data.state),
    timezone: data.request?.timezone,
  };
}

export async function runTask10QueryProbe() {
  const request = window.fetch.bind(window);
  const lease = await acquirePocRuntime({
    assetBasePath: '/grafana/public/',
    grafanaBasePath: '/grafana',
    locale: 'en-US',
    namespace: 'default',
    panelCatalog: { identity: 'task10-no-panel-loader', panelIds: [] },
    request,
    theme: 'light',
    timezone: 'browser',
  });
  const queryEvidence = createPocQueryEvidenceRecorder();
  const queryRuntime = await lease.acquireQueryRuntime({
    evidence: queryEvidence,
    loadDataSourceClass: loadExactTestDataDataSourceClass,
    moduleIdentity: TESTDATA_MODULE_IDENTITY,
  });
  const repeatedQueryRuntime = await lease.acquireQueryRuntime({
    evidence: queryEvidence,
    loadDataSourceClass: loadExactTestDataDataSourceClass,
    moduleIdentity: TESTDATA_MODULE_IDENTITY,
  });
  const conversion = await loadPocSceneConversion();
  const dashboard = await lease.dashboardClient.loadByUid('grsdk-phase0-poc');

  const convert = () =>
    conversion.convertFixtureV1ToScene({
      catalog: STAT_ONLY_CATALOG,
      input: dashboard,
      runtime: lease,
    });

  const successRoot = convert();
  const successRunner = getStatRunner(successRoot);
  const successTransitions: string[] = [];
  const successSubscription = successRunner.subscribeToState((state) => {
    if (state.data) successTransitions.push(String(state.data.state));
  });
  const deactivateSuccessRoot = successRoot.activate();
  const deactivateSuccessRunner = successRunner.activate();

  let deactivateCancellationRoot: (() => void) | undefined;
  let deactivateCancellationRunner: (() => void) | undefined;
  let deactivateGenerationRoot: (() => void) | undefined;
  let deactivateGenerationRunner: (() => void) | undefined;
  try {
    let firstDone: PanelData;
    try {
      firstDone = await waitForPanelData(
        successRunner,
        (data) => String(data.state) === 'Done'
      );
    } catch (error: unknown) {
      throw new Error(
        `Task 10 first query did not reach Done: ${JSON.stringify({
          currentState: successRunner.state.data ? String(successRunner.state.data.state) : 'unset',
          errors: successRunner.state.data?.errors?.map((entry) => ({
            message: entry.message,
            status: entry.status,
          })),
          error: successRunner.state.data?.error
            ? {
                message: successRunner.state.data.error.message,
                status: successRunner.state.data.error.status,
              }
            : undefined,
          queryEvidence: queryEvidence.snapshot(),
          transport: lease.transportEvidence.snapshot(),
        })}`,
        { cause: error }
      );
    }
    const firstRequestId = firstDone.request?.requestId;
    const refreshed = waitForPanelData(
      successRunner,
      (data) =>
        String(data.state) === 'Done' &&
        data.request?.requestId !== firstRequestId
    );
    successRunner.runQueries();
    const refreshDone = await refreshed;
    deactivateSuccessRunner();
    deactivateSuccessRoot();
    successSubscription.unsubscribe();

    const cancellationRoot = convert();
    const cancellationRunner = getStatRunner(cancellationRoot);
    cancellationRunner.setState({
      queries: cancellationRunner.state.queries.map((query) => ({
        ...query,
        scenarioId: 'slow_query',
        stringInput: '5s',
      })),
    });
    const cancellationTransitions: string[] = [];
    const cancellationSubscription = cancellationRunner.subscribeToState((state) => {
      if (state.data) cancellationTransitions.push(String(state.data.state));
    });
    deactivateCancellationRoot = cancellationRoot.activate();
    deactivateCancellationRunner = cancellationRunner.activate();
    await waitForPanelData(cancellationRunner, (data) => String(data.state) === 'Loading');
    // DataSourceWithBackend builds the backend request asynchronously after
    // runRequest publishes Loading. Give that real fetch a bounded head start
    // so this proves AbortSignal propagation, not merely pre-fetch teardown.
    await new Promise((resolve) => window.setTimeout(resolve, 100));
    if (String(cancellationRunner.state.data?.state) !== 'Loading') {
      throw new Error('The controlled slow query completed before cancellation could be exercised.');
    }
    deactivateCancellationRunner();
    deactivateCancellationRunner = undefined;
    deactivateCancellationRoot();
    deactivateCancellationRoot = undefined;
    cancellationSubscription.unsubscribe();
    await waitForCancellation(
      () => lease.transportEvidence.snapshot(),
      () => queryEvidence.snapshot()
    );

    const generationRoot = convert();
    const generationRunner = getStatRunner(generationRoot);
    deactivateGenerationRoot = generationRoot.activate();
    deactivateGenerationRunner = generationRunner.activate();
    const generationDone = await waitForPanelData(
      generationRunner,
      (data) => String(data.state) === 'Done'
    );
    deactivateGenerationRunner();
    deactivateGenerationRunner = undefined;
    deactivateGenerationRoot();
    deactivateGenerationRoot = undefined;

    const result = {
      cancellation: {
        staleDonePublished: cancellationTransitions.includes('Done'),
        transitions: cancellationTransitions,
      },
      datasource: {
        name: queryRuntime.settings.name,
        type: queryRuntime.settings.type,
        uid: queryRuntime.settings.uid,
      },
      generation: summarize(generationDone),
      iframeCount: document.querySelectorAll('iframe').length,
      moduleIdentity: TESTDATA_MODULE_IDENTITY,
      queryEvidence: queryEvidence.snapshot(),
      refresh: summarize(refreshDone),
      repeatedRuntimeIdentity: repeatedQueryRuntime === queryRuntime,
      runtimeDuring: inspectPocRuntime(),
      success: summarize(firstDone),
      successTransitions,
      transport: lease.transportEvidence.snapshot(),
    };
    lease.release();
    return { ...result, runtimeAfter: inspectPocRuntime() };
  } finally {
    deactivateCancellationRunner?.();
    deactivateCancellationRoot?.();
    deactivateGenerationRunner?.();
    deactivateGenerationRoot?.();
    if (successRunner.isActive) deactivateSuccessRunner();
    if (successRoot.isActive) deactivateSuccessRoot();
    successSubscription.unsubscribe();
    lease.release();
  }
}
