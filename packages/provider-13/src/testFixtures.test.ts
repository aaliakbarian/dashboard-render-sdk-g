import { readFileSync } from 'node:fs';

import {
  validateProviderCompatibilityManifest,
  type ManifestValidationSuccess,
  type ProviderCompatibilityManifest,
} from '@dashboard-render-sdk-g/provider-contract';

import type { Grafana13DashboardV1 } from './contracts';
import { decodeGrafana13DashboardV1Value } from './dashboardDto';

export function canonicalManifestValue(): ProviderCompatibilityManifest {
  return {
    capabilities: {
      datasources: ['grafana-testdata-datasource'],
      panels: ['stat', 'text', 'timeseries'],
      transformations: { allowEmptyPipeline: true, ids: ['renameByRegex'], maxChainLength: 1 },
    },
    dashboards: {
      apis: [{ group: 'dashboard.grafana.app', version: 'v1' }],
      lookup: 'uid',
      schemas: [{ family: 'v1', schemaVersion: 42 }],
    },
    host: { reactDomVersion: '19.2.8', reactVersion: '19.2.8' },
    provenance: { recordId: 'provider-13-grafana-13.2.3-pinned-source' },
    provider: {
      buildId: 'provider-13-grafana-13.2.3-build-1',
      id: '@dashboard-render-sdk-g/provider-13',
      supportTier: 'experimental',
      version: '0.0.0-private',
    },
    runtimeDependencies: [
      { id: '@grafana/data', version: '13.2.3' },
      { id: '@grafana/runtime', version: '13.2.3' },
      { id: '@grafana/scenes', version: '8.13.5' },
      { id: '@grafana/ui', version: '13.2.3' },
    ],
    schemaVersion: 1,
    target: {
      cells: [{
        edition: 'oss',
        source: {
          repository: 'https://github.com/grafana/grafana',
          revision: '6193dc03311b631b9727b560d24369e683dc396e',
          tag: 'v13.2.3',
        },
        version: '13.2.3',
      }],
      family: 'grafana',
    },
  };
}

export function canonicalManifest(
  mutate?: (manifest: any) => void
): ManifestValidationSuccess {
  const raw = structuredClone(canonicalManifestValue());
  mutate?.(raw);
  const result = validateProviderCompatibilityManifest(raw);
  if (!result.valid) throw new Error(`Invalid test manifest: ${result.errors[0]?.path}`);
  return result;
}

export function fixtureDashboard(
  uid: 'grsdk-phase0-poc' | 'grsdk-phase0-poc-alt'
): Grafana13DashboardV1 {
  const raw = JSON.parse(readFileSync(
    new URL(`../../../dev/grafana/provisioning/dashboards/${uid}.json`, import.meta.url),
    'utf8'
  )) as unknown;
  const result = decodeGrafana13DashboardV1Value({
    access: { canAdmin: false, canDelete: false, canEdit: false, canSave: false, canStar: false, isPublic: false },
    apiVersion: 'dashboard.grafana.app/v1',
    kind: 'DashboardWithAccessInfo',
    metadata: { name: uid, namespace: 'default' },
    spec: raw,
  }, { namespace: 'default', requestId: `dto-${uid}`, uid });
  if (result.kind !== 'success') throw new Error(`Invalid test dashboard: ${result.kind}`);
  return result.value;
}
