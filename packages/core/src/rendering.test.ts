import type { HostReactRuntime, HostTransportCapability, ProviderCompatibilityManifest, ProviderDashboardRendererProps, RendererProvider } from '@dashboard-render-sdk-g/provider-contract';
import { createElement, lazy, memo, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import * as inspection from './inspectConfiguredProvider';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { createDashboardRenderSdk, GrafanaDashboard } from './index';

export function configuration() {
  const manifest: ProviderCompatibilityManifest = {
    schemaVersion: 1,
    provider: { id: 'neutral-provider', buildId: 'build-one', version: '1.0.0', supportTier: 'experimental' },
    target: { family: 'neutral', cells: [{ version: '1.0.0', edition: 'default', source: { repository: 'https://example.invalid/provider', revision: 'revision' } }] },
    provenance: { recordId: 'neutral-provenance' }, runtimeDependencies: [],
    host: { reactVersion: '19.2.8', reactDomVersion: '19.2.8' },
    dashboards: { apis: [{ group: 'dashboard.example.invalid', version: 'v1' }], schemas: [{ family: 'v1', schemaVersion: 1 }], lookup: 'uid' },
    capabilities: { panels: [], datasources: [], transformations: { ids: [], allowEmptyPipeline: true, maxChainLength: 0 } },
  };
  const hostReact: HostReactRuntime = { versions: { react: '19.2.8', reactDom: '19.2.8' }, identities: { react: {}, reactDom: {}, reactDomClient: {}, jsxRuntime: {}, jsxDevRuntime: {} } };
  const transport: HostTransportCapability = { descriptor: { schemaVersion: 1, targetOrigin: 'https://example.invalid', basePath: '/', securityScopeId: 'scope', requestPolicyId: 'policy' }, execute: async (request) => ({ kind: 'cancelled', requestId: request.requestId }) };
  return { provider: { manifest }, hostReact, transport, renderer: (_props: ProviderDashboardRendererProps): ReactElement | null => null };
}

describe('dashboard render SDK creation', () => {
  it('delegates once, retains canonical validation, and stays inert until React renders', () => {
    const input = configuration();
    let reads = 0;
    const manifest = input.provider.manifest;
    input.provider = { get manifest() { reads += 1; return manifest; } };
    const observed: ProviderDashboardRendererProps[] = [];
    input.renderer = (props) => { observed.push(props); return createElement('div', null, props.uid); };
    const inspect = vi.spyOn(inspection, 'inspectConfiguredProvider');
    try {
      const result = createDashboardRenderSdk(input);
      expect(result.valid).toBe(true);
      expect(reads).toBe(1);
      expect(inspect).toHaveBeenCalledTimes(1);
      expect(observed).toEqual([]);
      if (!result.valid) return;
      expect(Object.isFrozen(result.sdk)).toBe(true);
      expect(result.sdk).toMatchObject({ providerId: 'neutral-provider', providerBuildId: 'build-one' });
      expect(Object.keys(result.sdk).sort()).toEqual(['providerBuildId', 'providerId']);
      const canonical = inspect.mock.results[0]!.value;
      expect(renderToStaticMarkup(createElement(GrafanaDashboard, { sdk: result.sdk, uid: 'dashboard-a' }))).toBe('<div>dashboard-a</div>');
      expect(observed[0]).toMatchObject({ namespace: 'default', uid: 'dashboard-a' });
      expect(observed[0]!.manifest).toBe(canonical);
      expect(observed[0]!.transport).toBe(input.transport);
      expect(observed[0]!.hostReact).toBe(input.hostReact);
      expect(Object.isFrozen(input.hostReact.identities.react)).toBe(false);
      expect(inspect).toHaveBeenCalledTimes(1);
    } finally { inspect.mockRestore(); }
  });

  it('returns typed canonical manifest failures without executing the renderer', () => {
    const input = configuration();
    input.provider = { manifest: { schemaVersion: 999 } } as unknown as RendererProvider;
    input.renderer = () => { throw new Error('must stay inert'); };
    const result = createDashboardRenderSdk(input);
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.every((error) => error.code === 'provider-manifest-invalid')).toBe(true);
    expect(result.errors.some((error) => error.path === '$.schemaVersion')).toBe(true);
  });

  it.each([
    { namespace: '' }, { namespace: null }, { namespace: '../invalid' }, { namespace: 'x'.repeat(64) },
    { renderer: null }, { transport: null }, { hostReact: null },
    { hostReact: { versions: { react: '19.2.8', reactDom: '19.2.8' }, identities: {} } },
  ])('rejects malformed bounded configuration: %j', (override) => {
    const result = createDashboardRenderSdk({ ...configuration(), ...override } as never);
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.errors[0]!.code).toBe('configuration-invalid');
  });

  it('accepts inert memo and lazy React components without executing a loader', () => {
    let loads = 0;
    const renderer = lazy(async () => { loads += 1; return { default: () => null }; });
    expect(createDashboardRenderSdk({ ...configuration(), renderer }).valid).toBe(true);
    expect(createDashboardRenderSdk({ ...configuration(), renderer: memo(() => null) }).valid).toBe(true);
    expect(loads).toBe(0);
  });

  it('captures selected configuration and manifest metadata without freezing host references', () => {
    const input = { ...configuration(), namespace: 'custom' };
    const originalTransport = input.transport;
    const originalHost = input.hostReact;
    const observed: ProviderDashboardRendererProps[] = [];
    input.renderer = (props) => { observed.push(props); return null; };
    const result = createDashboardRenderSdk(input);
    expect(result.valid).toBe(true);
    if (!result.valid) return;
    (input.provider.manifest.provider as { id: string }).id = 'changed';
    input.renderer = () => { throw new Error('must retain selected renderer'); };
    input.transport = configuration().transport;
    renderToStaticMarkup(createElement(GrafanaDashboard, { sdk: result.sdk, uid: 'a' }));
    expect(observed[0]!.namespace).toBe('custom');
    expect(observed[0]!.manifest.manifest.provider.id).toBe('neutral-provider');
    expect(observed[0]!.transport).toBe(originalTransport);
    expect(observed[0]!.hostReact).toBe(originalHost);
    expect(Object.isFrozen(originalTransport)).toBe(false);
  });
});

it('replaces UID subtrees and suppresses old, mismatched and unmounted statuses in real React', async () => {
  const server = await createServer({ configFile: false, cacheDir: '/tmp/core-render-vite-cache', server: { host: '127.0.0.1', port: 5197 }, appType: 'custom', optimizeDeps: { entries: [], include: ['react', 'react-dom', 'react-dom/client'] } });
  server.middlewares.use('/core-render-test', (_request, response) => { response.setHeader('Content-Type', 'text/html'); response.end('<html><body></body></html>'); });
  let browser;
  try {
    await server.listen();
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    const address = server.httpServer!.address();
    if (!address || typeof address === 'string') throw new Error('Missing test server port');
    await page.goto(`http://127.0.0.1:${address.port}/core-render-test`);
    const result = await page.evaluate<ReturnType<typeof import('./rendering.browser.test').exercise>>(`(async () => {
      const fixture = await import('/packages/core/src/rendering.browser.test.ts');
      return fixture.exercise(${JSON.stringify(configuration().provider.manifest)});
    })()`);
    expect(result.replaced).toBe(true);
    expect(result.instances[0]).not.toBe(result.instances[1]);
    expect(result.cleanup).toEqual(['a', 'b']);
    expect(result.beforeUnmount).toEqual(['loading:a', 'loading:b', 'loading:b']);
    expect(result.afterUnmount).toEqual(result.beforeUnmount);
    expect(result.strictActive).toBe(true);
  } finally {
    await browser?.close();
    await server.close();
  }
}, 30000);
