import {
  PROVIDER_MANIFEST_SCHEMA_VERSION,
  type ProviderCompatibilityManifest,
  type ProviderSupportTier,
  type RendererProvider,
  type RuntimeIdentity,
} from './index';

const grafanaCompatibilityExample = {
  capabilities: {
    datasources: ['grafana-testdata-datasource'],
    panels: ['text', 'stat', 'timeseries'],
    transformations: {
      allowEmptyPipeline: true,
      ids: ['renameByRegex'],
      maxChainLength: 1,
    },
  },
  dashboards: {
    apis: [{ group: 'dashboard.grafana.app', version: 'v1' }],
    lookup: 'uid',
    schemas: [{ family: 'v1', schemaVersion: 42 }],
  },
  host: {
    reactDomVersion: '19.2.8',
    reactVersion: '19.2.8',
  },
  provenance: {
    recordId: 'synthetic-provider-build-provenance',
  },
  provider: {
    buildId: 'synthetic-provider-build',
    id: 'synthetic-grafana-provider',
    supportTier: 'experimental',
    version: '1.2.3-test.1',
  },
  runtimeDependencies: [
    { id: '@grafana/data', version: '13.2.3' },
    { id: '@grafana/e2e-selectors', version: '13.2.3' },
    { id: '@grafana/i18n', version: '13.2.3' },
    { id: '@grafana/runtime', version: '13.2.3' },
    { id: '@grafana/schema', version: '13.2.3' },
    { id: '@grafana/ui', version: '13.2.3' },
    { id: '@grafana/scenes', version: '8.13.5' },
  ],
  schemaVersion: PROVIDER_MANIFEST_SCHEMA_VERSION,
  target: {
    cells: [
      {
        edition: 'oss',
        source: {
          repository: 'https://github.com/grafana/grafana',
          revision: '6193dc03311b631b9727b560d24369e683dc396e',
          tag: 'v13.2.3',
        },
        version: '13.2.3',
      },
    ],
    family: 'grafana',
  },
} satisfies ProviderCompatibilityManifest;

const metadataOnlyProvider = {
  manifest: grafanaCompatibilityExample,
} satisfies RendererProvider;

const providerNeutralExample = {
  ...grafanaCompatibilityExample,
  target: {
    cells: [
      {
        edition: 'default',
        source: {
          repository: 'https://example.invalid/another-dashboard-provider',
          revision: 'source-revision-1',
          tag: 'v9.0.0',
        },
        version: '9.0.0',
      },
    ],
    family: 'another-dashboard-provider',
  },
} satisfies ProviderCompatibilityManifest;

const runtimeIdentity = {
  cohort: {
    reactRuntimeToken: 'host-react-runtime-token',
    runtimeDependencies: grafanaCompatibilityExample.runtimeDependencies,
  },
  isolationMode: 'single-compatible-realm-v1',
  provider: {
    buildId: grafanaCompatibilityExample.provider.buildId,
    id: grafanaCompatibilityExample.provider.id,
    manifestDigest: 'sha256:synthetic-manifest-digest',
  },
  schemaVersion: 1,
  target: {
    family: grafanaCompatibilityExample.target.family,
    observedCompatibilityId: 'grafana-oss-13.2.3-observed',
  },
} satisfies RuntimeIdentity;

const readonlyManifest: ProviderCompatibilityManifest = grafanaCompatibilityExample;
// @ts-expect-error Contract metadata is immutable after construction.
readonlyManifest.provider.id = 'mutated-provider';

// @ts-expect-error Provider support tiers are a closed vocabulary.
const invalidSupportTier: ProviderSupportTier = 'preview';

void metadataOnlyProvider;
void invalidSupportTier;
void providerNeutralExample;
void readonlyManifest;
void runtimeIdentity;
