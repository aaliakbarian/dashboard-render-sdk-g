import { createElement } from 'react';

import { createGrafana13TextPanelCatalog } from '../panels/catalog';
import type { Grafana13RuntimeImplementation } from '../react/Grafana13DashboardRenderer';
import { convertPartialDashboardToGrafana13Scene } from '../scenes/sceneConversion';
import {
  createGrafana13RuntimeCoordinator,
  type Grafana13RuntimeAcquireRequest,
  type Grafana13RuntimeLease,
} from './coordinator';
import { createGrafana13RuntimeInitializer } from './initializeRuntime';
import { createGrafana13ProviderElement, type Grafana13ProviderValues } from './providers';

type MountInput = Parameters<Grafana13RuntimeImplementation['mountDashboard']>[0];

interface RuntimeMounterDependencies {
  readonly loadQueryScenes?: () => Promise<Partial<Parameters<typeof convertPartialDashboardToGrafana13Scene>[1]>>;
  readonly acquire: (request: Grafana13RuntimeAcquireRequest) => Promise<Grafana13RuntimeLease>;
  readonly convert: typeof convertPartialDashboardToGrafana13Scene;
  readonly createProviderElement: typeof createGrafana13ProviderElement;
}

export class Grafana13TextPanelPreparationError extends Error {
  override readonly name = 'Grafana13TextPanelPreparationError';
  readonly code = 'panel-render-failed' as const;

  constructor() {
    super('The Grafana 13 Text panel could not be prepared.');
  }
}

function releaseOnce(actions: readonly (() => void)[]) {
  let active = true;
  return () => {
    if (!active) return;
    active = false;
    for (const action of actions) {
      try { action(); } catch { /* cleanup is best-effort and never leaks internals */ }
    }
  };
}

export function createGrafana13RuntimeDashboardMounter(
  dependencies: RuntimeMounterDependencies
): Grafana13RuntimeImplementation['mountDashboard'] {
  return async ({
    dashboard,
    hostReact,
    instanceId,
    manifest,
    namespace,
    onPanelRenderFailure,
    transport,
  }: MountInput) => {
    const lease = await dependencies.acquire({
      hostReact,
      namespace,
      providerBuildId: manifest.manifest.provider.buildId,
      providerId: manifest.manifest.provider.id,
      providerManifest: manifest.manifest,
      transport,
    });
    let scope: ReturnType<typeof lease.acquireSceneScope> | undefined;
    let deactivate: (() => void) | undefined;
    try {
      const cohort = lease.cohort as {
        readonly runtime: {
          getPluginImportUtils(): {
            getPanelPluginFromCache(id: string): unknown;
            importPanelPlugin(id: string): Promise<unknown>;
          };
        };
        readonly scenes: Parameters<typeof convertPartialDashboardToGrafana13Scene>[1];
      };
      const catalog = cohort.runtime.getPluginImportUtils();
      const ids = [...new Set(dashboard.panels.filter(panel => panel.kind === 'supported').map(panel => panel.panelType))];
      let sceneConstructors = cohort.scenes;
      let nativeCss: string | undefined;
      if (ids.some(id => id !== 'text')) {
        if (!lease.acquireQueryRuntime) throw new Grafana13TextPanelPreparationError();
        await lease.acquireQueryRuntime();
        const queryScenes = await (dependencies.loadQueryScenes ?? (() => import('grafana-provider13-query-scenes')))();
        sceneConstructors = { ...cohort.scenes, ...queryScenes };
        const styles = await import('./nativeStyles');
        nativeCss = `${styles.nativeVisualizationCss}${ids.includes('table') ? `\n${styles.nativeTableCss}` : ''}`;
      }
      const failedPluginIds: string[] = [];
      for (const id of ids) {
        try {
          await catalog.importPanelPlugin(id);
          if (!catalog.getPanelPluginFromCache(id)) throw new Error();
        } catch {
          if (id === 'text') throw new Grafana13TextPanelPreparationError();
          failedPluginIds.push(id);
        }
      }
      scope = lease.acquireSceneScope(instanceId);
      const graph = dependencies.convert(dashboard, sceneConstructors, { failedPluginIds, onPanelRenderFailure });
      deactivate = graph.scene.activate();
      const Scene = graph.scene.Component;
      const sceneElement = createElement(
        'div',
        {
          'data-dashboard-render-sdk-g-surface': '',
          'data-dashboard-render-instance': instanceId,
          'data-dashboard-render-status': 'ready',
          'data-dashboard-render-uid': dashboard.uid,
        },
        nativeCss ? createElement('style', { 'data-dashboard-native-styles': instanceId }, nativeCss) : null,
        createElement(Scene, { model: graph.scene })
      );
      const element = dependencies.createProviderElement(
        lease.providerValues as Grafana13ProviderValues,
        sceneElement
      );
      return Object.freeze({
        element,
        release: releaseOnce([
          () => deactivate?.(),
          () => scope?.release(),
          () => lease.release(),
        ]),
      });
    } catch (error) {
      releaseOnce([
        () => deactivate?.(),
        () => scope?.release(),
        () => lease.release(),
      ])();
      throw error;
    }
  };
}

let defaultMount: Grafana13RuntimeImplementation['mountDashboard'] | undefined;

function defaultRuntimeMount(input: MountInput) {
  if (!defaultMount) {
    const panelCatalog = createGrafana13TextPanelCatalog({});
    const coordinator = createGrafana13RuntimeCoordinator({
      document: document as never,
      initialize: createGrafana13RuntimeInitializer({ panelCatalog, window: window as never }),
    });
    defaultMount = createGrafana13RuntimeDashboardMounter({
      acquire: coordinator.acquire,
      convert: convertPartialDashboardToGrafana13Scene,
      createProviderElement: createGrafana13ProviderElement,
    });
  }
  return defaultMount(input);
}

export const mountDashboard = defaultRuntimeMount;
