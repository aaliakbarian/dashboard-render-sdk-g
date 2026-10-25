import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { inspectCoreBoundary } from './check-core-boundary.mjs';

const providerContractPackage = '@dashboard-render-sdk-g/provider-contract';

async function withCoreBoundaryFixture(
  files,
  callback,
  { compilerOptions = {}, inheritedCompilerOptions, manifest = {} } = {}
) {
  const repositoryRoot = await mkdtemp(path.join(tmpdir(), 'core-boundary-'));
  const packageRoot = path.join(repositoryRoot, 'packages/core');
  const sourceRoot = path.join(packageRoot, 'src');

  try {
    await mkdir(sourceRoot, { recursive: true });
    await writeFile(
      path.join(packageRoot, 'package.json'),
      JSON.stringify({
        dependencies: { [providerContractPackage]: 'workspace:*' },
        name: '@dashboard-render-sdk-g/core',
        private: true,
        ...manifest,
      })
    );
    await writeFile(
      path.join(packageRoot, 'tsconfig.json'),
      JSON.stringify({
        ...(inheritedCompilerOptions === undefined
          ? {}
          : { extends: '../../tsconfig.base.json' }),
        compilerOptions: {
          jsx: 'preserve',
          module: 'ESNext',
          moduleResolution: 'Bundler',
          noEmit: true,
          target: 'ES2022',
          types: [],
          ...compilerOptions,
        },
        exclude: ['src/**/*.test.ts', 'src/**/*.type-test.ts'],
        include: ['src/index.ts'],
      })
    );
    if (inheritedCompilerOptions !== undefined) {
      await writeFile(
        path.join(repositoryRoot, 'tsconfig.base.json'),
        JSON.stringify({ compilerOptions: inheritedCompilerOptions })
      );
    }
    await Promise.all(
      Object.entries(files).map(async ([relativePath, contents]) => {
        const target = path.join(sourceRoot, relativePath);
        await mkdir(path.dirname(target), { recursive: true });
        await writeFile(target, contents);
      })
    );
    await callback(repositoryRoot);
  } finally {
    await rm(repositoryRoot, { force: true, recursive: true });
  }
}

test('allows exact static value and type imports from the provider-contract public root', async () => {
  await withCoreBoundaryFixture(
    {
      'index.ts': `
        import { validateProviderCompatibilityManifest } from '${providerContractPackage}';
        import type { RendererProvider } from '${providerContractPackage}';
        type Result = import('${providerContractPackage}').ManifestValidationResult;
        void validateProviderCompatibilityManifest;
        export type Configuration = { readonly provider: RendererProvider; readonly result?: Result };
      `,
    },
    async (repositoryRoot) => {
      assert.deepEqual(await inspectCoreBoundary(repositoryRoot), {
        dependencyFindings: [],
        importFindings: [],
      });
    }
  );
});

test('rejects forbidden external value, type-only, dynamic, require, and import-equals references', async () => {
  await withCoreBoundaryFixture(
    {
      'index.ts': `
        import '@grafana/data';
        import type { SceneObject } from '@grafana/scenes';
        import type { ReactNode } from 'react';
        import type { Bridge } from '@dashboard-render-sdk-g/provider-13';
        import type { Poc } from '@dashboard-render-sdk-g/poc-compat';
        const lazy = import('react-dom');
        const loaded = require('node:fs');
        import legacy = require('react-router-dom');
        void lazy;
        void loaded;
        void legacy;
      `,
    },
    async (repositoryRoot) => {
      const findings = await inspectCoreBoundary(repositoryRoot);

      assert.deepEqual(
        findings.importFindings.map(({ kind, specifier }) => ({ kind, specifier })),
        [
          { kind: 'import', specifier: '@grafana/data' },
          { kind: 'import-type-declaration', specifier: '@grafana/scenes' },
          { kind: 'import-type-declaration', specifier: 'react' },
          {
            kind: 'import-type-declaration',
            specifier: '@dashboard-render-sdk-g/provider-13',
          },
          {
            kind: 'import-type-declaration',
            specifier: '@dashboard-render-sdk-g/poc-compat',
          },
          { kind: 'dynamic-import', specifier: 'react-dom' },
          { kind: 'commonjs-require', specifier: 'node:fs' },
          { kind: 'typescript-import-equals', specifier: 'react-router-dom' },
        ]
      );
    }
  );
});

test('rejects provider-contract subpaths and re-exports', async () => {
  await withCoreBoundaryFixture(
    {
      'index.ts': `
        import type { RendererProvider } from '${providerContractPackage}/internal';
        export type { ManifestValidationResult } from '${providerContractPackage}';
        void (undefined as unknown as RendererProvider);
      `,
    },
    async (repositoryRoot) => {
      const findings = await inspectCoreBoundary(repositoryRoot);

      assert.deepEqual(
        findings.importFindings.map(({ kind, specifier }) => ({ kind, specifier })),
        [
          { kind: 'import-type-declaration', specifier: `${providerContractPackage}/internal` },
          { kind: 'type-re-export', specifier: providerContractPackage },
        ]
      );
    }
  );
});

test('allows relative static modules but rejects relative dynamic and CommonJS loading', async () => {
  await withCoreBoundaryFixture(
    {
      'helper.ts': 'export type Helper = string; export const value = 1;\n',
      'index.ts': `
        import { value } from './helper';
        export type { Helper } from './helper';
        const lazy = import('./helper');
        const loaded = require('./helper');
        void value;
        void lazy;
        void loaded;
      `,
    },
    async (repositoryRoot) => {
      const findings = await inspectCoreBoundary(repositoryRoot);

      assert.deepEqual(
        findings.importFindings.map(({ kind, specifier }) => ({ kind, specifier })),
        [
          { kind: 'dynamic-import', specifier: './helper' },
          { kind: 'commonjs-require', specifier: './helper' },
        ]
      );
    }
  );
});

test('checks triple-slash references, effective imports of test modules, and unresolved modules', async () => {
  await withCoreBoundaryFixture(
    {
      'hidden.type-test.ts': '/// <reference types="react" />\nexport type Hidden = string;\n',
      'index.ts': `
        export type { Hidden } from './hidden.type-test';
        export type { Missing } from './missing';
      `,
    },
    async (repositoryRoot) => {
      const findings = await inspectCoreBoundary(repositoryRoot);

      assert.deepEqual(
        findings.importFindings.map(({ kind, specifier }) => ({ kind, specifier })),
        [
          { kind: 'triple-slash-types', specifier: 'react' },
          { kind: 'production-imports-test-module', specifier: './hidden.type-test' },
          { kind: 'unresolved-relative-import', specifier: './missing' },
        ]
      );
    }
  );
});

test('rejects compiler-synthesized package dependencies', async () => {
  for (const compilerOptions of [
    { types: ['node'] },
    { jsx: 'react-jsx' },
    { jsx: 'preserve', jsxImportSource: 'react' },
    { importHelpers: true },
    { plugins: [{ name: 'forbidden-compiler-plugin' }] },
  ]) {
    await withCoreBoundaryFixture(
      { 'index.ts': 'export const value = 1;\n' },
      async (repositoryRoot) => {
        const findings = await inspectCoreBoundary(repositoryRoot);

        assert.equal(findings.dependencyFindings.length, 1);
      },
      { compilerOptions }
    );
  }
});

test('rejects an exact path mapping that redirects the allowed provider-contract import', async () => {
  await withCoreBoundaryFixture(
    {
      '../../poc-compat/src/index.ts': 'export type Redirected = string;\n',
      'index.ts': `import type { Redirected } from '${providerContractPackage}';\nexport type Value = Redirected;\n`,
    },
    async (repositoryRoot) => {
      const findings = await inspectCoreBoundary(repositoryRoot);

      assert.ok(
        findings.dependencyFindings.some(
          ({ path: pathName }) => pathName === 'compilerOptions.paths'
        )
      );
    },
    {
      compilerOptions: {
        paths: {
          [providerContractPackage]: ['../poc-compat/src/index.ts'],
        },
      },
    }
  );
});

test('rejects a wildcard path mapping that can redirect the allowed provider-contract import', async () => {
  await withCoreBoundaryFixture(
    {
      '../../poc-compat/src/provider-contract.ts': 'export type Redirected = string;\n',
      'index.ts': `import type { Redirected } from '${providerContractPackage}';\nexport type Value = Redirected;\n`,
    },
    async (repositoryRoot) => {
      const findings = await inspectCoreBoundary(repositoryRoot);

      assert.ok(
        findings.dependencyFindings.some(
          ({ path: pathName }) => pathName === 'compilerOptions.paths'
        )
      );
    },
    {
      compilerOptions: {
        paths: {
          '@dashboard-render-sdk-g/*': ['../poc-compat/src/*'],
        },
      },
    }
  );
});

test('rejects inherited path mappings from the effective production configuration', async () => {
  await withCoreBoundaryFixture(
    {
      '../../poc-compat/src/index.ts': 'export type Redirected = string;\n',
      'index.ts': `import type { Redirected } from '${providerContractPackage}';\nexport type Value = Redirected;\n`,
    },
    async (repositoryRoot) => {
      const findings = await inspectCoreBoundary(repositoryRoot);

      assert.ok(
        findings.dependencyFindings.some(
          ({ path: pathName }) => pathName === 'compilerOptions.paths'
        )
      );
    },
    {
      inheritedCompilerOptions: {
        paths: {
          [providerContractPackage]: ['./packages/poc-compat/src/index.ts'],
        },
      },
    }
  );
});

test('rejects baseUrl configuration that can redirect the allowed provider-contract import', async () => {
  await withCoreBoundaryFixture(
    {
      '../aliases/@dashboard-render-sdk-g/provider-contract/index.ts':
        'export type Redirected = string;\n',
      'index.ts': `import type { Redirected } from '${providerContractPackage}';\nexport type Value = Redirected;\n`,
    },
    async (repositoryRoot) => {
      const findings = await inspectCoreBoundary(repositoryRoot);

      assert.ok(
        findings.dependencyFindings.some(
          ({ path: pathName }) => pathName === 'compilerOptions.baseUrl'
        )
      );
    },
    { compilerOptions: { baseUrl: './aliases' } }
  );
});

test('enforces the exact provider-contract workspace dependency and no other sections', async () => {
  for (const [manifest, expectedKind] of [
    [{ dependencies: {} }, 'missing-required-dependency'],
    [
      { dependencies: { [providerContractPackage]: '^1.0.0' } },
      'invalid-dependency-range',
    ],
    [
      { dependencies: { [providerContractPackage]: 'workspace:*', react: '19.2.8' } },
      'forbidden-dependency',
    ],
    [{ devDependencies: {} }, 'forbidden-dependency-section'],
    [{ peerDependencies: { react: '19.2.8' } }, 'forbidden-dependency-section'],
    [{ peerDependenciesMeta: {} }, 'forbidden-dependency-section'],
    [{ optionalDependencies: {} }, 'forbidden-dependency-section'],
    [{ bundledDependencies: ['react'] }, 'forbidden-dependency-section'],
    [{ bundleDependencies: ['react'] }, 'forbidden-dependency-section'],
    [{ dependenciesMeta: {} }, 'forbidden-dependency-section'],
    [{ resolutions: { react: '19.2.8' } }, 'forbidden-dependency-section'],
    [{ overrides: { react: '19.2.8' } }, 'forbidden-dependency-section'],
    [{ pnpm: { overrides: { react: '19.2.8' } } }, 'forbidden-dependency-section'],
  ]) {
    await withCoreBoundaryFixture(
      { 'index.ts': 'export const value = 1;\n' },
      async (repositoryRoot) => {
        const findings = await inspectCoreBoundary(repositoryRoot);

        assert.ok(findings.dependencyFindings.some(({ kind }) => kind === expectedKind));
      },
      { manifest }
    );
  }
});

test('the real core package satisfies the boundary', async () => {
  assert.deepEqual(await inspectCoreBoundary(), {
    dependencyFindings: [],
    importFindings: [],
  });
});
