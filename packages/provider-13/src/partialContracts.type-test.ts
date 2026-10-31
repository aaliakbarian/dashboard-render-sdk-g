import type { HostTransportCapability, ManifestValidationSuccess } from '@dashboard-render-sdk-g/provider-contract';

import {
  retrieveAndClassifyGrafana13DashboardV1,
  type Grafana13DashboardStage,
  type Grafana13PartialDashboardLoadInput,
  type Grafana13PartialDashboardLoadResult,
  type Grafana13RenderablePanel,
} from './index';

declare const transport: HostTransportCapability;
declare const manifest: ManifestValidationSuccess;
declare const signal: AbortSignal;
type ActivePanelType = Extract<Grafana13RenderablePanel, { kind: 'supported' }>['panelType'];
const gaugePanelType: ActivePanelType = 'gauge';
const barGaugePanelType: ActivePanelType = 'bargauge';
const pieChartPanelType: ActivePanelType = 'piechart';
// @ts-expect-error blocked Table remains outside executable models
const tablePanelType: ActivePanelType = 'table';
void gaugePanelType; void barGaugePanelType; void pieChartPanelType; void tablePanelType;

const input: Grafana13PartialDashboardLoadInput = {
  manifest, namespace: 'default', requestIds: { dashboard: 'dashboard', discovery: 'discovery', health: 'health' },
  signal, transport, uid: 'grsdk-phase0-poc',
};
const result: Promise<Grafana13PartialDashboardLoadResult> = retrieveAndClassifyGrafana13DashboardV1(input);

// @ts-expect-error the partial facade requires a distinct health request ID
const missingHealth: Grafana13PartialDashboardLoadInput = { ...input, requestIds: { dashboard: 'dashboard', discovery: 'discovery' } };
// @ts-expect-error request IDs remain immutable
input.requestIds.health = 'changed';

function inspect(panel: Grafana13RenderablePanel) {
  // @ts-expect-error layout remains immutable
  panel.grid.width = 1;
  if (panel.kind === 'unsupported') {
    // @ts-expect-error unsupported panels contain no executable model
    return panel.model;
  }
  return panel.model.type === 'text' ? panel.model.options.content : panel.model.query;
}

// @ts-expect-error partial health stages do not widen the strict public contract
const strictHealth: Grafana13DashboardStage = 'health';

void result;
void missingHealth;
void inspect;
void strictHealth;
