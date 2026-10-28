import { expect, it } from 'vitest';
import { createServer } from 'vite';
import { chromium } from 'playwright';

it('the pinned Grafana decoder preserves field order, labels, empty labels, values and metadata', async () => {
  const server = await createServer({ configFile: false, appType: 'custom', cacheDir: '/tmp/provider13-decoder-vite',
    optimizeDeps: { entries: [], include: ['@grafana/data'] }, server: { host: '127.0.0.1', port: 0 } });
  server.middlewares.use('/probe', (_request, response) => { response.setHeader('Content-Type', 'text/html'); response.end('<html></html>'); });
  let browser;
  try {
  await server.listen(); browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const address = server.httpServer!.address(); if (!address || typeof address === 'string') throw new Error('Missing decoder port.');
  await page.goto(`http://127.0.0.1:${address.port}/probe`);
  const frame: any = await page.evaluate(`(async () => {
  const { dataFrameFromJSON } = await import('/@fs/tmp/provider13-decoder-vite/deps/@grafana_data.js');
  const frame = dataFrameFromJSON({ schema: { refId: 'A', name: 'labeled-pulse',
    meta: { type: 'timeseries-wide', custom: { source: 'synthetic-decoder-contract' }, executedQueryString: 'controlled' },
    fields: [
      { name: 'Time', type: 'time', typeInfo: { frame: 'time.Time' }, config: { interval: 1000 } },
      { name: 'Pulse', type: 'number', labels: { region: 'test', instance: 'one' }, config: { unit: 'percent', displayNameFromDS: 'Pulse label' } },
      { name: 'Empty labels', type: 'number', labels: {}, config: {} },
    ] }, data: { values: [[1700000000000, 1700000001000], [10, 90], [90, 10]] } });
  return frame;
  })()`);
  expect(frame.refId).toBe('A'); expect(frame.name).toBe('labeled-pulse'); expect(frame.length).toBe(2);
  expect(frame.fields.map((f: any) => [f.name, f.type, f.values])).toEqual([
    ['Time', 'time', [1700000000000, 1700000001000]], ['Pulse', 'number', [10, 90]], ['Empty labels', 'number', [90, 10]],
  ]);
  expect(frame.fields[0].labels).toBeUndefined();
  expect(frame.fields[1].labels).toEqual({ region: 'test', instance: 'one' });
  expect(frame.fields[2].labels).toEqual({});
  expect(frame.fields[0].config).toEqual({ interval: 1000 });
  expect(frame.fields[1].config).toEqual({ unit: 'percent', displayNameFromDS: 'Pulse label' });
  expect(frame.meta).toEqual({ type: 'timeseries-wide', custom: { source: 'synthetic-decoder-contract' }, executedQueryString: 'controlled' });
  } finally { await browser?.close(); await server.close(); }
}, 60_000);
