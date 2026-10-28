import { describe, expect, it } from 'vitest';
import { selectGrafana13TestDataSettings } from './loadFrontendSettings';

const raw = { uid: 'grsdk-testdata', type: 'grafana-testdata-datasource', id: 1,
  name: 'TestData', access: 'proxy', url: '', jsonData: {}, meta: { id: 'grafana-testdata-datasource' } };
describe('closed frontend settings selection', () => {
  it('normalizes only the fixture-generated proxy URL to an inert empty URL', () => {
    expect(selectGrafana13TestDataSettings({ datasources: { fixture: { ...raw, url: '/api/datasources/proxy/uid/grsdk-testdata' } } }).url).toBe('');
  });
  it('projects only inert controlled settings and drops all secrets and unrelated data', () => {
    const settings = selectGrafana13TestDataSettings({ datasources: { fixture: { ...raw,
      password: 'private', jsonData: { token: 'private' } }, other: { uid: 'other' } } });
    expect(settings).toMatchObject({ uid: raw.uid, type: raw.type, id: 1, name: 'TestData', jsonData: {}, withCredentials: false, url: '' });
    expect(JSON.stringify(settings)).not.toMatch(/private|password|token/);
    expect(Object.isFrozen(settings)).toBe(true);
  });
  it.each([
    null, { datasources: [] }, { datasources: {} },
    { datasources: { fixture: { ...raw, uid: 'other' } } },
    ...[{ type: 'prometheus' }, { name: '' }, { id: -1 }, { access: 'direct' }, { url: 'https://evil.test' }, { meta: { id: 'other' } }]
      .map(change => ({ datasources: { fixture: { ...raw, ...change } } })),
    { datasources: { a: raw, b: raw } },
  ])('rejects missing, mismatched or malformed settings %j', payload => {
    expect(() => selectGrafana13TestDataSettings(payload)).toThrow('controlled TestData');
  });
  it('never invokes a payload accessor', () => {
    let reads = 0;
    expect(() => selectGrafana13TestDataSettings({ get datasources() { reads++; return {}; } })).toThrow();
    expect(reads).toBe(0);
  });
});
