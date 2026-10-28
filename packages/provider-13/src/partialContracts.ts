import type { Grafana13DashboardLoadInput, Grafana13DashboardFailure, Grafana13PreflightDiagnostic } from './contracts';

export interface Grafana13RenderRequestIds {
  readonly health: string;
  readonly discovery: string;
  readonly dashboard: string;
}

export interface Grafana13PartialDashboardLoadInput extends Omit<Grafana13DashboardLoadInput, 'requestIds'> {
  readonly requestIds: Grafana13RenderRequestIds;
}

export interface Grafana13PartialDashboardFailure extends Omit<Grafana13DashboardFailure, 'stage'> {
  readonly stage: Grafana13DashboardFailure['stage'] | 'health';
}

export interface Grafana13GridPosition {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface Grafana13TextPanelModel {
  readonly id: number;
  readonly type: 'text';
  readonly title: string;
  readonly pluginVersion: '13.2.3';
  readonly options: {
    readonly mode: 'markdown';
    readonly content: string;
    readonly code: { readonly language: 'plaintext'; readonly showLineNumbers: false; readonly showMiniMap: false };
  };
  readonly fieldConfig: { readonly defaults: Readonly<Record<string, never>>; readonly overrides: readonly never[] };
}

export interface Grafana13ConstantVariable {
  readonly name: 'environment';
  readonly label: 'Environment';
  readonly value: 'phase0';
}

interface PanelIdentity {
  readonly index: number;
  readonly id: number;
  readonly panelType: string;
  readonly title: string;
  readonly grid: Grafana13GridPosition;
}

export type Grafana13RenderablePanel =
  | (PanelIdentity & { readonly kind: 'supported'; readonly profile: 'text-markdown-view-v1'; readonly panelType: 'text'; readonly model: Grafana13TextPanelModel })
  | (PanelIdentity & { readonly kind: 'unsupported'; readonly diagnostics: readonly Grafana13PreflightDiagnostic[] });

export type Grafana13PartialPreflightResult =
  | {
      readonly kind: 'renderable';
      readonly uid: string;
      readonly title: string;
      readonly timeRange: { readonly from: string; readonly to: string };
      readonly timezone: 'browser';
      readonly constantVariables: readonly Grafana13ConstantVariable[];
      readonly panels: readonly Grafana13RenderablePanel[];
      readonly supportedPanelCount: number;
      readonly unsupportedPanelCount: number;
    }
  | {
      readonly kind: 'unsupported-dashboard';
      readonly reason: 'dashboard-schema' | 'dashboard-profile';
      readonly diagnostics: readonly Grafana13PreflightDiagnostic[];
      readonly diagnosticsTruncated: boolean;
    };

export type Grafana13PartialDashboardLoadResult =
  | { readonly kind: 'renderable'; readonly requestIds: Grafana13RenderRequestIds; readonly dashboard: Grafana13PartialPreflightResult & { readonly kind: 'renderable' } }
  | { readonly kind: 'unsupported-dashboard'; readonly reason: 'target-version' | 'dashboard-schema' | 'dashboard-profile'; readonly diagnostics: readonly Grafana13PreflightDiagnostic[]; readonly diagnosticsTruncated: boolean }
  | { readonly kind: 'cancelled'; readonly stage: 'health' | 'discovery' | 'dashboard-v1'; readonly requestId: string }
  | { readonly kind: 'failure'; readonly error: Grafana13PartialDashboardFailure };
