import { validateProviderCompatibilityManifest, type RendererProvider } from '@dashboard-render-sdk-g/provider-contract';

const validation = validateProviderCompatibilityManifest({
  capabilities: {
    datasources: ['grafana-testdata-datasource'], panels: ['text', 'stat', 'timeseries'],
    transformations: { allowEmptyPipeline: true, ids: ['renameByRegex'], maxChainLength: 1 },
  },
  dashboards: {
    apis: [{ group: 'dashboard.grafana.app', version: 'v1' }], lookup: 'uid',
    schemas: [{ family: 'v1', schemaVersion: 42 }],
  },
  host: { reactDomVersion: '19.2.8', reactVersion: '19.2.8' },
  provenance: { recordId: 'provider-13-grafana-13.2.3-pinned-source' },
  provider: {
    buildId: 'provider-13-grafana-13.2.3-native-stat-timeseries-view-v1',
    id: '@dashboard-render-sdk-g/provider-13', supportTier: 'experimental', version: '0.0.0-private',
  },
  runtimeDependencies: [
    { id: '@grafana/data', version: '13.2.3' },
    { id: '@grafana/runtime', version: '13.2.3' },
    { id: '@grafana/scenes', version: '8.13.5' },
    { id: '@grafana/ui', version: '13.2.3' },
  ],
  schemaVersion: 1,
  target: {
    cells: [{ edition: 'oss', source: {
      repository: 'https://github.com/grafana/grafana', tag: 'v13.2.3', revision: '6193dc03311b631b9727b560d24369e683dc396e',
    }, version: '13.2.3' }], family: 'grafana',
  },
});

if (!validation.valid) throw new Error('Provider compatibility metadata is invalid.');

export const grafana13Provider: RendererProvider = Object.freeze({ manifest: validation.manifest });
