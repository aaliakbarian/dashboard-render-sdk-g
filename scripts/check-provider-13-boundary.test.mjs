import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { inspectProvider13Boundary } from './check-provider-13-boundary.mjs';

const providerContractPackage = '@dashboard-render-sdk-g/provider-contract';

async function withFixture(
  files,
  callback,
  { compilerOptions = {}, inheritedCompilerOptions, manifest = {} } = {}
) {
  const repositoryRoot = await mkdtemp(path.join(tmpdir(), 'provider-13-boundary-'));
  const packageRoot = path.join(repositoryRoot, 'packages/provider-13');
  const sourceRoot = path.join(packageRoot, 'src');

  try {
    await mkdir(sourceRoot, { recursive: true });
    await writeFile(
      path.join(packageRoot, 'package.json'),
      JSON.stringify({
        dependencies: { [providerContractPackage]: 'workspace:*' },
        name: '@dashboard-render-sdk-g/provider-13',
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

test('allows static provider-contract imports and local static modules', async () => {
  await withFixture(
    {
      'helper.ts': 'export type Helper = string; export const value = 1;\n',
      'index.ts': `
        import { HOST_TRANSPORT_DESCRIPTOR_SCHEMA_VERSION } from '${providerContractPackage}';
        import type { HostTransportCapability } from '${providerContractPackage}';
        type Result = import('${providerContractPackage}').TransportResult;
        export { value } from './helper';
        export type { Helper } from './helper';
        void HOST_TRANSPORT_DESCRIPTOR_SCHEMA_VERSION;
        export type Input = { transport: HostTransportCapability; result?: Result };
      `,
    },
    async (repositoryRoot) => {
      assert.deepEqual(await inspectProvider13Boundary(repositoryRoot), {
        dependencyFindings: [],
        importFindings: [],
      });
    }
  );
});

test('rejects forbidden static, type, dynamic, CommonJS, import-equals, subpath, and re-export references', async () => {
  await withFixture(
    {
      'index.ts': `
        import '@grafana/data';
        import type { SceneObject } from '@grafana/scenes';
        import type { ReactNode } from 'react';
        import type { Core } from '@dashboard-render-sdk-g/core';
        import type { Poc } from '@dashboard-render-sdk-g/poc-compat';
        import type { Internal } from '${providerContractPackage}/internal';
        export type { TransportResult } from '${providerContractPackage}';
        const lazy = import('react-dom');
        const loaded = require('node:fs');
        import legacy = require('react-router-dom');
        void lazy; void loaded; void legacy;
      `,
    },
    async (repositoryRoot) => {
      const findings = await inspectProvider13Boundary(repositoryRoot);
      const pairs = findings.importFindings.map(({ kind, specifier }) => ({ kind, specifier }));
      for (const expected of [
        { kind: 'import', specifier: '@grafana/data' },
        { kind: 'import-type-declaration', specifier: '@grafana/scenes' },
        { kind: 'import-type-declaration', specifier: 'react' },
        { kind: 'import-type-declaration', specifier: '@dashboard-render-sdk-g/core' },
        { kind: 'import-type-declaration', specifier: '@dashboard-render-sdk-g/poc-compat' },
        { kind: 'import-type-declaration', specifier: `${providerContractPackage}/internal` },
        { kind: 'type-re-export', specifier: providerContractPackage },
        { kind: 'dynamic-import', specifier: 'react-dom' },
        { kind: 'commonjs-require', specifier: 'node:fs' },
        { kind: 'typescript-import-equals', specifier: 'react-router-dom' },
      ]) {
        assert.ok(
          pairs.some(
            (actual) => actual.kind === expected.kind && actual.specifier === expected.specifier
          ),
          JSON.stringify(expected)
        );
      }
    }
  );
});

test('rejects relative dynamic loading, JSX, triple-slash, test modules, outside-package and unresolved imports', async () => {
  await withFixture(
    {
      '../../outside.ts': 'export const outside = 1;\n',
      'component.tsx': 'export const element = <div />;\n',
      'hidden.type-test.ts': '/// <reference types="react" />\nexport type Hidden = string;\n',
      'index.ts': `
        export type { Hidden } from './hidden.type-test';
        export { outside } from '../../outside';
        export { element } from './component';
        export type { Missing } from './missing';
        const lazy = import('./hidden.type-test');
        void lazy;
      `,
    },
    async (repositoryRoot) => {
      const kinds = (await inspectProvider13Boundary(repositoryRoot)).importFindings.map(
        ({ kind }) => kind
      );
      for (const expected of [
        'triple-slash-types',
        'production-imports-test-module',
        'relative-import-outside-package',
        'unresolved-relative-import',
        'dynamic-import',
        'jsx-syntax',
      ]) assert.ok(kinds.includes(expected), expected);
    }
  );
});

test('rejects compiler-injected dependencies and path redirection from direct or inherited configuration', async () => {
  for (const options of [
    { compilerOptions: { types: ['node'] } },
    { compilerOptions: { jsx: 'react-jsx' } },
    { compilerOptions: { jsx: 'preserve', jsxImportSource: 'react' } },
    { compilerOptions: { importHelpers: true } },
    { compilerOptions: { plugins: [{ name: 'forbidden-plugin' }] } },
    { compilerOptions: { paths: { [providerContractPackage]: ['../poc-compat/src/index.ts'] } } },
    { compilerOptions: { paths: { '@dashboard-render-sdk-g/*': ['../poc-compat/src/*'] } } },
    { compilerOptions: { baseUrl: './aliases' } },
    { inheritedCompilerOptions: { paths: { [providerContractPackage]: ['./bad.ts'] } } },
  ]) {
    await withFixture(
      { 'index.ts': `import type { TransportResult } from '${providerContractPackage}';\nexport type Value = TransportResult;\n` },
      async (repositoryRoot) => {
        assert.ok((await inspectProvider13Boundary(repositoryRoot)).dependencyFindings.length > 0);
      },
      options
    );
  }
});

test('enforces the exact single workspace dependency and rejects bypass metadata', async () => {
  for (const [manifest, expectedKind] of [
    [{ dependencies: {} }, 'missing-required-dependency'],
    [{ dependencies: { [providerContractPackage]: '^1.0.0' } }, 'invalid-dependency-range'],
    [{ dependencies: { [providerContractPackage]: 'workspace:*', react: '19.2.8' } }, 'forbidden-dependency'],
    [{ devDependencies: {} }, 'forbidden-dependency-section'],
    [{ peerDependencies: {} }, 'forbidden-dependency-section'],
    [{ peerDependenciesMeta: {} }, 'forbidden-dependency-section'],
    [{ optionalDependencies: {} }, 'forbidden-dependency-section'],
    [{ bundledDependencies: [] }, 'forbidden-dependency-section'],
    [{ bundleDependencies: [] }, 'forbidden-dependency-section'],
    [{ dependenciesMeta: {} }, 'forbidden-dependency-section'],
    [{ resolutions: {} }, 'forbidden-dependency-section'],
    [{ overrides: {} }, 'forbidden-dependency-section'],
    [{ pnpm: {} }, 'forbidden-dependency-section'],
  ]) {
    await withFixture(
      { 'index.ts': 'export const value = 1;\n' },
      async (repositoryRoot) => {
        assert.ok(
          (await inspectProvider13Boundary(repositoryRoot)).dependencyFindings.some(
            ({ kind }) => kind === expectedKind
          )
        );
      },
      { manifest }
    );
  }
});

test('the real provider-13 package satisfies the boundary', async () => {
  assert.deepEqual(await inspectProvider13Boundary(), {
    dependencyFindings: [],
    importFindings: [],
  });
});
