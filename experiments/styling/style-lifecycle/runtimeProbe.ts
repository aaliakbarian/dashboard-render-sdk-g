// POC / EXPERIMENT / NOT FOR PRODUCTION
import {
  acquirePocRuntime,
  inspectPocRuntime,
} from '@grafana-react-sdk/poc-compat';

import {
  inspectStrictCspProvider,
  strictCspProviderCommand,
} from '../../security/strict-csp/providerRuntime.tsx';

declare global {
  // eslint-disable-next-line no-var
  var __STYLE_LIFECYCLE_SCENE_REFS__: Array<WeakRef<{
    readonly isActive: boolean;
    readonly state: {
      readonly $timeRange: { updateFromUrl(value: { from: string; to: string }): void };
      readonly body: { readonly state: { readonly children: unknown[] } };
      readonly legacyPanelIds: readonly number[];
    };
  }>> | undefined;
}

function activeScenes() {
  const active = (globalThis.__STYLE_LIFECYCLE_SCENE_REFS__ ?? [])
    .map((reference) => reference.deref())
    .filter((scene): scene is NonNullable<typeof scene> => scene?.isActive === true);
  globalThis.__STYLE_LIFECYCLE_SCENE_REFS__ = active.map((scene) => new WeakRef(scene));
  return active;
}

function queryRunner(scene: ReturnType<typeof activeScenes>[number], panelId: number) {
  const index = scene.state.legacyPanelIds.indexOf(panelId);
  const panel = scene.state.body.state.children[index] as
    | { state?: { body?: { state?: { $data?: unknown } } } }
    | undefined;
  const data = panel?.state?.body?.state?.$data as
    | { state?: { $data?: unknown }; runQueries?: () => void }
    | undefined;
  return panelId === 3
    ? (data?.state?.$data as { runQueries?: () => void } | undefined)
    : data;
}

export function styleLifecycleProviderCommand(
  command: 'closeAll' | 'mountPrimary' | 'refresh' | 'resize' | 'switchUidWithOpenModal' | 'timeRange' | 'togglePrimary' | 'toggleSecondary'
) {
  if (command === 'refresh') {
    for (const scene of activeScenes()) {
      queryRunner(scene, 2)?.runQueries?.();
      queryRunner(scene, 3)?.runQueries?.();
    }
    return;
  }
  if (command === 'timeRange') {
    for (const scene of activeScenes()) scene.state.$timeRange.updateFromUrl({ from: 'now-15m', to: 'now' });
    return;
  }
  strictCspProviderCommand(command);
}

export function inspectStyleLifecycleProvider() {
  return {
    initEvents: [...(globalThis.__STYLE_LIFECYCLE_INIT_EVENTS__ ?? [])],
    provider: inspectStrictCspProvider(),
    runtime: inspectPocRuntime(),
  };
}

export async function probeIncompatibleRuntimeIdentity() {
  const before = inspectPocRuntime();
  let category = 'unexpected-success';
  try {
    const lease = await acquirePocRuntime({
      assetBasePath: '/incompatible-assets/',
      grafanaBasePath: '/incompatible-grafana',
      locale: 'en-US',
      namespace: 'default',
      panelCatalog: { identity: 'style-lifecycle-incompatible', panelIds: [] },
      request: window.fetch.bind(window),
      theme: 'light',
      timezone: 'browser',
    });
    lease.release();
  } catch (error: unknown) {
    category = error && typeof error === 'object' && 'code' in error && typeof error.code === 'string'
      ? error.code
      : error instanceof Error ? error.name : 'unknown';
  }
  const after = inspectPocRuntime();
  return {
    category,
    noEffects: {
      activeDashboardScopes: after.activeDashboardScopes === before.activeDashboardScopes,
      activeLeases: after.activeLeases === before.activeLeases,
      fingerprint: after.fingerprint === before.fingerprint,
      initializationSteps: after.initializationSteps.length === before.initializationSteps.length,
      moduleIdentities: JSON.stringify(after.moduleIdentities) === JSON.stringify(before.moduleIdentities),
    },
  };
}
