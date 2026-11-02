import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { access, chmod, mkdtemp, mkdir, readFile, writeFile, rm, readdir, rename, symlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { runGate, scanInventory, validateSpdxExpression } from './third-party-license-gate.mjs';

const cli = fileURLToPath(new URL('./third-party-license-gate.mjs', import.meta.url));
const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));
const revision = '1111111111111111111111111111111111111111';
const texts = {
  MIT: 'MIT License\nCopyright (c) Example\nPermission is hereby granted, free of charge, to any person obtaining a copy.\n',
  'Apache-2.0': 'Apache License\nVersion 2.0, January 2004\nhttp://www.apache.org/licenses/\n',
  'BSD-3-Clause': 'Software License Agreement (BSD License)\n\nCopyright (c) Example. All rights reserved.\n\nRedistribution and use of this software in source and binary forms, with or without modification, are permitted provided that the following conditions are met:\n* Redistributions of source code must retain the above copyright notice.\n* Redistributions in binary form must reproduce the above copyright notice.\n* Neither the name of the copyright holder nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.\n\nTHIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS".\n',
  'AGPL-3.0-only': 'GNU AFFERO GENERAL PUBLIC LICENSE\nVersion 3, 19 November 2007\n',
  'BlueOak-1.0.0': 'Blue Oak Model License\nVersion 1.0.0\n',
  'CC0-1.0': 'CC0 1.0 Universal\n',
  '0BSD': 'Copyright (C) Example\n\nPermission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted.\n\nTHE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.\n',
  'ISC': 'Copyright Example\n\nPermission to use, copy, modify, and/or distribute this software for any\npurpose with or without fee is hereby granted, provided that the above copyright notice\nand this permission notice appear in all copies.\n\nTHE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES.\n',
  Unlicense: 'This is free and unencumbered software released into the public domain.\n',
  '(MPL-2.0 OR Apache-2.0)': 'Mozilla Public License Version 2.0\nOR\nApache License\nVersion 2.0, January 2004\n',
};

async function put(root, file, content) {
  await mkdir(path.dirname(path.join(root, file)), { recursive: true });
  await writeFile(path.join(root, file), typeof content === 'string' ? content : `${JSON.stringify(content, null, 2)}\n`);
}

async function fixture(t, license = 'MIT') {
  const root = await mkdtemp(path.join(os.tmpdir(), 'third-party-gate-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const policy = {
    schemaVersion: 1,
    bundles: [
      { path: 'provider/evidence.json', outputDir: 'provider', scope: 'provider-bundled', workspace: 'packages/provider/package.json' },
      { path: 'host/evidence.json', outputDir: 'host', scope: 'host-bundled', workspace: 'apps/host/package.json' },
    ],
    workspaces: ['package.json', 'packages/provider/package.json', 'apps/host/package.json'],
    firstPartyPaths: ['packages/provider/', 'apps/host/', 'provider/'],
    packages: { 'example@1.0.0': {} },
    externalPeers: [], generatedHelpers: {}, assets: [], classifications: {},
    source: null,
  };
  await put(root, 'package.json', { name: 'fixture', version: '1.0.0', private: true });
  await put(root, 'packages/provider/package.json', { name: 'provider', version: '1.0.0', dependencies: { example: '1.0.0' } });
  await put(root, 'apps/host/package.json', { name: 'host', version: '1.0.0' });
  await put(root, 'node_modules/example/package.json', { name: 'example', version: '1.0.0', license });
  await put(root, 'node_modules/example/index.js', 'export default 1;\n');
  await put(root, 'node_modules/example/LICENSE', texts[license] ?? texts.MIT);
  await put(root, 'yarn.lock', '"example@npm:1.0.0":\n  version: 1.0.0\n  resolution: "example@npm:1.0.0"\n');
  await put(root, 'provider/provider.js', '/* generated provider */\n');
  await put(root, 'host/host.js', '/* generated host */\n');
  const provider = { chunks: [{ fileName: 'provider.js', modules: ['<repo>/node_modules/example/index.js'], imports: [], dynamicImports: [] }], assets: [] };
  await put(root, 'provider/evidence.json', provider);
  await put(root, 'host/evidence.json', { chunks: [{ fileName: 'host.js', modules: [], imports: [], dynamicImports: [] }], assets: [] });
  await put(root, 'compliance/third-party/policy.json', policy);
  return { root, policy, provider, save: () => put(root, 'compliance/third-party/policy.json', policy) };
}

function run(root, mode = 'generate', extra = []) {
  return spawnSync(process.execPath, [cli, mode, '--root', root, ...extra], { encoding: 'utf8' });
}

function succeeds(result) {
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
}

function rejects(result, pattern) {
  assert.notEqual(result.status, 0, 'gate must reject the input');
  assert.match(result.stderr, pattern);
}

async function snapshot(root, dir = 'licenses') {
  const result = {};
  async function visit(relative) {
    for (const entry of await readdir(path.join(root, relative), { withFileTypes: true })) {
      const file = `${relative}/${entry.name}`;
      if (entry.isDirectory()) await visit(file);
      else result[file] = await readFile(path.join(root, file), 'utf8');
    }
  }
  await visit(dir);
  result.THIRD_PARTY_NOTICES = await readFile(path.join(root, 'THIRD_PARTY_NOTICES.md'), 'utf8');
  return result;
}

test('generates deterministic inventories and preserves authoritative license bytes', async (t) => {
  const { root } = await fixture(t);
  succeeds(run(root));
  const first = await snapshot(root);
  succeeds(run(root));
  assert.deepEqual(await snapshot(root), first);
  succeeds(run(root, 'check'));
  const inventory = JSON.parse(first['licenses/dependency-inventory.json']);
  const component = inventory.components.find((entry) => entry.name === 'example');
  assert.equal(component.version, '1.0.0');
  assert.deepEqual(component.scopes, ['provider-bundled']);
  assert.deepEqual(component.locations, ['node_modules/example']);
  assert.equal(first[component.evidence[0].output], texts.MIT);
  assert.ok(!JSON.stringify(first).includes(root));
});

for (const license of ['0BSD', 'Apache-2.0', 'AGPL-3.0-only', 'BSD-3-Clause', '(MPL-2.0 OR Apache-2.0)', 'BlueOak-1.0.0', 'CC0-1.0', 'ISC', 'Unlicense']) {
  test(`accepts authoritative ${license} evidence without rewriting the expression`, async (t) => {
    const { root } = await fixture(t, license);
    succeeds(run(root));
    const data = JSON.parse(await readFile(path.join(root, 'licenses/dependency-inventory.json'), 'utf8'));
    assert.equal(data.components[0].license, license);
  });
}

test('rejects a manifest license without package-local or explicit license evidence', async (t) => {
  const { root } = await fixture(t);
  await rm(path.join(root, 'node_modules/example/LICENSE'));
  rejects(run(root), /missing license evidence/i);
});

for (const license of ['MadeUp-License', 'MIT OR', '(MIT AND Apache-2.0', 'MIT Apache-2.0', 'MIT WITH MadeUp-Exception', 'NOASSERTION']) {
  test(`rejects unknown or malformed SPDX expression: ${license}`, async (t) => {
    const { root } = await fixture(t);
    await put(root, 'node_modules/example/package.json', { name: 'example', version: '1.0.0', license });
    rejects(run(root), /SPDX/i);
  });
}

test('rejects conflicts between manifest declaration and authoritative evidence', async (t) => {
  const { root } = await fixture(t);
  await put(root, 'node_modules/example/LICENSE', texts['Apache-2.0']);
  rejects(run(root), /license.*conflict/i);
});

test('requires an explicit evidence decision for unrecognized license prose', async (t) => {
  const { root } = await fixture(t);
  await put(root, 'node_modules/example/LICENSE', 'Custom terms that the manifest cannot establish.\n');
  rejects(run(root), /unrecognized license evidence/i);
});

test('rejects an unexpected physical production dependency even when installed and licensed', async (t) => {
  const { root, policy, save } = await fixture(t);
  delete policy.packages['example@1.0.0'];
  await save();
  rejects(run(root), /unexpected production package/i);
});

test('rejects lockfile and direct workspace dependency identity drift', async (t) => {
  const { root } = await fixture(t);
  await put(root, 'yarn.lock', '"example@npm:2.0.0":\n  version: 2.0.0\n  resolution: "example@npm:2.0.0"\n');
  rejects(run(root), /lockfile/i);
  await put(root, 'yarn.lock', '"example@npm:1.0.0":\n  version: 1.0.0\n  resolution: "example@npm:1.0.0"\n');
  await put(root, 'packages/provider/package.json', { dependencies: { example: '2.0.0' } });
  rejects(run(root), /workspace.*(version|resolution)/i);
});

test('rejects an installed external package absent from the exact lockfile identities', async (t) => {
  const { root } = await fixture(t);
  await put(root, 'node_modules/stray/package.json', { name: 'stray', version: '1.0.0', license: 'MIT' });
  await put(root, 'node_modules/stray/LICENSE', texts.MIT);
  rejects(run(root), /lockfile identity missing.*stray@1\.0\.0/i);
});

test('classifies direct workspace devDependencies with distinct reviewed test and development scopes', async (t) => {
  const { root, policy, save } = await fixture(t);
  await put(root, 'package.json', { name: 'fixture', version: '1.0.0', private: true, devDependencies: { tool: '1.0.0', 'demo-tool': '1.0.0' } });
  await put(root, 'node_modules/tool/package.json', { name: 'tool', version: '1.0.0', license: 'MIT' });
  await put(root, 'node_modules/tool/LICENSE', texts.MIT);
  await put(root, 'node_modules/demo-tool/package.json', { name: 'demo-tool', version: '1.0.0', license: 'MIT' });
  await put(root, 'node_modules/demo-tool/LICENSE', texts.MIT);
  await put(root, 'yarn.lock', '"demo-tool@npm:1.0.0":\n  version: 1.0.0\n  resolution: "demo-tool@npm:1.0.0"\n\n"example@npm:1.0.0":\n  version: 1.0.0\n  resolution: "example@npm:1.0.0"\n\n"tool@npm:1.0.0":\n  version: 1.0.0\n  resolution: "tool@npm:1.0.0"\n');
  policy.classifications['tool@1.0.0'] = 'development-only';
  policy.classifications['demo-tool@1.0.0'] = 'test-only';
  await save();

  succeeds(run(root));
  const inventory = JSON.parse(await readFile(path.join(root, 'licenses/dependency-inventory.json'), 'utf8'));
  const component = inventory.components.find((entry) => entry.name === 'tool');
  assert.deepEqual(component.scopes, ['development-only']);
  assert.deepEqual(component.directIn, ['package.json']);
  assert.equal(component.relationship, 'direct');
  assert.deepEqual(inventory.components.find((entry) => entry.name === 'demo-tool').scopes, ['test-only']);
});

test('propagates distinct test, development, and demo reachability through exact physical dependency resolution', async (t) => {
  const { root, policy, save } = await fixture(t);
  await put(root, 'package.json', {
    name: 'fixture', version: '1.0.0', private: true,
    devDependencies: { 'test-runner': '1.0.0', 'build-tool': '1.0.0' },
  });
  await put(root, 'demo/package.json', {
    name: 'demo', version: '1.0.0', private: true,
    dependencies: { 'demo-client': '1.0.0' },
  });
  policy.workspaces.push('demo/package.json');
  policy.classifications['test-runner@1.0.0'] = 'test-only';
  policy.classifications['build-tool@1.0.0'] = 'development-only';

  const packages = [
    ['test-runner', {
      dependencies: { shared: '2.0.0', 'test-child': '1.0.0' },
      optionalDependencies: { 'test-optional': '1.0.0' },
    }],
    ['test-runner/node_modules/shared', { name: 'shared', version: '2.0.0', dependencies: { 'test-grandchild': '1.0.0' } }],
    ['build-tool', { dependencies: { shared: '1.0.0', 'dev-child': '1.0.0' } }],
    ['demo-client', { dependencies: { shared: '1.0.0', 'demo-child': '1.0.0' } }],
    ['shared', {}], ['test-child', { dependencies: { 'test-runner': '1.0.0' } }], ['test-grandchild', {}],
    ['test-optional', {}], ['dev-child', {}], ['demo-child', {}], ['orphan', {}],
  ];
  for (const [location, additions] of packages) {
    const fallbackName = location.split('/').at(-1);
    const fallbackVersion = location === 'test-runner/node_modules/shared' ? '2.0.0' : '1.0.0';
    await put(root, `node_modules/${location}/package.json`, {
      name: fallbackName, version: fallbackVersion, license: 'MIT', ...additions,
    });
    await put(root, `node_modules/${location}/LICENSE`, texts.MIT);
  }
  await put(root, 'yarn.lock', [
    'build-tool', 'demo-child', 'demo-client', 'dev-child', 'example', 'orphan', 'shared', 'test-child', 'test-grandchild', 'test-optional', 'test-runner',
  ].map((name) => `"${name}@npm:1.0.0":\n  version: 1.0.0\n  resolution: "${name}@npm:1.0.0"\n`).join('\n')
    + '\n"shared@npm:2.0.0":\n  version: 2.0.0\n  resolution: "shared@npm:2.0.0"\n');
  await save();

  succeeds(run(root));
  const { components } = JSON.parse(await readFile(path.join(root, 'licenses/dependency-inventory.json'), 'utf8'));
  const component = (name, version = '1.0.0') => components.find((entry) => entry.name === name && entry.version === version);
  assert.deepEqual(component('test-runner').scopes, ['test-only']);
  assert.deepEqual(component('shared', '2.0.0').scopes, ['test-only']);
  assert.deepEqual(component('test-grandchild').scopes, ['test-only']);
  assert.deepEqual(component('test-optional').scopes, ['test-only']);
  assert.deepEqual(component('build-tool').scopes, ['development-only']);
  assert.deepEqual(component('dev-child').scopes, ['development-only']);
  assert.deepEqual(component('demo-client').scopes, ['demo-only']);
  assert.deepEqual(component('demo-child').scopes, ['demo-only']);
  assert.deepEqual(component('shared').scopes, ['demo-only', 'development-only']);
  assert.deepEqual(component('orphan').scopes, ['installed-not-distributed']);
});

test('copies discovered NOTICE and rejects required NOTICE or attribution omissions', async (t) => {
  const { root, policy, save } = await fixture(t, 'Apache-2.0');
  policy.packages['example@1.0.0'].requiredFiles = ['NOTICE', 'ATTRIBUTION'];
  await save();
  rejects(run(root), /required.*NOTICE/i);
  await put(root, 'node_modules/example/NOTICE', 'Copyright and attribution from upstream.\n');
  rejects(run(root), /required.*ATTRIBUTION/i);
  await put(root, 'node_modules/example/ATTRIBUTION', 'Additional attribution.\n');
  succeeds(run(root));
  const files = await snapshot(root);
  assert.ok(Object.values(files).includes('Copyright and attribution from upstream.\n'));
  assert.ok(Object.values(files).includes('Additional attribution.\n'));
});

test('records multiple physical installed versions and separates bundled, peer and nonproduction scopes', async (t) => {
  const { root, policy, provider, save } = await fixture(t);
  await put(root, 'node_modules/example/node_modules/nested/package.json', { name: 'nested', version: '2.0.0', license: 'MIT' });
  await put(root, 'node_modules/example/node_modules/nested/index.js', 'export default 2;\n');
  await put(root, 'node_modules/example/node_modules/nested/LICENSE', texts.MIT);
  await put(root, 'node_modules/nested/package.json', { name: 'nested', version: '1.0.0', license: 'MIT' });
  await put(root, 'node_modules/tool/package.json', { name: 'tool', version: '1.0.0', license: 'MIT' });
  await put(root, 'node_modules/demo-package/package.json', { name: 'demo-package', version: '1.0.0', license: 'MIT' });
  provider.chunks[0].modules.push('<repo>/node_modules/example/node_modules/nested/index.js');
  provider.chunks[0].imports.push('example');
  policy.packages['nested@2.0.0'] = {};
  policy.externalPeers = [{ name: 'example', version: '1.0.0', workspace: 'packages/provider/package.json' }];
  policy.classifications = { 'tool@1.0.0': 'development-only', 'demo-package@1.0.0': 'demo-only' };
  await put(root, 'package.json', { name: 'fixture', version: '1.0.0', private: true, devDependencies: { tool: '1.0.0', 'demo-package': '1.0.0' } });
  await put(root, 'packages/provider/package.json', { dependencies: { example: '1.0.0' }, peerDependencies: { example: '1.0.0' } });
  await put(root, 'provider/evidence.json', provider);
  await put(root, 'yarn.lock', '"demo-package@npm:1.0.0":\n  version: 1.0.0\n  resolution: "demo-package@npm:1.0.0"\n\n"example@npm:1.0.0":\n  version: 1.0.0\n  resolution: "example@npm:1.0.0"\n\n"nested@npm:1.0.0":\n  version: 1.0.0\n  resolution: "nested@npm:1.0.0"\n\n"nested@npm:2.0.0":\n  version: 2.0.0\n  resolution: "nested@npm:2.0.0"\n\n"tool@npm:1.0.0":\n  version: 1.0.0\n  resolution: "tool@npm:1.0.0"\n');
  await save();
  succeeds(run(root));
  const { components } = JSON.parse(await readFile(path.join(root, 'licenses/dependency-inventory.json'), 'utf8'));
  assert.deepEqual(components.find((c) => c.name === 'example').scopes, ['external-peer', 'provider-bundled']);
  assert.equal(components.find((c) => c.name === 'nested' && c.version === '2.0.0').locations[0], 'node_modules/example/node_modules/nested');
  assert.deepEqual(components.find((c) => c.name === 'nested' && c.version === '1.0.0').scopes, ['installed-not-distributed']);
  assert.deepEqual(components.find((c) => c.name === 'tool').scopes, ['development-only']);
  assert.deepEqual(components.find((c) => c.name === 'demo-package').scopes, ['demo-only']);
});

test('retains explicit upstream evidence for an installed-only component without adding it to notices', async (t) => {
  const { root, policy, save } = await fixture(t);
  await put(root, 'node_modules/unused/package.json', { name: 'unused', version: '1.0.0', license: 'MIT' });
  await put(root, 'node_modules/unused/index.js', 'export default 1;\n');
  await put(root, 'compliance/upstream/unused-package.json', { name: 'unused', version: '1.0.0', license: 'MIT' });
  policy.packages['unused@1.0.0'] = {
    reason: 'The installed artifact omits its license file; retain the checked-in authoritative declaration.',
    evidence: [{ path: 'compliance/upstream/unused-package.json', kind: 'license', license: 'MIT', reason: 'Authoritative upstream SPDX declaration.' }],
  };
  policy.classifications['unused@1.0.0'] = 'installed-not-distributed';
  await put(root, 'yarn.lock', '"example@npm:1.0.0":\n  version: 1.0.0\n  resolution: "example@npm:1.0.0"\n\n"unused@npm:1.0.0":\n  version: 1.0.0\n  resolution: "unused@npm:1.0.0"\n');
  await save();

  succeeds(run(root));
  const inventory = JSON.parse(await readFile(path.join(root, 'licenses/dependency-inventory.json'), 'utf8'));
  const component = inventory.components.find((entry) => entry.name === 'unused');
  assert.equal(component.status, 'not-distributed');
  assert.deepEqual(component.scopes, ['installed-not-distributed']);
  assert.equal(component.evidence.length, 1);
  assert.equal(await readFile(path.join(root, component.evidence[0].output), 'utf8'), `${JSON.stringify({ name: 'unused', version: '1.0.0', license: 'MIT' }, null, 2)}\n`);
  assert.doesNotMatch(await readFile(path.join(root, 'THIRD_PARTY_NOTICES.md'), 'utf8'), /## unused 1\.0\.0/);
});

async function addSource(f) {
  const { root, policy, provider } = f;
  await put(root, 'upstream/LICENSE', texts['AGPL-3.0-only']);
  await put(root, 'upstream/LICENSING.md', 'public/app is AGPL; packages/grafana-ui is Apache-2.0.\n');
  await put(root, 'upstream/NOTICE.md', 'Fixture upstream notice.\n');
  await put(root, 'upstream/packages/grafana-ui/LICENSE', texts['Apache-2.0']);
  await put(root, 'upstream/public/app/panel.ts', 'export const panel = 1;\n');
  await put(root, 'upstream/packages/grafana-ui/ui.ts', 'export const ui = 1;\n');
  execFileSync('git', ['init', '--quiet', path.join(root, 'upstream')]);
  execFileSync('git', ['-C', path.join(root, 'upstream'), 'add', '.']);
  execFileSync('git', ['-C', path.join(root, 'upstream'), '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--quiet', '-m', 'fixture']);
  const actual = execFileSync('git', ['-C', path.join(root, 'upstream'), 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  policy.source = { root: 'upstream', revision: actual, url: 'https://example.invalid/upstream', licensing: ['LICENSE', 'LICENSING.md', 'NOTICE.md'], paths: {
    'public/app/panel.ts': { license: 'AGPL-3.0-only', evidence: ['LICENSE'] },
    'packages/grafana-ui/ui.ts': { license: 'Apache-2.0', evidence: ['packages/grafana-ui/LICENSE'] },
  } };
  provider.chunks[0].modules.push('<grafana-source>/public/app/panel.ts', '<grafana-source>/packages/grafana-ui/ui.ts');
  await put(root, 'provider/evidence.json', provider);
  await f.save();
}

test('accepts exact AGPL application and Apache package paths at the pinned source revision', async (t) => {
  const f = await fixture(t);
  await addSource(f);
  succeeds(run(f.root));
  const data = JSON.parse(await readFile(path.join(f.root, 'licenses/source-inventory.json'), 'utf8'));
  assert.equal(data.revision, f.policy.source.revision);
  assert.deepEqual(data.components.map((c) => [c.path, c.license]), [['packages/grafana-ui/ui.ts', 'Apache-2.0'], ['public/app/panel.ts', 'AGPL-3.0-only']]);
});

test('rejects unknown source paths, changed source revision and an Apache classification for public/app', async (t) => {
  const f = await fixture(t);
  await addSource(f);
  f.provider.chunks[0].modules.push('<grafana-source>/public/app/unknown.ts');
  await put(f.root, 'provider/evidence.json', f.provider);
  rejects(run(f.root), /unknown Grafana source path/i);
  f.provider.chunks[0].modules.pop();
  await put(f.root, 'provider/evidence.json', f.provider);
  f.policy.source.revision = revision;
  await f.save();
  rejects(run(f.root), /source revision/i);
  f.policy.source.revision = execFileSync('git', ['-C', path.join(f.root, 'upstream'), 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  f.policy.source.paths['public/app/panel.ts'].license = 'Apache-2.0';
  await f.save();
  rejects(run(f.root), /AGPL.*boundary/i);
});

test('records explicitly classified generated helpers and assets and fails on unknown emitted assets', async (t) => {
  const { root, policy, provider, save } = await fixture(t);
  provider.chunks[0].modules.push('rolldown/runtime.js');
  await put(root, 'node_modules/tool/package.json', { name: 'tool', version: '1.0.0', license: 'MIT' });
  await put(root, 'node_modules/tool/LICENSE', texts.MIT);
  policy.generatedHelpers['rolldown/runtime.js'] = { package: 'tool@1.0.0' };
  policy.packages['tool@1.0.0'] = {};
  await put(root, 'yarn.lock', '"example@npm:1.0.0":\n  version: 1.0.0\n  resolution: "example@npm:1.0.0"\n\n"tool@npm:1.0.0":\n  version: 1.0.0\n  resolution: "tool@npm:1.0.0"\n');
  await put(root, 'provider/theme.css', 'body { color: black; }\n');
  provider.assets.push({ fileName: 'theme.css' });
  await put(root, 'provider/evidence.json', provider);
  await save();
  rejects(run(root), /unclassified.*asset/i);
  policy.assets.push({ path: 'provider/theme.css', type: 'css', use: 'static', package: 'example@1.0.0' });
  await save();
  succeeds(run(root));
  const data = JSON.parse(await readFile(path.join(root, 'licenses/asset-inventory.json'), 'utf8'));
  assert.equal(data.components[0].type, 'css');
  const deps = JSON.parse(await readFile(path.join(root, 'licenses/dependency-inventory.json'), 'utf8'));
  assert.deepEqual(deps.components.find((c) => c.name === 'tool').scopes, ['generated-helper']);
});

test('records bundled first-party CSS without treating it as a third-party notice component', async (t) => {
  const { root, policy, provider, save } = await fixture(t);
  await put(root, 'apps/host/theme.css', ':root { color: inherit; }\n');
  provider.chunks[0].modules.push('<repo>/apps/host/theme.css');
  policy.assets.push({ path: 'apps/host/theme.css', type: 'css', use: 'runtime', firstParty: true, reason: 'Project-owned host style source bundled into JavaScript.' });
  await put(root, 'provider/evidence.json', provider);
  await save();
  succeeds(run(root));
  const assets = JSON.parse(await readFile(path.join(root, 'licenses/asset-inventory.json'), 'utf8'));
  assert.deepEqual(assets.components[0].scopes, ['first-party']);
  assert.doesNotMatch(await readFile(path.join(root, 'THIRD_PARTY_NOTICES.md'), 'utf8'), /Asset: apps\/host\/theme\.css/);
});

for (const unsafe of ['../escape', '/home/user/private', 'C:\\Users\\user\\private', 'licenses/../../escape', 'licenses\\escape']) {
  test(`rejects unsafe output path ${unsafe}`, async (t) => {
    const { root, policy, save } = await fixture(t);
    policy.outputDir = unsafe;
    await save();
    rejects(run(root), /unsafe.*path/i);
  });
}

test('rejects evidence symlinks escaping the repository', async (t) => {
  const { root } = await fixture(t);
  await rm(path.join(root, 'node_modules/example/LICENSE'));
  await symlink('/etc/passwd', path.join(root, 'node_modules/example/LICENSE'));
  rejects(run(root), /outside repository/i);
});

test('check rejects stale, missing and extra generated files without writing', async (t) => {
  const { root } = await fixture(t);
  succeeds(run(root));
  await put(root, 'THIRD_PARTY_NOTICES.md', 'edited\n');
  rejects(run(root, 'check'), /stale.*THIRD_PARTY_NOTICES/i);
  assert.equal(await readFile(path.join(root, 'THIRD_PARTY_NOTICES.md'), 'utf8'), 'edited\n');
  succeeds(run(root));
  await rm(path.join(root, 'licenses/source-inventory.json'));
  await put(root, 'licenses/evidence/extra.txt', 'unreviewed\n');
  rejects(run(root, 'check'), /stale|unexpected generated/i);
  await assert.rejects(readFile(path.join(root, 'licenses/source-inventory.json')), { code: 'ENOENT' });
});

test('check detects emitted bundle byte drift even when the module graph is unchanged', async (t) => {
  const { root } = await fixture(t);
  succeeds(run(root));
  await put(root, 'provider/provider.js', '/* a changed build */\n');
  rejects(run(root, 'check'), /stale/i);
});

test('CLI rejects unknown commands and flags without writing output', async (t) => {
  const { root } = await fixture(t);
  rejects(run(root, 'erase'), /usage/i);
  rejects(run(root, 'generate', ['--unknown']), /usage/i);
  await assert.rejects(readFile(path.join(root, 'THIRD_PARTY_NOTICES.md')), { code: 'ENOENT' });
});

test('does not treat an AND declaration as the authoritative DOMPurify OR license', async (t) => {
  const { root } = await fixture(t, '(MPL-2.0 OR Apache-2.0)');
  await put(root, 'node_modules/example/package.json', { name: 'example', version: '1.0.0', license: '(MPL-2.0 AND Apache-2.0)' });
  rejects(run(root), /license.*conflict/i);
});

test('requires source licensing-boundary evidence for Apache exception paths', async (t) => {
  const f = await fixture(t);
  await addSource(f);
  f.policy.source.licensing = [];
  await f.save();
  rejects(run(f.root), /licensing.*boundary.*evidence/i);
});

test('detects unreviewed changes to pinned source bytes in check mode', async (t) => {
  const f = await fixture(t);
  await addSource(f);
  succeeds(run(f.root));
  await put(f.root, 'upstream/public/app/panel.ts', 'export const panel = 2;\n');
  rejects(run(f.root, 'check'), /stale/i);
});

test('rejects a nested module with no physical package manifest instead of attributing it to its parent', async (t) => {
  const { root, provider } = await fixture(t);
  await put(root, 'node_modules/example/node_modules/missing/index.js', 'export const missing = true;\n');
  provider.chunks[0].modules.push('<repo>/node_modules/example/node_modules/missing/index.js');
  await put(root, 'provider/evidence.json', provider);
  rejects(run(root), /unresolved physical bundle package/i);
});

test('rejects unclassified CSS modules embedded into production JavaScript', async (t) => {
  const { root, provider } = await fixture(t);
  await put(root, 'node_modules/example/styles.css', 'body{}\n');
  provider.chunks[0].modules.push('<repo>/node_modules/example/styles.css?inline');
  await put(root, 'provider/evidence.json', provider);
  rejects(run(root), /unclassified.*asset/i);
});

test('rejects files emitted on disk that are absent from the reviewed bundle evidence', async (t) => {
  const { root } = await fixture(t);
  await put(root, 'provider/unexpected.woff2', 'unreviewed-font\n');
  rejects(run(root), /unclassified.*(asset|emitted)/i);
});

test('rejects package repository metadata that would leak credentials or machine paths', async (t) => {
  const { root } = await fixture(t);
  for (const repository of [
    '/home/person/private-repo',
    'https://token:secret@example.invalid/repo',
    'https://example.invalid/repo?token=secret',
    'https://example.invalid/repo#token',
    'https#token',
    'git:/home/person/private-repo',
    'git:///home/person/private-repo',
    'git:C:/Users/person/private-repo',
  ]) {
    await put(root, 'node_modules/example/package.json', { name: 'example', version: '1.0.0', license: 'MIT', repository });
    rejects(run(root), /unsafe.*(URL|metadata|path)/i);
  }
});

for (const [repository, canonical] of [
  ['owner/project', 'https://github.com/owner/project'],
  ['github:owner/project', 'https://github.com/owner/project'],
  ['github.com/owner/project.git', 'https://github.com/owner/project'],
  ['git@github.com:owner/project.git', 'https://github.com/owner/project'],
  ['git+ssh://git@github.com/owner/project.git', 'https://github.com/owner/project'],
  ['ssh://github.com/owner/project.git', 'https://github.com/owner/project'],
]) {
  test(`normalizes reviewed npm repository shorthand ${repository}`, async (t) => {
    const { root } = await fixture(t);
    await put(root, 'node_modules/example/package.json', { name: 'example', version: '1.0.0', license: 'MIT', repository });
    succeeds(run(root));
    const inventory = JSON.parse(await readFile(path.join(root, 'licenses/dependency-inventory.json'), 'utf8'));
    assert.equal(inventory.components.find((entry) => entry.name === 'example').sourceUrl, canonical);
  });
}

test('rejects output symlinks escaping the repository without writing through them', async (t) => {
  const { root } = await fixture(t);
  const external = await mkdtemp(path.join(os.tmpdir(), 'third-party-output-'));
  t.after(() => rm(external, { recursive: true, force: true }));
  await symlink(external, path.join(root, 'licenses'));
  rejects(run(root), /outside repository/i);
  assert.deepEqual(await readdir(external), []);
});

test('keeps peer scope on its resolved physical copy and records other copies as undistributed', async (t) => {
  const { root, policy, save } = await fixture(t);
  await put(root, 'node_modules/other/package.json', { name: 'other', version: '1.0.0', license: 'MIT' });
  await put(root, 'node_modules/other/node_modules/example/package.json', { name: 'example', version: '1.0.0', license: 'MIT' });
  // This undistributed copy intentionally has no LICENSE; it must not inherit
  // the peer scope of the root physical instance and acquire evidence duties.
  await put(root, 'packages/provider/package.json', { peerDependencies: { example: '1.0.0' } });
  policy.externalPeers = [{ name: 'example', version: '1.0.0', workspace: 'packages/provider/package.json' }];
  await put(root, 'yarn.lock', '"example@npm:1.0.0":\n  version: 1.0.0\n  resolution: "example@npm:1.0.0"\n\n"other@npm:1.0.0":\n  version: 1.0.0\n  resolution: "other@npm:1.0.0"\n');
  await save();
  succeeds(run(root));
  const { components } = JSON.parse(await readFile(path.join(root, 'licenses/dependency-inventory.json'), 'utf8'));
  const copies = components.find((c) => c.name === 'example').physicalComponents;
  assert.deepEqual(copies.find((c) => c.location === 'node_modules/other/node_modules/example').scopes, ['installed-not-distributed']);
  assert.deepEqual(copies.find((c) => c.location === 'node_modules/example').scopes, ['external-peer', 'provider-bundled']);
});

test('retains a complete unresolved package boundary conflict as a release-blocking review decision', async (t) => {
  const { root, policy, save } = await fixture(t, 'Apache-2.0');
  policy.packages['example@1.0.0'] = {
    conflict: { manifest: 'Apache-2.0', evidence: 'AGPL-3.0-only', status: 'unresolved', reason: 'Upstream evidence tension requires review.' },
  };
  await save();
  succeeds(run(root));
  const inventory = JSON.parse(await readFile(path.join(root, 'licenses/dependency-inventory.json'), 'utf8'));
  const component = inventory.components.find((entry) => entry.name === 'example');
  assert.equal(component.license, 'Apache-2.0');
  assert.equal(component.legalReviewRequired, true);
  assert.equal(inventory.releaseGate.status, 'blocked-legal-review');
  assert.deepEqual(inventory.releaseGate.components, ['example@1.0.0']);
  assert.match(await readFile(path.join(root, 'THIRD_PARTY_NOTICES.md'), 'utf8'), /LEGAL REVIEW REQUIRED[\s\S]*example@1\.0\.0/i);
});

test('retains an undeclared installed-only package license as a nonpublication inventory review decision', async (t) => {
  const { root, policy, save } = await fixture(t);
  await put(root, 'node_modules/unknown/package.json', { name: 'unknown', version: '1.0.0' });
  await put(root, 'yarn.lock', '"example@npm:1.0.0":\n  version: 1.0.0\n  resolution: "example@npm:1.0.0"\n\n"unknown@npm:1.0.0":\n  version: 1.0.0\n  resolution: "unknown@npm:1.0.0"\n');
  policy.packages['unknown@1.0.0'] = {
    unresolvedLicense: {
      reason: 'The installed artifact and exact upstream revision contain no license declaration or license terms.',
      references: ['node_modules/unknown/package.json'],
    },
  };
  await save();

  succeeds(run(root));
  const inventory = JSON.parse(await readFile(path.join(root, 'licenses/dependency-inventory.json'), 'utf8'));
  const component = inventory.components.find((entry) => entry.name === 'unknown');
  assert.equal(component.license, null);
  assert.equal(component.legalReviewRequired, true);
  assert.equal(component.unresolvedLicense.reason, policy.packages['unknown@1.0.0'].unresolvedLicense.reason);
  assert.equal(component.reviewEvidence.length, 1);
  assert.equal(component.reviewEvidence[0].path, 'node_modules/unknown/package.json');
  assert.match(component.reviewEvidence[0].sha256, /^[a-f0-9]{64}$/);
  assert.ok(inventory.inputs.some((entry) => entry.path === 'node_modules/unknown/package.json' && entry.sha256 === component.reviewEvidence[0].sha256));
  assert.equal(inventory.inventoryReview.status, 'review-required');
  assert.ok(inventory.inventoryReview.components.includes('unknown@1.0.0'));
  assert.deepEqual(inventory.releaseGate, { status: 'inventory-complete', components: [] });
});

test('separates all inventory review questions from production publication blockers', async (t) => {
  const { root, policy, save } = await fixture(t);
  policy.packages['example@1.0.0'] = {
    conflict: { manifest: 'MIT', evidence: 'AGPL-3.0-only', status: 'unresolved', reason: 'Bundled boundary requires review.' },
  };
  await put(root, 'node_modules/installed-review/package.json', { name: 'installed-review', version: '1.0.0' });
  policy.packages['installed-review@1.0.0'] = {
    unresolvedLicense: {
      reason: 'Installed-only evidence requires review.',
      references: ['node_modules/installed-review/package.json'],
    },
  };
  await put(root, 'yarn.lock', '"example@npm:1.0.0":\n  version: 1.0.0\n  resolution: "example@npm:1.0.0"\n\n"installed-review@npm:1.0.0":\n  version: 1.0.0\n  resolution: "installed-review@npm:1.0.0"\n');
  await save();

  succeeds(run(root));
  const inventory = JSON.parse(await readFile(path.join(root, 'licenses/dependency-inventory.json'), 'utf8'));
  assert.deepEqual(inventory.inventoryReview, {
    status: 'review-required',
    components: ['example@1.0.0', 'installed-review@1.0.0'],
    note: 'The inventory records unresolved upstream licensing boundaries that require maintainer or qualified legal review.',
  });
  assert.deepEqual(inventory.releaseGate.components, ['example@1.0.0']);
  assert.equal(inventory.releaseGate.status, 'blocked-legal-review');
  assert.equal(inventory.components.find((entry) => entry.name === 'example').status, 'unresolved');
  const notices = await readFile(path.join(root, 'THIRD_PARTY_NOTICES.md'), 'utf8');
  assert.match(notices, /PUBLICATION BLOCKED[\s\S]*example@1\.0\.0/i);
  const publicationSection = notices.slice(notices.indexOf('PUBLICATION BLOCKED'), notices.indexOf('## Inventory review'));
  assert.doesNotMatch(publicationSection, /installed-review@1\.0\.0/i);
  assert.match(notices, /INVENTORY REVIEW[\s\S]*installed-review@1\.0\.0/i);
});

test('an installed-only review question does not block the publication release gate', async (t) => {
  const { root, policy, save } = await fixture(t);
  await put(root, 'node_modules/installed-review/package.json', { name: 'installed-review', version: '1.0.0' });
  policy.packages['installed-review@1.0.0'] = {
    unresolvedLicense: {
      reason: 'Installed-only evidence requires review.',
      references: ['node_modules/installed-review/package.json'],
    },
  };
  await put(root, 'yarn.lock', '"example@npm:1.0.0":\n  version: 1.0.0\n  resolution: "example@npm:1.0.0"\n\n"installed-review@npm:1.0.0":\n  version: 1.0.0\n  resolution: "installed-review@npm:1.0.0"\n');
  await save();

  succeeds(run(root));
  const inventory = JSON.parse(await readFile(path.join(root, 'licenses/dependency-inventory.json'), 'utf8'));
  assert.equal(inventory.inventoryReview.status, 'review-required');
  assert.deepEqual(inventory.inventoryReview.components, ['installed-review@1.0.0']);
  assert.deepEqual(inventory.releaseGate, { status: 'inventory-complete', components: [] });
});

test('rejects a locked null-license package without an explicit unresolved decision', async (t) => {
  const { root } = await fixture(t);
  await put(root, 'node_modules/unknown/package.json', { name: 'unknown', version: '1.0.0' });
  await put(root, 'yarn.lock', '"example@npm:1.0.0":\n  version: 1.0.0\n  resolution: "example@npm:1.0.0"\n\n"unknown@npm:1.0.0":\n  version: 1.0.0\n  resolution: "unknown@npm:1.0.0"\n');
  rejects(run(root), /null license|unresolved license decision|missing license decision/i);
});

test('rejects a non-SPDX installed license unless an explicit normalized unresolved decision preserves it', async (t) => {
  const { root, policy, save } = await fixture(t);
  await put(root, 'node_modules/example/package.json', { name: 'example', version: '1.0.0', license: 'MIT and ISC' });
  rejects(run(root), /SPDX|license expression/i);

  policy.packages['example@1.0.0'] = {
    license: 'MIT AND ISC',
    unresolvedLicense: {
      reason: 'The upstream manifest uses a non-SPDX conjunction and requires reviewed normalization.',
      references: ['node_modules/example/package.json', 'node_modules/example/LICENSE'],
    },
  };
  await save();
  succeeds(run(root));
  const inventory = JSON.parse(await readFile(path.join(root, 'licenses/dependency-inventory.json'), 'utf8'));
  assert.equal(inventory.components[0].license, 'MIT AND ISC');
  assert.equal(inventory.components[0].legalReviewRequired, true);
});

test('reads review references as bounded evidence and detects missing or changed bytes', async (t) => {
  const { root, policy, save } = await fixture(t);
  policy.packages['example@1.0.0'].reviewReferences = ['compliance/review.md'];
  await save();
  rejects(run(root), /ENOENT|review evidence|no such file/i);
  await put(root, 'compliance/review.md', 'Reviewed upstream boundary.\n');
  succeeds(run(root));
  const inventory = JSON.parse(await readFile(path.join(root, 'licenses/dependency-inventory.json'), 'utf8'));
  const component = inventory.components.find((entry) => entry.name === 'example');
  assert.deepEqual(component.reviewEvidence.map((entry) => entry.path), ['compliance/review.md']);
  assert.match(component.reviewEvidence[0].sha256, /^[a-f0-9]{64}$/);
  await put(root, 'compliance/review.md', 'Changed review boundary.\n');
  rejects(run(root, 'check'), /stale/i);
});

test('writes third-party notices with exactly one newline at EOF', async (t) => {
  const { root } = await fixture(t);
  succeeds(run(root));
  const notice = await readFile(path.join(root, 'THIRD_PARTY_NOTICES.md'));
  assert.equal(notice.at(-1), 0x0a);
  assert.notEqual(notice.at(-2), 0x0a);
});

test('uses command-local safe.directory when verifying the ignored pinned source checkout', async (t) => {
  const f = await fixture(t);
  await addSource(f);
  f.policy.source.revision = revision;
  await f.save();
  await put(f.root, 'fake-bin/git', `#!/bin/sh\ncase "$1:$2" in\n  -c:safe.directory=*) printf '${revision}\\n' ;;\n  *) exit 29 ;;\nesac\n`);
  await chmod(path.join(f.root, 'fake-bin/git'), 0o755);
  const original = process.env.PATH;
  process.env.PATH = `${path.join(f.root, 'fake-bin')}:${original}`;
  try {
    const result = await scanInventory({ root: f.root, policy: f.policy });
    assert.equal(result.sourceInventory.revision, revision);
  } finally { process.env.PATH = original; }
});

test('accepts exact authoritative evidence overrides and preserves the resolved declaration tension', async (t) => {
  const { root, policy, save } = await fixture(t, 'Apache-2.0');
  await put(root, 'node_modules/example/LICENSE', texts['AGPL-3.0-only']);
  policy.packages['example@1.0.0'] = {
    license: 'AGPL-3.0-only',
    conflict: { manifest: 'Apache-2.0', evidence: 'AGPL-3.0-only', status: 'resolved', reason: 'Reviewed fixture-specific upstream statement.' },
  };
  await save();
  succeeds(run(root));
  const { components } = JSON.parse(await readFile(path.join(root, 'licenses/dependency-inventory.json'), 'utf8'));
  assert.equal(components[0].conflict.manifest, 'Apache-2.0');
  assert.equal(components[0].license, 'AGPL-3.0-only');
});

test('rejects empty standalone asset evidence rather than treating a policy string as a license', async (t) => {
  const { root, policy, save } = await fixture(t);
  await put(root, 'provider/theme.css', 'body{}\n');
  await put(root, 'upstream-font/LICENSE', '');
  policy.assets.push({ path: 'provider/theme.css', type: 'css', use: 'static', license: 'OFL-1.1', evidence: ['upstream-font/LICENSE'] });
  await save();
  rejects(run(root), /empty.*evidence/i);
});

test('attributes provider package code rebundled by the SDK host to both distribution scopes', async (t) => {
  const { root } = await fixture(t);
  await put(root, 'host/evidence.json', { chunks: [{ fileName: 'host.js', modules: ['<repo>/provider/provider.js'], imports: [], dynamicImports: [] }], assets: [] });
  succeeds(run(root));
  const { components } = JSON.parse(await readFile(path.join(root, 'licenses/dependency-inventory.json'), 'utf8'));
  assert.deepEqual(components[0].scopes, ['host-bundled', 'provider-bundled']);
});

test('propagates prebuilt provider attribution independently of policy bundle ordering', async (t) => {
  const { root, policy, save } = await fixture(t);
  policy.bundles.reverse();
  await save();
  await put(root, 'host/evidence.json', { chunks: [{ fileName: 'host.js', modules: ['<repo>/provider/provider.js'], imports: [], dynamicImports: [] }], assets: [] });
  succeeds(run(root));
  const { components } = JSON.parse(await readFile(path.join(root, 'licenses/dependency-inventory.json'), 'utf8'));
  assert.deepEqual(components[0].scopes, ['host-bundled', 'provider-bundled']);
});

for (const alias of ['notices', 'directory', 'evidence-file']) {
  test(`I1 rejects in-repository output symlink ${alias} before any writes`, async (t) => {
    const { root } = await fixture(t);
    const original = await readFile(path.join(root, 'package.json'));
    if (alias === 'notices') await symlink('package.json', path.join(root, 'THIRD_PARTY_NOTICES.md'));
    if (alias === 'directory') {
      await mkdir(path.join(root, 'unrelated'));
      await symlink('unrelated', path.join(root, 'licenses'));
    }
    if (alias === 'evidence-file') {
      const result = await scanInventory({ root, policy: JSON.parse(await readFile(path.join(root, 'compliance/third-party/policy.json'))) });
      const output = result.dependencyInventory.components[0].evidence[0].output;
      await mkdir(path.dirname(path.join(root, output)), { recursive: true });
      await symlink(path.join(root, 'package.json'), path.join(root, output));
    }
    rejects(run(root), /symlink.*output|output.*symlink/i);
    assert.deepEqual(await readFile(path.join(root, 'package.json')), original);
    if (alias !== 'notices') await assert.rejects(readFile(path.join(root, 'THIRD_PARTY_NOTICES.md')), { code: 'ENOENT' });
    if (alias === 'directory') assert.deepEqual(await readdir(path.join(root, 'unrelated')), []);
    await assert.rejects(readFile(path.join(root, 'licenses/dependency-inventory.json')), { code: 'ENOENT' });
  });
}

async function assertEvidenceCopies(root, refs, artifacts) {
  assert.equal(new Set(refs.map((ref) => ref.output)).size, refs.length);
  for (const ref of refs) {
    const expected = await readFile(path.join(root, ref.path));
    assert.deepEqual(artifacts.get(ref.output), expected);
    assert.equal(createHash('sha256').update(artifacts.get(ref.output)).digest('hex'), ref.sha256);
  }
}

test('I2 preserves package evidence with different source paths and the same basename', async (t) => {
  const { root, policy } = await fixture(t);
  await put(root, 'reviewed/LICENSE', `${texts.MIT}Different upstream bytes.\n`);
  policy.packages['example@1.0.0'] = { reason: 'Reviewed second upstream license.', evidence: [{ path: 'reviewed/LICENSE', kind: 'license' }] };
  const result = await scanInventory({ root, policy });
  await assertEvidenceCopies(root, result.dependencyInventory.components[0].evidence, result.artifacts);
});

test('I2 preserves asset evidence with different source paths and the same basename', async (t) => {
  const { root, policy } = await fixture(t);
  await put(root, 'provider/theme.css', 'body{}\n');
  await put(root, 'first/LICENSE', texts.MIT);
  await put(root, 'second/LICENSE', `${texts.MIT}Other upstream license bytes.\n`);
  policy.assets.push({ path: 'provider/theme.css', type: 'css', use: 'static', license: 'MIT', evidence: ['first/LICENSE', 'second/LICENSE'] });
  const result = await scanInventory({ root, policy });
  await assertEvidenceCopies(root, result.assetInventory.components[0].evidence, result.artifacts);
});

test('I2 rejects conflicting writes to an existing artifact destination', async (t) => {
  const { root, policy } = await fixture(t);
  const { artifacts } = await scanInventory({ root, policy });
  const [destination, original] = artifacts.entries().next().value;
  assert.throws(() => artifacts.set(destination, Buffer.from('conflicting bytes')), /artifact.*conflict|collision/i);
  assert.deepEqual(artifacts.get(destination), original);
  assert.doesNotThrow(() => artifacts.set(destination, Buffer.from(original)));
});

const threeLicenseText = `${texts.MIT}${texts['Apache-2.0']}Mozilla Public License Version 2.0\n`;
test('I3 preserves SPDX grouping when matching an authoritative declaration', async (t) => {
  const { root } = await fixture(t);
  await put(root, 'node_modules/example/package.json', { name: 'example', version: '1.0.0', license: '(MIT AND Apache-2.0) OR MPL-2.0' });
  await put(root, 'node_modules/example/LICENSE', `SPDX-License-Identifier: MIT AND (Apache-2.0 OR MPL-2.0)\n${threeLicenseText}`);
  rejects(run(root), /license.*conflict/i);
});

test('I3 accepts equivalent SPDX parentheses while retaining a WITH node in the parsed tree', async (t) => {
  const { root } = await fixture(t);
  await put(root, 'node_modules/example/package.json', { name: 'example', version: '1.0.0', license: 'MIT AND (Apache-2.0 OR MPL-2.0)' });
  await put(root, 'node_modules/example/LICENSE', `SPDX-License-Identifier: ((MIT) AND ((Apache-2.0) OR (MPL-2.0)))\n${threeLicenseText}`);
  succeeds(run(root));
  assert.deepEqual(validateSpdxExpression('MIT WITH LLVM-exception'), { type: 'with', license: { type: 'license', id: 'MIT' }, exception: 'LLVM-exception' });
});

test('I3 requires an exception grant rather than a plain base-license file', async (t) => {
  const { root } = await fixture(t);
  await put(root, 'node_modules/example/package.json', { name: 'example', version: '1.0.0', license: 'MIT WITH LLVM-exception' });
  rejects(run(root), /exception.*evidence|exception.*grant/i);
});

test('I3 accepts an authoritative exception declaration and an explicit reviewed exception decision', async (t) => {
  const { root, policy, save } = await fixture(t);
  await put(root, 'node_modules/example/package.json', { name: 'example', version: '1.0.0', license: 'MIT WITH LLVM-exception' });
  await put(root, 'node_modules/example/LICENSE', `SPDX-License-Identifier: MIT WITH LLVM-exception\n${texts.MIT}`);
  succeeds(run(root));
  await rm(path.join(root, 'licenses'), { recursive: true });
  await put(root, 'node_modules/example/LICENSE', texts.MIT);
  policy.packages['example@1.0.0'] = { reason: 'Reviewed authoritative exception grant for this exact file.', evidence: [{ path: 'node_modules/example/LICENSE', license: 'MIT WITH LLVM-exception' }] };
  await save();
  succeeds(run(root));
});

test('I3 checks source SPDX declaration structure instead of only identifier sets', async (t) => {
  const f = await fixture(t);
  await addSource(f);
  f.policy.source.paths['packages/grafana-ui/ui.ts'].license = '(MIT AND Apache-2.0) OR MPL-2.0';
  await put(f.root, 'upstream/packages/grafana-ui/LICENSE', `SPDX-License-Identifier: MIT AND (Apache-2.0 OR MPL-2.0)\n${threeLicenseText}`);
  await f.save();
  rejects(run(f.root), /license.*conflict/i);
});

test('I3 checks asset SPDX declaration structure and exception grants', async (t) => {
  const { root, policy, save } = await fixture(t);
  await put(root, 'provider/theme.css', 'body{}\n');
  await put(root, 'asset/LICENSE', `SPDX-License-Identifier: MIT AND (Apache-2.0 OR MPL-2.0)\n${threeLicenseText}`);
  policy.assets.push({ path: 'provider/theme.css', type: 'css', use: 'static', license: '(MIT AND Apache-2.0) OR MPL-2.0', evidence: ['asset/LICENSE'] });
  await save();
  rejects(run(root), /license.*conflict/i);
  await put(root, 'asset/LICENSE', texts.MIT);
  policy.assets[0].license = 'MIT WITH LLVM-exception';
  await save();
  rejects(run(root), /exception.*evidence|exception.*grant/i);
});

test('I3 rejects a package evidence override with the same identifiers but different grouping', async (t) => {
  const { root, policy, save } = await fixture(t);
  await put(root, 'node_modules/example/package.json', {
    name: 'example', version: '1.0.0', license: '(MIT AND Apache-2.0) OR MPL-2.0',
  });
  await put(root, 'node_modules/example/LICENSE', threeLicenseText);
  policy.packages['example@1.0.0'] = {
    reason: 'Reviewed expression carried by this exact evidence file.',
    evidence: [{
      path: 'node_modules/example/LICENSE',
      license: 'MIT AND (Apache-2.0 OR MPL-2.0)',
    }],
  };
  await save();
  rejects(run(root), /license.*conflict/i);
});

test('I3 rejects a source evidence override with the same identifiers but different grouping', async (t) => {
  const f = await fixture(t);
  await addSource(f);
  f.policy.source.paths['packages/grafana-ui/ui.ts'] = {
    license: '(MIT AND Apache-2.0) OR MPL-2.0',
    evidence: [{
      path: 'packages/grafana-ui/LICENSE',
      license: 'MIT AND (Apache-2.0 OR MPL-2.0)',
      reason: 'Reviewed expression carried by this exact evidence file.',
    }],
  };
  await put(f.root, 'upstream/packages/grafana-ui/LICENSE', threeLicenseText);
  await f.save();
  rejects(run(f.root), /license.*conflict/i);
});

test('I3 rejects an asset evidence override with the same identifiers but different grouping', async (t) => {
  const { root, policy, save } = await fixture(t);
  await put(root, 'provider/theme.css', 'body{}\n');
  await put(root, 'asset/LICENSE', threeLicenseText);
  policy.assets.push({
    path: 'provider/theme.css', type: 'css', use: 'static',
    license: '(MIT AND Apache-2.0) OR MPL-2.0',
    evidence: [{
      path: 'asset/LICENSE',
      license: 'MIT AND (Apache-2.0 OR MPL-2.0)',
      reason: 'Reviewed expression carried by this exact evidence file.',
    }],
  });
  await save();
  rejects(run(root), /license.*conflict/i);
});

test('I4 requires descriptor, installed version and exact resolution on the same lock record', async (t) => {
  const { root } = await fixture(t);
  await put(root, 'yarn.lock', '"example@npm:1.0.0":\n  version: 1.0.0\n  resolution: "malicious@npm:1.0.0"\n\n"example@npm:^1":\n  version: 1.0.0\n  resolution: "example@npm:1.0.0"\n');
  rejects(run(root), /workspace.*(resolution|version)|lockfile/i);
});

test('I4 rejects repeated ambiguous lock descriptors', async (t) => {
  const { root } = await fixture(t);
  const block = '"example@npm:1.0.0":\n  version: 1.0.0\n  resolution: "example@npm:1.0.0"\n';
  await put(root, 'yarn.lock', `${block}\n${block}`);
  rejects(run(root), /ambiguous.*lock|duplicate.*descriptor/i);
});

test('I4 rejects ambiguous repeated resolution fields inside one lock record', async (t) => {
  const { root } = await fixture(t);
  await put(root, 'yarn.lock', '"example@npm:1.0.0":\n  version: 1.0.0\n  resolution: "malicious@npm:1.0.0"\n  resolution: "example@npm:1.0.0"\n');
  rejects(run(root), /ambiguous.*lock|duplicate.*resolution/i);
});

test('I5 discovers a sole workspace-local dependency through its declared workspace and a workspace symlink', async (t) => {
  const { root, provider } = await fixture(t);
  await mkdir(path.join(root, 'packages/provider/node_modules'), { recursive: true });
  await rename(path.join(root, 'node_modules/example'), path.join(root, 'packages/provider/node_modules/example'));
  await symlink('../packages/provider', path.join(root, 'node_modules/provider'));
  provider.chunks[0].modules = ['<repo>/packages/provider/node_modules/example/index.js'];
  await put(root, 'provider/evidence.json', provider);
  succeeds(run(root));
  const { components } = JSON.parse(await readFile(path.join(root, 'licenses/dependency-inventory.json')));
  assert.deepEqual(components[0].locations, ['packages/provider/node_modules/example']);
});

test('I5 resolves a nearer workspace version before a different root version and deduplicates symlink aliases', async (t) => {
  const { root, policy, provider, save } = await fixture(t);
  await put(root, 'packages/provider/node_modules/example/package.json', { name: 'example', version: '2.0.0', license: 'MIT' });
  await put(root, 'packages/provider/node_modules/example/LICENSE', texts.MIT);
  await put(root, 'packages/provider/node_modules/example/index.js', 'export default 2;\n');
  await symlink('../packages/provider/node_modules/example', path.join(root, 'node_modules/alias'));
  await put(root, 'packages/provider/package.json', { dependencies: { example: '2.0.0' } });
  await put(root, 'yarn.lock', '"example@npm:1.0.0":\n  version: 1.0.0\n  resolution: "example@npm:1.0.0"\n\n"example@npm:2.0.0":\n  version: 2.0.0\n  resolution: "example@npm:2.0.0"\n');
  policy.packages['example@2.0.0'] = {};
  provider.chunks[0].modules = ['<repo>/packages/provider/node_modules/example/index.js'];
  await put(root, 'provider/evidence.json', provider);
  await save();
  succeeds(run(root));
  const { components } = JSON.parse(await readFile(path.join(root, 'licenses/dependency-inventory.json')));
  assert.equal(components.length, 2);
  assert.deepEqual(components.find((c) => c.version === '2.0.0').locations, ['packages/provider/node_modules/example']);
  assert.deepEqual(components.find((c) => c.version === '1.0.0').scopes, ['installed-not-distributed']);
});

test('I6 rejects source-policy identity overrides before the AGPL boundary can be bypassed', async (t) => {
  const f = await fixture(t);
  await addSource(f);
  f.policy.source.paths['public/app/panel.ts'] = { path: 'packages/grafana-ui/ui.ts', license: 'Apache-2.0', evidence: ['packages/grafana-ui/LICENSE'] };
  await f.save();
  rejects(run(f.root), /policy.*(unknown|reserved|shape).*path/i);
});

for (const mutate of [
  (p) => { p.packages['example@1.0.0'].unexpected = true; },
  (p) => { p.assets = {}; },
  (p) => { p.generatedHelpers.bad = { package: 'example@1.0.0', path: 'bypass' }; },
  (p) => { p.packages['example@1.0.0'].evidence = [{ path: 'node_modules/example/LICENSE', kind: 'invented' }]; },
]) {
  test('I6 rejects malformed or unknown policy record fields', async (t) => {
    const { root, policy, save } = await fixture(t);
    mutate(policy);
    await save();
    rejects(run(root), /invalid policy|policy.*(unknown|shape)/i);
  });
}

test('I7 rejects SPDX character, token and nesting limits deliberately', () => {
  for (const expression of ['('.repeat(20000) + 'MIT' + ')'.repeat(20000), '('.repeat(70) + 'MIT' + ')'.repeat(70), Array(1100).fill('MIT').join(' OR ')]) {
    assert.throws(() => validateSpdxExpression(expression), /limit.*SPDX|SPDX.*limit/i);
  }
});

test('I7 bounds deterministic diagnostics for an oversized unknown policy field', async (t) => {
  const { root, policy } = await fixture(t);
  policy['x'.repeat(10000)] = true;
  await assert.rejects(scanInventory({ root, policy }), (error) => {
    assert.match(error.message, /invalid policy unknown field/i);
    assert.ok(error.message.length <= 2048);
    return true;
  });
});

for (const [limit, value] of [['fileBytes', 32], ['jsonBytes', 32], ['inputBytes', 300], ['artifactBytes', 32], ['items', 2], ['traversalDepth', 1], ['jsonDepth', 2]]) {
  test(`I7 enforces the ${limit} resource bound`, async (t) => {
    const { root, policy } = await fixture(t);
    await assert.rejects(scanInventory({ root, policy, limits: { [limit]: value } }), /resource limit/i);
  });
}

test('I7 refuses non-regular license evidence without blocking on a FIFO', async (t) => {
  const { root } = await fixture(t);
  await rm(path.join(root, 'node_modules/example/LICENSE'));
  execFileSync('mkfifo', [path.join(root, 'node_modules/example/LICENSE')]);
  const result = spawnSync(process.execPath, [cli, 'generate', '--root', root], { encoding: 'utf8', timeout: 1500 });
  assert.equal(result.error, undefined, 'scanner must reject the FIFO before blocking on it');
  rejects(result, /regular file/i);
});

test('I7 bounds source Git verification with an explicit subprocess timeout', async (t) => {
  const f = await fixture(t);
  await addSource(f);
  await put(f.root, 'fake-bin/git', '#!/bin/sh\nexec /bin/sleep 2\n');
  await chmod(path.join(f.root, 'fake-bin/git'), 0o755);
  const original = process.env.PATH;
  process.env.PATH = `${path.join(f.root, 'fake-bin')}:${original}`;
  try {
    await assert.rejects(scanInventory({ root: f.root, policy: f.policy, limits: { gitTimeoutMs: 25 } }), /resource limit.*Git.*timeout/i);
  } finally { process.env.PATH = original; }
});

test('the checked-in policy and generated outputs cover the exact current production closure', async () => {
  succeeds(run(repositoryRoot, 'check'));
  const inventory = JSON.parse(await readFile(path.join(repositoryRoot, 'licenses/dependency-inventory.json'), 'utf8'));
  for (const component of inventory.components) {
    for (const evidence of component.evidence) {
      assert.ok(!evidence.output.split('/').includes('node_modules'), `generated evidence must remain trackable: ${evidence.output}`);
    }
  }
  const notices = await readFile(path.join(repositoryRoot, 'THIRD_PARTY_NOTICES.md'), 'utf8');
  const targets = [...notices.matchAll(/\]\((licenses\/evidence\/[^)]+)\)/g)].map((match) => decodeURIComponent(match[1]));
  assert.ok(targets.length > 0, 'notices must link to copied evidence');
  for (const target of targets) await access(path.join(repositoryRoot, target));
});

test('the real inventory never leaves installed license declarations silently unresolved', async () => {
  const inventory = JSON.parse(await readFile(path.join(repositoryRoot, 'licenses/dependency-inventory.json'), 'utf8'));
  const byIdentity = new Map(inventory.components.map((component) => [`${component.name}@${component.version}`, component]));
  for (const identity of ['fast-shallow-equal@1.0.0', 'react-universal-interface@0.6.2']) {
    const component = byIdentity.get(identity);
    assert.equal(component.license, 'Unlicense', `${identity} must retain its authoritative full Unlicense terms`);
    assert.ok(component.evidence.some((entry) => entry.kind === 'license'), `${identity} must retain license evidence`);
  }
  const undeclared = byIdentity.get('get-document@1.0.0');
  assert.equal(undeclared.license, null);
  assert.equal(undeclared.legalReviewRequired, true);
  assert.match(undeclared.unresolvedLicense.reason, /no license declaration or license terms/i);
  assert.ok(inventory.inventoryReview.components.includes('get-document@1.0.0'));
  assert.ok(!inventory.releaseGate.components.includes('get-document@1.0.0'));
  for (const component of inventory.components.filter((entry) => entry.license === null)) {
    assert.equal(component.legalReviewRequired, true, `${component.name}@${component.version} has a silent null license`);
  }
});

test('the bundled dangerously-set-html-content boundary is not satisfied by a manifest declaration alone', async () => {
  const inventory = JSON.parse(await readFile(path.join(repositoryRoot, 'licenses/dependency-inventory.json'), 'utf8'));
  const component = inventory.components.find((entry) => entry.name === 'dangerously-set-html-content' && entry.version === '1.1.1');
  assert.equal(component.legalReviewRequired, true);
  assert.match(component.unresolvedLicense.reason, /neither.*contains full license terms/i);
  assert.ok(inventory.releaseGate.components.includes('dangerously-set-html-content@1.1.1'));
});

test('the real release gate contains only production review blockers while retaining installed-only questions', async () => {
  const inventory = JSON.parse(await readFile(path.join(repositoryRoot, 'licenses/dependency-inventory.json'), 'utf8'));
  assert.deepEqual(inventory.releaseGate.components, [
    '@grafana/i18n@13.2.3',
    '@grafana/schema@13.2.3',
    'dangerously-set-html-content@1.1.1',
  ]);
  assert.deepEqual(inventory.inventoryReview.components, [
    '@grafana/i18n@13.2.3',
    '@grafana/schema@13.2.3',
    '@visx/vendor@3.12.0',
    'dangerously-set-html-content@1.1.1',
    'get-document@1.0.0',
  ]);
  for (const identity of ['@grafana/i18n@13.2.3', '@grafana/schema@13.2.3']) {
    const [name, version] = identity.startsWith('@')
      ? [identity.slice(0, identity.lastIndexOf('@')), identity.slice(identity.lastIndexOf('@') + 1)]
      : identity.split('@');
    const component = inventory.components.find((entry) => entry.name === name && entry.version === version);
    assert.equal(component.conflict.status, 'unresolved');
    assert.equal(component.status, 'unresolved', `${identity} must not be labeled resolved while its conflict is unresolved`);
  }
});

test('the real nonproduction dependency graph preserves test, development, and demo reachability', async () => {
  const inventory = JSON.parse(await readFile(path.join(repositoryRoot, 'licenses/dependency-inventory.json'), 'utf8'));
  const byIdentity = new Map(inventory.components.map((component) => [`${component.name}@${component.version}`, component]));
  assert.ok(byIdentity.get('@playwright/test@1.56.1').scopes.includes('test-only'));
  assert.ok(byIdentity.get('playwright@1.56.1').scopes.includes('test-only'));
  assert.ok(byIdentity.get('@typescript/typescript6@6.0.2').scopes.includes('development-only'));
  assert.ok(byIdentity.get('keycloak-js@26.2.4').scopes.includes('demo-only'));
  assert.ok(!inventory.components.some((component) => component.scopes.includes('test/development')));
});

test('the top-level notices make retained Grafana provenance documents discoverable', async () => {
  const notices = await readFile(path.join(repositoryRoot, 'THIRD_PARTY_NOTICES.md'), 'utf8');
  assert.match(notices, /^## Grafana source provenance$/m);
  for (const file of ['LICENSE', 'LICENSING.md', 'NOTICE.md']) {
    const target = `licenses/evidence/grafana/${file}`;
    assert.match(notices, new RegExp(`\\(${target.replace('.', '\\.') }\\)`));
    await access(path.join(repositoryRoot, target));
  }
});

test('all generated licensing artifacts are visible to Git', async () => {
  const policy = JSON.parse(await readFile(path.join(repositoryRoot, 'compliance/third-party/policy.json'), 'utf8'));
  const { artifacts } = await scanInventory({ root: repositoryRoot, policy });
  const gitRoot = path.resolve(repositoryRoot);
  const outputs = new Set([...artifacts.keys(), ...Object.keys(await snapshot(repositoryRoot))]);
  for (const output of outputs) {
    const result = spawnSync('git', [
      '-c', `safe.directory=${gitRoot}`, '-C', gitRoot,
      'check-ignore', '--no-index', '--quiet', output,
    ], { encoding: 'utf8' });
    assert.ok([0, 1].includes(result.status), result.stderr || `git check-ignore failed for ${output}`);
    assert.equal(result.status, 1, `${output} is ignored and would be omitted from a normal commit`);
  }
});

test('root commands and maintenance documentation expose the release gate without overstating it', async () => {
  const manifest = JSON.parse(await readFile(path.join(repositoryRoot, 'package.json'), 'utf8'));
  assert.equal(manifest.scripts['licenses:generate'], 'node scripts/third-party-license-gate.mjs generate');
  assert.equal(manifest.scripts['licenses:check'], 'node scripts/third-party-license-gate.mjs check');
  assert.equal(manifest.scripts['test:licenses'], 'node --test scripts/third-party-license-gate.test.mjs');

  const documentation = await readFile(path.join(repositoryRoot, 'docs/development/third-party-licensing.md'), 'utf8');
  for (const required of [
    'blocked-legal-review',
    '@grafana/i18n@13.2.3',
    '@grafana/schema@13.2.3',
    'dangerously-set-html-content@1.1.1',
    'get-document@1.0.0',
    '@visx/vendor@3.12.0',
    'AGPL-3.0-only',
    'Apache-2.0',
    '6193dc03311b631b9727b560d24369e683dc396e',
    'issue #65',
    'legal advice',
    'Do not edit generated',
  ]) assert.ok(documentation.includes(required), `maintenance documentation must include ${required}`);
});
