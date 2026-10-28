import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { inspectProvider13Boundary } from './check-provider-13-boundary.mjs';

const providerContractPackage = '@dashboard-render-sdk-g/provider-contract';
const allowedDependencies = {
  [providerContractPackage]: 'workspace:*',
  '@emotion/css': '11.13.5',
  '@emotion/react': '11.14.0',
  '@grafana/data': '13.2.3',
  '@grafana/e2e-selectors': '13.2.3',
  '@grafana/i18n': '13.2.3',
  '@grafana/runtime': '13.2.3',
  '@grafana/scenes': '8.13.5',
  '@grafana/schema': '13.2.3',
  '@grafana/ui': '13.2.3',
  'dangerously-set-html-content': '1.1.1',
  'react-router-dom': '6.30.3',
  'react-use': '17.6.1',
  rxjs: '7.8.2',
  uplot: '1.6.32',
};
const allowedPeers = { react: '19.2.8', 'react-dom': '19.2.8' };

async function withFixture(
  files,
  callback,
  {
    compilerOptions = {},
    exclude = ['src/**/*.test.ts', 'src/**/*.type-test.ts'],
    include = ['src/index.ts'],
    inheritedCompilerOptions,
    manifest = {},
  } = {}
) {
  const repositoryRoot = await mkdtemp(path.join(tmpdir(), 'provider-13-boundary-'));
  const packageRoot = path.join(repositoryRoot, 'packages/provider-13');
  const sourceRoot = path.join(packageRoot, 'src');

  try {
    await mkdir(sourceRoot, { recursive: true });
    await writeFile(
      path.join(packageRoot, 'package.json'),
      JSON.stringify({
        dependencies: allowedDependencies,
        name: '@dashboard-render-sdk-g/provider-13',
        peerDependencies: allowedPeers,
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
        exclude,
        include,
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

test('rejects test and type-test TS and TSX files included as production roots', async () => {
  await withFixture(
    {
      'index.ts': 'export const value = 1;\n',
      'hidden.test.ts': 'export const hiddenTest = true;\n',
      'hidden-jsx.test.tsx': 'export const hiddenTestTsx = <div />;\n',
      'hidden.type-test.ts': 'export type HiddenTypeTest = string;\n',
      'hidden-jsx.type-test.tsx': 'export type HiddenTypeTestTsx = string;\n',
    },
    async (repositoryRoot) => {
      const result = await inspectProvider13Boundary(repositoryRoot);
      assert.deepEqual(
        result.importFindings.map(({ file, kind }) => ({ file, kind })),
        [
          { file: 'packages/provider-13/src/hidden-jsx.test.tsx', kind: 'production-test-root' },
          { file: 'packages/provider-13/src/hidden-jsx.type-test.tsx', kind: 'production-test-root' },
          { file: 'packages/provider-13/src/hidden.test.ts', kind: 'production-test-root' },
          { file: 'packages/provider-13/src/hidden.type-test.ts', kind: 'production-test-root' },
        ]
      );
    },
    {
      exclude: [],
      include: ['src/**/*.ts', 'src/**/*.tsx'],
    }
  );
});

test('allows exact provider dependencies, React externals, audited Text alias, and local modules', async () => {
  await withFixture(
    {
      'helper.ts': 'export type Helper = string; export const value = 1;\n',
      'index.ts': `
        import { HOST_TRANSPORT_DESCRIPTOR_SCHEMA_VERSION } from '${providerContractPackage}';
        import type { HostTransportCapability } from '${providerContractPackage}';
        import type { PanelPlugin } from '@grafana/data';
        import * as React from 'react';
        type Result = import('${providerContractPackage}').TransportResult;
        export { value } from './helper';
        export type { Helper } from './helper';
        void HOST_TRANSPORT_DESCRIPTOR_SCHEMA_VERSION; void React;
        export type Input = { transport: HostTransportCapability; result?: Result; plugin?: PanelPlugin };
        export { load } from './runtime/cohort';
      `,
      'panels/textPlugin.ts': `
        import { PanelPlugin } from '@grafana/data';
        import { TextPanel } from 'grafana-provider13-text-renderer';
        export const plugin = new PanelPlugin(TextPanel);
      `,
      'runtime/cohort.ts': `
        export async function load() {
          await import('@grafana/runtime');
          await import('@grafana/data');
          await import('@grafana/i18n');
          await import('@grafana/scenes');
          await import('@grafana/ui');
        }
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

test('rejects forbidden core/POC imports, arbitrary dynamics, subpaths, and re-export references', async () => {
  await withFixture(
    {
      'index.ts': `
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

test('allows only the exact local Text dynamic edge and exact audited alias owner', async () => {
  await withFixture(
    {
      'index.ts': `export { create } from './panels/catalog';`,
      'panels/catalog.ts': `
        export const create = () => import('./textPlugin');
      `,
      'panels/textPlugin.ts': `
        import { TextPanel } from 'grafana-provider13-text-renderer';
        export { TextPanel };
      `,
    },
    async (repositoryRoot) => {
      assert.deepEqual(await inspectProvider13Boundary(repositoryRoot), {
        dependencyFindings: [],
        importFindings: [],
      });
    }
  );

  await withFixture(
    {
      'index.ts': `
        import { TextPanel } from 'grafana-provider13-text-renderer';
        const wrong = import('./other');
        void TextPanel; void wrong;
      `,
      'other.ts': 'export const value = true;',
    },
    async (repositoryRoot) => {
      const findings = (await inspectProvider13Boundary(repositoryRoot)).importFindings;
      assert.ok(findings.some(({ specifier }) => specifier === 'grafana-provider13-text-renderer'));
      assert.ok(findings.some(({ kind, specifier }) => kind === 'dynamic-import' && specifier === './other'));
    }
  );
});

test('allows only the inert renderer dynamic implementation edge', async () => {
  await withFixture(
    {
      'index.ts': `export { Renderer } from './react/Grafana13DashboardRenderer';`,
      'react/Grafana13DashboardRenderer.tsx': `
        export const Renderer = () => import('../runtime/implementation');
      `,
      'runtime/implementation.ts': 'export const mountDashboard = () => undefined;',
    },
    async (repositoryRoot) => {
      assert.deepEqual(await inspectProvider13Boundary(repositoryRoot), {
        dependencyFindings: [],
        importFindings: [],
      });
    }
  );

  for (const files of [
    {
      'index.ts': `export const load = () => import('./runtime/implementation');`,
      'runtime/implementation.ts': 'export const mountDashboard = () => undefined;',
    },
    {
      'index.ts': `export { Renderer } from './react/Grafana13DashboardRenderer';`,
      'react/Grafana13DashboardRenderer.tsx': `export const Renderer = () => import('../runtime/coordinator');`,
      'runtime/coordinator.ts': 'export const value = true;',
    },
  ]) {
    await withFixture(files, async (repositoryRoot) => {
      assert.ok((await inspectProvider13Boundary(repositoryRoot)).importFindings.some(
        ({ kind }) => kind === 'dynamic-import'
      ));
    });
  }
});

test('rejects suffix-lookalike owners for exceptional dynamic imports', async () => {
  await withFixture(
    {
      'index.ts': `
        export { Renderer } from './nested/src/react/Grafana13DashboardRenderer';
        export { create } from './nested/src/panels/catalog';
        export { plugin } from './nested/src/panels/textPlugin';
        export { load } from './nested/src/runtime/cohort';
      `,
      'nested/src/react/Grafana13DashboardRenderer.tsx': `
        export const Renderer = () => import('../runtime/implementation');
      `,
      'nested/src/runtime/implementation.ts': 'export const mountDashboard = () => undefined;',
      'nested/src/panels/catalog.ts': `export const create = () => import('./textPlugin');`,
      'nested/src/panels/textPlugin.ts': `
        import { TextPanel } from 'grafana-provider13-text-renderer';
        export const plugin = TextPanel;
      `,
      'nested/src/runtime/cohort.ts': `export const load = () => import('@grafana/runtime');`,
    },
    async (repositoryRoot) => {
      const findings = (await inspectProvider13Boundary(repositoryRoot)).importFindings;
      for (const expected of [
        { kind: 'dynamic-import', specifier: '../runtime/implementation' },
        { kind: 'dynamic-import', specifier: './textPlugin' },
        { kind: 'import', specifier: 'grafana-provider13-text-renderer' },
        { kind: 'dynamic-import', specifier: '@grafana/runtime' },
      ]) {
        assert.ok(findings.some(
          ({ kind, specifier }) => kind === expected.kind && specifier === expected.specifier
        ), JSON.stringify(expected));
      }
    }
  );
});

test('allows each exceptional dynamic-import edge only once', async () => {
  await withFixture(
    {
      'index.ts': `export { Renderer } from './react/Grafana13DashboardRenderer';`,
      'react/Grafana13DashboardRenderer.tsx': `
        export const Renderer = () => Promise.all([
          import('../runtime/implementation'),
          import('../runtime/implementation'),
        ]);
      `,
      'runtime/implementation.ts': 'export const mountDashboard = () => undefined;',
    },
    async (repositoryRoot) => {
      const findings = (await inspectProvider13Boundary(repositoryRoot)).importFindings;
      assert.equal(
        findings.filter(
          ({ kind, specifier }) =>
            kind === 'dynamic-import' && specifier === '../runtime/implementation'
        ).length,
        1
      );
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

test('enforces exact provider dependency metadata and rejects bypass metadata', async () => {
  for (const [manifest, expectedKind] of [
    [{ dependencies: {} }, 'missing-required-dependency'],
    [{ dependencies: { [providerContractPackage]: '^1.0.0' } }, 'invalid-dependency-range'],
    [{ dependencies: { ...allowedDependencies, react: '19.2.8' } }, 'forbidden-dependency'],
    [{ dependencies: { ...allowedDependencies, '@grafana/data': '13.2.2' } }, 'invalid-dependency-range'],
    [{ peerDependencies: {} }, 'missing-required-peer'],
    [{ peerDependencies: { ...allowedPeers, react: '^19.2.0' } }, 'invalid-peer-range'],
    [{ peerDependencies: { ...allowedPeers, scheduler: '0.27.0' } }, 'forbidden-peer'],
    [{ devDependencies: {} }, 'forbidden-dependency-section'],
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
