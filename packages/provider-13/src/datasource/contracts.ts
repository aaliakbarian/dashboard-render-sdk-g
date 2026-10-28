import type { DataQuery, DataSourceApi, DataSourceInstanceSettings } from '@grafana/data';
import type { TemplateSrv } from '@grafana/runtime';
import { cloneBoundedJson } from '../dashboardApi';
import { isGrafana13PulseAlias } from '../pulseAlias';

export const GRAFANA_13_TESTDATA_UID = 'grsdk-testdata' as const;
export const GRAFANA_13_TESTDATA_TYPE = 'grafana-testdata-datasource' as const;
export function isQueryRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
export type Grafana13TestDataConstructor = new (settings: DataSourceInstanceSettings, templateSrv: TemplateSrv) => DataSourceApi;
export class Grafana13QueryRuntimeError extends Error {
  override readonly name = 'Grafana13QueryRuntimeError';
  constructor(readonly code: 'datasource-unsupported' | 'datasource-module-load-failed' | 'frontend-settings-malformed' | 'query-runtime-initialization-failed' | 'template-unsupported',
    readonly phase?: 'cohort' | 'identity' | 'logger' | 'template' | 'settings' | 'datasource' | 'registration' | 'runner' | 'registries') {
    super('The controlled TestData runtime request is unavailable.');
  }
}

export function isGrafana13PulseTarget(target: DataQuery): boolean {
  const cloned = cloneBoundedJson(target);
  if (!cloned.ok || !isQueryRecord(cloned.value)) return false;
  const t = cloned.value;
  if (Object.keys(t).some(key => !['refId', 'scenarioId', 'alias', 'pulseWave', 'datasource', 'hide'].includes(key))) return false;
  if (t.refId !== 'A' || t.scenarioId !== 'predictable_pulse' || !isGrafana13PulseAlias(t.alias)) return false;
  if (t.hide !== undefined && t.hide !== false) return false;
  if (t.datasource !== undefined) {
    const d = t.datasource;
    if (!isQueryRecord(d) || Object.keys(d).length !== 2 || d.type !== GRAFANA_13_TESTDATA_TYPE || d.uid !== GRAFANA_13_TESTDATA_UID) return false;
  }
  const pulse = t.pulseWave;
  return isQueryRecord(pulse) && Object.keys(pulse).length === 5 &&
    pulse.offCount === 5 && pulse.offValue === 10 && pulse.onCount === 5 && pulse.onValue === 90 && pulse.timeStep === 1;
}
