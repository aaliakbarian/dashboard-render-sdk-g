import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  inspectDependencySections,
  inspectProviderContractBoundary,
  inspectSourceImports,
} from './check-provider-contract-boundary.mjs';

async function withBoundaryFixture(files, callback, compilerOptions = {}) {
  const repositoryRoot = await mkdtemp(path.join(tmpdir(), 'provider-contract-boundary-'));
  const packageRoot = path.join(repositoryRoot, 'packages/provider-contract');
  const sourceRoot = path.join(packageRoot, 'src');

  try {
    await mkdir(sourceRoot, { recursive: true });
    await writeFile(
      path.join(packageRoot, 'package.json'),
      JSON.stringify({ name: '@dashboard-render-sdk-g/provider-contract', private: true })
    );
    await writeFile(
      path.join(packageRoot, 'tsconfig.json'),
      JSON.stringify({
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

test('reports every forbidden external module reference form', () => {
  const source = `
    import value from '@scope/value';
    import type { TypeOnly } from '@scope/type-only';
    export { exported } from 'value-reexport';
    export type { ExportedType } from 'type-reexport';
    const lazy = import('dynamic-import');
    type Imported = import('typescript-import-type').Imported;
    import importedEquals = require('typescript-import-equals');
    const commonJs = require('commonjs-require');
  `;

  const findings = inspectSourceImports(source, 'fixture.ts');

  assert.deepEqual(
    findings.map(({ kind, specifier }) => ({ kind, specifier })),
    [
      { kind: 'import', specifier: '@scope/value' },
      { kind: 'import-type-declaration', specifier: '@scope/type-only' },
      { kind: 're-export', specifier: 'value-reexport' },
      { kind: 'type-re-export', specifier: 'type-reexport' },
      { kind: 'dynamic-import', specifier: 'dynamic-import' },
      { kind: 'typescript-import-type', specifier: 'typescript-import-type' },
      { kind: 'typescript-import-equals', specifier: 'typescript-import-equals' },
      { kind: 'commonjs-require', specifier: 'commonjs-require' },
    ]
  );
  assert.ok(findings.every((finding) => finding.file === 'fixture.ts'));
  assert.ok(findings.every((finding) => finding.line > 0));
});

test('reports non-literal dynamic loading that cannot prove a project-owned boundary', () => {
  const source = `
    const moduleName = getModuleName();
    const lazy = import(moduleName);
    const commonJs = require(moduleName);
  `;

  assert.deepEqual(
    inspectSourceImports(source, 'opaque.ts').map(({ kind, specifier }) => ({ kind, specifier })),
    [
      { kind: 'dynamic-import', specifier: '<non-literal>' },
      { kind: 'commonjs-require', specifier: '<non-literal>' },
    ]
  );
});

test('reports triple-slash type references', () => {
  const findings = inspectSourceImports('/// <reference types="react" />\nexport type Value = string;', 'fixture.ts');

  assert.deepEqual(
    findings.map(({ kind, specifier }) => ({ kind, specifier })),
    [{ kind: 'triple-slash-types', specifier: 'react' }]
  );
});

test('reports JSX syntax that would synthesize an implicit runtime import', () => {
  const findings = inspectSourceImports('export const View = () => <div />;', 'fixture.tsx');

  assert.deepEqual(
    findings.map(({ kind, specifier }) => ({ kind, specifier })),
    [{ kind: 'jsx-syntax', specifier: 'react/jsx-runtime' }]
  );
});

test('reports a JSX import-source pragma even when the file contains no JSX', () => {
  const findings = inspectSourceImports(
    '/** @jsxImportSource react */\nexport const value = 1;',
    'fixture.ts'
  );

  assert.deepEqual(
    findings.map(({ kind, specifier }) => ({ kind, specifier })),
    [{ kind: 'jsx-import-source-pragma', specifier: 'react/jsx-runtime' }]
  );
});

test('reports an automatic JSX-runtime pragma even when the file contains no JSX', () => {
  const findings = inspectSourceImports(
    '/** @jsxRuntime automatic */\nexport const value = 1;',
    'fixture.ts'
  );

  assert.deepEqual(
    findings.map(({ kind, specifier }) => ({ kind, specifier })),
    [{ kind: 'jsx-runtime-pragma', specifier: 'react/jsx-runtime' }]
  );
});

test('allows relative project-owned module references in every supported form', () => {
  const source = `
    import value from './value.js';
    import type { TypeOnly } from '../type-only.js';
    export { exported } from './value-reexport.js';
    export type { ExportedType } from '../type-reexport.js';
    const lazy = import('./dynamic-import.js');
    type Imported = import('../typescript-import-type.js').Imported;
    const commonJs = require('./commonjs-require.cjs');
  `;

  assert.deepEqual(inspectSourceImports(source, 'fixture.ts'), []);
});

test('does not mistake dot-prefixed bare specifiers for relative paths', () => {
  const findings = inspectSourceImports(
    `
      import '.external';
      export * from '.../module';
    `,
    'dot-prefix.ts'
  );

  assert.deepEqual(
    findings.map(({ kind, specifier }) => ({ kind, specifier })),
    [
      { kind: 'import', specifier: '.external' },
      { kind: 're-export', specifier: '.../module' },
    ]
  );
});

test('reports all dependency sections even when a section is empty', () => {
  const findings = inspectDependencySections({
    dependencies: { react: '19.2.8' },
    devDependencies: {},
    peerDependencies: { typescript: '6.0.2' },
    optionalDependencies: { optional: '1.0.0' },
  });

  assert.deepEqual(
    findings.map(({ section, packages }) => ({ section, packages })),
    [
      { section: 'dependencies', packages: ['react'] },
      { section: 'devDependencies', packages: [] },
      { section: 'peerDependencies', packages: ['typescript'] },
      { section: 'optionalDependencies', packages: ['optional'] },
    ]
  );
});

test('accepts a manifest with no dependency sections', () => {
  assert.deepEqual(
    inspectDependencySections({
      name: '@dashboard-render-sdk-g/provider-contract',
      private: true,
    }),
    []
  );
});

test('uses the effective production graph and ignores unreferenced excluded source', async () => {
  await withBoundaryFixture(
    {
      'detached.ts': "import 'react';\n",
      'index.ts': 'export const value = 1;\n',
    },
    async (repositoryRoot) => {
      const findings = await inspectProviderContractBoundary(repositoryRoot);

      assert.deepEqual(findings.importFindings, []);
    }
  );
});

test('inspects an excluded test-like module imported by production source', async () => {
  await withBoundaryFixture(
    {
      'hidden.test.ts': "import type { ReactNode } from 'react';\nexport type Hidden = ReactNode;\n",
      'index.ts': "export type { Hidden } from './hidden.test';\n",
    },
    async (repositoryRoot) => {
      const findings = await inspectProviderContractBoundary(repositoryRoot);

      assert.deepEqual(
        findings.importFindings.map(({ kind, specifier }) => ({ kind, specifier })),
        [
          { kind: 'import-type-declaration', specifier: 'react' },
          { kind: 'production-imports-test-module', specifier: './hidden.test' },
        ]
      );
    }
  );
});

test('follows require-only relative modules outside configured roots', async () => {
  await withBoundaryFixture(
    {
      '../helper.ts': "import 'react';\nexport const helper = true;\n",
      'index.ts': "declare const require: (id: string) => unknown;\nrequire('../helper');\n",
    },
    async (repositoryRoot) => {
      const findings = await inspectProviderContractBoundary(repositoryRoot);

      assert.deepEqual(
        findings.importFindings.map(({ kind, specifier }) => ({ kind, specifier })),
        [{ kind: 'import', specifier: 'react' }]
      );
    }
  );
});

test('fails closed when a relative production import cannot be resolved', async () => {
  await withBoundaryFixture(
    { 'index.ts': "export type { Missing } from './missing';\n" },
    async (repositoryRoot) => {
      const findings = await inspectProviderContractBoundary(repositoryRoot);

      assert.deepEqual(
        findings.importFindings.map(({ kind, specifier }) => ({ kind, specifier })),
        [{ kind: 'unresolved-relative-import', specifier: './missing' }]
      );
    }
  );
});

test('reports ambient type packages configured for the production program', async () => {
  await withBoundaryFixture(
    { 'index.ts': 'export const value = 1;\n' },
    async (repositoryRoot) => {
      const findings = await inspectProviderContractBoundary(repositoryRoot);

      assert.deepEqual(findings.dependencyFindings, [
        {
          file: 'packages/provider-contract/tsconfig.json',
          packages: ['react'],
          section: 'compilerOptions.types',
        },
      ]);
    },
    { types: ['react'] }
  );
});

test('reports automatic React JSX runtime modes configured for the production program', async () => {
  for (const [jsx, runtime] of [
    ['react-jsx', 'react/jsx-runtime'],
    ['react-jsxdev', 'react/jsx-dev-runtime'],
  ]) {
    await withBoundaryFixture(
      { 'index.ts': 'export const value = 1;\n' },
      async (repositoryRoot) => {
        const findings = await inspectProviderContractBoundary(repositoryRoot);

        assert.deepEqual(findings.dependencyFindings, [
          {
            file: 'packages/provider-contract/tsconfig.json',
            packages: [runtime],
            section: 'compilerOptions.jsx',
          },
        ]);
      },
      { jsx }
    );
  }
});

test('reports an effective JSX import source even with preserve emit', async () => {
  await withBoundaryFixture(
    { 'index.ts': 'export const value = 1;\n' },
    async (repositoryRoot) => {
      const findings = await inspectProviderContractBoundary(repositoryRoot);

      assert.deepEqual(findings.dependencyFindings, [
        {
          file: 'packages/provider-contract/tsconfig.json',
          packages: ['react/jsx-runtime'],
          section: 'compilerOptions.jsxImportSource',
        },
      ]);
    },
    { jsx: 'preserve', jsxImportSource: 'react' }
  );
});

test('reports imported compiler helpers configured for the production program', async () => {
  await withBoundaryFixture(
    { 'index.ts': 'export const value = 1;\n' },
    async (repositoryRoot) => {
      const findings = await inspectProviderContractBoundary(repositoryRoot);

      assert.deepEqual(findings.dependencyFindings, [
        {
          file: 'packages/provider-contract/tsconfig.json',
          packages: ['tslib'],
          section: 'compilerOptions.importHelpers',
        },
      ]);
    },
    { importHelpers: true }
  );
});
