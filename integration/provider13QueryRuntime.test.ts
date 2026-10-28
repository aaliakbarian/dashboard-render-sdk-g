import { chromium } from 'playwright';
import { build, createServer, loadConfigFromFile } from 'vite';
import { mkdtempSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';

const username = process.env.POC_GRAFANA_VERIFY_USER;
const password = process.env.POC_GRAFANA_VERIFY_PASSWORD;

describe.skipIf(!username || !password)('provider-13 actual TestData runtime', () => {
  it('lazily acquires one runtime and decodes the real fixture query into exact pulse frames', async () => {
    const loaded = await loadConfigFromFile({ command: 'serve', mode: 'test' }, 'packages/provider-13/vite.config.ts');
    if (!loaded) throw new Error('Missing pinned provider configuration.');
    const outDir = mkdtempSync(join(tmpdir(), 'provider13-query-integration-'));
    const allowedPlugins = ['provider-13-runtime-view-only-barrels', 'provider-13-query-runtime-imports', 'provider-13-native-renderer-only-imports', 'provider-13-text-renderer-only-imports', 'provider-13-forbidden-grafana-imports', 'provider-13-pinned-grafana-source'];
    await build({ ...loaded.config, configFile: false,
      plugins: loaded.config.plugins?.flat(Infinity).filter((plugin: any) => allowedPlugins.includes(plugin?.name)) as any,
      build: { outDir, emptyOutDir: false, minify: false, rollupOptions: { input: resolve('integration/provider13QueryRuntime.browser.ts'), output: { entryFileNames: 'probe.js' }, preserveEntrySignatures: 'strict' } },
    });
    const server = await createServer({ configFile: false, root: outDir, appType: 'custom',
      cacheDir: '/tmp/provider13-query-integration-vite',
      optimizeDeps: { noDiscovery: true, entries: [] },
      server: { host: '127.0.0.1', port: 0, proxy: { '/grafana': {
        target: 'http://grafana:3000', changeOrigin: false, rewrite: path => path.replace(/^\/grafana/, ''),
        configure(proxy) { proxy.on('proxyReq', proxyRequest => proxyRequest.setHeader('Authorization', `Basic ${btoa(`${username!}:${password!}`)}`)); },
      } } },
    });
    server.middlewares.use('/query-probe', (_request, response) => {
      response.setHeader('Content-Type', 'text/html'); response.end('<html><body></body></html>');
    });
    let browser;
    try {
      await server.listen(); browser = await chromium.launch({ headless: true });
      const page = await browser.newPage();
      const errors: string[] = []; page.on('pageerror', () => errors.push('page-error'));
      const address = server.httpServer!.address();
      if (!address || typeof address === 'string') throw new Error('Missing integration port.');
      await page.goto(`http://127.0.0.1:${address.port}/query-probe`);
      const result: any = await page.evaluate(`(async () => {
        const { initializeGrafana13Runtime, installGrafana13QueryRuntime, createGrafana13TextPanelCatalog, createSdkHostBrowserExecutor, createHostTransportCapability, grafana13Provider, queryServices, of, lastValueFrom, tap } = await import('/probe.js');
        const paths = [];
        let held;
        const wireCases = [
          { id: 'drsdk-legacy-series-A', result: { frames: [], series: [null] } },
          { id: 'drsdk-legacy-tables-A', result: { frames: [], tables: [null] } },
          { id: 'drsdk-cached-notices-A', result: { frames: [{ schema: { meta: { notices: 1 }, fields: [{ name: 'Value', type: 'number' }] }, data: { values: [[1]] } }] }, cached: true },
          { id: 'drsdk-empty-A', result: { frames: [] } },
        ];
        const execute = createSdkHostBrowserExecutor(location.origin, async (input, init) => {
          paths.push(input);
          if (input.includes('drsdk-held-A')) return new Promise(resolve => { held = { init, resolve }; });
          const wireCase = wireCases.find(test => input.includes(test.id));
          if (wireCase) return Promise.resolve(new Response(JSON.stringify({ results: { A: wireCase.result } }),
            { headers: { 'content-type': 'application/json', ...(wireCase.cached ? { 'X-Cache': 'HIT' } : {}) } }));
          if (input.includes('drsdk-malformed-A')) return Promise.resolve(new Response(JSON.stringify({ results: { A: { frames: [{
            schema: { fields: [{ name: 'Value', type: 'number' }] }, data: { values: [[1]], entities: [{ NaN: 1 }] },
          }] } } }), { headers: { 'content-type': 'application/json' } }));
          return fetch(input, init);
        });
        const capability = createHostTransportCapability({ basePath: '/grafana', schemaVersion: 1,
          requestPolicyId: 'query-fixture', securityScopeId: 'fixture', targetOrigin: location.origin }, execute);
        if (!capability.valid) throw new Error('Invalid fixture capability');
        let failRegistry = true; let nativeRegistrations = 0;
        const retryCohort = { ...queryServices,
          registerRuntimeDataSourceInstance(entry) { nativeRegistrations++; queryServices.registerRuntimeDataSourceInstance(entry); },
          transformerRegistry: { setInit(init) { if (failRegistry) throw new Error('controlled late installer failure'); queryServices.transformerRegistry.setInit(init); } },
        };
        const runtime = await initializeGrafana13Runtime({ transport: capability.capability, namespace: 'default',
          providerId: grafana13Provider.manifest.provider.id, providerBuildId: grafana13Provider.manifest.provider.buildId,
          providerManifest: grafana13Provider.manifest }, { panelCatalog: createGrafana13TextPanelCatalog({}), window,
            loadQueryRuntime: options => installGrafana13QueryRuntime({ ...options, loadCohort: async () => retryCohort }),
          });
        const before = [...paths];
        const failedFirst = runtime.acquireQueryRuntime(); const failedSecond = runtime.acquireQueryRuntime();
        const failed = await Promise.all([failedFirst, failedSecond]).then(() => false, () => true);
        const retained = { templateSrv: queryServices.runtime.getTemplateSrv(), dataSourceSrv: queryServices.runtime.getDataSourceSrv(), runRequest: queryServices.runtime.getRunRequest() };
        failRegistry = false;
        const first = runtime.acquireQueryRuntime(); const second = runtime.acquireQueryRuntime();
        const [query, same] = await Promise.all([first, second]).catch(error => { throw new Error('query-init-' + error.phase); });
        const retainedIdentities = query.templateSrv === retained.templateSrv && query.dataSourceSrv === retained.dataSourceSrv && query.runRequest === retained.runRequest;
        const fixture = await runtime.backendSrv.get('/apis/dashboard.grafana.app/v1/namespaces/default/dashboards/drsdk-g-phase2-visualizations/dto');
        const panel = fixture.spec.panels.find(panel => panel.type === 'stat');
        const targets = panel.targets.map(({ datasource, ...target }) => target);
        const request = { requestId: 'drsdk-fixture-A', dashboardUID: 'drsdk-g-phase2-visualizations', panelId: panel.id,
          targets, range: { from: new Date(1700000000000), to: new Date(1700000060000) },
          interval: '1s', intervalMs: 1000, maxDataPoints: 300, scopedVars: {}, startTime: Date.now(), timezone: 'browser', app: 'dashboard' };
        let decodedFrame;
        const packets = await new Promise((resolve, reject) => {
          const packets = []; query.runRequest(query.datasource, request, nextRequest => query.datasource.query(nextRequest).pipe(tap(packet => { decodedFrame = packet.data[0]; })))
            .subscribe({ next: packet => packets.push(packet), error: () => reject(new Error('query failed')), complete: () => resolve(packets) });
        });
        const last = packets.at(-1);
        const fields = queryServices.fieldRegistry.list().map(item => item.id).sort();
        const transformations = queryServices.transformerRegistry.list().map(item => item.id);
        const operator = await queryServices.transformerRegistry.get('renameByRegex').transformation();
        const transformed = await lastValueFrom(operator.operator({ regex: '/Raw/', renamePattern: 'Signal' })(of(last.series)));
        const malformed = [];
        await new Promise(resolve => query.runRequest(query.datasource, { ...request, requestId: 'drsdk-malformed-A' })
          .subscribe({ next: packet => malformed.push(packet), complete: resolve }));
        const wireResults = [];
        for (const test of wireCases) {
          const packets = [];
          await new Promise(resolve => query.runRequest(query.datasource, { ...request, requestId: test.id })
            .subscribe({ next: packet => packets.push(packet), complete: resolve }));
          wireResults.push({ id: test.id, states: packets.map(packet => packet.state),
            error: packets.at(-1).error ?? null, seriesLength: packets.at(-1).series.length });
        }
        const heldStates = [];
        const subscription = query.runRequest(query.datasource, { ...request, requestId: 'drsdk-held-A' }).subscribe(packet => heldStates.push(packet.state));
        for (let i = 0; i < 100 && !held; i++) await new Promise(resolve => setTimeout(resolve, 0));
        if (!held) throw new Error('Held query did not reach transport');
        subscription.unsubscribe();
        const aborted = held.init.signal.aborted;
        held.resolve(new Response('{"results":{"A":{"frames":[]}}}', { headers: { 'content-type': 'application/json' } }));
        await new Promise(resolve => setTimeout(resolve, 0));
        return { before, coalesced: first === second && query === same, states: packets.map(p => p.state), paths,
          retried: failed && failedFirst === failedSecond && retainedIdentities, nativeRegistrations,
          malformedStates: malformed.map(packet => packet.state), malformedError: malformed.at(-1).error,
          wireResults,
          decodedIdentity: last.series[0] === decodedFrame, fields, transformations,
          transformedName: transformed[0].fields[1].config.displayName, aborted, heldStates,
          requestIdentity: packets.every(p => p.request === request),
          series: last.series.map(frame => ({ refId: frame.refId, name: frame.name, length: frame.length, meta: frame.meta ?? null,
            fields: frame.fields.map(field => ({ name: field.name, type: field.type, values: Array.from(field.values), labels: field.labels ?? null, config: field.config })) })) };
      })()`);
      expect(result.before).toEqual([]); expect(result.coalesced).toBe(true); expect(result.requestIdentity).toBe(true);
      expect(result.retried).toBe(true); expect(result.nativeRegistrations).toBe(1);
      expect(result.malformedStates).toEqual(['Loading', 'Error']);
      expect(result.malformedError).toEqual({ message: 'The controlled datasource query failed.' });
      expect(result.wireResults).toEqual([
        { id: 'drsdk-legacy-series-A', states: ['Loading', 'Error'], error: { message: 'The controlled datasource query failed.' }, seriesLength: 0 },
        { id: 'drsdk-legacy-tables-A', states: ['Loading', 'Error'], error: { message: 'The controlled datasource query failed.' }, seriesLength: 0 },
        { id: 'drsdk-cached-notices-A', states: ['Loading', 'Error'], error: { message: 'The controlled datasource query failed.' }, seriesLength: 0 },
        { id: 'drsdk-empty-A', states: ['Loading', 'Done'], error: null, seriesLength: 0 },
      ]);
      expect(result.decodedIdentity).toBe(true);
      expect(result.fields).toEqual(['color', 'mappings', 'max', 'min', 'thresholds', 'unit']);
      expect(result.transformations).toEqual(['renameByRegex']);
      expect(result.transformedName).toBe('Phase 2 Pulse Signal');
      expect(result.aborted).toBe(true); expect(result.heldStates).toEqual(['Loading']);
      expect(result.states).toEqual(['Loading', 'Done']); expect(result.series).toHaveLength(1);
      const frame = result.series[0];
      expect(frame.refId).toBe('A'); expect(frame.name).toBe('Phase 2 Pulse Raw');
      expect(frame.fields.map((field: any) => [field.name, field.type])).toEqual([['Time', 'time'], ['Value', 'number']]);
      expect(frame.length).toBe(60); expect(frame.fields[0].values).toHaveLength(frame.length); expect(frame.fields[1].values).toHaveLength(frame.length);
      const times = frame.fields[0].values as number[];
      expect(times.every((value, i) => Number.isFinite(value) && (i === 0 || value > times[i - 1]!))).toBe(true);
      expect(times[0]).toBe(1700000000000); expect(times.at(-1)).toBe(1700000059000);
      expect(times.slice(1).every((value, index) => value - times[index]! === 1000)).toBe(true);
      expect(frame.fields[1].values).toEqual(Array.from({ length: 6 }, () => [90, 90, 90, 90, 90, 10, 10, 10, 10, 10]).flat());
      expect(frame.fields.map((field: any) => field.labels)).toEqual([null, {}]);
      expect(frame.meta).toEqual({ type: 'timeseries-multi', typeVersion: [0, 0] });
      expect(frame.fields.map((field: any) => field.config)).toEqual([{}, {}]);
      expect(result.paths.filter((path: string) => path.includes('/api/frontend/settings'))).toHaveLength(1);
      expect(result.paths.filter((path: string) => path.includes('/api/ds/query'))).toEqual([
        '/grafana/api/ds/query?ds_type=grafana-testdata-datasource&requestId=drsdk-fixture-A',
        '/grafana/api/ds/query?ds_type=grafana-testdata-datasource&requestId=drsdk-malformed-A',
        '/grafana/api/ds/query?ds_type=grafana-testdata-datasource&requestId=drsdk-legacy-series-A',
        '/grafana/api/ds/query?ds_type=grafana-testdata-datasource&requestId=drsdk-legacy-tables-A',
        '/grafana/api/ds/query?ds_type=grafana-testdata-datasource&requestId=drsdk-cached-notices-A',
        '/grafana/api/ds/query?ds_type=grafana-testdata-datasource&requestId=drsdk-empty-A',
        '/grafana/api/ds/query?ds_type=grafana-testdata-datasource&requestId=drsdk-held-A',
      ]);
      expect(errors).toEqual([]);
    } finally { await browser?.close(); await server.close(); }
  }, 60_000);
});
