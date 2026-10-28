import { chromium } from 'playwright';
import { createServer } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

let browser: Awaited<ReturnType<typeof chromium.launch>>;
let page: Awaited<ReturnType<typeof browser.newPage>>;
let server: Awaited<ReturnType<typeof createServer>>;

beforeAll(async () => {
  server = await createServer({
    appType: 'custom', cacheDir: '/tmp/provider13-renderer-vite-cache', configFile: false,
    optimizeDeps: { entries: [], include: ['react', 'react-dom', 'react-dom/client'] },
    server: { host: '127.0.0.1', port: 5198 },
  });
  server.middlewares.use('/provider-renderer-test', (_request, response) => {
    response.setHeader('Content-Type', 'text/html');
    response.end('<html><body></body></html>');
  });
  await server.listen();
  browser = await chromium.launch({ headless: true });
  page = await browser.newPage();
  const address = server.httpServer!.address();
  if (!address || typeof address === 'string') throw new Error('Missing test server port.');
  await page.goto(`http://127.0.0.1:${address.port}/provider-renderer-test`);
}, 30_000);

afterAll(async () => {
  await browser?.close();
  await server?.close();
});

async function exercise<T>(name: string, argument?: string): Promise<T> {
  return page.evaluate(`(async () => {
    const fixture = await import('/packages/provider-13/src/react/Grafana13DashboardRenderer.browser.test.tsx');
    return fixture[${JSON.stringify(name)}](${argument === undefined ? '' : JSON.stringify(argument)});
  })()`);
}

describe('Grafana13DashboardRenderer lifecycle', () => {
  it('maps loading, unsupported, operational error and ready states deterministically', async () => {
    const result = await exercise<any>('exerciseStatusAndSanitation');
    expect(result.statuses.map((status: any) => `${status.kind}:${status.uid}`)).toEqual([
      'loading:target', 'unsupported-dashboard:target',
      'loading:schema', 'unsupported-dashboard:schema',
      'loading:profile', 'unsupported-dashboard:profile',
      'loading:unauthorized', 'error:unauthorized',
      'loading:forbidden', 'error:forbidden',
      'loading:not-found', 'error:not-found',
      'loading:policy', 'error:policy',
      'loading:network', 'error:network',
      'loading:http', 'error:http',
      'loading:malformed', 'error:malformed',
      'loading:invalid', 'error:invalid',
      'loading:ready', 'ready:ready',
    ]);
    expect(result.statuses.filter((status: any) => status.kind === 'unsupported-dashboard').map((status: any) => status.reason))
      .toEqual(['target-version', 'dashboard-schema', 'dashboard-profile']);
    expect(result.statuses.filter((status: any) => status.kind === 'error').map((status: any) => status.error.code))
      .toEqual(['unauthorized', 'forbidden', 'not-found', 'transport-policy-error', 'network-error', 'http-error', 'response-malformed', 'dashboard-input-invalid']);
    expect(result.text).toEqual({
      ready: 'ready', unauthorized: 'Dashboard unavailable.', unsupported: 'Dashboard is not supported.',
    });
    expect(result.released).toEqual(['ready']);
    expect(result.serialized).not.toMatch(/headers|body|cookie|authorization|cause/i);
  }, 30_000);

  it.each(['retrieval', 'implementation', 'runtime'] as const)(
    'invalidates stale %s completion on UID change and releases acquired work once',
    async (stage) => {
      const result = await exercise<any>('exerciseRace', stage);
      expect(result.text).toBe('new');
      expect(result.oldAborted).toBe(true);
      expect(result.statuses.some((status: any) => status.kind === 'ready' && status.uid === 'old')).toBe(false);
      expect(result.statuses.at(-1)).toMatchObject({ kind: 'ready', uid: 'new' });
      expect(result.beforeUnmount.new).toBeUndefined();
      expect(result.releaseCounts.new).toBe(1);
      expect(result.releaseCounts.old ?? 0).toBe(stage === 'runtime' ? 1 : 0);
    }
  );

  it.each(['retrieval', 'implementation', 'runtime'] as const)(
    'consumes a late rejected %s promise after unmount',
    async (stage) => {
      const result = await exercise<any>('exerciseLateRejection', stage);
      expect(result.statuses.filter((status: any) => status.kind === 'error')).toHaveLength(0);
    }
  );

  it.each(['retrieval', 'implementation', 'runtime'] as const)(
    'consumes late %s settlement after StrictMode rehearsal and unmount',
    async (stage) => {
      const result = await exercise<any>('exerciseUnmountAndStrictMode', stage);
      expect(result.retrievals).toBe(1);
      expect(result.imports).toBe(stage === 'retrieval' ? 0 : 1);
      expect(result.mounts).toBe(stage === 'runtime' ? 1 : 0);
      expect(result.releases).toBe(stage === 'runtime' ? 1 : 0);
      expect(result.statuses.filter((status: any) => status.kind === 'ready')).toHaveLength(0);
    }
  );

  it('sanitizes hostile implementation and runtime failures', async () => {
    const result = await exercise<any>('exerciseHostileFailures');
    expect(result.statuses.filter((status: any) => status.kind === 'error')).toEqual([
      expect.objectContaining({ error: expect.objectContaining({ code: 'runtime-initialization-failed' }), uid: 'import-failure' }),
      expect.objectContaining({ error: expect.objectContaining({ code: 'runtime-initialization-failed' }), uid: 'runtime-failure' }),
    ]);
    expect(result.serialized).not.toMatch(/secret|authorization|cookie|cause/i);
  });

  it('maps a real closed-catalogue Text load failure before activation', async () => {
    const result = await exercise<any>('exerciseActualCatalogueFailure');
    expect(result.status).toMatchObject({
      error: { code: 'panel-render-failed' },
      kind: 'error',
      uid: 'catalogue-failure',
    });
    expect(result.text).toBe('Dashboard unavailable.');
    expect(result.releaseOrder).toEqual(['lease']);
    expect(result.serialized).not.toMatch(/secret|cookie|authorization|cause/i);
  });

  it('isolates a Text render failure while retaining an independent unsupported panel', async () => {
    const result = await exercise<any>('exercisePanelBoundary');
    expect(result).toEqual({
      error: 'Panel unavailable.', failures: ['failed'], independent: 'Not-Supported', secretPresent: false,
    });
  });

  it('propagates the projected Scenes inner boundary to the provider panel boundary', async () => {
    const result = await exercise<any>('exerciseProjectedInnerBoundary');
    expect(result).toEqual({
      error: 'Panel unavailable.', failures: [7], independent: 'Not-Supported', secretPresent: false,
    });
  });
});
