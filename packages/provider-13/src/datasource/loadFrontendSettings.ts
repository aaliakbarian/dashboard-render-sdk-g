import type { DataSourceInstanceSettings } from '@grafana/data';
import type { BackendSrv } from '@grafana/runtime';
import { cloneBoundedJson } from '../dashboardApi';
import { GRAFANA_13_TESTDATA_TYPE, GRAFANA_13_TESTDATA_UID, Grafana13QueryRuntimeError, isQueryRecord } from './contracts';

export function selectGrafana13TestDataSettings(payload: unknown): DataSourceInstanceSettings {
  const fail = (): never => { throw new Grafana13QueryRuntimeError('frontend-settings-malformed'); };
  const cloned = cloneBoundedJson(payload);
  if (!cloned.ok) return fail();
  const root = cloned.value;
  if (!isQueryRecord(root)) return fail();
  const sources = root.datasources;
  if (!isQueryRecord(sources)) return fail();
  const matches = Object.values(sources).filter(s => isQueryRecord(s) && s.uid === GRAFANA_13_TESTDATA_UID);
  if (matches.length !== 1) return fail();
  const s = matches[0];
  if (!isQueryRecord(s)) return fail();
  const meta = s.meta;
  if (s.type !== GRAFANA_13_TESTDATA_TYPE || typeof s.name !== 'string' || !/^[\x20-\x7e]{1,256}$/.test(s.name) ||
      (s.id !== undefined && (typeof s.id !== 'number' || !Number.isSafeInteger(s.id) || s.id <= 0 || s.id > 2147483647)) ||
      s.access !== 'proxy' || (s.url !== undefined && s.url !== '' && s.url !== '/api/datasources/proxy/uid/grsdk-testdata') ||
      !isQueryRecord(meta) || meta.id !== GRAFANA_13_TESTDATA_TYPE) return fail();
  return Object.freeze({
    ...(typeof s.id === 'number' ? { id: s.id } : {}), access: 'proxy', uid: GRAFANA_13_TESTDATA_UID,
    type: GRAFANA_13_TESTDATA_TYPE, name: s.name, url: '', withCredentials: false,
    isDefault: s.isDefault === true, readOnly: true, jsonData: Object.freeze({}),
    meta: Object.freeze({ id: GRAFANA_13_TESTDATA_TYPE, name: 'TestData', type: 'datasource', metrics: true, builtIn: true, backend: true }),
  }) as DataSourceInstanceSettings;
}

export async function loadGrafana13TestDataSettings(backend: BackendSrv): Promise<DataSourceInstanceSettings> {
  return selectGrafana13TestDataSettings(await backend.get('/api/frontend/settings'));
}
