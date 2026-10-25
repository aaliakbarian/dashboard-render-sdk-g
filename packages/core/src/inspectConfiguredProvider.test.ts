import {
  PROVIDER_MANIFEST_SCHEMA_VERSION,
  type ProviderCompatibilityManifest,
  type RendererProvider,
  validateProviderCompatibilityManifest,
} from '@dashboard-render-sdk-g/provider-contract';
import { describe, expect, it } from 'vitest';

import { inspectConfiguredProvider } from './inspectConfiguredProvider';

function createProviderNeutralManifest() {
  return {
    capabilities: {
      datasources: [],
      panels: [],
      transformations: {
        allowEmptyPipeline: true,
        ids: [],
        maxChainLength: 0,
      },
    },
    dashboards: {
      apis: [{ group: 'dashboard.example.invalid', version: 'v1' }],
      lookup: 'uid',
      schemas: [{ family: 'v1', schemaVersion: 1 }],
    },
    host: {
      reactDomVersion: '19.2.8',
      reactVersion: '19.2.8',
    },
    provenance: {
      recordId: 'synthetic-provider-neutral-provenance',
    },
    provider: {
      buildId: 'synthetic-build',
      id: 'synthetic-provider',
      supportTier: 'experimental',
      version: '1.0.0',
    },
    runtimeDependencies: [],
    schemaVersion: PROVIDER_MANIFEST_SCHEMA_VERSION,
    target: {
      cells: [
        {
          edition: 'default',
          source: {
            repository: 'https://example.invalid/provider',
            revision: 'synthetic-revision',
          },
          version: '1.0.0',
        },
      ],
      family: 'synthetic-dashboard-provider',
    },
  } satisfies ProviderCompatibilityManifest;
}

describe('inspectConfiguredProvider', () => {
  it('returns the canonical structural validation result for a configured provider', () => {
    const manifest = createProviderNeutralManifest();

    const result = inspectConfiguredProvider({ provider: { manifest } });

    expect(result).toEqual(validateProviderCompatibilityManifest(manifest));
    expect(result.valid).toBe(true);
  });

  it('returns a detached deeply frozen manifest snapshot', () => {
    const manifest = createProviderNeutralManifest();

    const result = inspectConfiguredProvider({ provider: { manifest } });

    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.manifest).not.toBe(manifest);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.manifest)).toBe(true);
    expect(Object.isFrozen(result.manifest.provider)).toBe(true);
    expect(Object.isFrozen(result.manifest.target.cells)).toBe(true);
    manifest.provider.id = 'mutated-after-inspection';
    expect(result.manifest.provider.id).toBe('synthetic-provider');
  });

  it('is deterministic without retaining a global result or manifest cache', () => {
    const manifest = createProviderNeutralManifest();
    const configuration = { provider: { manifest } };

    const first = inspectConfiguredProvider(configuration);
    const second = inspectConfiguredProvider(configuration);

    expect(second).toEqual(first);
    expect(second).not.toBe(first);
    if (first.valid && second.valid) {
      expect(second.manifest).not.toBe(first.manifest);
    }
  });

  it('preserves canonical typed failures and deterministic diagnostics', () => {
    const malformedManifest = {
      ...createProviderNeutralManifest(),
      schemaVersion: 999,
      unexpected: true,
    };
    const provider = { manifest: malformedManifest } as unknown as RendererProvider;

    const first = inspectConfiguredProvider({ provider });
    const second = inspectConfiguredProvider({ provider });

    expect(first).toEqual(validateProviderCompatibilityManifest(malformedManifest));
    expect(second).toEqual(first);
    expect(first.valid).toBe(false);
    if (first.valid) return;
    expect(first.errors.map(({ code, path }) => ({ code, path }))).toEqual([
      { code: 'unknown-field', path: '$.unexpected' },
      { code: 'unsupported-manifest-version', path: '$.schemaVersion' },
    ]);
  });

  it('delegates malformed reflection input to the canonical manifest validator', () => {
    const { proxy, revoke } = Proxy.revocable(createProviderNeutralManifest(), {});
    revoke();
    const provider = { manifest: proxy } as unknown as RendererProvider;

    const result = inspectConfiguredProvider({ provider });

    expect(result).toEqual(validateProviderCompatibilityManifest(proxy));
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.errors[0]).toMatchObject({
      code: 'non-serializable',
      path: '$',
    });
  });

  it('does not turn a structurally valid unverified target into admission', () => {
    const manifest = createProviderNeutralManifest();
    manifest.target.family = 'not-project-verified';

    const result = inspectConfiguredProvider({ provider: { manifest } });

    expect(result.valid).toBe(true);
    expect(Object.hasOwn(result, 'compatible')).toBe(false);
    expect(Object.hasOwn(result, 'admitted')).toBe(false);
    expect(Object.hasOwn(result, 'verified')).toBe(false);
  });

  it('reads the trusted configured provider manifest exactly once per call', () => {
    const manifest = createProviderNeutralManifest();
    let manifestReads = 0;
    const provider = {
      get manifest() {
        manifestReads += 1;
        return manifest;
      },
      get initialize() {
        throw new Error('inspection must not read provider initialization');
      },
      get transport() {
        throw new Error('inspection must not read provider transport');
      },
    } as RendererProvider;

    const result = inspectConfiguredProvider({ provider });

    expect(result.valid).toBe(true);
    expect(manifestReads).toBe(1);
  });
});
