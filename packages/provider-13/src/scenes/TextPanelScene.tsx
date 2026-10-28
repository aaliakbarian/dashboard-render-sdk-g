import { createElement, type ComponentType, type ReactElement } from 'react';

import { Grafana13PanelRenderBoundary } from '../react/Grafana13DashboardRenderer';

export interface Grafana13TextPanelSceneProps {
  readonly onFailure: (panelId: number) => void;
  readonly panel: {
    readonly Component: ComponentType<{ readonly model: unknown }>;
  };
  readonly panelId: number;
  readonly uid: string;
}

export interface Grafana13TextPanelSceneModel {
  readonly state: Grafana13TextPanelSceneProps;
}

export function Grafana13TextPanelScene({
  model,
}: { readonly model: Grafana13TextPanelSceneModel }): ReactElement {
  const { onFailure, panel, panelId, uid } = model.state;
  return createElement(
    Grafana13PanelRenderBoundary,
    { onFailure, panelId, uid },
    createElement(panel.Component, { model: panel })
  );
}
