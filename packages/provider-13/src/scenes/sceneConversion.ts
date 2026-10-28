import type { Grafana13PartialPreflightResult } from '../partialContracts';
import type { Grafana13ScenesModule } from '../runtime/cohort';
import { Grafana13FallbackPanel } from './FallbackPanel';
import { Grafana13NativePanelScene, Grafana13PanelPreparationFailure } from './NativePanelScene';
import { createElement } from 'react';

type RenderableDashboard = Grafana13PartialPreflightResult & { readonly kind: 'renderable' };

export interface Grafana13DashboardSceneGraph {
  readonly panelIds: readonly number[];
  readonly scene: any;
}

type QueryIdentity = { readonly dashboardUID: string; readonly panelId: number };
let nextSceneGeneration = 0;

function createRoot(scenes: Grafana13ScenesModule, state: Record<string, unknown>, queryIdentities: WeakMap<object, QueryIdentity>): any {
  class Grafana13DashboardScene extends scenes.SceneObjectBase {
    enrichDataRequest(source: object) {
      return queryIdentities.get(source) ?? null;
    }
    static Component = ({ model }: { readonly model: any }) => {
      const body = model.state.body;
      return createElement(body.Component ?? body.constructor.Component, { model: body });
    };
  }
  return new Grafana13DashboardScene(state);
}

function createNativePanelBody(
  scenes: Grafana13ScenesModule,
  state: Record<string, unknown>
): any {
  // Keep VizPanel as a direct SceneObject state child. Scenes deliberately does
  // not traverse arbitrary nested props objects, and a detached VizPanel cannot
  // inherit the dashboard variable/time-range context used by the real plugin.
  class Grafana13NativePanelBody extends scenes.SceneObjectBase {
    static Component = Grafana13NativePanelScene;
  }
  return new Grafana13NativePanelBody(state);
}

export function convertPartialDashboardToGrafana13Scene(
  dashboard: RenderableDashboard,
  scenes: Grafana13ScenesModule,
  options: { readonly onPanelRenderFailure?: (panelId: number) => void; readonly failedPluginIds?: readonly string[] } = {}
): Grafana13DashboardSceneGraph {
  // One fresh prefix per scene generation, never derived from caller text or
  // React IDs. The pinned runner appends its own monotonic request counter.
  const generation = ++nextSceneGeneration;
  const queryIdentities = new WeakMap<object, QueryIdentity>();
  const variables = dashboard.constantVariables.map((variable) =>
    new scenes.ConstantVariable({
      hide: 2,
      label: variable.label,
      name: variable.name,
      skipUrlSync: true,
      type: 'constant',
      value: variable.value,
    })
  );
  const children = dashboard.panels.map((panel) => {
    const body = panel.kind === 'supported' && options.failedPluginIds?.includes(panel.panelType)
      ? new scenes.SceneReactObject({ component: Grafana13PanelPreparationFailure, props: {
          id: panel.id, title: panel.title, onFailure: options.onPanelRenderFailure ?? (() => {}),
        } })
      : panel.kind === 'supported'
      ? (() => {
          const vizPanel = new scenes.VizPanel({
          ...(panel.model.type === 'text' ? {} : (() => {
            if (!scenes.SceneQueryRunner) throw new Error('Query scene constructors are unavailable.');
            const runner = new scenes.SceneQueryRunner({
              datasource: structuredClone(panel.model.query.datasource),
              queries: structuredClone(panel.model.query.targets),
              maxDataPoints: 300,
              requestIdPrefix: `sdk13-g${generation}-p${panel.id}`,
            });
            queryIdentities.set(runner, Object.freeze({ dashboardUID: dashboard.uid, panelId: panel.id }));
            if (panel.model.type === 'timeseries' && panel.model.transformations.length) {
              if (!scenes.SceneDataTransformer) throw new Error('Transform scene constructor is unavailable.');
              return { $data: new scenes.SceneDataTransformer({ $data: runner, transformations: structuredClone(panel.model.transformations) }) };
            }
            return { $data: runner };
          })()),
          fieldConfig: structuredClone(panel.model.fieldConfig),
          key: `panel-${panel.id}`,
          options: structuredClone(panel.model.options),
          pluginId: panel.model.type,
          pluginVersion: panel.model.pluginVersion,
          title: panel.title,
          });
          return createNativePanelBody(scenes, {
            onFailure: options.onPanelRenderFailure ?? (() => {}),
            panel: vizPanel,
            panelId: panel.id,
            uid: dashboard.uid,
          });
        })()
      : new scenes.SceneReactObject({
          component: Grafana13FallbackPanel,
          props: Object.freeze({ id: panel.id, panelType: panel.panelType, title: panel.title }),
        });
    return new scenes.SceneGridItem({
      body,
      height: panel.grid.height,
      isDraggable: false,
      isResizable: false,
      key: `grid-item-${panel.id}`,
      width: panel.grid.width,
      x: panel.grid.x,
      y: panel.grid.y,
    });
  });
  const body = new scenes.SceneGridLayout({
    children,
    isDraggable: false,
    isLazy: false,
    isResizable: false,
  });
  const timeRange = new scenes.SceneTimeRange({
    from: dashboard.timeRange.from,
    timeZone: dashboard.timezone,
    to: dashboard.timeRange.to,
  });
  const variableSet = new scenes.SceneVariableSet({ variables });
  return Object.freeze({
    panelIds: Object.freeze(dashboard.panels.map(({ id }) => id)),
    scene: createRoot(scenes, {
      $timeRange: timeRange,
      $variables: variableSet,
      body,
      title: dashboard.title,
      uid: dashboard.uid,
    }, queryIdentities),
  });
}

export function inspectGrafana13Scene(
  graph: Grafana13DashboardSceneGraph,
  scenes: Grafana13ScenesModule
) {
  return {
    panels: graph.scene.state.body.state.children.map((item: any, index: number) => {
      const body = item.state.body;
      const supportedPanel = body.state.panel;
      const common = {
        grid: {
          height: item.state.height,
          width: item.state.width,
          x: item.state.x,
          y: item.state.y,
        },
        id: graph.panelIds[index],
        title: supportedPanel?.state.title ?? body.state.title ?? body.state.props.title,
      };
      if (supportedPanel instanceof scenes.VizPanel) {
        return { ...common, executable: true, kind: supportedPanel.state.pluginId, pluginId: supportedPanel.state.pluginId };
      }
      return {
        ...common,
        executable: false,
        kind: 'fallback',
        panelType: body.state.props.panelType,
      };
    }),
    timeRange: {
      from: graph.scene.state.$timeRange.state.from,
      timeZone: graph.scene.state.$timeRange.state.timeZone,
      to: graph.scene.state.$timeRange.state.to,
    },
    title: graph.scene.state.title,
    uid: graph.scene.state.uid,
    variables: graph.scene.state.$variables.state.variables.map((variable: any) => ({
      label: variable.state.label,
      name: variable.state.name,
      value: variable.state.value,
    })),
  };
}
