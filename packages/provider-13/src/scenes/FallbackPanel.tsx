export interface Grafana13FallbackPanelProps {
  readonly id: number;
  readonly panelType: string;
  readonly title: string;
}

export function Grafana13FallbackPanel({ id, panelType, title }: Grafana13FallbackPanelProps) {
  return createElement(
    'section',
    {
      'aria-label': `${title || panelType} is not supported`,
      'data-dashboard-panel-id': id,
      'data-dashboard-panel-kind': 'not-supported',
      'data-dashboard-panel-type': panelType,
      className: 'dashboard-render-sdk-g-not-supported',
    },
    createElement('strong', null, title || panelType),
    createElement('span', null, 'Not-Supported')
  );
}
import { createElement } from 'react';
