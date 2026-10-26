import {
  PROVIDER_MANIFEST_SCHEMA_VERSION,
  type CompatibilityObservations,
  type ExactVersionedDependency,
  type ManifestValidationSuccess,
  type ProviderCompatibilityManifest,
} from '@dashboard-render-sdk-g/provider-contract';
import { describe, expect, it } from 'vitest';

import { evaluateProviderCompatibility } from './evaluateProviderCompatibility';
import { inspectConfiguredProvider } from './inspectConfiguredProvider';

function createManifest(): ProviderCompatibilityManifest {
  return {
    capabilities: {
      datasources: [],
      panels: [],
      transformations: { allowEmptyPipeline: true, ids: [], maxChainLength: 0 },
    },
    dashboards: {
      apis: [{ group: 'dashboard.example.invalid', version: 'v1' }],
      lookup: 'uid',
      schemas: [{ family: 'v1', schemaVersion: 1 }],
    },
    host: { reactDomVersion: '19.2.8', reactVersion: '19.2.8' },
    provenance: { recordId: 'synthetic-provenance' },
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
          edition: 'oss',
          source: {
            repository: 'https://example.invalid/provider',
            revision: 'revision-oss',
          },
          version: '13.2.3',
        },
        {
          edition: 'enterprise',
          source: {
            repository: 'https://example.invalid/provider',
            revision: 'revision-enterprise',
          },
          version: '13.2.3',
        },
      ],
      family: 'grafana',
    },
  };
}

function inspect(manifest = createManifest()): ManifestValidationSuccess {
  const result = inspectConfiguredProvider({ provider: { manifest } });
  if (!result.valid) throw new Error('Test manifest must be structurally valid.');
  return result;
}

function matchingObservations(): CompatibilityObservations {
  return {
    host: { reactDomVersion: '19.2.8', reactVersion: '19.2.8' },
    runtimeDependencies: [],
    target: { edition: 'oss', family: 'grafana', version: '13.2.3' },
  };
}

function inspectWithDependencies(
  runtimeDependencies: readonly ExactVersionedDependency[]
): ManifestValidationSuccess {
  return inspect({ ...createManifest(), runtimeDependencies });
}

function evaluateUnknown(
  observations: unknown,
  inspection: ManifestValidationSuccess = inspect()
) {
  return evaluateProviderCompatibility(inspection, observations as CompatibilityObservations);
}

function phantomPropertyProxy<T extends object>(target: T, property: string): T {
  return new Proxy(target, {
    getOwnPropertyDescriptor(current, key) {
      if (key === property) return undefined;
      return Reflect.getOwnPropertyDescriptor(current, key);
    },
    ownKeys(current) {
      return [...Reflect.ownKeys(current), property];
    },
  });
}

describe('evaluateProviderCompatibility target and host comparison', () => {
  it('matches one exact target cell and exact host versions without admitting runtime compatibility', () => {
    const result = evaluateProviderCompatibility(inspect(), matchingObservations());

    expect(result).toEqual({
      checks: [
        { expected: 'grafana', observed: 'grafana', path: '$.target.family', status: 'match' },
        {
          expected: 'oss@13.2.3 | enterprise@13.2.3',
          observed: 'oss@13.2.3',
          path: '$.target.cell',
          status: 'match',
        },
        { expected: '19.2.8', observed: '19.2.8', path: '$.host.reactVersion', status: 'match' },
        { expected: '19.2.8', observed: '19.2.8', path: '$.host.reactDomVersion', status: 'match' },
      ],
      matchedTargetCell: {
        edition: 'oss',
        source: {
          repository: 'https://example.invalid/provider',
          revision: 'revision-oss',
        },
        version: '13.2.3',
      },
      outcome: 'declared-requirements-match',
    });
    expect(Object.hasOwn(result, 'compatible')).toBe(false);
    expect(Object.hasOwn(result, 'admitted')).toBe(false);
    expect(Object.hasOwn(result, 'verified')).toBe(false);
  });

  it('selects the exact edition/version pair when two cells share a version', () => {
    const observations = {
      ...matchingObservations(),
      target: { edition: 'enterprise', family: 'grafana', version: '13.2.3' },
    };

    const result = evaluateProviderCompatibility(inspect(), observations);

    expect(result.matchedTargetCell?.edition).toBe('enterprise');
    expect(result.matchedTargetCell?.source.revision).toBe('revision-enterprise');
  });

  it('does not create a cross-cell match', () => {
    const original = createManifest();
    const manifest = {
      ...original,
      target: {
        ...original.target,
        cells: [original.target.cells[0]!, { ...original.target.cells[1]!, version: '14.0.0' }],
      },
    } satisfies ProviderCompatibilityManifest;
    const observations = {
      ...matchingObservations(),
      target: { edition: 'enterprise', family: 'grafana', version: '13.2.3' },
    };

    const result = evaluateProviderCompatibility(inspect(manifest), observations);

    expect(result.checks[1]).toEqual({
      expected: 'oss@13.2.3 | enterprise@14.0.0',
      observed: 'enterprise@13.2.3',
      path: '$.target.cell',
      status: 'mismatch',
    });
    expect(result.matchedTargetCell).toBeUndefined();
    expect(result.outcome).toBe('mismatch');
  });

  it('reports exact family, cell, React and ReactDOM mismatches in fixed order', () => {
    const result = evaluateProviderCompatibility(inspect(), {
      ...matchingObservations(),
      host: { reactDomVersion: '19.2.7', reactVersion: '19.2.9' },
      target: { edition: 'cloud', family: 'other', version: '13.2.4' },
    });

    expect(result.checks).toEqual([
      { expected: 'grafana', observed: 'other', path: '$.target.family', status: 'mismatch' },
      {
        expected: 'oss@13.2.3 | enterprise@13.2.3',
        observed: 'cloud@13.2.4',
        path: '$.target.cell',
        status: 'mismatch',
      },
      { expected: '19.2.8', observed: '19.2.9', path: '$.host.reactVersion', status: 'mismatch' },
      { expected: '19.2.8', observed: '19.2.7', path: '$.host.reactDomVersion', status: 'mismatch' },
    ]);
    expect(result.outcome).toBe('mismatch');
  });

  it('classifies missing groups and fields as missing evidence', () => {
    const missingGroups = evaluateProviderCompatibility(inspect(), {});
    const missingFields = evaluateProviderCompatibility(inspect(), { host: {}, target: {} });

    for (const result of [missingGroups, missingFields]) {
      expect(result.checks.map(({ path, status }) => ({ path, status }))).toEqual([
        { path: '$.target.family', status: 'missing-evidence' },
        { path: '$.target.version', status: 'missing-evidence' },
        { path: '$.target.edition', status: 'missing-evidence' },
        { path: '$.host.reactVersion', status: 'missing-evidence' },
        { path: '$.host.reactDomVersion', status: 'missing-evidence' },
        { path: '$.runtimeDependencies', status: 'missing-evidence' },
      ]);
      expect(result.outcome).toBe('insufficient-evidence');
    }
  });

  it.each([
    ['range', '^13.2.3'],
    ['wildcard', '13.x'],
    ['partial', '13.2'],
    ['empty', ''],
    ['malformed', 'v13.2.3'],
    ['non-string', 13_002_003],
  ])('classifies a %s target version as invalid observation', (_label, version) => {
    const observations = matchingObservations() as Record<string, unknown>;
    observations.target = { edition: 'oss', family: 'grafana', version };

    const result = evaluateProviderCompatibility(
      inspect(),
      observations as unknown as CompatibilityObservations
    );

    expect(result.checks).toContainEqual({
      path: '$.target.version',
      status: 'invalid-observation',
    });
    expect(result.outcome).toBe('invalid-observations');
  });

  it.each([
    ['React range', 'reactVersion', '^19.2.8'],
    ['ReactDOM wildcard', 'reactDomVersion', '19.x'],
    ['React partial', 'reactVersion', '19.2'],
    ['React empty', 'reactVersion', ''],
    ['React non-string', 'reactVersion', 19_002_008],
  ])('classifies %s as invalid observation', (_label, field, version) => {
    const host = { reactDomVersion: '19.2.8', reactVersion: '19.2.8' } as Record<string, unknown>;
    host[field] = version;

    const result = evaluateProviderCompatibility(inspect(), {
      ...matchingObservations(),
      host,
    } as CompatibilityObservations);

    expect(result.checks).toContainEqual({
      path: `$.host.${field}`,
      status: 'invalid-observation',
    });
    expect(result.outcome).toBe('invalid-observations');
  });

  it('classifies a different valid exact version as mismatch', () => {
    const result = evaluateProviderCompatibility(inspect(), {
      ...matchingObservations(),
      host: { reactDomVersion: '19.2.7', reactVersion: '19.2.9' },
      target: { edition: 'oss', family: 'grafana', version: '13.2.4' },
    });

    expect(result.checks.filter(({ path }) => path.endsWith('Version') || path === '$.target.cell'))
      .toEqual([
        {
          expected: 'oss@13.2.3 | enterprise@13.2.3',
          observed: 'oss@13.2.4',
          path: '$.target.cell',
          status: 'mismatch',
        },
        { expected: '19.2.8', observed: '19.2.9', path: '$.host.reactVersion', status: 'mismatch' },
        { expected: '19.2.8', observed: '19.2.7', path: '$.host.reactDomVersion', status: 'mismatch' },
      ]);
  });

  it('does not compare source revision but retains detached provenance', () => {
    const firstManifest = createManifest();
    const originalSecond = createManifest();
    const secondManifest = {
      ...originalSecond,
      target: {
        ...originalSecond.target,
        cells: [
          {
            ...originalSecond.target.cells[0]!,
            source: {
              ...originalSecond.target.cells[0]!.source,
              revision: 'another-source-revision',
            },
          },
          originalSecond.target.cells[1]!,
        ],
      },
    } satisfies ProviderCompatibilityManifest;

    const first = evaluateProviderCompatibility(inspect(firstManifest), matchingObservations());
    const second = evaluateProviderCompatibility(inspect(secondManifest), matchingObservations());

    expect(second.checks).toEqual(first.checks);
    expect(second.matchedTargetCell?.source.revision).toBe('another-source-revision');
    expect(second.matchedTargetCell).not.toBe(secondManifest.target.cells[0]);
  });
});

describe('evaluateProviderCompatibility dependencies and safety', () => {
  const dependencies = [
    { id: '@grafana/data', version: '13.2.3' },
    { id: '@grafana/scenes', version: '8.13.5' },
  ] as const;

  it('matches an exact dependency set independently of observation order', () => {
    const inspection = inspectWithDependencies(dependencies);
    const first = evaluateProviderCompatibility(inspection, {
      ...matchingObservations(),
      runtimeDependencies: [dependencies[1], dependencies[0]],
    });
    const second = evaluateProviderCompatibility(inspection, {
      ...matchingObservations(),
      runtimeDependencies: dependencies,
    });

    const dependencyChecks = first.checks.filter(({ path }) => path.startsWith('$.runtimeDependencies['));
    expect(dependencyChecks).toEqual([
      {
        expected: '13.2.3',
        observed: '13.2.3',
        path: '$.runtimeDependencies["@grafana/data"]',
        status: 'match',
      },
      {
        expected: '8.13.5',
        observed: '8.13.5',
        path: '$.runtimeDependencies["@grafana/scenes"]',
        status: 'match',
      },
    ]);
    expect(first).toEqual(second);
    expect(first.outcome).toBe('declared-requirements-match');
  });

  it('treats an explicit empty dependency set as matching an empty manifest set', () => {
    const result = evaluateProviderCompatibility(inspect(), matchingObservations());

    expect(result.checks.some(({ path }) => path.startsWith('$.runtimeDependencies'))).toBe(false);
    expect(result.outcome).toBe('declared-requirements-match');
  });

  it('treats a missing dependency collection as missing evidence even for an empty manifest set', () => {
    const { runtimeDependencies: _omitted, ...observations } = matchingObservations();

    const result = evaluateProviderCompatibility(inspect(), observations);

    expect(result.checks).toContainEqual({
      path: '$.runtimeDependencies',
      status: 'missing-evidence',
    });
    expect(result.outcome).toBe('insufficient-evidence');
  });

  it('reports missing, unexpected and version-mismatched dependencies in sorted order', () => {
    const inspection = inspectWithDependencies([
      { id: 'alpha', version: '1.0.0' },
      { id: 'beta', version: '2.0.0' },
      { id: 'delta', version: '4.0.0' },
    ]);
    const result = evaluateProviderCompatibility(inspection, {
      ...matchingObservations(),
      runtimeDependencies: [
        { id: 'gamma', version: '3.0.0' },
        { id: 'beta', version: '2.1.0' },
      ],
    });

    expect(result.checks.filter(({ path }) => path.startsWith('$.runtimeDependencies['))).toEqual([
      {
        expected: '1.0.0',
        path: '$.runtimeDependencies["alpha"]',
        status: 'mismatch',
      },
      {
        expected: '2.0.0',
        observed: '2.1.0',
        path: '$.runtimeDependencies["beta"]',
        status: 'mismatch',
      },
      {
        expected: '4.0.0',
        path: '$.runtimeDependencies["delta"]',
        status: 'mismatch',
      },
      {
        observed: '3.0.0',
        path: '$.runtimeDependencies["gamma"]',
        status: 'mismatch',
      },
    ]);
  });

  it('rejects duplicate dependency IDs', () => {
    const result = evaluateProviderCompatibility(inspectWithDependencies(dependencies), {
      ...matchingObservations(),
      runtimeDependencies: [dependencies[0], dependencies[0]],
    });

    expect(result.checks).toContainEqual({
      observed: '@grafana/data',
      path: '$.runtimeDependencies[1].id',
      status: 'invalid-observation',
    });
    expect(result.outcome).toBe('invalid-observations');
  });

  it.each([
    ['null root', null],
    ['array root', []],
    ['date root', new Date(0)],
    ['array target', { ...matchingObservations(), target: [] }],
    ['date host', { ...matchingObservations(), host: new Date(0) }],
    ['object dependency collection', { ...matchingObservations(), runtimeDependencies: {} }],
    ['primitive dependency entry', { ...matchingObservations(), runtimeDependencies: [1] }],
    ['non-plain dependency entry', { ...matchingObservations(), runtimeDependencies: [new Date(0)] }],
  ])('rejects malformed %s', (_label, observations) => {
    const result = evaluateUnknown(observations);

    expect(result.outcome).toBe('invalid-observations');
    expect(result.checks.some(({ status }) => status === 'invalid-observation')).toBe(true);
  });

  it.each([
    ['empty id', { id: '', version: '13.2.3' }, '$.runtimeDependencies[0].id'],
    ['non-string id', { id: 42, version: '13.2.3' }, '$.runtimeDependencies[0].id'],
    ['range version', { id: '@grafana/data', version: '^13.2.3' }, '$.runtimeDependencies[0].version'],
    ['wildcard version', { id: '@grafana/data', version: '13.x' }, '$.runtimeDependencies[0].version'],
    ['partial version', { id: '@grafana/data', version: '13.2' }, '$.runtimeDependencies[0].version'],
    ['empty version', { id: '@grafana/data', version: '' }, '$.runtimeDependencies[0].version'],
    ['non-string version', { id: '@grafana/data', version: 13_002_003 }, '$.runtimeDependencies[0].version'],
  ])('rejects dependency %s', (_label, entry, path) => {
    const result = evaluateUnknown({ ...matchingObservations(), runtimeDependencies: [entry] });

    expect(result.checks).toContainEqual({ path, status: 'invalid-observation' });
    expect(result.outcome).toBe('invalid-observations');
  });

  it('classifies a different valid dependency version as mismatch', () => {
    const result = evaluateProviderCompatibility(
      inspectWithDependencies([{ id: '@grafana/data', version: '13.2.3' }]),
      {
        ...matchingObservations(),
        runtimeDependencies: [{ id: '@grafana/data', version: '13.2.4' }],
      }
    );

    expect(result.checks).toContainEqual({
      expected: '13.2.3',
      observed: '13.2.4',
      path: '$.runtimeDependencies["@grafana/data"]',
      status: 'mismatch',
    });
  });

  it('rejects unknown, symbol-keyed and non-enumerable observation properties', () => {
    const symbol = Symbol('hidden');
    const observations = matchingObservations() as Record<PropertyKey, unknown>;
    observations.extra = true;
    observations[symbol] = true;
    Object.defineProperty(observations.host, 'hidden', { enumerable: false, value: true });

    const result = evaluateUnknown(observations);

    expect(result.checks).toContainEqual({ path: '$.extra', status: 'invalid-observation' });
    expect(result.checks).toContainEqual({ path: '$[symbol]', status: 'invalid-observation' });
    expect(result.checks).toContainEqual({ path: '$.host.hidden', status: 'invalid-observation' });
  });

  it('treats explicitly undefined optional data properties as missing evidence', () => {
    const explicit = evaluateUnknown({
      host: { reactDomVersion: undefined, reactVersion: undefined },
      runtimeDependencies: undefined,
      target: { edition: undefined, family: undefined, version: undefined },
    });
    const absent = evaluateUnknown({ host: {}, target: {} });

    expect(explicit).toEqual(absent);
    expect(explicit.outcome).toBe('insufficient-evidence');
  });

  it('rejects accessors without invoking them', () => {
    let reads = 0;
    const target = { edition: 'oss', family: 'grafana' } as Record<string, unknown>;
    Object.defineProperty(target, 'version', {
      enumerable: true,
      get() {
        reads += 1;
        return '13.2.3';
      },
    });

    const result = evaluateUnknown({ ...matchingObservations(), target });

    expect(reads).toBe(0);
    expect(result.checks).toContainEqual({
      path: '$.target.version',
      status: 'invalid-observation',
    });
  });

  it.each(['ownKeys', 'getPrototypeOf', 'getOwnPropertyDescriptor'] as const)(
    'sanitizes a throwing %s proxy trap',
    (trap) => {
      const message = `secret-${trap}`;
      const handler: ProxyHandler<object> = {
        [trap]() {
          throw new Error(message);
        },
      };
      const result = evaluateUnknown(new Proxy({ target: {} }, handler));

      expect(result.outcome).toBe('invalid-observations');
      expect(JSON.stringify(result)).not.toContain(message);
    }
  );

  it('fails closed when an enumerated dependency entry disappears before descriptor inspection', () => {
    const runtimeDependencies = new Proxy([{ id: 'dep', version: '9.0.0' }], {
      getOwnPropertyDescriptor(target, property) {
        if (property === '0') return undefined;
        return Reflect.getOwnPropertyDescriptor(target, property);
      },
    });

    const result = evaluateUnknown(
      { ...matchingObservations(), runtimeDependencies },
      inspectWithDependencies([{ id: 'dep', version: '1.0.0' }])
    );

    expect(result.checks).toContainEqual({
      path: '$.runtimeDependencies[0]',
      status: 'invalid-observation',
    });
    expect(result.outcome).toBe('invalid-observations');
  });

  it.each([
    [
      'root',
      () => phantomPropertyProxy(matchingObservations(), 'phantom'),
      '$.phantom',
    ],
    [
      'nested target',
      () => ({
        ...matchingObservations(),
        target: phantomPropertyProxy(matchingObservations().target!, 'phantom'),
      }),
      '$.target.phantom',
    ],
    [
      'dependency record',
      () => ({
        ...matchingObservations(),
        runtimeDependencies: [
          phantomPropertyProxy({ id: 'dep', version: '1.0.0' }, 'phantom'),
        ],
      }),
      '$.runtimeDependencies[0].phantom',
    ],
  ])('fails closed for a disappearing enumerated property at %s', (_label, create, path) => {
    const result = evaluateUnknown(create());

    expect(result.checks).toContainEqual({ path, status: 'invalid-observation' });
    expect(result.outcome).toBe('invalid-observations');
  });

  it('returns a deterministic invalid result for a revoked proxy', () => {
    const { proxy, revoke } = Proxy.revocable({}, {});
    revoke();

    const first = evaluateUnknown(proxy);
    const second = evaluateUnknown(proxy);

    expect(first).toEqual(second);
    expect(first.outcome).toBe('invalid-observations');
  });

  it('uses locale-independent dependency diagnostic ordering for all permutations', () => {
    const composed = 'é';
    const decomposed = 'e\u0301';
    const first = evaluateUnknown({
      ...matchingObservations(),
      runtimeDependencies: [
        { id: composed, version: '1.0.0' },
        { id: decomposed, version: '1.0.0' },
      ],
    });
    const second = evaluateUnknown({
      ...matchingObservations(),
      runtimeDependencies: [
        { id: decomposed, version: '1.0.0' },
        { id: composed, version: '1.0.0' },
      ],
    });

    expect(first).toEqual(second);
    expect(
      first.checks
        .filter(({ path }) => path.startsWith('$.runtimeDependencies['))
        .map(({ path }) => path)
    ).toEqual([
      `$.runtimeDependencies[${JSON.stringify(decomposed)}]`,
      `$.runtimeDependencies[${JSON.stringify(composed)}]`,
    ]);
  });

  it('rejects a dependency array beyond the 1,024-entry limit before indexed traversal', () => {
    let indexedDescriptorReads = 0;
    const array = new Array(1_000_000);
    const proxy = new Proxy(array, {
      getOwnPropertyDescriptor(target, property) {
        if (typeof property === 'string' && /^\d+$/.test(property)) indexedDescriptorReads += 1;
        return Reflect.getOwnPropertyDescriptor(target, property);
      },
    });

    const result = evaluateUnknown({ ...matchingObservations(), runtimeDependencies: proxy });

    expect(indexedDescriptorReads).toBe(0);
    expect(result.checks).toContainEqual({
      expected: 'at most 1024 entries',
      observed: '1000000 entries',
      path: '$.runtimeDependencies',
      status: 'invalid-observation',
    });
  });

  it('rejects a record beyond the 1,024-own-property limit', () => {
    const observations = matchingObservations() as Record<string, unknown>;
    for (let index = 0; index < 1_025; index += 1) observations[`extra${index}`] = index;

    const result = evaluateUnknown(observations);

    expect(result.checks).toContainEqual({
      expected: 'at most 1024 own properties',
      observed: '1028 own properties',
      path: '$',
      status: 'invalid-observation',
    });
  });

  it('rejects a sparse dependency array with one bounded diagnostic', () => {
    const runtimeDependencies = new Array(1_024);
    runtimeDependencies[1_023] = { id: 'last', version: '1.0.0' };

    const result = evaluateUnknown({ ...matchingObservations(), runtimeDependencies });
    const dependencyInvalid = result.checks.filter(
      ({ path, status }) => path.startsWith('$.runtimeDependencies') && status === 'invalid-observation'
    );

    expect(dependencyInvalid).toEqual([
      { path: '$.runtimeDependencies', status: 'invalid-observation' },
    ]);
  });

  it('caps diagnostics at 100 and fails closed with a deterministic final check', () => {
    const observations = matchingObservations() as Record<string, unknown>;
    for (let index = 0; index < 150; index += 1) observations[`extra${index}`] = index;

    const result = evaluateUnknown(observations);

    expect(result.checks).toHaveLength(100);
    expect(result.checks[99]).toEqual({
      expected: 'at most 99 detailed checks',
      observed: 'additional diagnostics omitted',
      path: '$',
      status: 'invalid-observation',
    });
    expect(result.outcome).toBe('invalid-observations');
  });

  it('applies outcome precedence independently of check order', () => {
    const invalid = evaluateUnknown({
      host: { reactDomVersion: '19.2.7', reactVersion: '^19.2.8' },
      runtimeDependencies: undefined,
      target: { edition: 'wrong', family: 'wrong', version: '13.2.4' },
    });
    const mismatch = evaluateProviderCompatibility(inspect(), {
      host: { reactDomVersion: '19.2.7', reactVersion: '19.2.8' },
      target: { edition: 'oss', family: 'grafana', version: '13.2.3' },
    });

    expect(invalid.outcome).toBe('invalid-observations');
    expect(invalid.checks.some(({ status }) => status === 'mismatch')).toBe(true);
    expect(invalid.checks.some(({ status }) => status === 'missing-evidence')).toBe(true);
    expect(mismatch.outcome).toBe('mismatch');
    expect(mismatch.checks.some(({ status }) => status === 'missing-evidence')).toBe(true);
  });

  it('returns detached deeply frozen results without retaining observations', () => {
    const observations = {
      host: { reactDomVersion: '19.2.8', reactVersion: '19.2.8' },
      runtimeDependencies: [{ id: '@grafana/data', version: '13.2.3' }],
      target: { edition: 'oss', family: 'grafana', version: '13.2.3' },
    };
    const inspection = inspectWithDependencies([{ id: '@grafana/data', version: '13.2.3' }]);
    const result = evaluateProviderCompatibility(inspection, observations);

    observations.host.reactVersion = '0.0.0';
    observations.runtimeDependencies[0]!.version = '0.0.0';
    observations.target.version = '0.0.0';

    expect(result.outcome).toBe('declared-requirements-match');
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.checks)).toBe(true);
    expect(result.checks.every(Object.isFrozen)).toBe(true);
    expect(Object.isFrozen(result.matchedTargetCell)).toBe(true);
    expect(Object.isFrozen(result.matchedTargetCell?.source)).toBe(true);
  });

  it('returns deeply equal but distinct results without a process-wide cache', () => {
    const inspection = inspectWithDependencies(dependencies);
    const observations = { ...matchingObservations(), runtimeDependencies: dependencies };

    const first = evaluateProviderCompatibility(inspection, observations);
    const second = evaluateProviderCompatibility(inspection, observations);

    expect(second).toEqual(first);
    expect(second).not.toBe(first);
    expect(second.checks).not.toBe(first.checks);
    expect(second.matchedTargetCell).not.toBe(first.matchedTargetCell);
  });
});
