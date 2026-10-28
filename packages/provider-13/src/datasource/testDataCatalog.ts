import type { DataSourceApi, DataSourceInstanceSettings, DataSourceRef } from '@grafana/data';
import type { DataSourceSrv, TemplateSrv } from '@grafana/runtime';
import { defer, from, throwError } from 'rxjs';
import { GRAFANA_13_TESTDATA_TYPE, GRAFANA_13_TESTDATA_UID, Grafana13QueryRuntimeError, isGrafana13PulseTarget, type Grafana13TestDataConstructor } from './contracts';

export function createGrafana13TestDataCatalog(options: {
  readonly settings: DataSourceInstanceSettings;
  readonly templateSrv: TemplateSrv;
  readonly load: () => Promise<Grafana13TestDataConstructor>;
}): DataSourceSrv {
  const { settings, templateSrv, load } = options;
  if (settings.uid !== GRAFANA_13_TESTDATA_UID || settings.type !== GRAFANA_13_TESTDATA_TYPE) throw new Grafana13QueryRuntimeError('datasource-unsupported');
  let pending: Promise<DataSourceApi> | undefined;
  const matches = (ref: string | DataSourceRef | null | undefined): boolean => {
    try { return ref === GRAFANA_13_TESTDATA_UID || (typeof ref === 'object' && ref !== null && ref.uid === GRAFANA_13_TESTDATA_UID && (ref.type === undefined || ref.type === GRAFANA_13_TESTDATA_TYPE)); }
    catch { return false; }
  };
  return {
    get(ref) {
      if (!matches(ref)) return Promise.reject(new Grafana13QueryRuntimeError('datasource-unsupported'));
      if (!pending) pending = Promise.resolve().then(load).then(Constructor => {
        const instance = new Constructor(settings, templateSrv);
        const query = instance.query.bind(instance);
        instance.query = request => defer(() => {
          const visible = request.targets.filter(target => !target.hide);
          if (visible.length > 1 || !visible.every(isGrafana13PulseTarget)) return throwError(() => new Grafana13QueryRuntimeError('datasource-unsupported'));
          return from(query(request));
        });
        return instance;
      }).catch(() => {
        pending = undefined; throw new Grafana13QueryRuntimeError('datasource-module-load-failed');
      });
      return pending;
    },
    getInstanceSettings: ref => matches(ref) ? settings : undefined,
    getList: () => [settings],
    registerRuntimeDataSource() { throw new Grafana13QueryRuntimeError('datasource-unsupported'); },
    reload: async () => { throw new Grafana13QueryRuntimeError('datasource-unsupported'); },
  };
}
