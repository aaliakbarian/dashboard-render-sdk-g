import type { DataSourceInstanceSettings } from '@grafana/data';
import { describe, expect, it } from 'vitest';
import { lastValueFrom, of } from 'rxjs';
import { createGrafana13TestDataCatalog } from './testDataCatalog';
import { createGrafana13TemplateSrv } from '../runtime/templateSrv';

const settings = { uid: 'grsdk-testdata', type: 'grafana-testdata-datasource', name: 'TestData' } as DataSourceInstanceSettings;
describe('closed TestData catalogue', () => {
  it('blocks dormant upstream scenario branches even if the datasource is queried directly', async () => {
    let calls = 0;
    class Source { query() { calls++; return of({ data: [] }); } }
    const service = createGrafana13TestDataCatalog({ settings, templateSrv: createGrafana13TemplateSrv(), load: async () => Source as never });
    const datasource = await service.get(settings.uid);
    await expect(lastValueFrom(datasource.query({ targets: [{ refId: 'A', scenarioId: 'grafana_api' }] } as never) as any)).rejects.toMatchObject({ code: 'datasource-unsupported' });
    expect(calls).toBe(0);
  });
  it('loads lazily, coalesces concurrent construction and retries a sanitized rejection', async () => {
    let loads = 0; let constructions = 0;
    class Source { constructor() { constructions++; } query() { return Promise.resolve({ data: [] }); } }
    const service = createGrafana13TestDataCatalog({ settings, templateSrv: createGrafana13TemplateSrv(),
      load: async () => { if (++loads === 1) throw new Error('private'); return Source as never; } });
    expect(loads).toBe(0);
    const [a, b] = await Promise.allSettled([service.get(settings.uid), service.get(settings.uid)]);
    expect(a.status).toBe('rejected'); expect(b.status).toBe('rejected');
    if (a.status === 'rejected') { expect(a.reason.code).toBe('datasource-module-load-failed'); expect(a.reason).not.toHaveProperty('cause'); expect(String(a.reason)).not.toContain('private'); }
    const [first, second] = await Promise.all([service.get(settings.uid), service.get({ uid: settings.uid, type: settings.type })]);
    expect(first).toBe(second); expect(loads).toBe(2); expect(constructions).toBe(1);
    expect(service.getInstanceSettings(settings.uid)).toBe(settings);
    expect(() => service.registerRuntimeDataSource({} as never)).toThrow();
  });
  it.each([undefined, null, '', 'other', { type: settings.type }, { uid: settings.uid, type: 'prometheus' }])('rejects nonexplicit or foreign identity %j before loading', async ref => {
    let loads = 0;
    const service = createGrafana13TestDataCatalog({ settings, templateSrv: createGrafana13TemplateSrv(), load: async () => { loads++; throw new Error(); } });
    await expect(service.get(ref)).rejects.toMatchObject({ code: 'datasource-unsupported' });
    expect(service.getInstanceSettings(ref)).toBeUndefined(); expect(loads).toBe(0);
  });
});
