import type { ManifestValidationSuccess } from '@dashboard-render-sdk-g/provider-contract';

import {
  GRAFANA_13_DASHBOARD_API_GROUP,
  GRAFANA_13_DASHBOARD_API_VERSION,
  GRAFANA_13_DASHBOARD_SCHEMA_VERSION,
  type Grafana13DashboardInventory,
  type Grafana13DashboardV1,
  type Grafana13JsonValue,
  type Grafana13PreflightDiagnostic,
  type Grafana13PreflightDiagnosticCode,
} from './contracts';

const MAX_DIAGNOSTICS = 100;
const MAX_TRANSFORMATIONS = 256;
const supportedPanels = new Set(['stat', 'text', 'timeseries']);
const dashboardKeys = new Set([
  'annotations', 'description', 'editable', 'fiscalYearStartMonth', 'graphTooltip', 'id',
  'links', 'liveNow', 'panels', 'preload', 'refresh', 'schemaVersion', 'tags', 'templating',
  'time', 'timepicker', 'timezone', 'title', 'uid', 'version', 'weekStart',
]);
const commonPanelKeys = new Set([
  'datasource', 'fieldConfig', 'gridPos', 'id', 'options', 'pluginVersion', 'targets',
  'title', 'transformations', 'type',
]);
const statOptionKeys = new Set([
  'colorMode', 'graphMode', 'justifyMode', 'orientation', 'percentChangeColorMode',
  'reduceOptions', 'showPercentChange', 'textMode', 'wideLayout',
]);
const timeSeriesOptionKeys = new Set(['legend', 'tooltip']);
const statFieldKeys = new Set(['color', 'mappings', 'thresholds', 'unit']);
const timeSeriesFieldKeys = new Set(['color', 'custom', 'max', 'min', 'thresholds', 'unit']);
const timeSeriesCustomKeys = new Set([
  'axisBorderShow', 'axisCenteredZero', 'axisColorMode', 'axisLabel', 'axisPlacement',
  'barAlignment', 'drawStyle', 'fillOpacity', 'gradientMode', 'hideFrom', 'insertNulls',
  'lineInterpolation', 'lineWidth', 'pointSize', 'scaleDistribution', 'showPoints',
  'spanNulls', 'stacking', 'thresholdsStyle',
]);
const diagnosticTotals = new WeakMap<Grafana13PreflightDiagnostic[], number>();
const diagnosticCodes = new WeakMap<Grafana13PreflightDiagnostic[], Set<Grafana13PreflightDiagnosticCode>>();
const knownCapabilityIds = new Set([
  'constant', 'grafana-testdata-datasource', 'renameByRegex', 'stat', 'table', 'text', 'timeseries',
]);
const expectedStatOptions = {
  colorMode: 'background', graphMode: 'area', justifyMode: 'auto', orientation: 'auto',
  percentChangeColorMode: 'standard', reduceOptions: { calcs: ['lastNotNull'], fields: '', values: false },
  showPercentChange: false, textMode: 'auto', wideLayout: true,
};
const expectedStatDefaults = {
  color: { mode: 'thresholds' }, mappings: [],
  thresholds: { mode: 'absolute', steps: [{ color: 'green', value: null }, { color: 'orange', value: 50 }, { color: 'red', value: 80 }] },
  unit: 'percent',
};
const expectedTimeSeriesOptions = {
  legend: { calcs: [], displayMode: 'list', placement: 'bottom', showLegend: true },
  tooltip: { hideZeros: false, mode: 'single', sort: 'none' },
};
const expectedTimeSeriesDefaults = {
  color: { mode: 'palette-classic' },
  custom: {
    axisBorderShow: false, axisCenteredZero: false, axisColorMode: 'text', axisLabel: '', axisPlacement: 'auto',
    barAlignment: 0, drawStyle: 'line', fillOpacity: 15, gradientMode: 'none',
    hideFrom: { legend: false, tooltip: false, viz: false }, insertNulls: false,
    lineInterpolation: 'linear', lineWidth: 2, pointSize: 5, scaleDistribution: { type: 'linear' },
    showPoints: 'auto', spanNulls: false, stacking: { group: 'A', mode: 'none' }, thresholdsStyle: { mode: 'line' },
  },
  max: 100, min: 0,
  thresholds: { mode: 'absolute', steps: [{ color: 'green', value: null }, { color: 'red', value: 80 }] },
  unit: 'percent',
};

export type Grafana13StaticPreflightResult =
  | { readonly kind: 'match'; readonly inventory: Grafana13DashboardInventory }
  | {
      readonly kind: 'unsupported';
      readonly inventory: Grafana13DashboardInventory;
      readonly diagnostics: readonly Grafana13PreflightDiagnostic[];
      readonly diagnosticsTruncated: boolean;
    };

type ObjectValue = Readonly<Record<string, Grafana13JsonValue>>;

function frozen<T extends object>(value: T): Readonly<T> {
  return Object.freeze(value);
}

function object(value: Grafana13JsonValue | undefined): ObjectValue | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as ObjectValue
    : undefined;
}

function own(value: ObjectValue, key: string): Grafana13JsonValue | undefined {
  return Object.prototype.hasOwnProperty.call(value, key) ? value[key] : undefined;
}

function exactKeys(value: ObjectValue, keys: ReadonlySet<string>): boolean {
  return Object.keys(value).every((key) => keys.has(key));
}

function jsonEqual(actual: unknown, expected: unknown): boolean {
  if (actual === expected) return true;
  if (Array.isArray(actual) || Array.isArray(expected)) {
    return Array.isArray(actual) && Array.isArray(expected) && actual.length === expected.length &&
      actual.every((value, index) => jsonEqual(value, expected[index]));
  }
  if (typeof actual !== 'object' || actual === null || typeof expected !== 'object' || expected === null) return false;
  const actualKeys = Object.keys(actual);
  const expectedKeys = Object.keys(expected);
  return actualKeys.length === expectedKeys.length && expectedKeys.every((key) =>
    Object.prototype.hasOwnProperty.call(actual, key) &&
    jsonEqual((actual as Record<string, unknown>)[key], (expected as Record<string, unknown>)[key])
  );
}

function safeCapabilityId(value: unknown): string {
  if (typeof value !== 'string') return '<invalid>';
  return knownCapabilityIds.has(value) ? value : '<unsupported>';
}

function compareDiagnostic(a: Grafana13PreflightDiagnostic, b: Grafana13PreflightDiagnostic): number {
  return a.path.localeCompare(b.path) || a.code.localeCompare(b.code) || (a.capabilityId ?? '').localeCompare(b.capabilityId ?? '');
}

function add(
  diagnostics: Grafana13PreflightDiagnostic[],
  code: Grafana13PreflightDiagnosticCode,
  path: string,
  message: string,
  capabilityId?: string
): void {
  diagnosticTotals.set(diagnostics, (diagnosticTotals.get(diagnostics) ?? 0) + 1);
  const codes = diagnosticCodes.get(diagnostics) ?? new Set<Grafana13PreflightDiagnosticCode>();
  codes.add(code);
  diagnosticCodes.set(diagnostics, codes);
  const diagnostic = frozen({ code, ...(capabilityId === undefined ? {} : { capabilityId: safeCapabilityId(capabilityId) }), message, path });
  if (diagnostics.length < MAX_DIAGNOSTICS) {
    diagnostics.push(diagnostic);
    diagnostics.sort(compareDiagnostic);
    return;
  }
  if (compareDiagnostic(diagnostic, diagnostics[diagnostics.length - 1]!) < 0) {
    diagnostics[diagnostics.length - 1] = diagnostic;
    diagnostics.sort(compareDiagnostic);
  }
}

function datasourceIdentity(panel: ObjectValue): { type?: string; uid?: string } {
  const datasource = object(own(panel, 'datasource'));
  return {
    type: typeof datasource?.type === 'string' ? safeCapabilityId(datasource.type) : undefined,
    uid: typeof datasource?.uid === 'string' ? datasource.uid : undefined,
  };
}

export function validateGrid(
  panel: ObjectValue,
  index: number,
  occupied: Array<{ x: number; y: number; w: number; h: number }>,
  diagnostics: Grafana13PreflightDiagnostic[]
): void {
  const path = `$.spec.panels[${index}].gridPos`;
  const grid = object(own(panel, 'gridPos'));
  if (!grid || !exactKeys(grid, new Set(['h', 'w', 'x', 'y']))) {
    add(diagnostics, 'dashboard.layout-unsupported', path, 'The panel grid position is outside the static profile.');
    return;
  }
  const values = ['x', 'y', 'w', 'h'].map((key) => own(grid, key));
  if (!values.every(Number.isSafeInteger)) {
    add(diagnostics, 'dashboard.layout-unsupported', path, 'The panel grid position must use bounded integers.');
    return;
  }
  const x = values[0] as number;
  const y = values[1] as number;
  const w = values[2] as number;
  const h = values[3] as number;
  if (x < 0 || y < 0 || w <= 0 || h <= 0 || x + w > 24) {
    add(diagnostics, 'dashboard.layout-unsupported', path, 'The panel grid position is outside the 24-column profile.');
    return;
  }
  if (occupied.some((other) => x < other.x + other.w && x + w > other.x && y < other.y + other.h && y + h > other.y)) {
    add(diagnostics, 'dashboard.layout-unsupported', path, 'Panel grid positions overlap.');
  }
  occupied.push({ h, w, x, y });
}

function validateVariableProfile(spec: ObjectValue, variableKinds: string[], diagnostics: Grafana13PreflightDiagnostic[]): void {
  const templating = object(own(spec, 'templating'));
  const list = templating && own(templating, 'list');
  if (!templating || !exactKeys(templating, new Set(['list'])) || !Array.isArray(list)) {
    add(diagnostics, 'dashboard.feature-unsupported', '$.spec.templating', 'Dashboard variables are outside the static profile.');
    return;
  }
  if (list.length > 1) {
    add(diagnostics, 'dashboard.feature-unsupported', '$.spec.templating.list', 'The static profile permits at most one dashboard variable.');
  }
  for (let index = 0; index < list.length; index += 1) {
    const variable = object(list[index]);
    const type = safeCapabilityId(variable && own(variable, 'type'));
    const current = variable && object(own(variable, 'current'));
    variableKinds.push(type);
    if (
      !variable || type !== 'constant' || own(variable, 'name') !== 'environment' ||
      own(variable, 'query') !== 'phase0' || own(variable, 'hide') !== 2 ||
      own(variable, 'label') !== 'Environment' || own(variable, 'skipUrlSync') !== true ||
      !current || !exactKeys(current, new Set(['selected', 'text', 'value'])) ||
      own(current, 'selected') !== true || own(current, 'text') !== 'phase0' || own(current, 'value') !== 'phase0' ||
      !exactKeys(variable, new Set(['current', 'hide', 'label', 'name', 'query', 'skipUrlSync', 'type']))
    ) add(diagnostics, 'dashboard.feature-unsupported', `$.spec.templating.list[${index}]`, 'The dashboard variable is outside the static profile.', type);
  }
}

function annotationPolicy(spec: ObjectValue, diagnostics: Grafana13PreflightDiagnostic[]): Grafana13DashboardInventory['annotationPolicy'] {
  const annotations = object(own(spec, 'annotations'));
  const list = annotations && own(annotations, 'list');
  if (!annotations || !exactKeys(annotations, new Set(['list'])) || !Array.isArray(list)) {
    add(diagnostics, 'dashboard.feature-unsupported', '$.spec.annotations', 'Dashboard annotations are outside the static profile.');
    return 'unsupported';
  }
  if (list.length === 0) return 'none';
  if (list.length === 1) {
    const entry = object(list[0]);
    const datasource = entry && object(own(entry, 'datasource'));
    if (
      entry && exactKeys(entry, new Set(['builtIn', 'datasource', 'enable', 'hide', 'iconColor', 'name', 'type'])) &&
      datasource && exactKeys(datasource, new Set(['type', 'uid'])) &&
      own(entry, 'builtIn') === 1 && own(entry, 'enable') === true && own(entry, 'hide') === true &&
      own(entry, 'iconColor') === 'rgba(0, 211, 255, 1)' && own(entry, 'name') === 'Annotations & Alerts' &&
      own(entry, 'type') === 'dashboard' && own(datasource, 'type') === 'grafana' && own(datasource, 'uid') === '-- Grafana --'
    ) {
      return 'canonical-builtin-omitted';
    }
  }
  add(diagnostics, 'dashboard.feature-unsupported', '$.spec.annotations.list', 'Material dashboard annotations are unsupported.');
  return 'unsupported';
}

function validateQueryPanel(
  panel: ObjectValue,
  index: number,
  manifest: ManifestValidationSuccess,
  datasourceTypes: string[],
  diagnostics: Grafana13PreflightDiagnostic[]
): void {
  const path = `$.spec.panels[${index}]`;
  const identity = datasourceIdentity(panel);
  const panelDatasource = object(own(panel, 'datasource'));
  if (identity.type) datasourceTypes.push(identity.type);
  if (identity.type !== 'grafana-testdata-datasource' || identity.uid !== 'grsdk-testdata' || !panelDatasource || !exactKeys(panelDatasource, new Set(['type', 'uid']))) {
    add(diagnostics, 'datasource.profile-unsupported', `${path}.datasource`, 'The panel datasource is outside the controlled TestData profile.', identity.type);
  }
  if (!identity.type || !manifest.manifest.capabilities.datasources.includes(identity.type)) {
    add(diagnostics, 'dashboard.manifest-declaration-missing', `${path}.datasource`, 'The manifest does not declare this datasource type.', identity.type);
  }
  const targets = own(panel, 'targets');
  if (!Array.isArray(targets) || targets.length !== 1) {
    add(diagnostics, 'datasource.profile-unsupported', `${path}.targets`, 'Exactly one controlled query target is required.', identity.type);
    return;
  }
  const target = object(targets[0]);
  const targetDatasource = target && object(own(target, 'datasource'));
  const pulse = target && object(own(target, 'pulseWave'));
  if (
    !target || !targetDatasource || !pulse || !exactKeys(target, new Set(['alias', 'datasource', 'pulseWave', 'refId', 'scenarioId'])) ||
    !exactKeys(targetDatasource, new Set(['type', 'uid'])) || typeof own(target, 'alias') !== 'string' || own(target, 'refId') !== 'A' ||
    own(target, 'scenarioId') !== 'predictable_pulse' ||
    own(targetDatasource, 'type') !== 'grafana-testdata-datasource' || own(targetDatasource, 'uid') !== 'grsdk-testdata' ||
    own(pulse, 'offCount') !== 5 || own(pulse, 'offValue') !== 10 || own(pulse, 'onCount') !== 5 ||
    own(pulse, 'onValue') !== 90 || own(pulse, 'timeStep') !== 1 ||
    !exactKeys(pulse, new Set(['offCount', 'offValue', 'onCount', 'onValue', 'timeStep']))
  ) add(diagnostics, 'datasource.profile-unsupported', `${path}.targets[0]`, 'The query target is outside the Predictable Pulse profile.', identity.type);
}

function validatePanelConfiguration(
  panel: ObjectValue,
  index: number,
  type: string,
  diagnostics: Grafana13PreflightDiagnostic[]
): void {
  const path = `$.spec.panels[${index}]`;
  const options = object(own(panel, 'options'));
  const fieldConfig = object(own(panel, 'fieldConfig'));
  const defaults = fieldConfig && object(own(fieldConfig, 'defaults'));
  const overrides = fieldConfig && own(fieldConfig, 'overrides');
  if (!options || !fieldConfig || !defaults || !Array.isArray(overrides) || overrides.length !== 0 || !exactKeys(fieldConfig, new Set(['defaults', 'overrides']))) {
    add(diagnostics, 'panel.profile-unsupported', path, 'Panel options and field configuration are outside the static profile.', type);
    return;
  }
  if (type === 'stat') {
    const reduce = object(own(options, 'reduceOptions'));
    const calcs = reduce && own(reduce, 'calcs');
    if (
      !exactKeys(options, statOptionKeys) || !exactKeys(defaults, statFieldKeys) ||
      !jsonEqual(options, expectedStatOptions) || !jsonEqual(defaults, expectedStatDefaults) ||
      !reduce || !exactKeys(reduce, new Set(['calcs', 'fields', 'values'])) ||
      !Array.isArray(calcs) || calcs.length !== 1 || calcs[0] !== 'lastNotNull' ||
      own(defaults, 'unit') !== 'percent'
    ) add(diagnostics, 'panel.profile-unsupported', path, 'The Stat options or field configuration are outside the verified profile.', type);
  } else if (type === 'timeseries') {
    const custom = object(own(defaults, 'custom'));
    const legend = object(own(options, 'legend'));
    const tooltip = object(own(options, 'tooltip'));
    if (
      !exactKeys(options, timeSeriesOptionKeys) || !exactKeys(defaults, timeSeriesFieldKeys) ||
      !jsonEqual(options, expectedTimeSeriesOptions) || !jsonEqual(defaults, expectedTimeSeriesDefaults) ||
      !custom || !exactKeys(custom, timeSeriesCustomKeys) ||
      !legend || !exactKeys(legend, new Set(['calcs', 'displayMode', 'placement', 'showLegend'])) ||
      !tooltip || !exactKeys(tooltip, new Set(['hideZeros', 'mode', 'sort'])) ||
      own(defaults, 'unit') !== 'percent'
    ) add(diagnostics, 'panel.profile-unsupported', path, 'The Time series options or field configuration are outside the verified profile.', type);
  }
}

function validateTransforms(
  panel: ObjectValue,
  index: number,
  panelType: string,
  manifest: ManifestValidationSuccess,
  transformationIds: string[],
  diagnostics: Grafana13PreflightDiagnostic[],
  aggregate: { count: number; exceeded: boolean }
): void {
  const path = `$.spec.panels[${index}].transformations`;
  const raw = own(panel, 'transformations');
  const transformations = raw === undefined ? [] : raw;
  if (!Array.isArray(transformations)) {
    add(diagnostics, 'transformation.profile-unsupported', path, 'Panel transformations must be a bounded array.');
    return;
  }
  if (panelType !== 'timeseries' && transformations.length > 0) {
    add(diagnostics, 'transformation.profile-unsupported', path, 'Only the verified Time series panel may declare a transformation.');
  }
  if (transformations.length === 0 && !manifest.manifest.capabilities.transformations.allowEmptyPipeline) {
    add(diagnostics, 'dashboard.manifest-declaration-missing', path, 'The manifest does not allow the empty transformation pipeline.');
  }
  if (transformations.length > 1) {
    add(diagnostics, 'transformation.profile-unsupported', path, 'The static profile permits at most one transformation.');
  }
  if (transformations.length > manifest.manifest.capabilities.transformations.maxChainLength) {
    add(diagnostics, 'dashboard.manifest-declaration-missing', path, 'The manifest transformation chain limit is too small.');
  }
  const remaining = Math.max(0, MAX_TRANSFORMATIONS - aggregate.count);
  const processCount = Math.min(transformations.length, remaining);
  if (transformations.length > remaining && !aggregate.exceeded) {
    aggregate.exceeded = true;
    add(diagnostics, 'transformation.profile-unsupported', '$.spec.panels', 'The dashboard exceeds the transformation inventory limit.');
  }
  aggregate.count += processCount;
  for (let transformIndex = 0; transformIndex < processCount; transformIndex += 1) {
    const transformation = object(transformations[transformIndex]);
    const id = safeCapabilityId(transformation && own(transformation, 'id'));
    transformationIds.push(id);
    if (!manifest.manifest.capabilities.transformations.ids.includes(id)) {
      add(diagnostics, 'dashboard.manifest-declaration-missing', `${path}[${transformIndex}]`, 'The manifest does not declare this transformation.', id);
    }
    const options = transformation && object(own(transformation, 'options'));
    if (
      !transformation || id !== 'renameByRegex' || !exactKeys(transformation, new Set(['id', 'options'])) ||
      !options || !exactKeys(options, new Set(['regex', 'renamePattern'])) ||
      own(options, 'regex') !== '/Raw/' || own(options, 'renamePattern') !== 'Signal'
    ) add(diagnostics, 'transformation.profile-unsupported', `${path}[${transformIndex}]`, 'The transformation is outside the renameByRegex profile.', id);
  }
}

export function preflightGrafana13DashboardV1(
  dashboard: Grafana13DashboardV1,
  manifest: ManifestValidationSuccess
): Grafana13StaticPreflightResult {
  const diagnostics: Grafana13PreflightDiagnostic[] = [];
  const spec = dashboard.spec as ObjectValue;
  const panels = dashboard.spec.panels;
  const panelInventory: Array<{ index: number; id: number; type: string }> = [];
  const panelTypes: string[] = [];
  const datasourceTypes: string[] = [];
  const transformationIds: string[] = [];
  const variableKinds: string[] = [];
  const transformationAggregate = { count: 0, exceeded: false };
  const ids = new Set<number>();
  const occupied: Array<{ x: number; y: number; w: number; h: number }> = [];

  if (manifest.manifest.dashboards.lookup !== 'uid' ||
      !manifest.manifest.dashboards.apis.some(({ group, version }) => group === GRAFANA_13_DASHBOARD_API_GROUP && version === GRAFANA_13_DASHBOARD_API_VERSION) ||
      !manifest.manifest.dashboards.schemas.some(({ family, schemaVersion }) => family === 'v1' && schemaVersion === GRAFANA_13_DASHBOARD_SCHEMA_VERSION)) {
    add(diagnostics, 'dashboard.manifest-declaration-missing', '$.manifest.dashboards', 'The manifest does not declare the required UID/V1/schema-42 dashboard contract.');
  }
  for (const key of Object.keys(spec)) {
    if (!dashboardKeys.has(key)) add(diagnostics, 'dashboard.feature-unsupported', '$.spec.<unknown-property>', 'The dashboard contains an unknown material property.');
  }
  if (own(spec, 'timezone') !== 'browser' || own(spec, 'liveNow') !== false || own(spec, 'preload') !== false) {
    add(diagnostics, 'dashboard.feature-unsupported', '$.spec', 'The dashboard execution settings are outside the static profile.');
  }
  const links = own(spec, 'links');
  if (!Array.isArray(links) || links.length !== 0) add(diagnostics, 'dashboard.feature-unsupported', '$.spec.links', 'Dashboard links are unsupported.');
  const time = object(own(spec, 'time'));
  if (!time || !exactKeys(time, new Set(['from', 'to'])) || typeof own(time, 'from') !== 'string' || typeof own(time, 'to') !== 'string') {
    add(diagnostics, 'dashboard.feature-unsupported', '$.spec.time', 'The dashboard time range is outside the static profile.');
  }
  validateVariableProfile(spec, variableKinds, diagnostics);
  const annotations = annotationPolicy(spec, diagnostics);

  for (let index = 0; index < panels.length; index += 1) {
    const panel = object(panels[index]);
    const type = safeCapabilityId(panel && own(panel, 'type'));
    const idValue = panel ? own(panel, 'id') : undefined;
    const id = typeof idValue === 'number' && Number.isSafeInteger(idValue) ? idValue : -1;
    panelInventory.push(frozen({ id, index, type }));
    panelTypes.push(type);
    if (!panel) {
      add(diagnostics, 'panel.profile-unsupported', `$.spec.panels[${index}]`, 'The panel structure is outside the static profile.', type);
      continue;
    }
    if (id <= 0 || ids.has(id)) add(diagnostics, 'dashboard.layout-unsupported', `$.spec.panels[${index}].id`, 'Panel IDs must be unique positive integers.');
    ids.add(id);
    validateGrid(panel, index, occupied, diagnostics);
    if (!exactKeys(panel, commonPanelKeys)) add(diagnostics, 'panel.profile-unsupported', `$.spec.panels[${index}]`, 'The panel contains an unknown material property.', type);
    if (!supportedPanels.has(type)) add(diagnostics, 'panel.unsupported', `$.spec.panels[${index}].type`, 'The panel type is outside the provider static profile.', type);
    if (!manifest.manifest.capabilities.panels.includes(type)) add(diagnostics, 'dashboard.manifest-declaration-missing', `$.spec.panels[${index}].type`, 'The manifest does not declare this panel type.', type);
    if (own(panel, 'pluginVersion') !== '13.2.3') add(diagnostics, 'panel.profile-unsupported', `$.spec.panels[${index}].pluginVersion`, 'The panel plugin version must match Grafana 13.2.3.', type);

    if (type === 'text') {
      const options = object(own(panel, 'options'));
      const code = options && object(own(options, 'code'));
      const fieldConfig = object(own(panel, 'fieldConfig'));
      const defaults = fieldConfig && object(own(fieldConfig, 'defaults'));
      const overrides = fieldConfig && own(fieldConfig, 'overrides');
      const emptyFieldConfig = own(panel, 'fieldConfig') === undefined || (
        fieldConfig !== undefined && exactKeys(fieldConfig, new Set(['defaults', 'overrides'])) &&
        defaults !== undefined && Object.keys(defaults).length === 0 && Array.isArray(overrides) && overrides.length === 0
      );
      if (!options || !exactKeys(options, new Set(['code', 'content', 'mode'])) || !code ||
          !exactKeys(code, new Set(['language', 'showLineNumbers', 'showMiniMap'])) ||
          own(code, 'language') !== 'plaintext' || own(code, 'showLineNumbers') !== false || own(code, 'showMiniMap') !== false ||
          own(options, 'mode') !== 'markdown' || typeof own(options, 'content') !== 'string' ||
          !emptyFieldConfig || own(panel, 'datasource') !== undefined || own(panel, 'targets') !== undefined || own(panel, 'transformations') !== undefined) {
        add(diagnostics, 'panel.profile-unsupported', `$.spec.panels[${index}]`, 'The Text panel is outside the Markdown view-only profile.', type);
      }
    } else {
      validateQueryPanel(panel, index, manifest, datasourceTypes, diagnostics);
      validateTransforms(panel, index, type, manifest, transformationIds, diagnostics, transformationAggregate);
      validatePanelConfiguration(panel, index, type, diagnostics);
    }
  }
  const unique = (values: string[]) => frozen([...new Set(values)].sort());
  const diagnosticTotal = diagnosticTotals.get(diagnostics) ?? 0;
  const inventory: Grafana13DashboardInventory = frozen({
    annotationPolicy: annotations,
    datasourceTypes: unique(datasourceTypes),
    layout: diagnosticCodes.get(diagnostics)?.has('dashboard.layout-unsupported') ? 'unsupported' : 'flat-grid',
    panelCount: panels.length,
    panels: frozen(panelInventory),
    panelTypes: unique(panelTypes),
    transformationIds: unique(transformationIds),
    variableKinds: unique(variableKinds),
  });
  if (diagnosticTotal === 0) return frozen({ inventory, kind: 'match' as const });
  return frozen({
    diagnostics: frozen(diagnostics),
    diagnosticsTruncated: diagnosticTotal > diagnostics.length,
    inventory,
    kind: 'unsupported' as const,
  });
}
