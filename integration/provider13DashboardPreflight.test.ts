import { describe, expect, it } from 'vitest';

import { createHostTransportCapability } from '@dashboard-render-sdk-g/core';
import {
  validateProviderCompatibilityManifest,
  type HostTransportExecutor,
  type ProviderCompatibilityManifest,
} from '@dashboard-render-sdk-g/provider-contract';
import { retrieveAndPreflightGrafana13DashboardV1 } from '@dashboard-render-sdk-g/provider-13';

const username = process.env.POC_GRAFANA_VERIFY_USER;
const password = process.env.POC_GRAFANA_VERIFY_PASSWORD;
const credentialsAvailable = Boolean(username && password);
const targetOrigin = 'http://grafana:3000';

async function probeFixtureBasePath(): Promise<'/' | '/grafana'> {
  const candidates = ['/', '/grafana'] as const;
  const results = await Promise.all(candidates.map(async (candidate) => {
    const prefix = candidate === '/' ? '' : candidate;
    const health = await fetch(`${targetOrigin}${prefix}/api/health`, { redirect: 'manual' });
    const discovery = await fetch(`${targetOrigin}${prefix}/apis/dashboard.grafana.app/`, { redirect: 'manual' });
    return {
      candidate,
      reachable: !health.headers.has('location') && !discovery.headers.has('location') &&
        health.status === 200 && [200, 401, 403].includes(discovery.status),
    };
  }));
  const direct = results.find(({ candidate, reachable }) => candidate === '/' && reachable);
  if (direct) return direct.candidate;
  const prefixed = results.find(({ candidate, reachable }) => candidate === '/grafana' && reachable);
  if (prefixed) return prefixed.candidate;
  throw new Error('No directly reachable Grafana fixture base path passed the health and discovery probes.');
}

function manifest() {
  const raw: ProviderCompatibilityManifest = {
    capabilities: {
      datasources: ['grafana-testdata-datasource'],
      panels: ['stat', 'text', 'timeseries'],
      transformations: { allowEmptyPipeline: true, ids: ['renameByRegex'], maxChainLength: 1 },
    },
    dashboards: {
      apis: [{ group: 'dashboard.grafana.app', version: 'v1' }], lookup: 'uid',
      schemas: [{ family: 'v1', schemaVersion: 42 }],
    },
    host: { reactDomVersion: '19.2.8', reactVersion: '19.2.8' },
    provenance: { recordId: 'provider-13-grafana-13.2.3-pinned-source' },
    provider: { buildId: 'provider-13-grafana-13.2.3-build-1', id: '@dashboard-render-sdk-g/provider-13', supportTier: 'experimental', version: '0.0.0-private' },
    runtimeDependencies: [
      { id: '@grafana/data', version: '13.2.3' }, { id: '@grafana/runtime', version: '13.2.3' },
      { id: '@grafana/scenes', version: '8.13.5' }, { id: '@grafana/ui', version: '13.2.3' },
    ],
    schemaVersion: 1,
    target: { cells: [{ edition: 'oss', source: { repository: 'https://github.com/grafana/grafana', revision: '6193dc03311b631b9727b560d24369e683dc396e', tag: 'v13.2.3' }, version: '13.2.3' }], family: 'grafana' },
  };
  const result = validateProviderCompatibilityManifest(raw);
  if (!result.valid) throw new Error('Integration manifest must be canonical.');
  return result;
}

describe.skipIf(!credentialsAvailable)('provider-13 real Grafana fixture', () => {
  it('retrieves the alternate dashboard and rejects the complete primary dashboard statically', async () => {
    const basePath = await probeFixtureBasePath();
    expect(basePath).toBe('/');
    const observedPaths: string[] = [];
    const executor: HostTransportExecutor = async (request) => {
      observedPaths.push(request.path);
      const providerHeaders = new Headers(request.headers as readonly [string, string][] | undefined);
      for (const name of ['authorization', 'cookie', 'x-grafana-org-id']) {
        expect(providerHeaders.has(name)).toBe(false);
      }
      const response = await fetch(`${targetOrigin}${basePath === '/' ? '' : basePath}${request.path}`, {
        headers: {
          ...Object.fromEntries(providerHeaders.entries()),
          Authorization: `Basic ${btoa(`${username!}:${password!}`)}`,
        },
        method: request.method,
        signal: request.signal,
        redirect: 'error',
      });
      return {
        body: await response.text(),
        headers: [...response.headers.entries()]
          .filter(([name]) => !['set-cookie', 'set-cookie2'].includes(name.toLowerCase())),
        status: response.status,
      };
    };
    const creation = createHostTransportCapability({
      basePath,
      requestPolicyId: 'provider-13-fixture-read-only-v1',
      schemaVersion: 1,
      securityScopeId: 'local-grafana-fixture',
      targetOrigin,
    }, executor);
    expect(creation.valid).toBe(true);
    if (!creation.valid) return;

    const load = (uid: string, suffix: string) => retrieveAndPreflightGrafana13DashboardV1({
      manifest: manifest(), namespace: 'default',
      requestIds: { dashboard: `fixture-dashboard-${suffix}`, discovery: `fixture-discovery-${suffix}` },
      signal: new AbortController().signal, transport: creation.capability, uid,
    });
    const alternate = await load('grsdk-phase0-poc-alt', 'alt');
    expect(alternate.kind).toBe('ready');
    if (alternate.kind === 'ready') {
      expect(alternate.dashboard.metadata.name).toBe('grsdk-phase0-poc-alt');
      expect(alternate.dashboard.spec.schemaVersion).toBe(42);
      expect(alternate.inventory.panelTypes).toEqual(['text']);
      expect(alternate.staticPreflight).not.toHaveProperty('runtimeAdmission');
    }

    const primary = await load('grsdk-phase0-poc', 'primary');
    expect(primary.kind).toBe('unsupported');
    if (primary.kind === 'unsupported') {
      expect(primary.stage).toBe('preflight');
      expect(primary.inventory?.panelTypes).toContain('table');
      expect(primary.diagnostics.some(({ code, capabilityId }) => code === 'panel.unsupported' && capabilityId === 'table')).toBe(true);
    }
    expect(observedPaths).toEqual([
      '/apis/dashboard.grafana.app/',
      '/apis/dashboard.grafana.app/v1/namespaces/default/dashboards/grsdk-phase0-poc-alt/dto',
      '/apis/dashboard.grafana.app/',
      '/apis/dashboard.grafana.app/v1/namespaces/default/dashboards/grsdk-phase0-poc/dto',
    ]);
    expect(observedPaths.every((path) => !path.includes('/api/dashboards/') && !path.includes('/v2') && !path.includes('beta'))).toBe(true);
  });
});
