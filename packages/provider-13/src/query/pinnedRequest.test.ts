import { chromium } from 'playwright';
import { createServer } from 'vite';
import { describe, expect, it } from 'vitest';

describe('pinned Grafana 13.2.3 backend request profile', () => {
  it('emits the approved URL, headers and pulse body', async () => {
    const server = await createServer({ configFile: false, appType: 'custom',
      cacheDir: '/tmp/provider13-pinned-request-vite',
      optimizeDeps: { entries: [], include: ['@grafana/runtime'] },
      server: { host: '127.0.0.1', port: 0 },
    });
    server.middlewares.use('/probe', (_request, response) => {
      response.setHeader('Content-Type', 'text/html'); response.end('<html><body></body></html>');
    });
    let browser;
    try {
    await server.listen();
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    const address = server.httpServer!.address();
    if (!address || typeof address === 'string') throw new Error('Missing probe port.');
    await page.goto(`http://127.0.0.1:${address.port}/probe`);
    const request: any = await page.evaluate(`(async () => {
    const { installGrafana13BootPrelude } = await import('/packages/provider-13/src/runtime/bootPrelude.ts');
    installGrafana13BootPrelude({ basePath: '/', locale: 'en-US', namespace: 'default', theme: 'light', timezone: 'browser' }, window);
    const { DataSourceWithBackend } = await import('/@fs/tmp/provider13-pinned-request-vite/deps/@grafana_runtime.js');
    const ds = new DataSourceWithBackend({ uid: 'grsdk-testdata', type: 'grafana-testdata-datasource', id: 1, name: 'TestData', jsonData: {}, meta: {} });
    const [request] = await ds.createBackendRequest({ requestId: 'drsdk-1-A', intervalMs: 1000, maxDataPoints: 300,
      dashboardUID: 'fixture', panelId: 2, scopedVars: {},
      range: { from: { valueOf: () => 1700000000000 }, to: { valueOf: () => 1700000060000 } },
      targets: [{ refId: 'A', scenarioId: 'predictable_pulse', alias: 'Raw Signal',
        pulseWave: { offCount: 5, offValue: 10, onCount: 5, onValue: 90, timeStep: 1 } }],
    });
    return JSON.parse(JSON.stringify(request));
    })()`);
    expect(request.url).toBe('/api/ds/query?ds_type=grafana-testdata-datasource&requestId=drsdk-1-A');
    expect(request.method).toBe('POST');
    expect(request.headers).toEqual({ 'X-Plugin-Id': 'grafana-testdata-datasource', 'X-Datasource-Uid': 'grsdk-testdata', 'X-Dashboard-Uid': 'fixture', 'X-Panel-Id': '2' });
    expect(request.data).toEqual({ queries: [{ refId: 'A', scenarioId: 'predictable_pulse', alias: 'Raw Signal',
      pulseWave: { offCount: 5, offValue: 10, onCount: 5, onValue: 90, timeStep: 1 },
      datasource: { type: 'grafana-testdata-datasource', uid: 'grsdk-testdata' }, datasourceId: 1,
      intervalMs: 1000, maxDataPoints: 300 }], from: '1700000000000', to: '1700000060000' });
    } finally { await browser?.close(); await server.close(); }
  }, 60_000);
});
