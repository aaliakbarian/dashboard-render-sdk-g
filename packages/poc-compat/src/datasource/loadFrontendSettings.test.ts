import type { BackendSrv } from '@grafana/runtime';
import { describe, expect, it, vi } from 'vitest';

import { loadPocTestDataSettings } from './loadFrontendSettings';

function backendWith(payload: unknown): BackendSrv {
  return { get: vi.fn(async () => payload) } as unknown as BackendSrv;
}

const rawSettings = {
  access: 'proxy',
  id: 7,
  isDefault: true,
  jsonData: { keep: 'safe' },
  meta: { builtIn: true, id: 'grafana-testdata-datasource', metrics: true },
  name: 'Dashboard Render SDK G POC TestData',
  readOnly: true,
  type: 'grafana-testdata-datasource',
  uid: 'grsdk-testdata',
  url: '',
};

describe('Task 10 frontend datasource settings', () => {
  it('selects and sanitizes only the controlled UID and type', async () => {
    const backend = backendWith({
      datasources: {
        'Dashboard Render SDK G POC TestData': {
          ...rawSettings,
          password: 'must-not-survive',
          secureJsonFields: { token: true },
        },
        Other: { ...rawSettings, name: 'Other', uid: 'other' },
      },
      defaultDatasource: rawSettings.name,
    });

    const settings = await loadPocTestDataSettings(backend);

    expect(settings).toMatchObject(rawSettings);
    expect(JSON.stringify(settings)).not.toMatch(/password|secureJsonFields|token/i);
    expect(backend.get).toHaveBeenCalledWith('/api/frontend/settings');
  });

  it.each([
    ['missing UID', { datasources: {}, defaultDatasource: '' }, 'datasource-not-found'],
    [
      'wrong type',
      {
        datasources: { Fixture: { ...rawSettings, type: 'prometheus' } },
        defaultDatasource: rawSettings.name,
      },
      'datasource-type-unsupported',
    ],
    ['malformed response', { datasources: [] }, 'frontend-settings-malformed'],
  ])('classifies %s', async (_name, payload, code) => {
    await expect(loadPocTestDataSettings(backendWith(payload))).rejects.toMatchObject({ code });
  });
});
