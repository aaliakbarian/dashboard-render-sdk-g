import { cloneBoundedJson } from './dashboardApi';
import type { Grafana13JsonObject, Grafana13PreflightDiagnostic } from './contracts';
import type { Grafana13QueryPanelModel, Grafana13TextPanelModel } from './partialContracts';
import { isGrafana13PulseAlias } from './pulseAlias';

const reduceOptions = { calcs: ['lastNotNull'], fields: '', values: false } as const;
const legend = { calcs: [], displayMode: 'list', placement: 'bottom', showLegend: true } as const;
const tooltip = { hideZeros: false, mode: 'single', sort: 'none' } as const;
const hideFrom = { legend: false, tooltip: false, viz: false } as const;
const thresholds = { mode: 'absolute', steps: [{ color: 'green', value: null }, { color: 'orange', value: 50 }, { color: 'red', value: 80 }] } as const;
const singleValueDefaults = { color: { mode: 'thresholds' }, mappings: [], thresholds, unit: 'percent' } as const;
const axis = { axisBorderShow: false, axisCenteredZero: false, axisColorMode: 'text', axisLabel: '', axisPlacement: 'auto' } as const;

/** DTO profiles only. Presence here never authorizes a plugin loader or query runner. */
const queryPanelProfiles = {
  stat: {
    options: {
      colorMode: 'background', graphMode: 'area', justifyMode: 'auto', orientation: 'auto',
      percentChangeColorMode: 'standard', reduceOptions, showPercentChange: false, textMode: 'auto', wideLayout: true,
    },
    fieldConfig: { defaults: singleValueDefaults, overrides: [] },
  },
  timeseries: {
    options: { legend, tooltip },
    fieldConfig: {
      defaults: {
        color: { mode: 'palette-classic' }, custom: {
          ...axis, barAlignment: 0, drawStyle: 'line', fillOpacity: 15, gradientMode: 'none', hideFrom,
          insertNulls: false, lineInterpolation: 'linear', lineWidth: 2, pointSize: 5,
          scaleDistribution: { type: 'linear' }, showPoints: 'auto', spanNulls: false,
          stacking: { group: 'A', mode: 'none' }, thresholdsStyle: { mode: 'line' },
        },
        max: 100, min: 0, thresholds: { mode: 'absolute', steps: [{ color: 'green', value: null }, { color: 'red', value: 80 }] }, unit: 'percent',
      }, overrides: [],
    },
  },
  table: {
    options: { cellHeight: 'sm', frameIndex: 0, showHeader: true, showTypeIcons: false, sortBy: [], enablePagination: false },
    fieldConfig: {
      defaults: { custom: { align: 'auto', cellOptions: { type: 'auto' }, filterable: false, inspect: false }, unit: 'percent' }, overrides: [],
    },
  },
  gauge: {
    options: {
      reduceOptions, orientation: 'auto', barShape: 'flat', barWidthFactor: 0.5, effects: {}, endpointMarker: 'point',
      minVizHeight: 75, minVizWidth: 75, segmentCount: 1, segmentSpacing: 0.3, shape: 'gauge',
      showThresholdLabels: false, showThresholdMarkers: true, sizing: 'auto', sparkline: true, textMode: 'auto',
    },
    fieldConfig: { defaults: { ...singleValueDefaults, min: 0, max: 100 }, overrides: [] },
  },
  bargauge: {
    options: {
      reduceOptions, orientation: 'auto', displayMode: 'gradient', maxVizHeight: 300, minVizHeight: 16, minVizWidth: 8,
      namePlacement: 'auto', showUnfilled: true, sizing: 'auto', valueMode: 'color', legend: { ...legend, showLegend: false },
    },
    fieldConfig: { defaults: { ...singleValueDefaults, min: 0, max: 100 }, overrides: [] },
  },
  piechart: {
    options: {
      reduceOptions, pieType: 'pie', sort: 'none', displayLabels: ['name', 'value'],
      legend: { ...legend, values: ['value'] }, tooltip,
    },
    fieldConfig: { defaults: { color: { mode: 'palette-classic' }, mappings: [], unit: 'percent', custom: { hideFrom } }, overrides: [] },
  },
  barchart: {
    options: {
      barRadius: 0, barWidth: 0.97, fullHighlight: false, groupWidth: 0.7, orientation: 'auto', showValue: 'auto',
      stacking: 'none', xTickLabelRotation: 0, xTickLabelSpacing: 0, xTickLabelMaxLength: 0, legend, tooltip,
    },
    fieldConfig: {
      defaults: {
        color: { mode: 'palette-classic' }, unit: 'percent', min: 0, max: 100,
        custom: { ...axis, fillOpacity: 80, gradientMode: 'none', lineWidth: 1, hideFrom, scaleDistribution: { type: 'linear' }, thresholdsStyle: { mode: 'off' } },
      }, overrides: [],
    },
  },
} as const;

export type Grafana13QueryPanelType = keyof typeof queryPanelProfiles;
export type Grafana13QueryPanelConfiguration<T extends Grafana13QueryPanelType> = (typeof queryPanelProfiles)[T];

const panelKeys = new Set(['datasource', 'fieldConfig', 'gridPos', 'id', 'options', 'pluginVersion', 'targets', 'title', 'transformations', 'type']);
const datasource = { type: 'grafana-testdata-datasource', uid: 'grsdk-testdata' } as const;
const pulseWave = { offCount: 5, offValue: 10, onCount: 5, onValue: 90, timeStep: 1 } as const;
const rename = [{ id: 'renameByRegex', options: { regex: '/Raw/', renamePattern: 'Signal' } }] as const;

export type Grafana13PanelProfileResult =
  | { readonly kind: 'supported'; readonly profile: 'text-markdown-view-v1'; readonly model: Grafana13TextPanelModel }
  | { readonly kind: 'supported'; readonly profile: 'predictable-pulse-view-v1'; readonly model: Grafana13QueryPanelModel }
  | { readonly kind: 'unsupported'; readonly diagnostics: readonly Grafana13PreflightDiagnostic[] };

const unsupported: Grafana13PanelProfileResult = Object.freeze({ kind: 'unsupported', diagnostics: Object.freeze([Object.freeze({
  code: 'panel.profile-unsupported', path: '$.panel', message: 'The panel is outside the verified view profile.',
})]) });

function object(value: unknown): value is Grafana13JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function safeString(value: unknown, limit: number, empty = false): value is string {
  return typeof value === 'string' && (empty || value.length > 0) && value.length <= limit && !/[\u0000-\u001f\u007f]/.test(value);
}

/** Inputs to this comparison are a bounded accessor-free clone and provider-owned literals. */
function equal(actual: unknown, expected: unknown): boolean {
  if (actual === expected) return true;
  if (Array.isArray(actual) || Array.isArray(expected)) {
    return Array.isArray(actual) && Array.isArray(expected) && actual.length === expected.length && actual.every((v, i) => equal(v, expected[i]));
  }
  if (!object(actual) || !object(expected)) return false;
  const keys = Object.keys(expected);
  return Object.keys(actual).length === keys.length && keys.every((key) => Object.hasOwn(actual, key) && equal(actual[key], expected[key]));
}

/** Validates a complete private profile, without granting active renderer support. */
export function classifyGrafana13PanelProfile(value: unknown): Grafana13PanelProfileResult {
  const cloned = cloneBoundedJson(value);
  if (!cloned.ok || !object(cloned.value)) return unsupported;
  const panel = cloned.value;
  if (!Object.keys(panel).every((key) => panelKeys.has(key)) || !Number.isSafeInteger(panel.id) || (panel.id as number) <= 0 ||
      !safeString(panel.title, 1024, true) || panel.pluginVersion !== '13.2.3') return unsupported;
  const grid = panel.gridPos;
  if (!object(grid) || Object.keys(grid).length !== 4 || !['x', 'y', 'w', 'h'].every((k) => Object.hasOwn(grid, k) && Number.isSafeInteger(grid[k]))) return unsupported;
  const { x, y, w, h } = grid as unknown as { x: number; y: number; w: number; h: number };
  if (x < 0 || y < 0 || w <= 0 || h <= 0 || x + w > 24 || !Number.isSafeInteger(y + h)) return unsupported;
  const identity = { id: panel.id as number, title: panel.title, pluginVersion: '13.2.3' as const };
  if (panel.type === 'text') {
    const options = panel.options;
    if (!object(options) || typeof options.content !== 'string' || options.content.length > 1_048_576 || !equal(options, {
      code: { language: 'plaintext', showLineNumbers: false, showMiniMap: false }, content: options.content, mode: 'markdown',
    }) || (panel.fieldConfig !== undefined && !equal(panel.fieldConfig, { defaults: {}, overrides: [] })) ||
        panel.datasource !== undefined || panel.targets !== undefined || panel.transformations !== undefined) return unsupported;
    const model: Grafana13TextPanelModel = Object.freeze({
      ...identity, type: 'text', options: Object.freeze({
        code: Object.freeze({ language: 'plaintext', showLineNumbers: false, showMiniMap: false }), content: options.content, mode: 'markdown',
      }), fieldConfig: Object.freeze({ defaults: Object.freeze({}), overrides: Object.freeze([]) }),
    });
    return Object.freeze({ kind: 'supported', profile: 'text-markdown-view-v1', model });
  }
  if (typeof panel.type !== 'string' || !Object.hasOwn(queryPanelProfiles, panel.type)) return unsupported;
  const type = panel.type as Grafana13QueryPanelType;
  const config = queryPanelProfiles[type];
  let fieldConfig = panel.fieldConfig;
  // Grafana's V1 DTO omits the JSON null representing the base (-Infinity)
  // threshold. Canonicalize only that exact omitted value, never later steps.
  if (['stat', 'timeseries', 'gauge', 'bargauge'].includes(type) && object(fieldConfig) && object(fieldConfig.defaults)) {
    const defaults = fieldConfig.defaults;
    const thresholds = defaults.thresholds;
    if (object(thresholds) && Array.isArray(thresholds.steps) && object(thresholds.steps[0]) && !Object.hasOwn(thresholds.steps[0], 'value')) {
      fieldConfig = Object.freeze({ ...fieldConfig, defaults: Object.freeze({ ...defaults, thresholds: Object.freeze({
        ...thresholds, steps: Object.freeze([Object.freeze({ ...thresholds.steps[0], value: null }), ...thresholds.steps.slice(1)]),
      }) }) });
    }
  }
  if (!equal(panel.options, config.options) || !equal(fieldConfig, config.fieldConfig) || !equal(panel.datasource, datasource) ||
      !Array.isArray(panel.targets) || panel.targets.length !== 1) return unsupported;
  const target = panel.targets[0];
  if (!object(target) || !isGrafana13PulseAlias(target.alias) || !equal(target, {
    alias: target.alias, datasource, refId: 'A', scenarioId: 'predictable_pulse', pulseWave,
  })) return unsupported;
  const transformations = panel.transformations === undefined ? [] : panel.transformations;
  if (!equal(transformations, []) && !(type === 'timeseries' && equal(transformations, rename))) return unsupported;
  // Every material value is verified above; all retained nested objects come from the frozen snapshot.
  const model = Object.freeze({
    ...identity, type, options: panel.options, fieldConfig,
    query: Object.freeze({ datasource: panel.datasource, targets: Object.freeze([Object.freeze({
      alias: target.alias, refId: 'A', scenarioId: 'predictable_pulse', pulseWave: target.pulseWave,
    })]) }), transformations: panel.transformations ?? Object.freeze([]),
  }) as Grafana13QueryPanelModel;
  return Object.freeze({ kind: 'supported', profile: 'predictable-pulse-view-v1', model });
}
