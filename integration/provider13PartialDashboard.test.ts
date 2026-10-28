import { describe, expect, it } from 'vitest';

import { createHostTransportCapability } from '@dashboard-render-sdk-g/core';
import {
  validateProviderCompatibilityManifest,
  type HostTransportExecutor,
} from '@dashboard-render-sdk-g/provider-contract';
import {
  grafana13Provider,
  retrieveAndClassifyGrafana13DashboardV1,
} from '@dashboard-render-sdk-g/provider-13';

const username = process.env.POC_GRAFANA_VERIFY_USER;
const password = process.env.POC_GRAFANA_VERIFY_PASSWORD;
const credentialsAvailable = Boolean(username && password);
const targetOrigin = 'http://grafana:3000';

describe.skipIf(!credentialsAvailable)('provider-13 real partial dashboard path', () => {
  it.each([
    ['grsdk-phase0-poc', 1, 3, ['text', 'stat', 'table', 'timeseries']],
    ['grsdk-phase0-poc-alt', 1, 0, ['text']],
  ] as const)('retrieves and classifies %s through health, discovery, and V1 DTO', async (
    uid,
    supportedPanelCount,
    unsupportedPanelCount,
    panelTypes
  ) => {
    const observedPaths: string[] = [];
    const executor: HostTransportExecutor = async (request) => {
      observedPaths.push(request.path);
      const providerHeaders = new Headers(request.headers as readonly [string, string][] | undefined);
      for (const name of ['authorization', 'cookie', 'x-grafana-org-id']) {
        expect(providerHeaders.has(name)).toBe(false);
      }
      const response = await fetch(`${targetOrigin}${request.path}`, {
        headers: {
          ...Object.fromEntries(providerHeaders.entries()),
          Authorization: `Basic ${btoa(`${username!}:${password!}`)}`,
        },
        method: request.method,
        redirect: 'error',
        signal: request.signal,
      });
      return {
        body: await response.text(),
        headers: [...response.headers.entries()].filter(
          ([name]) => !['set-cookie', 'set-cookie2'].includes(name.toLowerCase())
        ),
        status: response.status,
      };
    };
    const transport = createHostTransportCapability(
      {
        basePath: '/',
        requestPolicyId: 'provider-13-partial-fixture-v1',
        schemaVersion: 1,
        securityScopeId: 'local-grafana-fixture',
        targetOrigin,
      },
      executor
    );
    expect(transport.valid).toBe(true);
    if (!transport.valid) return;
    const manifest = validateProviderCompatibilityManifest(grafana13Provider.manifest);
    expect(manifest.valid).toBe(true);
    if (!manifest.valid) return;

    const result = await retrieveAndClassifyGrafana13DashboardV1({
      manifest,
      namespace: 'default',
      requestIds: {
        dashboard: `partial-${uid}-dashboard`,
        discovery: `partial-${uid}-discovery`,
        health: `partial-${uid}-health`,
      },
      signal: new AbortController().signal,
      transport: transport.capability,
      uid,
    });

    expect(result.kind).toBe('renderable');
    if (result.kind !== 'renderable') return;
    expect(result.dashboard.uid).toBe(uid);
    expect(result.dashboard.supportedPanelCount).toBe(supportedPanelCount);
    expect(result.dashboard.unsupportedPanelCount).toBe(unsupportedPanelCount);
    expect(result.dashboard.panels.map(({ panelType }) => panelType)).toEqual(panelTypes);
    expect(result.dashboard.panels.filter(({ kind }) => kind === 'unsupported'))
      .toHaveLength(unsupportedPanelCount);
    expect(observedPaths).toEqual([
      '/api/health',
      '/apis/dashboard.grafana.app/',
      `/apis/dashboard.grafana.app/v1/namespaces/default/dashboards/${uid}/dto`,
    ]);
    expect(observedPaths.some((path) => path.includes('/api/ds/query'))).toBe(false);
  });
});
