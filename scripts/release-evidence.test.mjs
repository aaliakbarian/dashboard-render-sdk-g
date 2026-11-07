import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { link, mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  compareArtifactManifests,
  createReleaseEvidence as createReleaseEvidenceBase,
  runReleaseEvidence as runReleaseEvidenceBase,
  validateSpdxDocument,
  verifyReproducibleBuild,
} from './release-evidence.mjs';

const inventoryGate = async () => ({ status: 'verified-fixture' });
const fixtureToolchain = {
  node: '22.23.3',
  yarn: '4.17.1',
  containerImage: 'dashboard-render-sdk-g-poc-dev:local',
  containerDigest: `sha256:${'a'.repeat(64)}`,
  baseImage: 'node:22.23.3-bookworm',
  baseImageDigest: `sha256:${'b'.repeat(64)}`,
};
const createReleaseEvidence = options => createReleaseEvidenceBase({
  ...options,
  inventoryGate,
  buildRunner: options.buildRunner ?? (async () => {}),
  observedToolchain: options.observedToolchain ?? fixtureToolchain,
});
const runReleaseEvidence = options => runReleaseEvidenceBase({
  ...options,
  inventoryGate,
  buildRunner: options.buildRunner ?? (async () => {}),
  observedToolchain: options.observedToolchain ?? fixtureToolchain,
});

const cli = new URL('./release-evidence.mjs', import.meta.url).pathname;
const sha256 = value => createHash('sha256').update(value).digest('hex');

async function put(root, file, value) {
  const target = path.join(root, file);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, Buffer.isBuffer(value) ? value : typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`);
}

function git(cwd, args) {
  return execFileSync('git', ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', ...args], { cwd, encoding: 'utf8' }).trim();
}

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'release-evidence-'));
  t.after(() => rm(root, { recursive: true, force: true }));

  const sourcePath = 'public/app/panel.ts';
  const sourceBytes = 'export const panel = true;\n';
  const buildSourcePath = 'packages/grafana-ui/src/build-only.ts';
  const buildSourceBytes = 'export const buildOnly = true;\n';
  await put(root, '.grafana-source/grafana-v13.2.3/LICENSE', 'GNU AFFERO GENERAL PUBLIC LICENSE\n');
  await put(root, '.grafana-source/grafana-v13.2.3/LICENSING.md', 'Repository default: AGPL-3.0-only\n');
  await put(root, '.grafana-source/grafana-v13.2.3/NOTICE.md', 'Grafana notice\n');
  await put(root, `.grafana-source/grafana-v13.2.3/${sourcePath}`, sourceBytes);
  await put(root, `.grafana-source/grafana-v13.2.3/${buildSourcePath}`, buildSourceBytes);
  const grafanaRoot = path.join(root, '.grafana-source/grafana-v13.2.3');
  git(grafanaRoot, ['init', '-q']);
  git(grafanaRoot, ['add', '.']);
  git(grafanaRoot, ['commit', '-q', '-m', 'fixture']);
  const grafanaRevision = git(grafanaRoot, ['rev-parse', 'HEAD']);

  const provider = 'artifacts/sdk/provider-13/provider.js';
  const host = 'artifacts/sdk/host/index.js';
  const providerBytes = 'export const provider = true;\n';
  const hostBytes = 'console.log("host");\n';
  await put(root, provider, providerBytes);
  await put(root, host, hostBytes);
  await put(root, 'artifacts/sdk/provider-13/evidence/bundle-evidence.json', {
    chunks: [{ fileName: 'provider.js', modules: ['<grafana-source>/public/app/panel.ts'], imports: [], dynamicImports: [] }], assets: [],
  });
  await put(root, 'artifacts/sdk/host/evidence/bundle-evidence.json', {
    chunks: [{ fileName: 'index.js', modules: ['<repo>/artifacts/sdk/provider-13/provider.js'], imports: [], dynamicImports: [] }], assets: [],
  });
  await put(root, 'package.json', {
    name: 'fixture', version: '1.0.0', private: true, packageManager: 'yarn@4.17.1', engines: { node: '22.23.3' }, license: 'AGPL-3.0-only',
  });
  await put(root, 'packages/provider-13/package.json', { name: '@fixture/provider', version: '1.0.0', private: true, license: 'AGPL-3.0-only' });
  await put(root, 'apps/sdk-host/package.json', { name: '@fixture/host', version: '1.0.0', private: true, license: 'AGPL-3.0-only' });
  await put(root, 'yarn.lock', '# lock\n');
  await put(root, 'LICENSE', 'GNU AFFERO GENERAL PUBLIC LICENSE\n');
  await put(root, 'THIRD_PARTY_NOTICES.md', '# Notices\n');
  await put(root, 'dev/container/Dockerfile', 'FROM node:22.23.3-bookworm\n');
  await put(root, 'compose.yaml', 'services: {}\n');
  await put(root, 'packages/provider-13/vite.config.ts', 'export default {};\n');
  await put(root, 'apps/sdk-host/vite.config.ts', 'export default {};\n');

  const dependencyInventory = {
    schemaVersion: 1,
    components: [{
      name: 'example', version: '1.0.0', license: 'MIT', sourceUrl: 'https://example.invalid/example',
      scopes: ['provider-bundled'], relationship: 'transitive', directIn: [], locations: ['node_modules/example'],
      physicalComponents: [], evidence: [], modules: ['node_modules/example/index.js'], status: 'verified',
    }, {
      name: 'react', version: '19.2.8', license: 'MIT', sourceUrl: 'https://github.com/facebook/react',
      scopes: ['external-peer'], relationship: 'direct', directIn: ['packages/provider-13/package.json'], locations: ['node_modules/react'],
      physicalComponents: [], evidence: [], modules: [], status: 'verified',
    }, {
      name: '@fixture/runtime', version: '3.2.1', license: 'Apache-2.0', sourceUrl: 'https://example.invalid/runtime',
      scopes: ['provider-bundled'], relationship: 'transitive', directIn: [], locations: ['node_modules/@fixture/runtime'],
      physicalComponents: [], evidence: [], modules: [], status: 'verified',
    }, {
      name: 'dev-only', version: '2.0.0', license: 'MIT', sourceUrl: 'https://example.invalid/dev',
      scopes: ['development-only'], relationship: 'direct', directIn: ['package.json'], locations: ['node_modules/dev-only'],
      physicalComponents: [], evidence: [], modules: [], status: 'verified',
    }],
    emitted: [
      { path: host, scope: 'host-bundled', sha256: sha256(hostBytes), type: 'javascript' },
      { path: provider, scope: 'provider-bundled', sha256: sha256(providerBytes), type: 'javascript' },
    ],
    inputs: [], inventoryReview: [],
    releaseGate: { status: 'blocked-legal-review', components: ['example@1.0.0'], note: 'Fixture review remains.' },
  };
  const sourceInventory = {
    schemaVersion: 1, sourceUrl: 'https://github.com/grafana/grafana', revision: grafanaRevision,
    components: [{ path: sourcePath, sha256: sha256(sourceBytes), license: 'AGPL-3.0-only', scopes: ['source-derived'], bundles: ['provider-bundled'], evidence: [] }],
  };
  const assetBytes = '.example { color: red; }\n';
  await put(root, 'node_modules/example/style.css', assetBytes);
  const assetInventory = { schemaVersion: 1, components: [{
    path: 'node_modules/example/style.css', type: 'css', use: 'runtime', package: 'example@1.0.0',
    scopes: ['asset'], sha256: sha256(assetBytes), evidence: [], reason: 'Embedded fixture CSS.',
  }] };
  await put(root, 'licenses/dependency-inventory.json', dependencyInventory);
  await put(root, 'licenses/source-inventory.json', sourceInventory);
  await put(root, 'licenses/asset-inventory.json', assetInventory);

  const policy = {
    schemaVersion: 1,
    outputDir: 'artifacts/release',
    inventories: {
      dependencies: 'licenses/dependency-inventory.json',
      sources: 'licenses/source-inventory.json',
      assets: 'licenses/asset-inventory.json',
      notices: 'THIRD_PARTY_NOTICES.md',
    },
    grafana: {
      root: '.grafana-source/grafana-v13.2.3', revision: grafanaRevision,
      licenseFiles: ['LICENSE', 'LICENSING.md', 'NOTICE.md'],
      buildSourceFiles: [{ path: buildSourcePath, license: 'Apache-2.0' }],
    },
    artifacts: [
      { id: 'provider-13', root: 'artifacts/sdk/provider-13', evidence: 'artifacts/sdk/provider-13/evidence/bundle-evidence.json' },
      { id: 'sdk-host', root: 'artifacts/sdk/host', evidence: 'artifacts/sdk/host/evidence/bundle-evidence.json' },
    ],
    buildInputs: ['package.json', 'yarn.lock', 'dev/container/Dockerfile', 'compose.yaml', 'packages/provider-13/vite.config.ts', 'apps/sdk-host/vite.config.ts'],
    firstPartyPackages: ['packages/provider-13/package.json', 'apps/sdk-host/package.json'],
    toolchain: fixtureToolchain,
    sensitiveSourceFixtures: [],
  };
  await put(root, 'compliance/release/policy.json', policy);

  git(root, ['init', '-q']);
  await put(root, '.gitignore', '.grafana-source/\nartifacts/release/\n');
  git(root, ['add', '.']);
  git(root, ['commit', '-q', '-m', 'fixture']);
  return { root, policy, grafanaRevision, sourcePath, buildSourcePath };
}

test('creates deterministic source, SPDX, hash and provenance artifacts from the audited closure', async t => {
  const { root } = await fixture(t);
  const first = await createReleaseEvidence({ root, policyPath: 'compliance/release/policy.json' });
  const second = await createReleaseEvidence({ root, policyPath: 'compliance/release/policy.json' });
  assert.deepEqual([...second.artifacts], [...first.artifacts]);
  assert.equal(first.project.dirty, false);
  assert.equal(first.sourceManifest.grafana.files.length, 5);
  assert.ok(first.sourceManifest.grafana.files.some(file => file.use === 'build-input'));
  assert.ok(first.artifacts.has('dashboard-render-sdk-g-source.tar.gz'));
  assert.ok(first.artifacts.has('dashboard-render-sdk-g.spdx.json'));
  assert.ok(first.artifacts.has('SHA256SUMS'));
  assert.ok(first.artifacts.has('provenance.json'));
  validateSpdxDocument(first.sbom);
  assert.ok(first.sbom.packages.some(component => component.name === 'example'));
  assert.ok(!first.sbom.packages.some(component => component.name === 'dev-only'));
  assert.ok(first.sbom.files.some(file => file.fileName.endsWith('public/app/panel.ts')));
  assert.equal(first.provenance.licensing.releaseGate, 'blocked-legal-review');
});

test('source archive preserves tracked paths that exceed the ustar name fields', async t => {
  const { root } = await fixture(t);
  const longPath = `licenses/evidence/packages/${'long-segment-'.repeat(12)}/LICENSE`;
  await put(root, longPath, 'Long path license evidence.\n');
  const evidence = await createReleaseEvidence({
    root,
    policyPath: 'compliance/release/policy.json',
    allowDirty: true,
  });
  assert.ok(evidence.sourceManifest.sdk.files.some(file => file.path === longPath));
  const archive = path.join(root, 'long-path.tar.gz');
  await writeFile(archive, evidence.artifacts.get('dashboard-render-sdk-g-source.tar.gz'));
  const archivedPath = `dashboard-render-sdk-g-source/project/${longPath}`;
  assert.match(execFileSync('tar', ['-tzf', archive], { encoding: 'utf8' }), new RegExp(`${archivedPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'));
  assert.equal(execFileSync('tar', ['-xOzf', archive, archivedPath], { encoding: 'utf8' }), 'Long path license evidence.\n');
});

test('requires the issue #64 inventory gate before consuming generated inventories', async t => {
  const { root } = await fixture(t);
  await assert.rejects(createReleaseEvidenceBase({
    root,
    policyPath: 'compliance/release/policy.json',
    inventoryGate: async () => { throw new Error('stale issue #64 inventory'); },
    buildRunner: async () => {},
    observedToolchain: fixtureToolchain,
  }), /stale issue #64 inventory/);
});

test('SPDX describes only the distribution closure and relates packages, Grafana sources and assets', async t => {
  const { root, buildSourcePath } = await fixture(t);
  const evidence = await createReleaseEvidence({ root, policyPath: 'compliance/release/policy.json' });
  const names = evidence.sbom.packages.map(component => component.name);
  assert.ok(names.includes('example'));
  assert.ok(names.includes('react'));
  assert.ok(!names.includes('dev-only'));
  const react = evidence.sbom.packages.find(component => component.name === 'react');
  assert.match(react.annotations[0].comment, /external-peer/);
  assert.ok(evidence.sbom.files.some(file => file.fileName === 'grafana/public/app/panel.ts'));
  assert.ok(evidence.sbom.files.some(file => file.fileName === `grafana/${buildSourcePath}`));
  assert.ok(evidence.sbom.files.some(file => file.fileName === 'asset/node_modules/example/style.css'));
  assert.ok(evidence.sbom.files.some(file => file.fileName === 'artifact/artifacts/sdk/provider-13/provider.js'));
  const scoped = evidence.sbom.packages.find(component => component.name === '@fixture/runtime');
  assert.equal(scoped.externalRefs[0].referenceLocator, 'pkg:npm/%40fixture/runtime@3.2.1');
  const related = new Set(evidence.sbom.relationships.map(relation => relation.relatedSpdxElement));
  for (const component of [...evidence.sbom.packages, ...evidence.sbom.files]) assert.ok(related.has(component.SPDXID));
});

test('provenance connects toolchain, build inputs, artifacts, assets and deterministic outputs without self-reference', async t => {
  const { root } = await fixture(t);
  const evidence = await createReleaseEvidence({ root, policyPath: 'compliance/release/policy.json' });
  assert.equal(evidence.provenance.sdk.gitCommit, git(root, ['rev-parse', 'HEAD']));
  assert.equal(evidence.provenance.grafana.gitCommit, git(path.join(root, '.grafana-source/grafana-v13.2.3'), ['rev-parse', 'HEAD']));
  assert.equal(evidence.provenance.toolchain.observed.node, process.versions.node);
  assert.match(evidence.provenance.toolchain.observed.containerDigest, /^sha256:[0-9a-f]{64}$/);
  assert.equal(evidence.provenance.toolchain.observed.baseImage, 'node:22.23.3-bookworm');
  assert.match(evidence.provenance.toolchain.observed.baseImageDigest, /^sha256:[0-9a-f]{64}$/);
  assert.match(evidence.provenance.build.lockfile.sha256, /^[0-9a-f]{64}$/);
  assert.equal(evidence.provenance.build.inputs.length, 6);
  assert.equal(evidence.provenance.build.artifacts.length, 4);
  assert.equal(evidence.provenance.assets.length, 1);
  assert.equal(evidence.provenance.assets[0].path, 'node_modules/example/style.css');
  for (const output of Object.values(evidence.provenance.outputs)) assert.match(output.sha256, /^[0-9a-f]{64}$/);
  const sums = evidence.artifacts.get('SHA256SUMS').toString('utf8');
  assert.match(sums, /dashboard-render-sdk-g-source\.tar\.gz/);
  assert.match(sums, /dashboard-render-sdk-g\.spdx\.json/);
  assert.match(sums, /node_modules\/example\/style\.css/);
  assert.doesNotMatch(sums, /provenance\.json|SHA256SUMS/);
});

test('SPDX validation rejects missing and dangling relationships', async t => {
  const { root } = await fixture(t);
  const evidence = await createReleaseEvidence({ root, policyPath: 'compliance/release/policy.json' });
  const missing = structuredClone(evidence.sbom);
  missing.relationships = missing.relationships.filter(relation => relation.relationshipType !== 'DESCRIBES');
  assert.throws(() => validateSpdxDocument(missing), /DESCRIBES/);
  const dangling = structuredClone(evidence.sbom);
  dangling.relationships.push({ spdxElementId: 'SPDXRef-DOCUMENT', relationshipType: 'DESCRIBES', relatedSpdxElement: 'SPDXRef-Missing' });
  assert.throws(() => validateSpdxDocument(dangling), /unknown/);
  const malformedLicense = structuredClone(evidence.sbom);
  malformedLicense.packages[0].licenseDeclared = 'MIT OR';
  assert.throws(() => validateSpdxDocument(malformedLicense), /SPDX|license/i);
});

test('generate and check are deterministic and check rejects stale output', async t => {
  const { root } = await fixture(t);
  await runReleaseEvidence({ root, mode: 'generate', policyPath: 'compliance/release/policy.json' });
  await runReleaseEvidence({ root, mode: 'check', policyPath: 'compliance/release/policy.json' });
  await put(root, 'artifacts/release/provenance.json', '{}\n');
  await assert.rejects(runReleaseEvidence({ root, mode: 'check', policyPath: 'compliance/release/policy.json' }), /stale/i);
});

test('release mode rejects a dirty project while explicit development mode records it', async t => {
  const { root } = await fixture(t);
  await put(root, 'package.json', { changed: true });
  await assert.rejects(createReleaseEvidence({ root, policyPath: 'compliance/release/policy.json' }), /dirty/i);
  const evidence = await createReleaseEvidence({ root, policyPath: 'compliance/release/policy.json', allowDirty: true });
  assert.equal(evidence.project.dirty, true);
  assert.equal(evidence.provenance.releaseEligible, false);
});

test('rejects wrong or dirty Grafana source and source hash drift', async t => {
  const { root, sourcePath } = await fixture(t);
  await put(root, `.grafana-source/grafana-v13.2.3/${sourcePath}`, 'changed\n');
  await assert.rejects(createReleaseEvidence({ root, policyPath: 'compliance/release/policy.json' }), /Grafana.*(?:dirty|identity)|source.*hash/i);
});

test('rejects unexpected, missing or changed production artifact content', async t => {
  const { root } = await fixture(t);
  await put(root, 'artifacts/sdk/provider-13/unreviewed.js', 'surprise\n');
  await assert.rejects(createReleaseEvidence({ root, policyPath: 'compliance/release/policy.json', allowDirty: true }), /unexpected artifact/i);
  await rm(path.join(root, 'artifacts/sdk/provider-13/unreviewed.js'));
  await put(root, 'artifacts/sdk/provider-13/provider.js', 'changed\n');
  await assert.rejects(createReleaseEvidence({ root, policyPath: 'compliance/release/policy.json', allowDirty: true }), /artifact.*hash/i);
});

test('scans textual source by content and rejects ambiguous encodings without exposing contents', async t => {
  const { root } = await fixture(t);
  await put(root, 'bypass.ts', '-----BEGIN PRIVATE KEY-----\nnot-a-real-key\n');
  await assert.rejects(createReleaseEvidence({ root, policyPath: 'compliance/release/policy.json', allowDirty: true }), /secret/i);
  await rm(path.join(root, 'bypass.ts'));
  await put(root, 'bypass.yaml', 'source: /home/person/private/build.js\n');
  await assert.rejects(createReleaseEvidence({ root, policyPath: 'compliance/release/policy.json', allowDirty: true }), /machine-local/i);
  await rm(path.join(root, 'bypass.yaml'));
  await put(root, 'extensionless', 'file:///home/person/private/build.js\n');
  await assert.rejects(createReleaseEvidence({ root, policyPath: 'compliance/release/policy.json', allowDirty: true }), /machine-local/i);
  await rm(path.join(root, 'extensionless'));
  await put(root, 'utf16.txt', Buffer.concat([
    Buffer.from([0xff, 0xfe]),
    Buffer.from('private source', 'utf16le'),
  ]));
  await assert.rejects(createReleaseEvidence({ root, policyPath: 'compliance/release/policy.json', allowDirty: true }), /encoding/i);
  await rm(path.join(root, 'utf16.txt'));
  const dilutedUtf16 = `${'漢字'.repeat(100)}-----BEGIN PRIVATE KEY-----`;
  await put(root, 'utf16le-no-bom.txt', Buffer.from(dilutedUtf16, 'utf16le'));
  await assert.rejects(createReleaseEvidence({ root, policyPath: 'compliance/release/policy.json', allowDirty: true }), /encoding/i);
  await rm(path.join(root, 'utf16le-no-bom.txt'));
  const utf16be = Buffer.from(dilutedUtf16, 'utf16le');
  utf16be.swap16();
  await put(root, 'utf16be-no-bom.txt', utf16be);
  await assert.rejects(createReleaseEvidence({ root, policyPath: 'compliance/release/policy.json', allowDirty: true }), /encoding/i);
  await rm(path.join(root, 'utf16be-no-bom.txt'));
  await put(root, 'ambiguous.conf', Buffer.from([0x63, 0x61, 0x66, 0xe9]));
  await assert.rejects(createReleaseEvidence({ root, policyPath: 'compliance/release/policy.json', allowDirty: true }), /encoding/i);
  await rm(path.join(root, 'ambiguous.conf'));
  await put(root, 'binary.dat', Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0xff]),
    Buffer.from('-----BEGIN PRIVATE KEY-----'),
  ]));
  await assert.rejects(createReleaseEvidence({ root, policyPath: 'compliance/release/policy.json', allowDirty: true }), /secret/i);
  await rm(path.join(root, 'binary.dat'));
  await put(root, 'binary.dat', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0xff, 0x10, 0x00]));
  await assert.doesNotReject(createReleaseEvidence({ root, policyPath: 'compliance/release/policy.json', allowDirty: true }));
});

test('rejects source symlink escapes', async t => {
  const { root } = await fixture(t);
  const external = await mkdtemp(path.join(os.tmpdir(), 'release-evidence-external-'));
  t.after(() => rm(external, { recursive: true, force: true }));
  await put(external, 'provider.js', 'outside\n');
  await rm(path.join(root, 'artifacts/sdk/provider-13/provider.js'));
  await symlink(path.join(external, 'provider.js'), path.join(root, 'artifacts/sdk/provider-13/provider.js'));
  await assert.rejects(createReleaseEvidence({ root, policyPath: 'compliance/release/policy.json', allowDirty: true }), /symlink|contain/i);
});

test('rejects symlinked release output destinations', async t => {
  const { root } = await fixture(t);
  const external = await mkdtemp(path.join(os.tmpdir(), 'release-evidence-output-'));
  t.after(() => rm(external, { recursive: true, force: true }));
  await mkdir(path.join(root, 'artifacts'), { recursive: true });
  await symlink(external, path.join(root, 'artifacts/release'));
  await assert.rejects(runReleaseEvidence({ root, mode: 'generate', policyPath: 'compliance/release/policy.json', allowDirty: true }), /symlink|contain/i);
});

test('atomically replaces a hard-linked output without changing its external inode', async t => {
  const { root } = await fixture(t);
  const external = await mkdtemp(path.join(os.tmpdir(), 'release-evidence-hardlink-'));
  t.after(() => rm(external, { recursive: true, force: true }));
  const externalFile = path.join(external, 'external.txt');
  const original = 'external bytes must survive\n';
  await writeFile(externalFile, original);
  await mkdir(path.join(root, 'artifacts/release'), { recursive: true });
  await link(externalFile, path.join(root, 'artifacts/release/provenance.json'));

  await runReleaseEvidence({ root, mode: 'generate', policyPath: 'compliance/release/policy.json', allowDirty: true });

  assert.equal(await readFile(externalFile, 'utf8'), original);
  assert.notEqual(await readFile(path.join(root, 'artifacts/release/provenance.json'), 'utf8'), original);
  await runReleaseEvidence({ root, mode: 'check', policyPath: 'compliance/release/policy.json', allowDirty: true });
});

test('failed output replacement leaves no temporary files', async t => {
  const { root } = await fixture(t);
  const output = path.join(root, 'artifacts/release');
  await mkdir(path.join(output, 'provenance.json'), { recursive: true });

  await assert.rejects(
    runReleaseEvidence({ root, mode: 'generate', policyPath: 'compliance/release/policy.json', allowDirty: true }),
    /regular file/i,
  );
  assert.deepEqual((await readdir(output)).filter(name => name.includes('.tmp-')), []);
});

test('accepts audited emitted assets and records each path once in the hash manifest', async t => {
  const { root } = await fixture(t);
  const cssPath = 'artifacts/sdk/host/assets/index.css';
  const cssBytes = '.host { display: block; }\n';
  await put(root, cssPath, cssBytes);
  const assets = JSON.parse(await readFile(path.join(root, 'licenses/asset-inventory.json'), 'utf8'));
  assets.components.push({
    path: cssPath,
    type: 'css',
    use: 'static',
    firstParty: true,
    scopes: ['first-party'],
    sha256: sha256(cssBytes),
    evidence: [],
    reason: 'Generated host CSS fixture.',
  });
  await put(root, 'licenses/asset-inventory.json', assets);
  const bundle = JSON.parse(await readFile(path.join(root, 'artifacts/sdk/host/evidence/bundle-evidence.json'), 'utf8'));
  bundle.assets.push({ fileName: 'assets/index.css' });
  await put(root, 'artifacts/sdk/host/evidence/bundle-evidence.json', bundle);

  const evidence = await createReleaseEvidence({ root, policyPath: 'compliance/release/policy.json', allowDirty: true });
  assert.ok(evidence.artifactFiles.some(file => file.path === cssPath));
  assert.ok(evidence.assetFiles.some(file => file.path === cssPath));
  const sums = evidence.artifacts.get('SHA256SUMS').toString('utf8').split('\n');
  assert.equal(sums.filter(line => line.endsWith(`  ${cssPath}`)).length, 1);
});

test('accepts bundle evidence that tracks generated assets through the audited asset inventory', async t => {
  const { root } = await fixture(t);
  const bundlePath = path.join(root, 'artifacts/sdk/host/evidence/bundle-evidence.json');
  const bundle = JSON.parse(await readFile(bundlePath, 'utf8'));
  delete bundle.assets;
  await put(root, 'artifacts/sdk/host/evidence/bundle-evidence.json', bundle);
  await assert.doesNotReject(createReleaseEvidence({
    root,
    policyPath: 'compliance/release/policy.json',
    allowDirty: true,
  }));
});

test('rejects unsafe policy paths, local paths and high-confidence secrets', async t => {
  const { root, policy } = await fixture(t);
  policy.outputDir = '../escape';
  await put(root, 'compliance/release/policy.json', policy);
  await assert.rejects(createReleaseEvidence({ root, policyPath: 'compliance/release/policy.json', allowDirty: true }), /safe relative path/i);
  policy.outputDir = 'artifacts/release';
  await put(root, 'compliance/release/policy.json', policy);
  const secret = 'const key = "-----BEGIN PRIVATE KEY-----";\n';
  await put(root, 'artifacts/sdk/host/index.js', secret);
  const inventory = JSON.parse(await readFile(path.join(root, 'licenses/dependency-inventory.json'), 'utf8'));
  inventory.emitted.find(entry => entry.path === 'artifacts/sdk/host/index.js').sha256 = sha256(secret);
  await put(root, 'licenses/dependency-inventory.json', inventory);
  await assert.rejects(createReleaseEvidence({ root, policyPath: 'compliance/release/policy.json', allowDirty: true }), /secret/i);
});

test('comparison reports byte differences without ignoring filenames', () => {
  assert.doesNotThrow(() => compareArtifactManifests([{ path: 'a.js', sha256: 'a' }], [{ path: 'a.js', sha256: 'a' }]));
  assert.throws(() => compareArtifactManifests([{ path: 'a.js', sha256: 'a' }], [{ path: 'a.js', sha256: 'b' }]), /reproducibility/i);
  assert.throws(() => compareArtifactManifests([{ path: 'a.js', sha256: 'a' }], [{ path: 'b.js', sha256: 'a' }]), /reproducibility/i);
});

test('double-build verification accepts identical complete trees and rejects a changed second build', async t => {
  const { root } = await fixture(t);
  let round = 0;
  const stable = async () => {
    round += 1;
    await put(root, 'artifacts/sdk/provider-13/provider.js', 'stable\n');
    await put(root, 'artifacts/sdk/host/index.js', 'stable-host\n');
  };
  const result = await verifyReproducibleBuild({ root, policyPath: 'compliance/release/policy.json', buildRunner: stable, observedToolchain: fixtureToolchain });
  assert.equal(round, 2);
  assert.equal(result.byteIdentical, true);
  let changedRound = 0;
  const changed = async () => {
    changedRound += 1;
    await put(root, 'artifacts/sdk/provider-13/provider.js', `round-${changedRound}\n`);
  };
  await assert.rejects(verifyReproducibleBuild({ root, policyPath: 'compliance/release/policy.json', buildRunner: changed, observedToolchain: fixtureToolchain }), /reproducibility/i);
  await assert.rejects(verifyReproducibleBuild({
    root,
    policyPath: 'compliance/release/policy.json',
    buildRunner: stable,
    observedToolchain: { ...fixtureToolchain, yarn: '0.0.0' },
  }), /toolchain/i);
});

test('root package exposes the bounded release-evidence commands', async () => {
  const root = path.resolve(new URL('../', import.meta.url).pathname);
  const manifest = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  assert.equal(manifest.scripts['test:release-evidence'], 'node --test scripts/release-evidence.test.mjs');
  assert.equal(manifest.scripts['release:evidence:generate'], 'node scripts/release-evidence.mjs generate');
  assert.equal(manifest.scripts['release:evidence:check'], 'node scripts/release-evidence.mjs check');
  assert.equal(manifest.scripts['release:evidence:verify-build'], 'node scripts/release-evidence.mjs verify-build');
});

test('CLI rejects unknown modes and oversized policy before traversal', async t => {
  const { root } = await fixture(t);
  const unknown = spawnSync(process.execPath, [cli, 'wat', '--root', root], { encoding: 'utf8' });
  assert.notEqual(unknown.status, 0);
  assert.match(unknown.stderr, /mode/i);
  await writeFile(path.join(root, 'compliance/release/policy.json'), ' '.repeat(1024 * 1024 + 1));
  const large = spawnSync(process.execPath, [cli, 'generate', '--root', root], { encoding: 'utf8' });
  assert.notEqual(large.status, 0);
  assert.match(large.stderr, /limit/i);
});
