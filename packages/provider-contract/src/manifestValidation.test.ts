import { describe, expect, it } from 'vitest';

import { isExactVersion } from './index';
import { validateProviderCompatibilityManifest } from './manifestValidation';

describe('isExactVersion', () => {
  it.each(['0.0.0', '13.2.3', '1.2.3-test.1', '1.2.3+build.7', '1.2.3-rc.1+build.7'])(
    'accepts exact version %s',
    (version) => {
      expect(isExactVersion(version)).toBe(true);
    }
  );

  it.each([
    ['range', '^13.2.3'],
    ['wildcard', '13.x'],
    ['partial', '13.2'],
    ['major only', '13'],
    ['empty', ''],
    ['leading zero', '013.2.3'],
    ['version prefix', 'v13.2.3'],
    ['malformed prerelease', '13.2.3-'],
    ['number', 13_002_003],
    ['undefined', undefined],
  ])('rejects %s exact-version observation', (_label, value) => {
    expect(isExactVersion(value)).toBe(false);
  });
});

function validManifest(): Record<string, unknown> {
  return {
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
    schemaVersion: 1,
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
  };
}

function nestedRecord(root: Record<string, unknown>, key: string): Record<string, unknown> {
  return root[key] as Record<string, unknown>;
}

function expectInvalid(input: unknown, code: string, path: string) {
  const result = validateProviderCompatibilityManifest(input);

  expect(result.valid).toBe(false);
  if (result.valid) {
    throw new Error('Expected manifest validation to fail.');
  }
  expect(result.errors).toContainEqual(expect.objectContaining({ code, path }));
}

describe('validateProviderCompatibilityManifest', () => {
  it('accepts the exact approved Grafana 13.2.3 compatibility-cell structure', () => {
    const result = validateProviderCompatibilityManifest(validManifest());

    expect(result.valid).toBe(true);
    if (!result.valid) {
      throw new Error(JSON.stringify(result.errors));
    }
    expect(result.manifest).toMatchObject({
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
      host: { reactDomVersion: '19.2.8', reactVersion: '19.2.8' },
      schemaVersion: 1,
      target: { family: 'grafana' },
    });
  });

  it('keeps structural validation separate from compatibility admission', () => {
    const input = validManifest();
    const target = nestedRecord(input, 'target');
    target.family = 'another-dashboard-provider';
    target.cells = [
      {
        edition: 'default',
        source: {
          repository: 'https://example.invalid/another-dashboard-provider',
          revision: 'unverified-revision',
        },
        version: '99.0.0',
      },
    ];

    const result = validateProviderCompatibilityManifest(input);

    expect(result.valid).toBe(true);
    expect(result).not.toHaveProperty('admitted');
    expect(result).not.toHaveProperty('compatible');
    expect(result).not.toHaveProperty('verified');
  });

  it('reports missing required fields with stable paths', () => {
    const input = validManifest();
    delete input.provider;

    expectInvalid(input, 'missing-field', '$.provider');
  });

  it('rejects unknown fields instead of silently ignoring them', () => {
    const input = validManifest();
    nestedRecord(input, 'provider').unexpected = true;

    expectInvalid(input, 'unknown-field', '$.provider.unexpected');
  });

  it('rejects unsupported manifest schema versions distinctly', () => {
    const input = validManifest();
    input.schemaVersion = 2;

    expectInvalid(input, 'unsupported-manifest-version', '$.schemaVersion');
  });

  it.each([
    ['empty provider ID', '$.provider.id', ''],
    ['whitespace in provider ID', '$.provider.id', 'bad provider'],
    ['empty target family', '$.target.family', ''],
    ['empty panel ID', '$.capabilities.panels[1]', ''],
    ['whitespace in datasource ID', '$.capabilities.datasources[0]', 'bad datasource'],
  ])('rejects %s', (_label, path, value) => {
    const input = validManifest();
    if (path === '$.provider.id') nestedRecord(input, 'provider').id = value;
    if (path === '$.target.family') nestedRecord(input, 'target').family = value;
    if (path === '$.capabilities.panels[1]') {
      nestedRecord(nestedRecord(input, 'capabilities'), 'panels')[1] = value;
    }
    if (path === '$.capabilities.datasources[0]') {
      nestedRecord(nestedRecord(input, 'capabilities'), 'datasources')[0] = value;
    }

    expectInvalid(input, 'invalid-identifier', path);
  });

  it.each([
    ['runtime dependency', '$.runtimeDependencies[7].id', 'runtimeDependencies', { id: '@grafana/data', version: '13.2.3' }],
    ['panel', '$.capabilities.panels[3]', 'panels', 'text'],
    ['datasource', '$.capabilities.datasources[1]', 'datasources', 'grafana-testdata-datasource'],
    ['transformation', '$.capabilities.transformations.ids[1]', 'transformations', 'renameByRegex'],
  ])('rejects duplicate %s identifiers', (_label, path, collection, duplicate) => {
    const input = validManifest();
    if (collection === 'runtimeDependencies') {
      (input.runtimeDependencies as unknown[]).push(duplicate);
    } else if (collection === 'panels' || collection === 'datasources') {
      const capabilities = nestedRecord(input, 'capabilities');
      (capabilities[collection] as unknown[]).push(duplicate);
    } else {
      const transformations = nestedRecord(nestedRecord(input, 'capabilities'), 'transformations');
      (transformations.ids as unknown[]).push(duplicate);
    }

    expectInvalid(input, 'duplicate-identifier', path);
  });

  it.each([
    ['provider version', '$.provider.version', '^1.2.3'],
    ['target version', '$.target.cells[0].version', '13.2'],
    ['runtime dependency version', '$.runtimeDependencies[0].version', '>=13.2.3'],
    ['React version', '$.host.reactVersion', '19.x'],
    ['ReactDOM version', '$.host.reactDomVersion', 'v19.2.8'],
  ])('rejects a non-exact %s', (_label, path, value) => {
    const input = validManifest();
    if (path === '$.provider.version') nestedRecord(input, 'provider').version = value;
    if (path === '$.target.cells[0].version') {
      ((nestedRecord(input, 'target').cells as Record<string, unknown>[])[0] as Record<string, unknown>).version = value;
    }
    if (path === '$.runtimeDependencies[0].version') {
      ((input.runtimeDependencies as Record<string, unknown>[])[0] as Record<string, unknown>).version = value;
    }
    if (path === '$.host.reactVersion') nestedRecord(input, 'host').reactVersion = value;
    if (path === '$.host.reactDomVersion') nestedRecord(input, 'host').reactDomVersion = value;

    expectInvalid(input, 'invalid-exact-version', path);
  });

  it('rejects duplicate target cells', () => {
    const input = validManifest();
    const cells = nestedRecord(input, 'target').cells as unknown[];
    cells.push(structuredClone(cells[0]));

    expectInvalid(input, 'duplicate-identifier', '$.target.cells[1]');
  });

  it('rejects duplicate dashboard APIs', () => {
    const input = validManifest();
    const apis = nestedRecord(input, 'dashboards').apis as unknown[];
    apis.push({ group: 'dashboard.grafana.app', version: 'v1' });

    expectInvalid(input, 'duplicate-identifier', '$.dashboards.apis[1]');
  });

  it('rejects duplicate dashboard schema declarations', () => {
    const input = validManifest();
    const schemas = nestedRecord(input, 'dashboards').schemas as unknown[];
    schemas.push({ family: 'v1', schemaVersion: 42 });

    expectInvalid(input, 'duplicate-identifier', '$.dashboards.schemas[1]');
  });

  it.each([0, -1, 42.5, Number.MAX_SAFE_INTEGER + 1])(
    'rejects dashboard schemaVersion %s',
    (schemaVersion) => {
      const input = validManifest();
      const schemas = nestedRecord(input, 'dashboards').schemas as Record<string, unknown>[];
      (schemas[0] as Record<string, unknown>).schemaVersion = schemaVersion;

      expectInvalid(input, 'invalid-dashboard-declaration', '$.dashboards.schemas[0].schemaVersion');
    }
  );

  it('rejects empty dashboard API declarations', () => {
    const input = validManifest();
    nestedRecord(input, 'dashboards').apis = [];

    expectInvalid(input, 'invalid-dashboard-declaration', '$.dashboards.apis');
  });

  it('rejects empty dashboard schema declarations', () => {
    const input = validManifest();
    nestedRecord(input, 'dashboards').schemas = [];

    expectInvalid(input, 'invalid-dashboard-declaration', '$.dashboards.schemas');
  });

  it.each([-1, 1.5, Number.MAX_SAFE_INTEGER + 1])('rejects transformation maxChainLength %s', (maxChainLength) => {
    const input = validManifest();
    const transformations = nestedRecord(nestedRecord(input, 'capabilities'), 'transformations');
    transformations.maxChainLength = maxChainLength;

    expectInvalid(input, 'invalid-capability', '$.capabilities.transformations.maxChainLength');
  });

  it('rejects a positive transformation chain limit without supported transformations', () => {
    const input = validManifest();
    const transformations = nestedRecord(nestedRecord(input, 'capabilities'), 'transformations');
    transformations.ids = [];

    expectInvalid(input, 'invalid-capability', '$.capabilities.transformations.maxChainLength');
  });

  it('rejects supported transformations when the maximum chain length is zero', () => {
    const input = validManifest();
    const transformations = nestedRecord(nestedRecord(input, 'capabilities'), 'transformations');
    transformations.maxChainLength = 0;

    expectInvalid(input, 'invalid-capability', '$.capabilities.transformations.maxChainLength');
  });

  it.each([
    ['undefined', undefined],
    ['function', () => 'not-json'],
    ['symbol', Symbol('not-json')],
    ['bigint', 1n],
    ['NaN', Number.NaN],
    ['positive infinity', Number.POSITIVE_INFINITY],
    ['negative infinity', Number.NEGATIVE_INFINITY],
  ])('rejects a %s manifest field as non-serializable', (_label, value) => {
    const input = validManifest();
    nestedRecord(input, 'provider').buildId = value;

    expectInvalid(input, 'non-serializable', '$.provider.buildId');
  });

  it('rejects cyclic objects as non-serializable', () => {
    const input = validManifest();
    nestedRecord(input, 'provider').cycle = input;

    expectInvalid(input, 'non-serializable', '$.provider.cycle');
  });

  it('rejects sparse arrays as non-serializable', () => {
    const input = validManifest();
    const sparsePanels = new Array<string>(2);
    sparsePanels[0] = 'text';
    nestedRecord(input, 'capabilities').panels = sparsePanels;

    expectInvalid(input, 'non-serializable', '$.capabilities.panels[1]');
  });

  it('reports one bounded diagnostic for a sparse array instead of every missing index', () => {
    const input = validManifest();
    const sparsePanels = new Array<string>(1_000);
    sparsePanels[0] = 'text';
    nestedRecord(input, 'capabilities').panels = sparsePanels;

    const result = validateProviderCompatibilityManifest(input);

    expect(result.valid).toBe(false);
    if (result.valid) throw new Error('Expected manifest validation to fail.');
    expect(result.errors).toEqual([
      expect.objectContaining({ code: 'non-serializable', path: '$.capabilities.panels[1]' }),
    ]);
  });

  it('rejects arrays beyond the manifest resource limit without scanning their contents', () => {
    const input = validManifest();
    nestedRecord(input, 'capabilities').panels = Array.from({ length: 1_025 }, () => 'text');

    expectInvalid(input, 'non-serializable', '$.capabilities.panels');
  });

  it('rejects arrays with too many extra own properties before inspecting every descriptor', () => {
    const input = validManifest();
    const oversized: unknown[] = [];
    for (let index = 0; index < 1_025; index += 1) {
      Object.defineProperty(oversized, `extra${index}`, {
        enumerable: true,
        value: index,
      });
    }
    nestedRecord(input, 'capabilities').panels = oversized;

    const result = validateProviderCompatibilityManifest(input);

    expect(result.valid).toBe(false);
    if (result.valid) throw new Error('Expected manifest validation to fail.');
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: 'non-serializable', path: '$.capabilities.panels' })
    );
    expect(result.errors.some(({ message }) => message.includes('maximum array property count'))).toBe(true);
  });

  it('rejects input beyond the maximum traversal depth without overflowing the stack', () => {
    const input = validManifest();
    const deepRoot: Record<string, unknown> = {};
    let cursor = deepRoot;
    for (let index = 0; index < 40; index += 1) {
      const next: Record<string, unknown> = {};
      cursor.next = next;
      cursor = next;
    }
    nestedRecord(input, 'provenance').deep = deepRoot;

    const result = validateProviderCompatibilityManifest(input);

    expect(result.valid).toBe(false);
    if (result.valid) throw new Error('Expected manifest validation to fail.');
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: 'non-serializable' })
    );
    expect(result.errors.some(({ message }) => message.includes('maximum traversal depth'))).toBe(true);
  });

  it('rejects input beyond the visited-node budget', () => {
    const input = validManifest();
    nestedRecord(input, 'provenance').large = Array.from(
      { length: 65 },
      (_, row) => Array.from({ length: 65 }, (_, column) => `${row}:${column}`)
    );

    const result = validateProviderCompatibilityManifest(input);

    expect(result.valid).toBe(false);
    if (result.valid) throw new Error('Expected manifest validation to fail.');
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        code: 'non-serializable',
        path: expect.stringMatching(/^\$\.provenance\.large\[\d+\]\[\d+\]$/),
      })
    );
    expect(result.errors.some(({ message }) => message.includes('maximum visited-node count'))).toBe(true);
  });

  it('rejects objects beyond the property-count limit before inspecting every descriptor', () => {
    const input = validManifest();
    const oversized: Record<string, unknown> = {};
    let getterCalls = 0;
    for (let index = 0; index < 1_025; index += 1) {
      Object.defineProperty(oversized, `entry${index}`, {
        enumerable: true,
        get() {
          getterCalls += 1;
          return index;
        },
      });
    }
    nestedRecord(input, 'provenance').large = oversized;

    const result = validateProviderCompatibilityManifest(input);

    expect(result.valid).toBe(false);
    if (result.valid) throw new Error('Expected manifest validation to fail.');
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: 'non-serializable', path: '$.provenance.large' })
    );
    expect(result.errors.some(({ message }) => message.includes('maximum object property count'))).toBe(true);
    expect(getterCalls).toBe(0);
  });

  it('caps diagnostics produced by hostile input', () => {
    const input = validManifest();
    for (let index = 0; index < 150; index += 1) {
      Object.defineProperty(input, Symbol(`hidden-${index}`), {
        enumerable: true,
        value: index,
      });
    }

    const result = validateProviderCompatibilityManifest(input);

    expect(result.valid).toBe(false);
    if (result.valid) throw new Error('Expected manifest validation to fail.');
    expect(result.errors).toHaveLength(100);
    expect(result.errors.at(-1)).toEqual(
      expect.objectContaining({
        code: 'non-serializable',
        message: expect.stringContaining('Additional diagnostics were omitted'),
      })
    );
  });

  it('returns a frozen typed failure for a revoked proxy', () => {
    const revocable = Proxy.revocable(validManifest(), {});
    revocable.revoke();

    const result = validateProviderCompatibilityManifest(revocable.proxy);

    expect(result.valid).toBe(false);
    if (result.valid) throw new Error('Expected manifest validation to fail.');
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: 'non-serializable', path: '$' })
    );
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.errors)).toBe(true);
  });

  it.each([
    ['ownKeys', { ownKeys: () => { throw new Error('sensitive-ownKeys-detail'); } }, '$.provider'],
    [
      'getPrototypeOf',
      { getPrototypeOf: () => { throw new Error('sensitive-getPrototypeOf-detail'); } },
      '$.provider',
    ],
    [
      'getOwnPropertyDescriptor',
      { getOwnPropertyDescriptor: () => { throw new Error('sensitive-descriptor-detail'); } },
      '$.provider.buildId',
    ],
  ] as const)('returns a sanitized typed failure when a proxy %s trap throws', (_trap, handler, path) => {
    const input = validManifest();
    input.provider = new Proxy(nestedRecord(input, 'provider'), handler);

    const result = validateProviderCompatibilityManifest(input);

    expect(result.valid).toBe(false);
    if (result.valid) throw new Error('Expected manifest validation to fail.');
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: 'non-serializable', path })
    );
    expect(result.errors.map(({ message }) => message).join('\n')).not.toContain('sensitive-');
    expect(Object.isFrozen(result.errors[0])).toBe(true);
  });

  it('rejects accessor properties without invoking them', () => {
    const input = validManifest();
    let getterCalls = 0;
    Object.defineProperty(nestedRecord(input, 'provider'), 'id', {
      configurable: true,
      enumerable: true,
      get() {
        getterCalls += 1;
        return 'synthetic-grafana-provider';
      },
    });

    expectInvalid(input, 'non-serializable', '$.provider.id');
    expect(getterCalls).toBe(0);
  });

  it.each([
    ['Date', new Date('2026-10-20T00:00:00.000Z')],
    ['Map', new Map([['recordId', 'synthetic-provider-build-provenance']])],
  ])('rejects a %s as a non-plain JSON object', (_label, value) => {
    const input = validManifest();
    input.provenance = value;

    expectInvalid(input, 'non-serializable', '$.provenance');
  });

  it('rejects symbol-keyed properties', () => {
    const input = validManifest();
    Object.defineProperty(input, Symbol('hidden'), {
      enumerable: true,
      value: 'not-json',
    });

    expectInvalid(input, 'non-serializable', '$');
  });

  it('detaches validated manifests from later caller mutation', () => {
    const input = validManifest();
    const result = validateProviderCompatibilityManifest(input);
    expect(result.valid).toBe(true);
    if (!result.valid) throw new Error(JSON.stringify(result.errors));

    nestedRecord(input, 'provider').id = 'mutated-provider';
    (nestedRecord(input, 'capabilities').panels as string[]).push('mutated-panel');

    expect(result.manifest.provider.id).toBe('synthetic-grafana-provider');
    expect(result.manifest.capabilities.panels).toEqual(['text', 'stat', 'timeseries']);
  });

  it('deeply freezes successful validation results', () => {
    const result = validateProviderCompatibilityManifest(validManifest());
    expect(result.valid).toBe(true);
    if (!result.valid) throw new Error(JSON.stringify(result.errors));

    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.manifest)).toBe(true);
    expect(Object.isFrozen(result.manifest.provider)).toBe(true);
    expect(Object.isFrozen(result.manifest.capabilities.panels)).toBe(true);
    expect(() => {
      (result.manifest.provider as { id: string }).id = 'mutated-provider';
    }).toThrow(TypeError);
  });

  it('returns deterministic detached results for repeated validation', () => {
    const input = validManifest();
    const first = validateProviderCompatibilityManifest(input);
    const second = validateProviderCompatibilityManifest(input);

    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    if (first.valid && second.valid) {
      expect(first.manifest).not.toBe(second.manifest);
    }
  });

  it('does not mutate invalid input and freezes its diagnostics', () => {
    const input = validManifest();
    nestedRecord(input, 'provider').unexpected = true;
    const before = structuredClone(input);

    const result = validateProviderCompatibilityManifest(input);

    expect(input).toEqual(before);
    expect(result.valid).toBe(false);
    if (result.valid) throw new Error('Expected manifest validation to fail.');
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.errors)).toBe(true);
    expect(Object.isFrozen(result.errors[0])).toBe(true);
  });
});
