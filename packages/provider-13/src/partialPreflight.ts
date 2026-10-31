import type { ManifestValidationSuccess } from '@dashboard-render-sdk-g/provider-contract';

import type { Grafana13DashboardV1, Grafana13JsonObject, Grafana13PreflightDiagnostic } from './contracts';
import { cloneBoundedJson } from './dashboardApi';
import { decodeGrafana13DashboardV1Value } from './dashboardDto';
import type { Grafana13ConstantVariable, Grafana13PartialPreflightResult, Grafana13RenderablePanel } from './partialContracts';
import { classifyGrafana13PanelProfile } from './preflightProfiles';
import { preflightGrafana13DashboardV1, validateGrid } from './staticPreflight';

const layoutKeys = ['repeat', 'repeatDirection', 'maxPerRow', 'scopedVars', 'libraryPanel', 'collapsed', 'panels', 'rows', 'tabs'];

function unsupportedProfile(path: string, code: Grafana13PreflightDiagnostic['code'] = 'dashboard.feature-unsupported'): Grafana13PartialPreflightResult {
  return Object.freeze({
    diagnostics: Object.freeze([Object.freeze({ code, message: 'The dashboard is outside the safe view profile.', path })]),
    diagnosticsTruncated: false, kind: 'unsupported-dashboard', reason: 'dashboard-profile',
  });
}

function safeString(value: unknown, max: number, empty = false): value is string {
  return typeof value === 'string' && (empty || value.length > 0) && value.length <= max && !/[\u0000-\u001f\u007f]/.test(value);
}

/** Reuses the strict profile for dashboard-wide semantics and exact Text validation. */
export function partialPreflightGrafana13DashboardV1(
  dashboard: Grafana13DashboardV1,
  manifest: ManifestValidationSuccess
): Grafana13PartialPreflightResult {
  // Public synchronous callers receive the same bounded, accessor-free snapshot as the DTO path.
  const cloned = cloneBoundedJson(dashboard);
  if (!cloned.ok || typeof cloned.value !== 'object' || cloned.value === null || Array.isArray(cloned.value)) return unsupportedProfile('$');
  const raw = cloned.value as Grafana13JsonObject;
  const metadata = raw.metadata as Grafana13JsonObject | undefined;
  if (raw.family !== 'v1' || !metadata || typeof metadata.name !== 'string' || typeof metadata.namespace !== 'string') return unsupportedProfile('$.metadata');
  const { family: _family, ...envelope } = raw;
  const decoded = decodeGrafana13DashboardV1Value(envelope, { namespace: metadata.namespace, requestId: 'partial-preflight', uid: metadata.name });
  if (decoded.kind === 'unsupported') return Object.freeze({
    diagnostics: decoded.diagnostics, diagnosticsTruncated: decoded.diagnosticsTruncated, kind: 'unsupported-dashboard',
    reason: decoded.diagnostics.some(({ code }) => code === 'dashboard.schema-unsupported') ? 'dashboard-schema' : 'dashboard-profile',
  });
  if (decoded.kind !== 'success') return unsupportedProfile('$');
  dashboard = decoded.value;
  if (!safeString(dashboard.spec.title, 1024) || !/^[A-Za-z0-9_-]{1,40}$/.test(dashboard.metadata.name) ||
      !/^(?=.{1,63}$)[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(dashboard.metadata.namespace) ||
      (Object.hasOwn(dashboard.spec, 'uid') && dashboard.spec.uid !== dashboard.metadata.name)) return unsupportedProfile('$.spec');
  const global = preflightGrafana13DashboardV1({ ...dashboard, spec: { ...dashboard.spec, panels: [] } }, manifest);
  if (global.kind === 'unsupported') return Object.freeze({
    diagnostics: global.diagnostics, diagnosticsTruncated: global.diagnosticsTruncated,
    kind: 'unsupported-dashboard', reason: 'dashboard-profile',
  });
  const timepicker = dashboard.spec.timepicker;
  if (dashboard.spec.refresh !== '' || dashboard.spec.graphTooltip !== 0 ||
      typeof timepicker !== 'object' || timepicker === null || Array.isArray(timepicker) || Object.keys(timepicker).length > 0) return unsupportedProfile('$.spec');
  const time = dashboard.spec.time as Grafana13JsonObject;
  if (!safeString(time.from, 256) || !safeString(time.to, 256)) return unsupportedProfile('$.spec.time');
  const ids = new Set<number>();
  const occupied: Array<{ x: number; y: number; w: number; h: number }> = [];
  for (let index = 0; index < dashboard.spec.panels.length; index += 1) {
    const panel = dashboard.spec.panels[index];
    const path = `$.spec.panels[${index}]`;
    if (!panel || typeof panel !== 'object' || Array.isArray(panel) ||
        !Number.isSafeInteger(panel.id) || (panel.id as number) <= 0 || ids.has(panel.id as number) ||
        !safeString(panel.type, 128) || !/^[a-z][a-z0-9-]*$/.test(panel.type) || !safeString(panel.title, 1024, true)) {
      return unsupportedProfile(path, 'dashboard.layout-unsupported');
    }
    ids.add(panel.id as number);
    if (panel.type === 'row' || panel.type === 'tabs' || layoutKeys.some((key) => Object.hasOwn(panel, key))) return unsupportedProfile(path, 'dashboard.layout-unsupported');
    const diagnostics: Grafana13PreflightDiagnostic[] = [];
    validateGrid(panel, index, occupied, diagnostics);
    const grid = panel.gridPos as Grafana13JsonObject | undefined;
    if (diagnostics.length > 0 || !grid || !Number.isSafeInteger((grid.y as number) + (grid.h as number))) return unsupportedProfile(`${path}.gridPos`, 'dashboard.layout-unsupported');
  }
  const panels: Grafana13RenderablePanel[] = dashboard.spec.panels.map((panel, index) => {
    const grid = panel.gridPos as Grafana13JsonObject;
    const identity = {
      grid: Object.freeze({ height: grid.h as number, width: grid.w as number, x: grid.x as number, y: grid.y as number }),
      id: panel.id as number, index, panelType: panel.type as string, title: panel.title as string,
    };
    const checked = ['text', 'stat', 'timeseries', 'gauge', 'bargauge', 'barchart'].includes(panel.type as string)
      ? preflightGrafana13DashboardV1({ ...dashboard, spec: { ...dashboard.spec, panels: [panel] } }, manifest)
      : undefined;
    const profile = checked?.kind === 'match' ? classifyGrafana13PanelProfile(panel) : undefined;
    if (profile?.kind === 'supported' && profile.profile === 'text-markdown-view-v1') {
      return Object.freeze({ ...identity, kind: 'supported', model: profile.model, panelType: 'text', profile: profile.profile });
    }
    if (profile?.kind === 'supported' && profile.profile === 'predictable-pulse-view-v1' &&
        (profile.model.type === 'stat' || profile.model.type === 'timeseries' || profile.model.type === 'gauge' || profile.model.type === 'bargauge' || profile.model.type === 'barchart')) {
      return Object.freeze({ ...identity, kind: 'supported', model: profile.model, panelType: profile.model.type, profile: profile.profile });
    }
    const diagnostics: readonly Grafana13PreflightDiagnostic[] = Object.freeze([Object.freeze({
      code: panel.type === 'text' ? 'panel.profile-unsupported' : 'panel.unsupported',
      message: 'The panel is outside the verified view profile.', path: `$.spec.panels[${index}]`,
    })]);
    return Object.freeze({ ...identity, diagnostics, kind: 'unsupported' });
  });
  const templating = dashboard.spec.templating as Grafana13JsonObject;
  const variables: readonly Grafana13ConstantVariable[] = Object.freeze((templating.list as readonly unknown[]).length === 0 ? [] : [
    Object.freeze({ label: 'Environment', name: 'environment', value: 'phase0' }),
  ]);
  const supportedPanelCount = panels.filter(({ kind }) => kind === 'supported').length;
  return Object.freeze({
    constantVariables: variables, kind: 'renderable', panels: Object.freeze(panels), supportedPanelCount,
    timeRange: Object.freeze({ from: time.from as string, to: time.to as string }), timezone: 'browser',
    title: dashboard.spec.title as string, uid: dashboard.metadata.name, unsupportedPanelCount: panels.length - supportedPanelCount,
  });
}
