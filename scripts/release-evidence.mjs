#!/usr/bin/env node

import { execFileSync, spawnSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import {
  closeSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { runGate, validateSpdxExpression } from './third-party-license-gate.mjs';

export const LIMITS = Object.freeze({
  policyBytes: 1024 * 1024,
  jsonBytes: 16 * 1024 * 1024,
  fileBytes: 64 * 1024 * 1024,
  totalBytes: 1024 * 1024 * 1024,
  files: 100_000,
});

const productionScopes = new Set(['provider-bundled', 'host-bundled', 'external-peer', 'asset', 'generated-helper']);
const hash = value => createHash('sha256').update(value).digest('hex');
const json = value => `${JSON.stringify(value, null, 2)}\n`;

function fail(message) {
  throw new Error(message);
}

function safeRelative(value, label = 'path') {
  if (typeof value !== 'string' || value.length === 0 || value.length > 4096 ||
      path.isAbsolute(value) || value.includes('\\') || /[\0-\x1f\x7f]/.test(value)) {
    fail(`${label} must be a safe relative path`);
  }
  const normalized = path.posix.normalize(value);
  if (normalized === '.' || normalized === '..' || normalized.startsWith('../') || normalized !== value.replace(/\/$/, '')) {
    fail(`${label} must be a safe relative path`);
  }
  return normalized;
}

function exactKeys(value, allowed, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`Invalid ${label}`);
  for (const key of Object.keys(value)) if (!allowed.includes(key)) fail(`Unexpected ${label} field: ${key}`);
}

function assertContainedPath(root, file, label, allowMissing = false) {
  const canonicalRoot = realpathSync(root);
  const absolute = path.resolve(file);
  const relative = path.relative(canonicalRoot, absolute);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) fail(`${label} escapes its allowed root`);
  let current = canonicalRoot;
  for (const part of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    let info;
    try { info = lstatSync(current); } catch (error) {
      if (allowMissing && error?.code === 'ENOENT') continue;
      throw error;
    }
    if (info.isSymbolicLink()) fail(`Symlink is not allowed in release inputs or outputs: ${label}`);
  }
}

function boundedRead(file, limits, budget, label = file, containmentRoot) {
  if (containmentRoot) assertContainedPath(containmentRoot, file, label);
  const info = lstatSync(file);
  if (!info.isFile() || info.isSymbolicLink()) fail(`${label} must be a regular file`);
  if (info.size > limits.fileBytes) fail(`Resource limit: ${label} exceeds fileBytes`);
  budget.bytes += info.size;
  budget.files += 1;
  if (budget.bytes > limits.totalBytes) fail('Resource limit: aggregate input bytes');
  if (budget.files > limits.files) fail('Resource limit: file count');
  return readFileSync(file);
}

function readJson(root, relative, limits, budget, policy = false) {
  const safe = safeRelative(relative);
  const file = path.resolve(root, safe);
  const bytes = boundedRead(file, limits, budget, safe, root);
  const maximum = policy ? limits.policyBytes : limits.jsonBytes;
  if (bytes.length > maximum) fail(`Resource limit: ${safe} exceeds ${policy ? 'policyBytes' : 'jsonBytes'}`);
  try {
    return JSON.parse(bytes.toString('utf8'));
  } catch {
    fail(`Invalid JSON: ${safe}`);
  }
}

function command(cwd, executable, args, options = {}) {
  try {
    return execFileSync(executable, args, {
      cwd,
      encoding: options.encoding ?? 'utf8',
      maxBuffer: 16 * 1024 * 1024,
      env: options.env,
      stdio: options.stdio,
    });
  } catch (error) {
    fail(`${executable} ${args.join(' ')} failed${error?.stderr ? `: ${String(error.stderr).trim()}` : ''}`);
  }
}

function git(root, args) {
  return command(root, 'git', args).trim();
}

function validatePolicy(policy) {
  exactKeys(policy, ['schemaVersion', 'outputDir', 'inventories', 'grafana', 'artifacts', 'buildInputs', 'firstPartyPackages', 'toolchain', 'sensitiveSourceFixtures'], 'policy');
  if (policy.schemaVersion !== 1) fail('Unsupported release policy schema');
  safeRelative(policy.outputDir, 'outputDir');
  exactKeys(policy.inventories, ['dependencies', 'sources', 'assets', 'notices'], 'inventories');
  for (const [key, value] of Object.entries(policy.inventories)) safeRelative(value, `inventories.${key}`);
  exactKeys(policy.grafana, ['root', 'revision', 'licenseFiles', 'buildSourceFiles'], 'grafana');
  safeRelative(policy.grafana.root, 'grafana.root');
  if (!/^[0-9a-f]{40}$/.test(policy.grafana.revision)) fail('Invalid Grafana revision');
  if (!Array.isArray(policy.grafana.licenseFiles) || policy.grafana.licenseFiles.length === 0 || policy.grafana.licenseFiles.length > 32) fail('Invalid Grafana licenseFiles');
  policy.grafana.licenseFiles.forEach(file => safeRelative(file, 'grafana.licenseFiles'));
  if (!Array.isArray(policy.grafana.buildSourceFiles) || policy.grafana.buildSourceFiles.length > 128) fail('Invalid Grafana buildSourceFiles');
  for (const source of policy.grafana.buildSourceFiles) {
    exactKeys(source, ['path', 'license'], 'Grafana build source');
    safeRelative(source.path, 'grafana.buildSourceFiles.path');
    validateSpdxExpression(source.license);
  }
  if (!Array.isArray(policy.artifacts) || policy.artifacts.length === 0 || policy.artifacts.length > 16) fail('Invalid artifacts');
  const artifactIds = new Set();
  for (const artifact of policy.artifacts) {
    exactKeys(artifact, ['id', 'root', 'evidence'], 'artifact');
    if (typeof artifact.id !== 'string' || !/^[a-z0-9-]{1,64}$/.test(artifact.id) || artifactIds.has(artifact.id)) fail('Invalid artifact id');
    artifactIds.add(artifact.id);
    safeRelative(artifact.root, 'artifact.root');
    safeRelative(artifact.evidence, 'artifact.evidence');
    if (!artifact.evidence.startsWith(`${artifact.root}/`)) fail('Artifact evidence must be inside its root');
  }
  for (const key of ['buildInputs', 'firstPartyPackages']) {
    if (!Array.isArray(policy[key]) || policy[key].length === 0 || policy[key].length > 256) fail(`Invalid ${key}`);
    policy[key].forEach(value => safeRelative(value, key));
  }
  exactKeys(policy.toolchain, ['node', 'yarn', 'containerImage', 'containerDigest', 'baseImage', 'baseImageDigest'], 'toolchain');
  if (typeof policy.toolchain.node !== 'string' || typeof policy.toolchain.yarn !== 'string' ||
      typeof policy.toolchain.containerImage !== 'string' || typeof policy.toolchain.baseImage !== 'string') fail('Invalid toolchain');
  for (const key of ['containerDigest', 'baseImageDigest']) {
    if (!/^sha256:[0-9a-f]{64}$/.test(policy.toolchain[key])) fail(`Invalid ${key}`);
  }
  if (!Array.isArray(policy.sensitiveSourceFixtures) || policy.sensitiveSourceFixtures.length > 32) fail('Invalid sensitiveSourceFixtures');
  for (const fixture of policy.sensitiveSourceFixtures) {
    exactKeys(fixture, ['path', 'sha256'], 'sensitive source fixture');
    safeRelative(fixture.path, 'sensitiveSourceFixtures.path');
    if (!/^[0-9a-f]{64}$/.test(fixture.sha256)) fail('Invalid sensitive source fixture hash');
  }
  return policy;
}

function walk(root, relative, limits, budget) {
  const result = [];
  assertContainedPath(root, path.resolve(root, relative), relative);
  const visit = current => {
    const absolute = path.join(root, current);
    for (const entry of readdirSync(absolute, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const item = current ? `${current}/${entry.name}` : entry.name;
      budget.files += 1;
      if (budget.files > limits.files) fail('Resource limit: file count');
      if (entry.isSymbolicLink()) fail(`Symlink is not allowed in release inputs: ${item}`);
      if (entry.isDirectory()) visit(item);
      else if (entry.isFile()) result.push(item);
      else fail(`Unsupported release input type: ${item}`);
    }
  };
  visit(relative);
  return result;
}

function scanSensitiveText(relative, text) {
  if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text) || /\bAKIA[0-9A-Z]{16}\b/.test(text) ||
      /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/.test(text)) {
    fail(`Potential secret in distributed artifact: ${relative}`);
  }
  if (/(?:file:\/\/\/|\/home\/[^/<\s]+\/|\/Users\/[^/<\s]+\/|[A-Za-z]:\\Users\\)/.test(text)) {
    fail(`Machine-local path in distributed artifact: ${relative}`);
  }
}

function resemblesNullEncodedText(bytes) {
  let nulls = 0;
  let printable = 0;
  let nonNull = 0;
  for (const byte of bytes) {
    if (byte === 0) {
      nulls += 1;
      continue;
    }
    nonNull += 1;
    if (byte === 9 || byte === 10 || byte === 13 || (byte >= 0x20 && byte <= 0x7e)) printable += 1;
  }
  if (nulls * 4 >= bytes.length && nonNull > 0 && printable * 5 >= nonNull * 4) return true;
  for (let offset = 0; offset < 2; offset += 1) {
    let alternatingRun = 0;
    for (let index = offset; index + 1 < bytes.length; index += 2) {
      const firstNull = bytes[index] === 0;
      const secondNull = bytes[index + 1] === 0;
      const other = firstNull ? bytes[index + 1] : bytes[index];
      const printablePair = firstNull !== secondNull && (other === 9 || other === 10 || other === 13 || (other >= 0x20 && other <= 0x7e));
      alternatingRun = printablePair ? alternatingRun + 1 : 0;
      if (alternatingRun >= 8) return true;
    }
  }
  return false;
}

function scanSensitive(relative, bytes) {
  scanSensitiveText(relative, bytes.toString('latin1'));
  if ((bytes[0] === 0xff && bytes[1] === 0xfe) || (bytes[0] === 0xfe && bytes[1] === 0xff) || resemblesNullEncodedText(bytes)) {
    fail(`Unsupported text encoding in distributed artifact: ${relative}`);
  }
  try {
    scanSensitiveText(relative, new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch (error) {
    if (error?.message?.startsWith('Potential secret') || error?.message?.startsWith('Machine-local path') ||
        error?.message?.startsWith('Unsupported text encoding')) throw error;
    const clearlyBinary = bytes.includes(0) || bytes.some(byte => byte < 9 || (byte > 13 && byte < 0x20));
    if (!clearlyBinary) fail(`Unsupported or ambiguous text encoding in distributed artifact: ${relative}`);
  }
}

function scanSourceSensitive(relative, bytes, sensitiveSourceFixtures) {
  try {
    scanSensitive(relative, bytes);
  } catch (error) {
    const fixture = sensitiveSourceFixtures.find(entry => entry.path === relative);
    if (!fixture || fixture.sha256 !== hash(bytes)) throw error;
  }
}

function artifactManifest(root, policy, dependencyInventory, assetFiles, limits, budget) {
  if (!Array.isArray(dependencyInventory.emitted)) fail('Invalid dependency inventory emitted list');
  const expected = new Map();
  for (const entry of dependencyInventory.emitted) {
    exactKeys(entry, ['path', 'scope', 'sha256', 'type'], 'emitted inventory entry');
    const file = safeRelative(entry.path, 'emitted.path');
    if (!/^[0-9a-f]{64}$/.test(entry.sha256)) fail(`Invalid artifact hash: ${file}`);
    expected.set(file, entry);
  }
  const output = [];
  for (const artifact of policy.artifacts) {
    const allowed = new Set([artifact.evidence]);
    for (const file of expected.keys()) if (file.startsWith(`${artifact.root}/`)) allowed.add(file);
    for (const asset of assetFiles) if (asset.path.startsWith(`${artifact.root}/`)) allowed.add(asset.path);
    const actual = walk(root, artifact.root, limits, budget).map(file => `${artifact.root}/${file.slice(artifact.root.length + 1)}`);
    for (const file of actual) if (!allowed.has(file)) fail(`Unexpected artifact file: ${file}`);
    for (const file of allowed) {
      let bytes;
      try { bytes = boundedRead(path.resolve(root, file), limits, budget, file, root); } catch (error) {
        if (error?.code === 'ENOENT') fail(`Missing artifact file: ${file}`);
        throw error;
      }
      scanSensitive(file, bytes);
      const digest = hash(bytes);
      const inventory = expected.get(file);
      if (inventory && digest !== inventory.sha256) fail(`Artifact hash mismatch: ${file}`);
      const asset = assetFiles.find(entry => entry.path === file);
      output.push({ artifact: artifact.id, path: file, sha256: digest, size: bytes.length, kind: inventory?.type ?? asset?.type ?? 'bundle-evidence' });
    }
    const report = readJson(root, artifact.evidence, limits, budget);
    if (!Array.isArray(report.chunks) || (report.assets !== undefined && !Array.isArray(report.assets))) fail(`Invalid bundle evidence: ${artifact.evidence}`);
    for (const item of [...report.chunks, ...(report.assets ?? [])]) {
      if (!item || typeof item.fileName !== 'string') fail(`Invalid bundle evidence item: ${artifact.evidence}`);
      const emitted = `${artifact.root}/${safeRelative(item.fileName, 'bundle fileName')}`;
      if (!expected.has(emitted) && !assetFiles.some(asset => asset.path === emitted)) fail(`Bundle evidence is not reconciled with emitted inventory: ${emitted}`);
    }
  }
  for (const file of expected.keys()) if (!output.some(entry => entry.path === file)) fail(`Emitted inventory path is outside configured artifacts: ${file}`);
  return output.sort((a, b) => a.path.localeCompare(b.path));
}

function octal(buffer, offset, length, value) {
  const text = Math.max(0, value).toString(8).padStart(length - 1, '0').slice(-(length - 1));
  buffer.write(text, offset, length - 1, 'ascii');
  buffer[offset + length - 1] = 0;
}

function tarName(header, name) {
  const bytes = Buffer.byteLength(name);
  if (bytes <= 100) return header.write(name, 0, 100, 'utf8');
  const slash = name.lastIndexOf('/');
  if (slash <= 0 || Buffer.byteLength(name.slice(0, slash)) > 155 || Buffer.byteLength(name.slice(slash + 1)) > 100) fail(`Source archive path is too long: ${name}`);
  header.write(name.slice(slash + 1), 0, 100, 'utf8');
  header.write(name.slice(0, slash), 345, 155, 'utf8');
}

function tarHeader(name, size, mode, epoch, type = '0') {
  const header = Buffer.alloc(512);
  tarName(header, name);
  octal(header, 100, 8, mode);
  octal(header, 108, 8, 0); octal(header, 116, 8, 0);
  octal(header, 124, 12, size); octal(header, 136, 12, epoch);
  header.fill(0x20, 148, 156); header[156] = type.charCodeAt(0);
  header.write('ustar\0', 257, 6, 'ascii'); header.write('00', 263, 2, 'ascii');
  octal(header, 329, 8, 0); octal(header, 337, 8, 0);
  let sum = 0; for (const byte of header) sum += byte;
  const checksum = sum.toString(8).padStart(6, '0');
  header.write(checksum, 148, 6, 'ascii'); header[154] = 0; header[155] = 0x20;
  return header;
}

function paxPathRecord(name) {
  const body = `path=${name}\n`;
  let size = Buffer.byteLength(body) + 3;
  while (true) {
    const record = `${size} ${body}`;
    const actual = Buffer.byteLength(record);
    if (actual === size) return Buffer.from(record);
    size = actual;
  }
}

function appendTarEntry(chunks, header, bytes) {
  chunks.push(header, bytes);
  const padding = (512 - (bytes.length % 512)) % 512;
  if (padding) chunks.push(Buffer.alloc(padding));
}

function tar(files, epoch) {
  const chunks = [];
  for (const file of [...files].sort((a, b) => a.path.localeCompare(b.path))) {
    let archiveName = file.path;
    try {
      tarName(Buffer.alloc(512), archiveName);
    } catch {
      const identity = hash(file.path).slice(0, 24);
      const pax = paxPathRecord(file.path);
      appendTarEntry(chunks, tarHeader(`PaxHeaders/${identity}`, pax.length, 0o644, epoch, 'x'), pax);
      archiveName = `PaxFiles/${identity}`;
    }
    appendTarEntry(chunks, tarHeader(archiveName, file.bytes.length, file.mode ?? 0o644, epoch), file.bytes);
  }
  chunks.push(Buffer.alloc(1024));
  return Buffer.concat(chunks);
}

function projectSources(root, outputDir, sensitiveSourceFixtures, limits, budget) {
  const listed = command(root, 'git', ['ls-files', '-co', '--exclude-standard', '-z'], { encoding: 'buffer' });
  const files = listed.toString('utf8').split('\0').filter(Boolean).sort();
  const result = [];
  for (const relative of files) {
    const safe = safeRelative(relative, 'project source');
    if (safe === outputDir || safe.startsWith(`${outputDir}/`) || safe.startsWith('.grafana-source/')) continue;
    const absolute = path.resolve(root, safe);
    const bytes = boundedRead(absolute, limits, budget, safe, root);
    scanSourceSensitive(safe, bytes, sensitiveSourceFixtures);
    result.push({ path: safe, sha256: hash(bytes), size: bytes.length, mode: statSync(absolute).mode & 0o111 ? 0o755 : 0o644, bytes });
  }
  return result;
}

function sourcePackage(root, policy, sourceInventory, project, limits, budget) {
  if (sourceInventory.schemaVersion !== 1 || sourceInventory.revision !== policy.grafana.revision || !Array.isArray(sourceInventory.components)) fail('Source inventory does not match the pinned Grafana revision');
  const grafanaRoot = path.resolve(root, policy.grafana.root);
  const grafanaRevision = git(grafanaRoot, ['rev-parse', 'HEAD']);
  if (grafanaRevision !== policy.grafana.revision) fail(`Grafana revision mismatch: ${grafanaRevision}`);
  if (git(grafanaRoot, ['status', '--porcelain']).length) fail('Grafana source checkout is dirty');
  const projectFiles = projectSources(root, policy.outputDir, policy.sensitiveSourceFixtures, limits, budget);
  const grafanaFiles = [];
  for (const component of sourceInventory.components) {
    const relative = safeRelative(component.path, 'Grafana source path');
    if (!/^[0-9a-f]{64}$/.test(component.sha256)) fail(`Invalid source inventory hash: ${relative}`);
    const bytes = boundedRead(path.join(grafanaRoot, relative), limits, budget, relative, grafanaRoot);
    const digest = hash(bytes);
    if (digest !== component.sha256) fail(`Grafana source hash mismatch: ${relative}`);
    scanSensitive(`grafana/${relative}`, bytes);
    grafanaFiles.push({ path: relative, sha256: digest, size: bytes.length, mode: 0o644, bytes, license: component.license, use: 'emitted-source' });
  }
  for (const source of policy.grafana.buildSourceFiles) {
    if (grafanaFiles.some(file => file.path === source.path)) continue;
    const bytes = boundedRead(path.join(grafanaRoot, source.path), limits, budget, source.path, grafanaRoot);
    scanSensitive(`grafana/${source.path}`, bytes);
    grafanaFiles.push({ path: source.path, sha256: hash(bytes), size: bytes.length, mode: 0o644, bytes, license: source.license, use: 'build-input' });
  }
  for (const relative of policy.grafana.licenseFiles) {
    const bytes = boundedRead(path.join(grafanaRoot, relative), limits, budget, relative, grafanaRoot);
    scanSensitive(`grafana/${relative}`, bytes);
    grafanaFiles.push({ path: relative, sha256: hash(bytes), size: bytes.length, mode: 0o644, bytes, license: null, use: 'license-notice' });
  }
  const sourceManifest = {
    schemaVersion: 1,
    sdk: { commit: project.commit, dirty: project.dirty, files: projectFiles.map(({ bytes, mode, ...entry }) => ({ ...entry, mode: mode.toString(8) })) },
    grafana: { revision: grafanaRevision, sourceUrl: sourceInventory.sourceUrl, modifications: [], files: grafanaFiles.map(({ bytes, mode, ...entry }) => ({ ...entry, mode: mode.toString(8) })) },
  };
  const manifestBytes = Buffer.from(json(sourceManifest));
  const prefix = 'dashboard-render-sdk-g-source';
  const archiveFiles = [
    ...projectFiles.map(file => ({ path: `${prefix}/project/${file.path}`, bytes: file.bytes, mode: file.mode })),
    ...grafanaFiles.map(file => ({ path: `${prefix}/grafana/${file.path}`, bytes: file.bytes, mode: file.mode })),
    { path: `${prefix}/SOURCE_MANIFEST.json`, bytes: manifestBytes, mode: 0o644 },
  ];
  return { sourceManifest, archive: gzipSync(tar(archiveFiles, project.epoch), { level: 9, mtime: 0 }) };
}

function spdxId(kind, identity) {
  return `SPDXRef-${kind}-${identity.replace(/[^A-Za-z0-9.-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80)}-${hash(identity).slice(0, 12)}`;
}

function packageLicense(component) {
  return typeof component.license === 'string' && component.license.length ? component.license : 'NOASSERTION';
}

function npmPurl(name, version) {
  const pathName = name.startsWith('@')
    ? name.split('/').map(segment => encodeURIComponent(segment)).join('/')
    : encodeURIComponent(name);
  return `pkg:npm/${pathName}@${version}`;
}

function assetManifest(root, dependencyInventory, assetInventory, limits, budget) {
  const files = [];
  for (const asset of assetInventory.components ?? []) {
    if (asset.included === false || (!asset.sha256 && !statSafe(path.resolve(root, asset.path)))) continue;
    const relative = safeRelative(asset.path, 'asset path');
    const bytes = boundedRead(path.resolve(root, relative), limits, budget, relative, root);
    scanSensitive(relative, bytes);
    const digest = hash(bytes);
    if (asset.sha256 && digest !== asset.sha256) fail(`Asset hash mismatch: ${relative}`);
    const owner = asset.package ? dependencyInventory.components.find(component => `${component.name}@${component.version}` === asset.package) : undefined;
    files.push({
      path: relative,
      sha256: digest,
      size: bytes.length,
      type: asset.type,
      use: asset.use,
      package: asset.package,
      license: asset.firstParty ? 'AGPL-3.0-only' : packageLicense(owner ?? {}),
    });
  }
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

function createSbom(root, policy, dependencyInventory, grafanaSourceFiles, assetFiles, project, artifactFiles, buildVerification, limits, budget) {
  const namespace = `https://github.com/aaliakbarian/dashboard-render-sdk-g/sbom/${project.commit}/${buildVerification.bindingSha256}`;
  const distributionId = 'SPDXRef-Package-dashboard-render-sdk-g';
  const packages = [{
    SPDXID: distributionId, name: 'dashboard-render-sdk-g', versionInfo: project.commit,
    downloadLocation: 'NOASSERTION', filesAnalyzed: false,
    licenseConcluded: 'AGPL-3.0-only', licenseDeclared: 'AGPL-3.0-only', copyrightText: 'NOASSERTION',
  }];
  const relationships = [{ spdxElementId: 'SPDXRef-DOCUMENT', relationshipType: 'DESCRIBES', relatedSpdxElement: distributionId }];
  for (const manifestPath of policy.firstPartyPackages) {
    const manifest = readJson(root, manifestPath, limits, budget);
    const id = spdxId('Package', `${manifest.name}@${manifest.version}`);
    packages.push({ SPDXID: id, name: manifest.name, versionInfo: manifest.version, downloadLocation: 'NOASSERTION', filesAnalyzed: false, licenseConcluded: manifest.license ?? 'AGPL-3.0-only', licenseDeclared: manifest.license ?? 'AGPL-3.0-only', copyrightText: 'NOASSERTION' });
    relationships.push({ spdxElementId: distributionId, relationshipType: 'CONTAINS', relatedSpdxElement: id });
  }
  for (const component of dependencyInventory.components ?? []) {
    if (!Array.isArray(component.scopes) || !component.scopes.some(scope => productionScopes.has(scope))) continue;
    const identity = `${component.name}@${component.version}`;
    const id = spdxId('Package', identity);
    packages.push({
      SPDXID: id, name: component.name, versionInfo: component.version,
      downloadLocation: component.sourceUrl ?? 'NOASSERTION', filesAnalyzed: false,
      licenseConcluded: packageLicense(component), licenseDeclared: packageLicense(component), copyrightText: 'NOASSERTION',
      externalRefs: [{ referenceCategory: 'PACKAGE-MANAGER', referenceType: 'purl', referenceLocator: npmPurl(component.name, component.version) }],
      annotations: [{ annotationType: 'OTHER', annotator: 'Tool: dashboard-render-sdk-g-release-evidence', annotationDate: '1970-01-01T00:00:00Z', comment: `distribution scopes: ${component.scopes.join(', ')}` }],
    });
    relationships.push({ spdxElementId: distributionId, relationshipType: 'DEPENDS_ON', relatedSpdxElement: id });
  }
  const files = [];
  for (const component of grafanaSourceFiles) {
    const id = spdxId('File', `grafana/${component.path}`);
    const license = component.license ?? 'NOASSERTION';
    files.push({ SPDXID: id, fileName: `grafana/${component.path}`, checksums: [{ algorithm: 'SHA256', checksumValue: component.sha256 }], licenseConcluded: license, licenseInfoInFiles: [license], copyrightText: 'NOASSERTION', fileTypes: ['SOURCE'] });
    relationships.push({ spdxElementId: distributionId, relationshipType: 'CONTAINS', relatedSpdxElement: id });
  }
  for (const asset of assetFiles) {
    const id = spdxId('File', `asset/${asset.path}`);
    files.push({ SPDXID: id, fileName: `asset/${asset.path}`, checksums: [{ algorithm: 'SHA256', checksumValue: asset.sha256 }], licenseConcluded: asset.license, licenseInfoInFiles: [asset.license], copyrightText: 'NOASSERTION' });
    relationships.push({ spdxElementId: distributionId, relationshipType: 'CONTAINS', relatedSpdxElement: id });
  }
  const assetPaths = new Set(assetFiles.map(asset => asset.path));
  for (const artifact of artifactFiles) {
    if (assetPaths.has(artifact.path)) continue;
    const id = spdxId('File', `artifact/${artifact.path}`);
    files.push({
      SPDXID: id,
      fileName: `artifact/${artifact.path}`,
      checksums: [{ algorithm: 'SHA256', checksumValue: artifact.sha256 }],
      licenseConcluded: 'NOASSERTION',
      licenseInfoInFiles: ['NOASSERTION'],
      copyrightText: 'NOASSERTION',
      fileTypes: ['BINARY'],
    });
    relationships.push({ spdxElementId: distributionId, relationshipType: 'CONTAINS', relatedSpdxElement: id });
  }
  const sbom = {
    spdxVersion: 'SPDX-2.3', dataLicense: 'CC0-1.0', SPDXID: 'SPDXRef-DOCUMENT', name: 'dashboard-render-sdk-g-distribution',
    documentNamespace: namespace, creationInfo: { created: '1970-01-01T00:00:00Z', creators: ['Tool: dashboard-render-sdk-g-release-evidence'] },
    documentDescribes: [distributionId], packages: packages.sort((a, b) => a.SPDXID.localeCompare(b.SPDXID)), files: files.sort((a, b) => a.fileName.localeCompare(b.fileName)),
    relationships: relationships.sort((a, b) => `${a.spdxElementId}:${a.relationshipType}:${a.relatedSpdxElement}`.localeCompare(`${b.spdxElementId}:${b.relationshipType}:${b.relatedSpdxElement}`)),
    annotations: [{ annotationType: 'OTHER', annotator: 'Tool: dashboard-render-sdk-g-release-evidence', annotationDate: '1970-01-01T00:00:00Z', comment: `artifact files reconciled: ${artifactFiles.length}` }],
  };
  validateSpdxDocument(sbom);
  return sbom;
}

function statSafe(file) {
  try { return statSync(file).isFile(); } catch { return false; }
}

export function validateSpdxDocument(document) {
  if (!document || document.spdxVersion !== 'SPDX-2.3' || document.dataLicense !== 'CC0-1.0' || document.SPDXID !== 'SPDXRef-DOCUMENT') fail('Invalid SPDX document header');
  if (typeof document.documentNamespace !== 'string' || !/^https:\/\//.test(document.documentNamespace)) fail('Invalid SPDX namespace');
  if (!Array.isArray(document.packages) || document.packages.length === 0 || !Array.isArray(document.files) || !Array.isArray(document.relationships)) fail('Invalid SPDX collections');
  const ids = new Set(['SPDXRef-DOCUMENT']);
  for (const item of document.packages) {
    if (typeof item.name !== 'string' || typeof item.versionInfo !== 'string' || typeof item.filesAnalyzed !== 'boolean' || typeof item.downloadLocation !== 'string') fail('Invalid SPDX package');
    for (const field of ['licenseConcluded', 'licenseDeclared']) {
      if (item[field] !== 'NOASSERTION' && item[field] !== 'NONE') validateSpdxExpression(item[field]);
    }
  }
  for (const item of document.files) {
    if (typeof item.fileName !== 'string' || !Array.isArray(item.checksums) || item.checksums.length === 0 || !Array.isArray(item.licenseInfoInFiles)) fail('Invalid SPDX file');
    if (item.licenseConcluded !== 'NOASSERTION' && item.licenseConcluded !== 'NONE') validateSpdxExpression(item.licenseConcluded);
    for (const expression of item.licenseInfoInFiles) if (expression !== 'NOASSERTION' && expression !== 'NONE') validateSpdxExpression(expression);
    for (const checksum of item.checksums) if (checksum.algorithm !== 'SHA256' || !/^[0-9a-f]{64}$/.test(checksum.checksumValue)) fail('Invalid SPDX checksum');
  }
  for (const item of [...document.packages, ...document.files]) {
    if (typeof item.SPDXID !== 'string' || !/^SPDXRef-[A-Za-z0-9.-]+$/.test(item.SPDXID) || ids.has(item.SPDXID)) fail('Invalid or duplicate SPDX identifier');
    ids.add(item.SPDXID);
  }
  for (const relation of document.relationships) if (!ids.has(relation.spdxElementId) || !ids.has(relation.relatedSpdxElement)) fail('SPDX relationship references an unknown element');
  if (!document.relationships.some(relation => relation.spdxElementId === 'SPDXRef-DOCUMENT' && relation.relationshipType === 'DESCRIBES')) fail('SPDX document has no DESCRIBES relationship');
  return true;
}

export function compareArtifactManifests(first, second) {
  if (json(first) !== json(second)) fail(`Build reproducibility mismatch. First=${json(first).trim()} Second=${json(second).trim()}`);
  return true;
}

function snapshotConfiguredArtifacts(root, policy, limits = LIMITS) {
  const budget = { bytes: 0, files: 0 };
  const entries = [];
  for (const artifact of policy.artifacts) {
    for (const relative of walk(root, artifact.root, limits, budget)) {
      const bytes = boundedRead(path.resolve(root, relative), limits, budget, relative, root);
      scanSensitive(relative, bytes);
      entries.push({ path: relative, sha256: hash(bytes), size: bytes.length });
    }
  }
  return entries.sort((a, b) => a.path.localeCompare(b.path));
}

export async function verifyReproducibleBuild({
  root = process.cwd(),
  policyPath = 'compliance/release/policy.json',
  buildRunner,
  observedToolchain,
} = {}) {
  root = path.resolve(root);
  const policy = validatePolicy(readJson(root, policyPath, LIMITS, { bytes: 0, files: 0 }, true));
  const run = buildRunner ?? (async () => {
    const result = spawnSync('yarn', ['build:sdk-slice'], { cwd: root, encoding: 'utf8', stdio: 'inherit' });
    if (result.status !== 0) fail(`yarn build:sdk-slice failed with status ${result.status}`);
  });
  await run(1);
  const first = snapshotConfiguredArtifacts(root, policy);
  await run(2);
  const second = snapshotConfiguredArtifacts(root, policy);
  compareArtifactManifests(first, second);
  const observed = observedToolchain ?? {
    node: process.versions.node,
    yarn: command(root, 'yarn', ['--version']).trim(),
    containerImage: policy.toolchain.containerImage,
    containerDigest: process.env.DRSDK_CONTAINER_IMAGE_DIGEST,
    baseImage: policy.toolchain.baseImage,
    baseImageDigest: process.env.DRSDK_BASE_IMAGE_DIGEST,
  };
  exactKeys(observed, ['node', 'yarn', 'containerImage', 'containerDigest', 'baseImage', 'baseImageDigest'], 'observed toolchain');
  if (json(observed) !== json(policy.toolchain)) fail('Observed toolchain identity does not match the release policy');
  const sourceBudget = { bytes: 0, files: 0 };
  const sourceFiles = projectSources(root, policy.outputDir, policy.sensitiveSourceFixtures, LIMITS, sourceBudget)
    .map(({ bytes, ...entry }) => entry);
  const sourceTreeSha256 = hash(Buffer.from(json(sourceFiles)));
  const buildInputs = policy.buildInputs.map(relative => {
    const bytes = boundedRead(path.resolve(root, relative), LIMITS, sourceBudget, relative, root);
    return { path: relative, sha256: hash(bytes) };
  }).sort((a, b) => a.path.localeCompare(b.path));
  const sdk = {
    gitCommit: git(root, ['rev-parse', 'HEAD']),
    dirty: git(root, ['status', '--porcelain', '--untracked-files=all']).length > 0,
    sourceTreeSha256,
  };
  const grafanaRoot = path.resolve(root, policy.grafana.root);
  const grafana = {
    gitCommit: git(grafanaRoot, ['rev-parse', 'HEAD']),
    dirty: git(grafanaRoot, ['status', '--porcelain']).length > 0,
  };
  if (grafana.gitCommit !== policy.grafana.revision || grafana.dirty) fail('Grafana source identity does not match the release policy');
  const manifestSha256 = hash(Buffer.from(json(second)));
  const binding = { sdk, grafana, toolchain: observed, buildInputs, artifacts: second, manifestSha256 };
  return {
    byteIdentical: true,
    files: second.length,
    manifestSha256,
    bindingSha256: hash(Buffer.from(json(binding))),
    ...binding,
  };
}

function loadInputs(root, policyPath, customLimits) {
  const limits = Object.freeze({ ...LIMITS, ...customLimits });
  for (const [key, value] of Object.entries(limits)) if (!Number.isSafeInteger(value) || value <= 0 || value > LIMITS[key]) fail(`Invalid resource limit: ${key}`);
  const budget = { bytes: 0, files: 0 };
  const policy = validatePolicy(readJson(root, policyPath, limits, budget, true));
  const dependencyInventory = readJson(root, policy.inventories.dependencies, limits, budget);
  const sourceInventory = readJson(root, policy.inventories.sources, limits, budget);
  const assetInventory = readJson(root, policy.inventories.assets, limits, budget);
  boundedRead(path.resolve(root, policy.inventories.notices), limits, budget, policy.inventories.notices, root);
  return { limits, budget, policy, dependencyInventory, sourceInventory, assetInventory };
}

export async function createReleaseEvidence({
  root = process.cwd(),
  policyPath = 'compliance/release/policy.json',
  allowDirty = false,
  limits: customLimits,
  inventoryGate = runGate,
  buildRunner,
  observedToolchain,
} = {}) {
  root = path.resolve(root);
  safeRelative(policyPath, 'policyPath');
  const buildVerification = await verifyReproducibleBuild({ root, policyPath, buildRunner, observedToolchain });
  await inventoryGate({ root, mode: 'check' });
  const { limits, budget, policy, dependencyInventory, sourceInventory, assetInventory } = loadInputs(root, policyPath, customLimits);
  const project = {
    commit: git(root, ['rev-parse', 'HEAD']),
    dirty: git(root, ['status', '--porcelain', '--untracked-files=all']).length > 0,
    epoch: Number(git(root, ['show', '-s', '--format=%ct', 'HEAD'])),
  };
  if (!/^[0-9a-f]{40}$/.test(project.commit) || !Number.isSafeInteger(project.epoch)) fail('Invalid SDK Git identity');
  if (project.dirty && !allowDirty) fail('SDK source checkout is dirty; release generation requires a clean commit');
  const assetFiles = assetManifest(root, dependencyInventory, assetInventory, limits, budget);
  const artifactFiles = artifactManifest(root, policy, dependencyInventory, assetFiles, limits, budget);
  const { sourceManifest, archive } = sourcePackage(root, policy, sourceInventory, project, limits, budget);
  const sbom = createSbom(root, policy, dependencyInventory, sourceManifest.grafana.files, assetFiles, project, artifactFiles, buildVerification, limits, budget);
  const sourceManifestBytes = Buffer.from(json(sourceManifest));
  const sbomBytes = Buffer.from(json(sbom));
  const sumEntries = [
    { path: `${policy.outputDir}/dashboard-render-sdk-g-source.tar.gz`, sha256: hash(archive) },
    { path: `${policy.outputDir}/dashboard-render-sdk-g.spdx.json`, sha256: hash(sbomBytes) },
    { path: `${policy.outputDir}/source-manifest.json`, sha256: hash(sourceManifestBytes) },
    ...artifactFiles.map(({ path: file, sha256 }) => ({ path: file, sha256 })),
    ...assetFiles.map(({ path: file, sha256 }) => ({ path: file, sha256 })),
  ];
  const sumMap = new Map();
  for (const entry of sumEntries) {
    const prior = sumMap.get(entry.path);
    if (prior && prior.sha256 !== entry.sha256) fail(`Conflicting hashes for distributed path: ${entry.path}`);
    sumMap.set(entry.path, entry);
  }
  const sums = [...sumMap.values()].sort((a, b) => a.path.localeCompare(b.path));
  const sumsBytes = Buffer.from(sums.map(entry => `${entry.sha256}  ${entry.path}\n`).join(''));
  const buildInputs = policy.buildInputs.map(relative => {
    const bytes = boundedRead(path.resolve(root, relative), limits, budget, relative, root);
    return { path: relative, sha256: hash(bytes) };
  }).sort((a, b) => a.path.localeCompare(b.path));
  const provenance = {
    schemaVersion: 1,
    releaseEligible: !project.dirty && dependencyInventory.releaseGate?.status === 'inventory-complete',
    sdk: { gitCommit: project.commit, dirty: project.dirty },
    grafana: { version: '13.2.3', gitCommit: policy.grafana.revision, modifications: [] },
    toolchain: { expected: policy.toolchain, observed: buildVerification.toolchain },
    compatibility: { react: '19.2.8', reactDom: '19.2.8', scenes: '8.13.5' },
    build: {
      command: 'yarn build:sdk-slice',
      inputs: buildInputs,
      lockfile: buildInputs.find(input => input.path === 'yarn.lock'),
      artifacts: artifactFiles,
      reproducibility: buildVerification,
    },
    assets: assetFiles,
    outputs: {
      sourceArchive: { path: `${policy.outputDir}/dashboard-render-sdk-g-source.tar.gz`, sha256: hash(archive) },
      sourceManifest: { path: `${policy.outputDir}/source-manifest.json`, sha256: hash(sourceManifestBytes) },
      sbom: { format: 'SPDX-2.3-json', path: `${policy.outputDir}/dashboard-render-sdk-g.spdx.json`, sha256: hash(sbomBytes) },
      sha256Manifest: { path: `${policy.outputDir}/SHA256SUMS`, sha256: hash(sumsBytes) },
    },
    licensing: { releaseGate: dependencyInventory.releaseGate?.status ?? 'unknown', blockedComponents: dependencyInventory.releaseGate?.components ?? [] },
  };
  const artifacts = new Map([
    ['SHA256SUMS', sumsBytes],
    ['dashboard-render-sdk-g-source.tar.gz', archive],
    ['dashboard-render-sdk-g.spdx.json', sbomBytes],
    ['provenance.json', Buffer.from(json(provenance))],
    ['source-manifest.json', sourceManifestBytes],
  ].sort(([a], [b]) => a.localeCompare(b)));
  return { artifacts, artifactFiles, assetFiles, buildVerification, policy, project, provenance, sbom, sourceManifest };
}

function writeArtifacts(root, outputDir, artifacts) {
  const destination = path.resolve(root, outputDir);
  assertContainedPath(root, destination, outputDir, true);
  mkdirSync(destination, { recursive: true });
  assertContainedPath(root, destination, outputDir);
  for (const [relative, bytes] of artifacts) {
    const file = path.resolve(destination, safeRelative(relative, 'output artifact'));
    if (!file.startsWith(`${destination}${path.sep}`)) fail('Output escaped release directory');
    assertContainedPath(root, file, `${outputDir}/${relative}`, true);
    mkdirSync(path.dirname(file), { recursive: true });
    assertContainedPath(root, path.dirname(file), `${outputDir}/${path.dirname(relative)}`);
    let existing;
    try {
      existing = lstatSync(file);
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
    if (existing && (!existing.isFile() || existing.isSymbolicLink())) fail(`Release output is not a regular file: ${relative}`);
    const temporary = path.join(path.dirname(file), `.${path.basename(file)}.tmp-${process.pid}-${randomBytes(8).toString('hex')}`);
    let descriptor;
    try {
      descriptor = openSync(temporary, 'wx', 0o644);
      writeFileSync(descriptor, bytes);
      fsyncSync(descriptor);
      closeSync(descriptor);
      descriptor = undefined;
      renameSync(temporary, file);
    } catch (error) {
      if (descriptor !== undefined) {
        try { closeSync(descriptor); } catch {}
      }
      try { unlinkSync(temporary); } catch (cleanupError) {
        if (cleanupError?.code !== 'ENOENT') throw new AggregateError([error, cleanupError], `Failed to write release output: ${relative}`);
      }
      throw error;
    }
  }
}

function checkArtifacts(root, outputDir, artifacts) {
  const destination = path.resolve(root, outputDir);
  const actual = walk(root, outputDir, LIMITS, { bytes: 0, files: 0 }).map(file => file.slice(outputDir.length + 1)).sort();
  const expected = [...artifacts.keys()].sort();
  if (json(actual) !== json(expected)) fail('Release evidence is stale: output file set differs');
  for (const [relative, bytes] of artifacts) {
    const file = path.join(destination, relative);
    assertContainedPath(root, file, `${outputDir}/${relative}`);
    const actualBytes = readFileSync(file);
    if (!actualBytes.equals(bytes)) fail(`Release evidence is stale: ${relative}`);
  }
}

export async function runReleaseEvidence({ root = process.cwd(), mode, policyPath = 'compliance/release/policy.json', allowDirty = false, limits, inventoryGate, buildRunner, observedToolchain } = {}) {
  if (!['generate', 'check'].includes(mode)) fail(`Unknown release-evidence mode: ${mode}`);
  const evidence = await createReleaseEvidence({ root, policyPath, allowDirty, limits, inventoryGate, buildRunner, observedToolchain });
  if (mode === 'generate') writeArtifacts(path.resolve(root), evidence.policy.outputDir, evidence.artifacts);
  else checkArtifacts(path.resolve(root), evidence.policy.outputDir, evidence.artifacts);
  return evidence;
}

async function main() {
  const args = process.argv.slice(2);
  const mode = args.shift();
  let root = process.cwd();
  let policyPath = 'compliance/release/policy.json';
  let allowDirty = false;
  while (args.length) {
    const flag = args.shift();
    if (flag === '--root') root = args.shift();
    else if (flag === '--policy') policyPath = args.shift();
    else if (flag === '--allow-dirty') allowDirty = true;
    else fail(`Unknown argument: ${flag}`);
  }
  if (!root || !policyPath) fail('Missing CLI argument value');
  if (mode === 'verify-build') {
    const result = await verifyReproducibleBuild({ root, policyPath });
    process.stdout.write(`Release build reproducibility: PASS (${result.files} files, ${result.manifestSha256})\n`);
    return;
  }
  await runReleaseEvidence({ root, mode, policyPath, allowDirty });
  process.stdout.write(`Release evidence ${mode}: PASS\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}

