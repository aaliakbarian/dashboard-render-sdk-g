import type { DataQueryRequest, DataQueryResponse, DataSourceInstanceSettings } from '@grafana/data';
import type { TemplateSrv } from '@grafana/runtime';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { createPocTemplateSrv } from '../events/installTemplateSrv';
import {
  createPocDataSourceSrv,
  type PocDataSourceConstructor,
} from './pocDataSourceSrv';

const settings = {
  access: 'proxy',
  id: 7,
  isDefault: true,
  jsonData: {},
  meta: { id: 'grafana-testdata-datasource', metrics: true },
  name: 'Dashboard Render SDK G POC TestData',
  readOnly: true,
  type: 'grafana-testdata-datasource',
  uid: 'grsdk-testdata',
} as DataSourceInstanceSettings;

class FakeDataSource {
  static constructions = 0;
  readonly templateSrv: TemplateSrv | undefined;

  constructor(_instanceSettings: DataSourceInstanceSettings, templateSrv?: TemplateSrv) {
    FakeDataSource.constructions += 1;
    this.templateSrv = templateSrv;
  }

  query(_request: DataQueryRequest) {
    return of<DataQueryResponse>({ data: [] });
  }

  testDatasource() {
    return Promise.resolve({ message: 'ok', status: 'success' });
  }
}

describe('Task 10 fixed datasource service', () => {
  it('loads once, caches one instance, and resolves only the fixed UID/default', async () => {
    FakeDataSource.constructions = 0;
    const templateSrv = createPocTemplateSrv();
    const loadDataSourceClass = vi.fn(
      async () => FakeDataSource as unknown as PocDataSourceConstructor
    );
    const service = createPocDataSourceSrv({ loadDataSourceClass, settings, templateSrv });

    const first = await service.get('grsdk-testdata');
    const second = await service.get({ type: settings.type, uid: settings.uid });
    const implicit = await service.get();

    expect(first).toBe(second);
    expect(implicit).toBe(first);
    expect(loadDataSourceClass).toHaveBeenCalledOnce();
    expect(FakeDataSource.constructions).toBe(1);
    expect((first as unknown as FakeDataSource).templateSrv).toBe(templateSrv);
    expect(service.getInstanceSettings('grsdk-testdata')).toBe(settings);
    expect(service.getList({ metrics: true })).toEqual([settings]);
  });

  it.each([
    ['unknown UID', 'other', 'datasource-not-found'],
    ['unsupported type', { type: 'prometheus', uid: 'grsdk-testdata' }, 'datasource-type-unsupported'],
  ])('rejects %s', async (_name, ref, code) => {
    const service = createPocDataSourceSrv({
      loadDataSourceClass: async () => FakeDataSource as unknown as PocDataSourceConstructor,
      settings,
      templateSrv: createPocTemplateSrv(),
    });

    await expect(service.get(ref)).rejects.toMatchObject({ code });
    expect(service.getInstanceSettings(ref)).toBeUndefined();
  });

  it('classifies a frontend module load failure and allows no runtime registrations', async () => {
    const service = createPocDataSourceSrv({
      loadDataSourceClass: async () => {
        throw new Error('private source failure');
      },
      settings,
      templateSrv: createPocTemplateSrv(),
    });

    await expect(service.get(settings.uid)).rejects.toMatchObject({
      code: 'datasource-module-load-failed',
    });
    expect(() => service.registerRuntimeDataSource({} as never)).toThrow(/not permitted/i);
  });
});
