import type { Grafana13PartialPreflightResult } from '../partialContracts';
import type { Grafana13ScenesModule } from '../runtime/cohort';
import { Grafana13FallbackPanel } from './FallbackPanel';
import { Grafana13TextPanelScene } from './TextPanelScene';
import { createElement } from 'react';

type RenderableDashboard = Grafana13PartialPreflightResult & { readonly kind: 'renderable' };

export interface Grafana13DashboardSceneGraph {
  readonly panelIds: readonly number[];
  readonly scene: any;
}

function createRoot(scenes: Grafana13ScenesModule, state: Record<string, unknown>): any {
  class Grafana13DashboardScene extends scenes.SceneObjectBase {
    static Component = ({ model }: { readonly model: any }) => {
      const body = model.state.body;
      return createElement(body.Component ?? body.constructor.Component, { model: body });
    };
  }
  return new Grafana13DashboardScene(state);
}

function createTextPanelBody(
  scenes: Grafana13ScenesModule,
  state: Record<string, unknown>
): any {
  // Keep VizPanel as a direct SceneObject state child. Scenes deliberately does
  // not traverse arbitrary nested props objects, and a detached VizPanel cannot
  // inherit the dashboard variable/time-range context used by the real plugin.
  class Grafana13TextPanelBody extends scenes.SceneObjectBase {
    static Component = Grafana13TextPanelScene;
  }
  return new Grafana13TextPanelBody(state);
}

export function convertPartialDashboardToGrafana13Scene(
  dashboard: RenderableDashboard,
  scenes: Grafana13ScenesModule,
  options: { readonly onPanelRenderFailure?: (panelId: number) => void } = {}
): Grafana13DashboardSceneGraph {
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
    const body = panel.kind === 'supported'
      ? (() => {
          const vizPanel = new scenes.VizPanel({
          fieldConfig: structuredClone(panel.model.fieldConfig),
          key: `panel-${panel.id}`,
          options: structuredClone(panel.model.options),
          pluginId: 'text',
          pluginVersion: panel.model.pluginVersion,
          title: panel.title,
          });
          return createTextPanelBody(scenes, {
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
    }),
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
        return { ...common, executable: true, kind: 'text', pluginId: supportedPanel.state.pluginId };
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
