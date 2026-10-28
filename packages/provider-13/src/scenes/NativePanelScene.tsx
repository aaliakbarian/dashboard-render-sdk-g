import { createElement, useEffect, type ComponentType, type ReactElement } from 'react';

import { Grafana13PanelRenderBoundary } from '../react/Grafana13DashboardRenderer';

export interface Grafana13NativePanelSceneProps {
  readonly onFailure: (panelId: number) => void;
  readonly panel: {
    readonly Component: ComponentType<{ readonly model: unknown }>;
  };
  readonly panelId: number;
  readonly uid: string;
}

export interface Grafana13NativePanelSceneModel {
  readonly state: Grafana13NativePanelSceneProps;
}

export function Grafana13NativePanelScene({
  model,
}: { readonly model: Grafana13NativePanelSceneModel }): ReactElement {
  const { onFailure, panel, panelId, uid } = model.state;
  return createElement(
    Grafana13PanelRenderBoundary,
    { onFailure, panelId, uid },
    createElement(panel.Component, { model: panel })
  );
}

export function Grafana13PanelPreparationFailure({ id, title, onFailure }: {
  readonly id: number; readonly title: string; readonly onFailure: (panelId: number) => void;
}) {
  useEffect(() => onFailure(id), [id, onFailure]);
  return createElement('section', { 'aria-label': title, 'data-dashboard-panel-error': id, className: 'dashboard-render-sdk-g-panel-error' }, 'Panel unavailable.');
}
