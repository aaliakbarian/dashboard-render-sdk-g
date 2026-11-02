import { createHash } from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
import { execFileSync } from 'node:child_process';
import { constants } from 'node:fs';
import { lstat, mkdir, open, opendir, realpath, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// Deliberately bounded, reviewed SPDX subset; an unfamiliar identifier requires
// an explicit code/policy review rather than accepting arbitrary license names.
export const SPDX_IDENTIFIERS = Object.freeze([
  '0BSD', 'AGPL-3.0-only', 'AGPL-3.0-or-later', 'Apache-2.0', 'BSD-2-Clause',
  'BSD-3-Clause', 'BlueOak-1.0.0', 'BSL-1.0', 'CC-BY-3.0', 'CC-BY-4.0',
  'CC0-1.0', 'GPL-2.0-only', 'GPL-2.0-or-later', 'GPL-3.0-only',
  'GPL-3.0-or-later', 'ISC', 'LGPL-2.1-only', 'LGPL-2.1-or-later',
  'LGPL-3.0-only', 'LGPL-3.0-or-later', 'MIT', 'MPL-2.0', 'OFL-1.1',
  'Python-2.0', 'Unlicense', 'Zlib',
]);
const SPDX_EXCEPTIONS = new Set(['Classpath-exception-2.0', 'LLVM-exception']);
const PRODUCTION_SCOPES = new Set(['provider-bundled', 'host-bundled', 'external-peer', 'asset', 'generated-helper']);
const NONPRODUCTION_SCOPES = new Set(['demo-only', 'test-only', 'development-only', 'installed-not-distributed']);
const sorted = (values) => [...new Set(values)].sort();
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const fail = (message) => { throw new Error(String(message).slice(0, 2048)); };

export const LIMITS = Object.freeze({
  fileBytes: 64 * 1024 * 1024, jsonBytes: 16 * 1024 * 1024,
  inputBytes: 1024 * 1024 * 1024, artifactBytes: 512 * 1024 * 1024,
  items: 1000000, traversalDepth: 128, jsonDepth: 128,
  spdxChars: 8192, spdxTokens: 2048, spdxDepth: 64, gitTimeoutMs: 10000,
});
const scans = new AsyncLocalStorage();
function limitsFor(overrides = {}) {
  const limits = { ...LIMITS };
  for (const [key, value] of Object.entries(overrides)) {
    if (!Object.hasOwn(LIMITS, key) || !Number.isSafeInteger(value) || value <= 0 || value > LIMITS[key]) fail(`Invalid resource limit: ${key}`);
    limits[key] = value;
  }
  return limits;
}
function budget() { return scans.getStore(); }
function countItems(amount = 1) {
  const context = budget();
  if (context && (context.items += amount) > context.limits.items) fail('Resource limit: total items');
}
function depthLimit(depth, kind = 'traversalDepth') {
  if (depth > (budget()?.limits ?? LIMITS)[kind]) fail(`Resource limit: ${kind}`);
}
function withBudget(limits, fn) {
  if (budget()) return fn();
  return scans.run({ limits: limitsFor(limits), inputBytes: 0, items: 0 }, fn);
}
function inspectJson(value) {
  const pending = [[value, 0]];
  while (pending.length) {
    const [item, depth] = pending.pop();
    depthLimit(depth, 'jsonDepth'); countItems();
    if (item && typeof item === 'object') for (const child of Object.values(item)) pending.push([child, depth + 1]);
  }
}

class ArtifactMap extends Map {
  constructor() { super(); this.totalBytes = 0; this.limits = budget()?.limits ?? LIMITS; }
  set(destination, content) {
    safePath(destination);
    if (!Buffer.isBuffer(content)) fail(`Invalid artifact bytes: ${destination}`);
    if (this.has(destination)) {
      if (!super.get(destination).equals(content)) fail(`Artifact destination conflict: ${destination}`);
      return this;
    }
    if (this.totalBytes + content.length > this.limits.artifactBytes) fail('Resource limit: aggregate artifact bytes');
    countItems(); this.totalBytes += content.length;
    return super.set(destination, content);
  }
}

export function validateSpdxExpression(expression) {
  if (typeof expression !== 'string' || !expression.trim()) fail('Invalid SPDX expression');
  const limits = budget()?.limits ?? LIMITS;
  if (expression.length > limits.spdxChars) fail('Resource limit: SPDX characters');
  const tokens = expression.match(/[A-Za-z0-9][A-Za-z0-9.+-]*|[()]/g) ?? [];
  if (tokens.length > limits.spdxTokens) fail('Resource limit: SPDX tokens');
  if (tokens.join('') !== expression.replace(/\s/g, '')) fail(`Invalid SPDX syntax: ${expression}`);
  let position = 0;
  let depth = 0;
  function combine(type, left, right) {
    const operands = [left, right].flatMap((node) => node.type === type ? node.operands : [node]);
    operands.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b), 'en'));
    return { type, operands };
  }
  function atom() {
    if (tokens[position] === '(') {
      if (++depth > limits.spdxDepth) fail('Resource limit: SPDX nesting');
      position++;
      const node = or();
      if (tokens[position++] !== ')') fail(`Invalid SPDX parentheses: ${expression}`);
      depth--;
      return node;
    }
    const identifier = tokens[position++];
    if (!SPDX_IDENTIFIERS.includes(identifier)) fail(`Unknown SPDX identifier: ${identifier ?? '(missing)'}`);
    const node = { type: 'license', id: identifier };
    if (tokens[position] === 'WITH') {
      position++;
      const exception = tokens[position++];
      if (!SPDX_EXCEPTIONS.has(exception)) fail(`Unknown SPDX exception: ${expression}`);
      return { type: 'with', license: node, exception };
    }
    return node;
  }
  function and() { let node = atom(); while (tokens[position] === 'AND') { position++; node = combine('and', node, atom()); } return node; }
  function or() { let node = and(); while (tokens[position] === 'OR') { position++; node = combine('or', node, and()); } return node; }
  const tree = or();
  if (position !== tokens.length) fail(`Invalid SPDX expression: ${expression}`);
  return tree;
}

function spdxFacts(tree) {
  if (tree.type === 'license') return { identifiers: [tree.id], exceptions: [] };
  if (tree.type === 'with') return { identifiers: [tree.license.id], exceptions: [`${tree.license.id} WITH ${tree.exception}`] };
  const facts = tree.operands.map(spdxFacts);
  return { identifiers: sorted(facts.flatMap((f) => f.identifiers)), exceptions: sorted(facts.flatMap((f) => f.exceptions)) };
}
const sameTree = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function safePath(value) {
  if (typeof value !== 'string' || !value || value.includes('\\') || /[\x00-\x1f\x7f<>:]/.test(value) ||
      path.posix.isAbsolute(value) || value.split('/').some((part) => !part || part === '.' || part === '..')) {
    fail(`Unsafe repository-relative path: ${String(value)}`);
  }
  return value;
}

async function contained(root, relative, forWrite = false) {
  safePath(relative);
  const absolute = path.join(root, relative);
  let candidate = absolute;
  while (true) {
    try {
      const resolved = await realpath(candidate);
      if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) fail(`Path outside repository: ${relative}`);
      break;
    } catch (error) {
      if (!forWrite || error.code !== 'ENOENT') throw error;
      const parent = path.dirname(candidate);
      if (parent === candidate) throw error;
      candidate = parent;
    }
  }
  return absolute;
}

async function bytes(root, relative, jsonFile = false) {
  const file = await contained(root, relative);
  const limits = budget()?.limits ?? LIMITS;
  const maximum = Math.min(limits.fileBytes, jsonFile ? limits.jsonBytes : limits.fileBytes);
  const handle = await open(file, constants.O_RDONLY | constants.O_NONBLOCK);
  try {
    const info = await handle.stat();
    if (!info.isFile()) fail(`Evidence must be a regular file: ${relative}`);
    if (info.size > maximum) fail(`Resource limit: ${jsonFile ? 'JSON' : 'file'} bytes: ${relative}`);
    const chunks = []; let total = 0;
    while (true) {
      const chunk = Buffer.alloc(Math.min(65536, maximum - total + 1));
      const { bytesRead } = await handle.read(chunk, 0, chunk.length, null);
      if (!bytesRead) break;
      total += bytesRead;
      if (total > maximum) fail(`Resource limit: file bytes: ${relative}`);
      if (budget() && (budget().inputBytes += bytesRead) > limits.inputBytes) fail('Resource limit: aggregate input bytes');
      chunks.push(chunk.subarray(0, bytesRead));
    }
    return Buffer.concat(chunks, total);
  } finally { await handle.close(); }
}
async function json(root, relative) {
  let value;
  try { value = JSON.parse((await bytes(root, relative, true)).toString('utf8')); }
  catch (error) { if (error instanceof SyntaxError) fail(`Invalid JSON evidence: ${relative}`); throw error; }
  inspectJson(value);
  return value;
}
async function exists(root, relative) {
  try { await lstat(path.join(root, safePath(relative))); return true; }
  catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}
async function directoryEntries(root, relative) {
  const entries = [];
  for await (const entry of await opendir(await contained(root, relative))) { countItems(); entries.push(entry); }
  return entries;
}
async function outputDestination(root, relative) {
  safePath(relative);
  let current = root;
  for (const segment of relative.split('/')) {
    current = path.join(current, segment);
    try {
      const info = await lstat(current);
      if (info.isSymbolicLink()) fail(`Unsafe output symlink (outside repository or aliased destination): ${relative}`);
    } catch (error) { if (error.code === 'ENOENT') break; throw error; }
  }
  return contained(root, relative, true);
}
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  return value;
}
function jsonBytes(value) { return Buffer.from(`${JSON.stringify(stable(value), null, 2)}\n`); }
function markdownHref(relative) { return relative.split('/').map((segment) => encodeURIComponent(segment)).join('/'); }
function evidenceFileName(relative) { return encodeURIComponent(safePath(relative)); }

function sourceUrl(value) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') fail('Unsafe source URL metadata');
  const githubPath = value.match(/^(?:github:)?([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)$/)?.[1]
    ?? value.match(/^github\.com\/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+?)(?:\.git)?$/)?.[1]
    ?? value.match(/^git@github\.com:([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+?)(?:\.git)?$/)?.[1]
    ?? value.match(/^git\+ssh:\/\/git@github\.com\/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+?)(?:\.git)?$/)?.[1]
    ?? value.match(/^ssh:\/\/github\.com\/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+?)(?:\.git)?$/)?.[1];
  if (githubPath) return `https://github.com/${githubPath.replace(/\.git$/, '')}`;
  let url;
  try { url = new URL(value); } catch { fail('Unsafe source URL metadata'); }
  if (!['http:', 'https:', 'git:', 'git+https:'].includes(url.protocol) || !url.hostname ||
      url.username || url.password || url.search || url.hash) fail('Unsafe source URL metadata');
  return value;
}

function validatePolicy(policy) {
  function record(value, fields, label) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`Invalid policy shape: ${label}`);
    for (const key of Object.keys(value)) if (!fields.includes(key)) fail(`Invalid policy unknown field: ${label}.${key}`);
  }
  function array(value, label) { if (!Array.isArray(value)) fail(`Invalid policy shape: ${label} must be an array`); }
  function string(value, label) { if (typeof value !== 'string' || !value.trim()) fail(`Invalid policy shape: ${label} must be a nonempty string`); }
  function paths(value, label) { array(value, label); for (const item of value) safePath(item); }
  function evidence(value, label, objectsOnly = false) {
    array(value, label);
    for (const ref of value) {
      if (typeof ref === 'string' && !objectsOnly) { safePath(ref); continue; }
      record(ref, ['path', 'kind', 'license', 'reason'], label);
      safePath(ref.path);
      if (ref.kind !== undefined && !['license', 'attribution'].includes(ref.kind)) fail(`Invalid policy evidence kind: ${label}`);
      if (ref.license !== undefined) validateSpdxExpression(ref.license);
      if (ref.reason !== undefined) string(ref.reason, `${label}.reason`);
    }
  }
  record(policy, ['schemaVersion', 'outputDir', 'noticesPath', 'bundles', 'workspaces', 'firstPartyPaths', 'packages', 'externalPeers', 'generatedHelpers', 'assets', 'classifications', 'source', 'reviewStatus'], 'root');
  if (policy.schemaVersion !== 1) fail('Unsupported license policy schema');
  array(policy.bundles, 'bundles');
  for (const bundle of policy.bundles) {
    record(bundle, ['path', 'outputDir', 'scope', 'workspace'], 'bundles');
    safePath(bundle.path); safePath(bundle.outputDir);
    if (!['provider-bundled', 'host-bundled'].includes(bundle.scope)) fail('Invalid policy bundle scope');
    if (bundle.workspace !== undefined) safePath(bundle.workspace);
  }
  for (const key of ['workspaces', 'firstPartyPaths']) {
    array(policy[key], key);
    for (const item of policy[key]) safePath(key === 'firstPartyPaths' && typeof item === 'string' ? item.replace(/\/$/, '') : item);
  }
  if (!policy.packages || typeof policy.packages !== 'object' || Array.isArray(policy.packages)) fail('Invalid policy shape: packages');
  for (const [identity, decision] of Object.entries(policy.packages)) {
    if (!/^(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+@[0-9][a-z0-9.+_-]*$/i.test(identity)) fail(`Invalid policy package identity: ${identity}`);
    record(decision, ['license', 'sourceUrl', 'requiredFiles', 'reason', 'evidence', 'conflict', 'unresolvedLicense', 'reviewReferences', 'reviewNote'], `packages.${identity}`);
    if (decision.license !== undefined) validateSpdxExpression(decision.license);
    if (decision.sourceUrl !== undefined) sourceUrl(decision.sourceUrl);
    if (decision.requiredFiles !== undefined) paths(decision.requiredFiles, 'requiredFiles');
    if (decision.evidence !== undefined) evidence(decision.evidence, 'package evidence', true);
    if (decision.reviewReferences !== undefined) paths(decision.reviewReferences, 'reviewReferences');
    for (const key of ['reason', 'reviewNote']) if (decision[key] !== undefined) string(decision[key], key);
    if (decision.conflict !== undefined) {
      record(decision.conflict, ['manifest', 'evidence', 'reason', 'status'], 'conflict');
      validateSpdxExpression(decision.conflict.manifest); validateSpdxExpression(decision.conflict.evidence);
      string(decision.conflict.reason, 'conflict.reason');
      if (!['resolved', 'unresolved'].includes(decision.conflict.status)) fail('Invalid policy conflict status');
    }
    if (decision.unresolvedLicense !== undefined) {
      record(decision.unresolvedLicense, ['reason', 'references'], 'unresolvedLicense');
      string(decision.unresolvedLicense.reason, 'unresolvedLicense.reason');
      paths(decision.unresolvedLicense.references, 'unresolvedLicense.references');
      if (decision.conflict !== undefined) fail('Invalid policy: unresolvedLicense and conflict are mutually exclusive');
    }
  }
  array(policy.externalPeers ?? [], 'externalPeers');
  for (const peer of policy.externalPeers ?? []) {
    record(peer, ['name', 'version', 'workspace'], 'externalPeers');
    string(peer.name, 'peer.name'); string(peer.version, 'peer.version'); safePath(peer.workspace);
  }
  record(policy.generatedHelpers ?? {}, Object.keys(policy.generatedHelpers ?? {}), 'generatedHelpers');
  for (const helper of Object.values(policy.generatedHelpers ?? {})) {
    record(helper, ['package', 'location'], 'generatedHelpers'); string(helper.package, 'helper.package');
    if (helper.location !== undefined) safePath(helper.location);
  }
  array(policy.assets ?? [], 'assets');
  for (const asset of policy.assets ?? []) {
    record(asset, ['path', 'type', 'use', 'package', 'location', 'license', 'evidence', 'included', 'firstParty', 'reason'], 'assets');
    safePath(asset.path);
    if (!['css', 'font', 'icon', 'image', 'worker', 'other'].includes(asset.type) || !['runtime', 'static'].includes(asset.use)) fail('Invalid policy asset classification');
    if (asset.package !== undefined) string(asset.package, 'asset.package');
    if (asset.location !== undefined) safePath(asset.location);
    if (asset.license !== undefined) validateSpdxExpression(asset.license);
    if (asset.evidence !== undefined) evidence(asset.evidence, 'asset evidence');
    if (asset.included !== undefined && typeof asset.included !== 'boolean') fail('Invalid policy asset included');
    if (asset.firstParty !== undefined && typeof asset.firstParty !== 'boolean') fail('Invalid policy asset firstParty');
    if (asset.firstParty && (asset.package || asset.license || asset.evidence)) fail('First-party assets cannot carry third-party package or license evidence');
    if (asset.reason !== undefined) string(asset.reason, 'asset.reason');
  }
  record(policy.classifications ?? {}, Object.keys(policy.classifications ?? {}), 'classifications');
  for (const classification of Object.values(policy.classifications ?? {})) if (!NONPRODUCTION_SCOPES.has(classification)) fail('Invalid policy nonproduction classification');
  if (policy.source !== null && policy.source !== undefined) {
    const source = policy.source;
    record(source, ['root', 'revision', 'url', 'licensing', 'paths'], 'source');
    safePath(source.root); string(source.revision, 'source.revision');
    if (source.url !== undefined) sourceUrl(source.url);
    if (source.licensing !== undefined) paths(source.licensing, 'source.licensing');
    record(source.paths, Object.keys(source.paths ?? {}), 'source.paths');
    for (const [file, decision] of Object.entries(source.paths)) {
      safePath(file); record(decision, ['license', 'evidence'], `source.paths.${file}`);
      validateSpdxExpression(decision.license); evidence(decision.evidence, 'source evidence');
    }
  }
  if (policy.reviewStatus !== undefined) string(policy.reviewStatus, 'reviewStatus');
}

function parseLock(text) {
  const entries = [];
  let current;
  for (const line of text.split('\n')) {
    if (/^\S.*:$/.test(line)) {
      current = { descriptors: line.slice(0, -1).replace(/^"|"$/g, '').split(', '), version: null, resolution: null };
      entries.push(current);
    } else if (current) {
      const match = /^  (version|resolution): (.+)$/.exec(line);
      if (match) {
        if (current[match[1]] !== null) fail(`Ambiguous lockfile duplicate ${match[1]} field`);
        current[match[1]] = match[2].replace(/^"|"$/g, '');
      }
    }
  }
  const descriptors = new Set();
  for (const entry of entries) for (const descriptor of entry.descriptors) {
    countItems();
    if (descriptors.has(descriptor)) fail(`Ambiguous lockfile duplicate descriptor: ${descriptor}`);
    descriptors.add(descriptor);
  }
  return entries;
}

// Evidence detection checks distinguishing license titles/clauses, never just
// a package manifest. Unrecognized prose must have a reviewed, exact override.
function evidenceIdentifiers(text) {
  const matches = [];
  const zeroBsd = /Permission to use, copy, modify, and\/?or distribute this software for any\s+purpose\s+with or without fee is hereby granted\.\s*THE SOFTWARE IS PROVIDED ["']AS IS["'][\s\S]*AUTHOR DISCLAIMS ALL WARRANTIES/i.test(text);
  const rules = [
    ['MIT', /Permission is hereby granted, free of charge/i],
    ['Apache-2.0', /Apache License[\s,\S]{0,80}Version 2\.0|SPDX-License-Identifier:\s*Apache-2\.0/i],
    ['AGPL-3.0-only', /GNU AFFERO GENERAL PUBLIC LICENSE[\s\S]{0,80}Version 3/i],
    ['MPL-2.0', /Mozilla Public License[\s\S]{0,80}(?:Version|v\.)\s*2\.0/i],
    ['BlueOak-1.0.0', /Blue\s*Oak Model License[\s\S]{0,80}(?:Version\s*)?1\.0\.0/i],
    ['CC0-1.0', /CC0 1\.0 Universal/i],
    ['Unlicense', /free and unencumbered software released into the public domain/i],
    ['ISC', /Permission to use, copy, modify, and(?:\/or)? distribute this software for any\s+purpose\s+with or without fee is hereby granted, provided that/i],
    ['OFL-1.1', /SIL OPEN FONT LICENSE[\s\S]{0,80}Version 1\.1/i],
    ['BSL-1.0', /Boost Software License\s*-?\s*Version 1\.0/i],
    ['Zlib', /This software is provided ['"]as-is['"][\s\S]*altered source versions must be plainly marked/i],
  ];
  if (zeroBsd) matches.push('0BSD');
  for (const [identifier, pattern] of rules) if (!(zeroBsd && identifier === 'ISC') && pattern.test(text)) matches.push(identifier);
  if (/Redistribution and use(?: of this software)? in source and binary forms/i.test(text)) {
    matches.push(/Neither the name|names of (?:its|the) contributors/i.test(text) ? 'BSD-3-Clause' : 'BSD-2-Clause');
  }
  return sorted(matches);
}

function validateEvidence(content, expression, file, explicit = false, reason) {
  if (!content.length) fail(`Empty license evidence: ${file}`);
  const text = content.toString('utf8');
  const found = evidenceIdentifiers(text);
  const expectedTree = validateSpdxExpression(expression);
  const expected = spdxFacts(expectedTree);
  const declarations = [...text.matchAll(/SPDX-License-Identifier:\s*([^\r\n*]+)/g)].map((match) => validateSpdxExpression(match[1].trim()));
  if (declarations.some((declaration) => !sameTree(declaration, expectedTree))) fail(`License expression conflict: ${file}`);
  if (found.length > 1 && (/^\s*OR\s*$/m.test(text) || /distributed under either/i.test(text)) && /\bAND\b/.test(expression)) fail(`License expression conflict: ${file}`);
  if (expected.exceptions.length && !declarations.length && !(explicit && typeof reason === 'string' && reason.trim())) fail(`Missing exception grant evidence: ${file}`);
  if (explicit) {
    if (found.some((identifier) => !expected.identifiers.includes(identifier))) fail(`License evidence conflict: ${file}`);
    return { ...expected, tree: expectedTree };
  }
  if (!found.length) fail(`Unrecognized license evidence: ${file}`);
  return {
    identifiers: found,
    exceptions: declarations.length ? expected.exceptions : [],
    ...(declarations.length === 1 ? { tree: declarations[0] } : {}),
  };
}

function reconcileEvidence(facts, expression, label) {
  const expectedTree = validateSpdxExpression(expression);
  const expected = spdxFacts(expectedTree);
  for (const fact of facts) {
    if (!fact.tree) continue;
    const coversExpression = JSON.stringify({ identifiers: fact.identifiers, exceptions: fact.exceptions }) === JSON.stringify(expected);
    if (coversExpression && !sameTree(fact.tree, expectedTree)) fail(`License manifest/evidence conflict for ${label}`);
  }
  const actual = { identifiers: sorted(facts.flatMap((f) => f.identifiers)), exceptions: sorted(facts.flatMap((f) => f.exceptions)) };
  if (JSON.stringify(actual) !== JSON.stringify(expected)) fail(`License manifest/evidence conflict for ${label}`);
}

async function installedPackages(root, workspaces) {
  const records = [];
  const visited = new Set();
  const physicalRecords = new Map();
  async function modules(relative, depth = 0) {
    depthLimit(depth);
    if (!await exists(root, relative)) return;
    const absolute = await contained(root, relative);
    const physical = await realpath(absolute);
    if (visited.has(physical)) return;
    visited.add(physical);
    for (const entry of (await directoryEntries(root, relative)).sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
      if (entry.name.startsWith('.')) continue;
      const location = `${relative}/${entry.name}`;
      if (entry.name.startsWith('@')) {
        for (const child of await directoryEntries(root, location)) await component(`${location}/${child.name}`, depth + 1);
      } else await component(location, depth + 1);
    }
  }
  async function component(alias, depth) {
    depthLimit(depth);
    const location = path.relative(root, await realpath(await contained(root, alias))).split(path.sep).join('/');
    const resolved = await contained(root, location);
    const info = await stat(resolved);
    if (!info.isDirectory() || !await exists(root, `${location}/package.json`)) return;
    const manifest = await json(root, `${location}/package.json`);
    // Workspace links are first-party, not physical third-party components.
    const physical = await realpath(resolved);
    if (!location.split('/').includes('node_modules')) { await modules(`${location}/node_modules`, depth + 1); return; }
    if (typeof manifest.name !== 'string' || typeof manifest.version !== 'string') fail(`Invalid installed package identity: ${location}`);
    if (!physicalRecords.has(physical)) {
      const record = { location, aliases: [alias], manifest, identity: `${manifest.name}@${manifest.version}` };
      records.push(record); physicalRecords.set(physical, record);
    } else physicalRecords.get(physical).aliases.push(alias);
    await modules(`${location}/node_modules`, depth + 1);
  }
  const seeds = new Set(['node_modules']);
  for (const workspace of workspaces) {
    let directory = path.posix.dirname(workspace);
    while (directory !== '.') {
      seeds.add(`${directory}/node_modules`); directory = path.posix.dirname(directory);
    }
  }
  for (const seed of [...seeds].sort()) await modules(seed);
  return records.sort((a, b) => a.location.localeCompare(b.location, 'en'));
}

async function packageEvidence(root, location, manifest, decision, outputDir, artifacts) {
  const expression = decision.license ?? manifest.license;
  validateSpdxExpression(expression);
  if (manifest.license) validateSpdxExpression(manifest.license);
  if (decision.license && manifest.license && decision.license !== manifest.license) {
    if (!decision.conflict || decision.conflict.manifest !== manifest.license || decision.conflict.evidence !== decision.license ||
        !decision.conflict.reason || decision.conflict.status !== 'resolved') {
      fail(`License conflict for ${manifest.name}@${manifest.version}: explicit resolved evidence decision required`);
    }
  }
  const files = (await directoryEntries(root, location)).map((entry) => entry.name).filter((file) => /^(?:licen[cs]e|copying|notice|copyright|attribution)(?:$|[._-])/i.test(file)).sort();
  const refs = files.map((file) => ({ path: `${location}/${file}`, kind: /^(notice|attribution|copyright)/i.test(file) ? 'attribution' : 'license' }));
  for (const override of decision.evidence ?? []) {
    if (!decision.reason) fail(`Evidence override requires a reason: ${manifest.name}`);
    safePath(override.path);
    const prior = refs.find((ref) => ref.path === override.path);
    if (prior) Object.assign(prior, override);
    else refs.push({ kind: 'license', ...override });
  }
  for (const file of decision.requiredFiles ?? []) {
    safePath(file);
    const relative = `${location}/${file}`;
    if (!await exists(root, relative)) fail(`Missing required evidence ${file} for ${manifest.name}@${manifest.version}`);
    if (!refs.some((ref) => ref.path === relative)) refs.push({ path: relative, kind: 'attribution' });
  }
  if (!refs.some((ref) => ref.kind === 'license')) fail(`Missing license evidence for ${manifest.name}@${manifest.version}`);
  const found = [];
  const evidence = [];
  for (const ref of refs.sort((a, b) => a.path.localeCompare(b.path, 'en'))) {
    const content = await bytes(root, ref.path);
    if (!content.length) fail(`Empty license evidence: ${ref.path}`);
    if (ref.kind === 'license') {
      found.push(validateEvidence(content, ref.license ?? expression, ref.path, Boolean(ref.license), ref.reason ?? decision.reason));
    }
    const output = `${outputDir}/evidence/packages/${encodeURIComponent(manifest.name)}@${encodeURIComponent(manifest.version)}/${sha(location)}/${evidenceFileName(ref.path)}`;
    artifacts.set(output, content);
    evidence.push({ path: ref.path, output, kind: ref.kind, sha256: sha(content) });
  }
  reconcileEvidence(found, expression, `${manifest.name}@${manifest.version}`);
  return { license: expression, evidence };
}

async function scanInventoryInternal({ root: inputRoot, policy, policyPath }) {
  const root = await realpath(inputRoot);
  inspectJson(policy); validatePolicy(policy);
  if (!Array.isArray(policy.bundles) || !policy.bundles.some((b) => b.scope === 'provider-bundled') || !policy.bundles.some((b) => b.scope === 'host-bundled')) fail('Provider and host bundle evidence are required');
  const outputDir = safePath(policy.outputDir ?? 'licenses');
  if (/^(?:node_modules|packages|apps|scripts|compliance|\.git)(?:\/|$)/.test(outputDir)) fail(`Unsafe output path: ${outputDir}`);
  const noticesPath = safePath(policy.noticesPath ?? 'THIRD_PARTY_NOTICES.md');
  if (noticesPath !== 'THIRD_PARTY_NOTICES.md') fail(`Unsafe notices output path: ${noticesPath}`);
  const artifacts = new ArtifactMap();
  const records = await installedPackages(root, policy.workspaces);
  const byLocation = new Map(records.flatMap((r) => sorted([r.location, ...r.aliases]).map((location) => [location, r])));
  const byIdentity = new Map();
  for (const record of records) {
    if (!byIdentity.has(record.identity)) byIdentity.set(record.identity, []);
    byIdentity.get(record.identity).push(record);
    record.scopes = new Set(); record.modules = new Set(); record.direct = new Set();
  }
  const lock = parseLock((await bytes(root, 'yarn.lock')).toString('utf8'));
  const inputEvidence = [{ path: 'yarn.lock', sha256: sha(await bytes(root, 'yarn.lock')) }];
  if (policyPath) inputEvidence.push({ path: policyPath, sha256: sha(await bytes(root, policyPath)) });
  const manifests = new Map();
  for (const file of sorted(policy.workspaces ?? [])) {
    const manifest = await json(root, file);
    manifests.set(file, manifest);
    inputEvidence.push({ path: file, sha256: sha(await bytes(root, file)) });
  }
  function locked(record) {
    if (!lock.some((entry) => entry.version === record.manifest.version && entry.resolution === `${record.manifest.name}@npm:${record.manifest.version}`)) fail(`Lockfile identity missing: ${record.identity} (${record.location})`);
  }
  for (const record of records) locked(record);
  async function resolveWorkspace(file, name) {
    let directory = path.posix.dirname(file);
    while (true) {
      const candidate = `${directory === '.' ? '' : `${directory}/`}node_modules/${name}`;
      if (byLocation.has(candidate)) return byLocation.get(candidate);
      if (directory === '.') break;
      directory = path.posix.dirname(directory);
    }
    fail(`Workspace resolution missing for ${name} in ${file}`);
  }
  function exactDependencyLock(record, name, range, owner) {
    const descriptor = `${name}@${range.startsWith('npm:') ? range : `npm:${range}`}`;
    if (!lock.some((entry) => entry.version === record.manifest.version &&
        entry.resolution === `${record.manifest.name}@npm:${record.manifest.version}` && entry.descriptors.includes(descriptor))) {
      fail(`Workspace or dependency version/resolution conflict for ${name} in ${owner}`);
    }
  }
  function nonproductionRootScope(file, section, record) {
    if (file === 'demo/package.json' || file.startsWith('demo/')) return 'demo-only';
    if (section !== 'devDependencies') return null;
    return policy.classifications?.[record.identity] ?? 'development-only';
  }
  async function resolvePhysicalDependency(owner, name, optional = false) {
    let directory = owner.location;
    while (true) {
      const candidate = `${directory === '.' ? '' : `${directory}/`}node_modules/${name}`;
      if (byLocation.has(candidate)) return byLocation.get(candidate);
      if (directory === '.') break;
      directory = path.posix.dirname(directory);
    }
    if (optional) return null;
    fail(`Physical dependency resolution missing for ${name} from ${owner.location}`);
  }
  const nonproductionRoots = [];
  for (const [file, manifest] of manifests) {
    for (const section of ['dependencies', 'peerDependencies', 'optionalDependencies', 'devDependencies']) {
      for (const [name, range] of Object.entries(manifest[section] ?? {})) {
        if (range.startsWith('workspace:')) continue;
        const record = await resolveWorkspace(file, name);
        locked(record);
        exactDependencyLock(record, name, range, file);
        record.direct.add(file);
        const scope = nonproductionRootScope(file, section, record);
        if (scope) nonproductionRoots.push({ record, scope });
      }
    }
  }
  const reached = new Set();
  const pending = [...nonproductionRoots];
  while (pending.length) {
    const { record, scope } = pending.shift();
    const key = `${record.location}\0${scope}`;
    if (reached.has(key)) continue;
    reached.add(key); countItems(); record.scopes.add(scope);
    for (const section of ['dependencies', 'optionalDependencies']) {
      for (const [name, range] of Object.entries(record.manifest[section] ?? {})) {
        if (typeof range !== 'string' || range.startsWith('workspace:')) continue;
        const dependency = await resolvePhysicalDependency(record, name, section === 'optionalDependencies');
        if (!dependency) continue;
        // Scope follows the physical package Node would load from this owner.
        // The exact physical identity must exist in the lock; Yarn may hoist a
        // compatible copy whose own lock descriptor differs from this edge.
        locked(dependency);
        pending.push({ record: dependency, scope });
      }
    }
  }
  const sources = new Map();
  const emitted = [];
  const sourceRoot = policy.source ? safePath(policy.source.root) : null;
  const normalizeModule = (module) => {
    if (typeof module !== 'string') fail('Invalid bundle module');
    if (module.startsWith('<repo>/')) return safePath(module.slice(7).replace(/\?.*$/, ''));
    return module;
  };
  // Host evidence contains prebuilt provider chunks as inputs. Expand their
  // already-reviewed module graph so their code retains its host scope too.
  const prebuiltChunks = new Map();
  for (const bundle of policy.bundles) {
    const evidence = await json(root, bundle.path);
    for (const chunk of evidence.chunks ?? []) prebuiltChunks.set(`${bundle.outputDir}/${safePath(chunk.fileName)}`, chunk.modules ?? []);
  }
  function mark(identity, scope, module, location) {
    if (!Object.hasOwn(policy.packages ?? {}, identity)) fail(`Unexpected production package: ${identity}`);
    const matches = byIdentity.get(identity);
    if (!matches?.length) fail(`Missing installed production package: ${identity}`);
    const record = location ? matches.find((entry) => entry.location === location) :
      matches.find((entry) => entry.location === `node_modules/${entry.manifest.name}`) ?? (matches.length === 1 ? matches[0] : null);
    if (!record) fail(`Ambiguous physical production package: ${identity}; specify location`);
    record.scopes.add(scope); if (module) record.modules.add(module);
  }
  for (const peer of policy.externalPeers ?? []) {
    const manifest = manifests.get(peer.workspace);
    if (!manifest?.peerDependencies?.[peer.name]) fail(`External peer missing from workspace: ${peer.name}`);
    const record = await resolveWorkspace(peer.workspace, peer.name);
    if (record.manifest.version !== peer.version) fail(`External peer version conflict: ${peer.name}`);
    mark(record.identity, 'external-peer', null, record.location);
  }
  for (const bundle of policy.bundles) {
    if (!['provider-bundled', 'host-bundled'].includes(bundle.scope)) fail(`Unknown bundle scope: ${bundle.scope}`);
    safePath(bundle.path); safePath(bundle.outputDir);
    const evidence = await json(root, bundle.path);
    inputEvidence.push({ path: bundle.path, sha256: sha(await bytes(root, bundle.path)) });
    if (!Array.isArray(evidence.chunks) || !evidence.chunks.length) fail(`Missing bundle chunks: ${bundle.path}`);
    const chunkNames = new Set(evidence.chunks.map((c) => c.fileName));
    for (const chunk of evidence.chunks) {
      const file = `${bundle.outputDir}/${safePath(chunk.fileName)}`;
      emitted.push({ path: file, type: 'javascript', scope: bundle.scope, sha256: sha(await bytes(root, file)) });
      for (const imported of [...(chunk.imports ?? []), ...(chunk.dynamicImports ?? [])]) {
        if (chunkNames.has(imported)) continue;
        const peer = (policy.externalPeers ?? []).find((p) => imported === p.name || imported.startsWith(`${p.name}/`));
        if (!peer) fail(`Unexpected external bundle dependency: ${imported}`);
      }
      if (!Array.isArray(chunk.modules)) fail(`Missing chunk module evidence: ${file}`);
      const modules = [...chunk.modules];
      const seenModules = new Set(modules);
      for (const raw of modules) {
        countItems();
        const module = normalizeModule(raw);
        if (prebuiltChunks.has(module)) {
          await bytes(root, module);
          for (const nested of prebuiltChunks.get(module)) {
            if (!seenModules.has(nested)) { seenModules.add(nested); modules.push(nested); }
          }
          continue;
        }
        if (/\.(?:css|woff2?|ttf|eot|otf|svg|png|jpe?g|gif|webp|ico|wasm)$/.test(module) &&
            !(policy.assets ?? []).some((asset) => asset.path === module && asset.included !== false)) fail(`Unclassified bundled asset: ${module}`);
        if (module.startsWith('<grafana-source>/')) {
          const relative = safePath(module.slice(17));
          const decision = policy.source?.paths?.[relative];
          if (!decision) fail(`Unknown Grafana source path: ${relative}`);
          if (!sources.has(relative)) sources.set(relative, { path: relative, license: decision.license, evidence: decision.evidence, scopes: ['source-derived'], bundles: [] });
          sources.get(relative).bundles.push(bundle.scope);
        } else if (module.includes('node_modules/')) {
          const marker = module.lastIndexOf('node_modules/');
          const suffix = module.slice(marker + 13).split('/');
          const location = `${module.slice(0, marker + 13)}${suffix.slice(0, suffix[0].startsWith('@') ? 2 : 1).join('/')}`;
          const record = byLocation.get(location);
          if (!record) fail(`Unresolved physical bundle package: ${module}`);
          if (!Object.hasOwn(policy.packages ?? {}, record.identity)) fail(`Unexpected production package: ${record.identity}`);
          await bytes(root, module);
          record.scopes.add(bundle.scope); record.modules.add(module);
        } else if (Object.hasOwn(policy.generatedHelpers ?? {}, module)) {
          mark(policy.generatedHelpers[module].package, 'generated-helper', module, policy.generatedHelpers[module].location);
        } else if (!(policy.firstPartyPaths ?? []).some((prefix) => module.startsWith(`${safePath(prefix.replace(/\/$/, ''))}/`))) {
          fail(`Unclassified production module: ${module}`);
        } else await bytes(root, module);
      }
    }
    for (const asset of evidence.assets ?? []) {
      const file = `${bundle.outputDir}/${safePath(typeof asset === 'string' ? asset : asset.fileName)}`;
      if (!(policy.assets ?? []).some((entry) => entry.path === file && entry.included !== false)) fail(`Unclassified emitted asset: ${file}`);
    }
    const reviewedFiles = new Set([
      bundle.path,
      ...policy.bundles.map((entry) => entry.path),
      ...evidence.chunks.map((chunk) => `${bundle.outputDir}/${chunk.fileName}`),
      ...(policy.assets ?? []).filter((entry) => entry.included !== false).map((entry) => entry.path),
    ]);
    for (const file of await listFiles(root, bundle.outputDir)) {
      if (!reviewedFiles.has(file)) fail(`Unclassified emitted asset on disk: ${file}`);
    }
  }
  const assetComponents = [];
  for (const asset of [...(policy.assets ?? [])].sort((a, b) => a.path.localeCompare(b.path, 'en'))) {
    safePath(asset.path);
    if (!['css', 'font', 'icon', 'image', 'worker', 'other'].includes(asset.type) || !['runtime', 'static'].includes(asset.use)) fail(`Invalid asset classification: ${asset.path}`);
    if (asset.included === false) {
      if (!asset.reason) fail(`Excluded asset needs evidence reason: ${asset.path}`);
      assetComponents.push({ ...asset, scopes: ['installed-not-distributed'] });
      continue;
    }
    const content = await bytes(root, asset.path);
    if (asset.firstParty) {
      if (!(policy.firstPartyPaths ?? []).some((prefix) => asset.path.startsWith(`${safePath(prefix.replace(/\/$/, ''))}/`))) fail(`First-party asset outside reviewed project paths: ${asset.path}`);
      assetComponents.push({ ...asset, scopes: ['first-party'], sha256: sha(content), evidence: [] });
      continue;
    }
    if (asset.package) mark(asset.package, 'asset', asset.path, asset.location);
    else if (!asset.license || !asset.evidence?.length) fail(`Missing license evidence for asset: ${asset.path}`);
    const evidence = [];
    const assetFacts = [];
    for (const reference of asset.evidence ?? []) {
      const ref = typeof reference === 'string' ? { path: reference } : reference;
      const data = await bytes(root, ref.path);
      assetFacts.push(validateEvidence(data, ref.license ?? asset.license, ref.path, Boolean(ref.license), ref.reason));
      const output = `${outputDir}/evidence/assets/${sha(asset.path)}/${evidenceFileName(ref.path)}`;
      artifacts.set(output, data); evidence.push({ path: ref.path, output, sha256: sha(data) });
    }
    if (assetFacts.length) reconcileEvidence(assetFacts, asset.license, `asset ${asset.path}`);
    assetComponents.push({ ...asset, scopes: ['asset'], sha256: sha(content), evidence });
  }
  let sourceRevision = null;
  if (sources.size || policy.source) {
    if (!sourceRoot || !/^[a-f0-9]{40}$/.test(policy.source.revision)) fail('Exact Grafana source revision is required');
    const absoluteSource = await contained(root, sourceRoot);
    try { sourceRevision = execFileSync('git', ['-c', `safe.directory=${absoluteSource}`, '-C', absoluteSource, 'rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: budget().limits.gitTimeoutMs, maxBuffer: 65536 }).trim(); }
    catch (error) { if (error.code === 'ETIMEDOUT') fail('Resource limit: Git verification timeout'); fail('Cannot verify Grafana source revision'); }
    if (sourceRevision !== policy.source.revision) fail('Grafana source revision conflict');
    if ([...sources.keys()].some((file) => file.startsWith('packages/')) && !policy.source.licensing?.length) fail('Missing Grafana licensing boundary evidence for package exception paths');
    for (const file of policy.source.licensing ?? []) {
      const ref = `${sourceRoot}/${safePath(file)}`;
      const content = await bytes(root, ref);
      if (!content.length) fail(`Empty licensing boundary evidence: ${ref}`);
      const output = file.includes('/')
        ? `${outputDir}/evidence/grafana/source/${evidenceFileName(file)}`
        : `${outputDir}/evidence/grafana/${file}`;
      artifacts.set(output, content);
      inputEvidence.push({ path: ref, output, sha256: sha(content) });
    }
    for (const component of sources.values()) {
      validateSpdxExpression(component.license);
      if (component.path.startsWith('public/app/') && component.license !== 'AGPL-3.0-only') fail(`AGPL application boundary violation: ${component.path}`);
      if (!component.path.startsWith('public/app/') && !component.path.startsWith('packages/')) fail(`Unknown Grafana source boundary: ${component.path}`);
      const content = await bytes(root, `${sourceRoot}/${component.path}`);
      component.sha256 = sha(content); component.bundles = sorted(component.bundles);
      if (!component.evidence?.length) fail(`Missing license evidence for source: ${component.path}`);
      const found = [];
      const sourceEvidence = [];
      for (const reference of component.evidence) {
        const decision = typeof reference === 'string' ? { path: reference } : reference;
        const file = safePath(decision.path);
        const ref = `${sourceRoot}/${file}`;
        const data = await bytes(root, ref);
        found.push(validateEvidence(data, decision.license ?? component.license, ref, Boolean(decision.license), decision.reason));
        // Nested upstream paths can match repository-wide ignore patterns
        // (for example `grafana-data/`). Encode them beneath a neutral
        // directory so every generated evidence file is visible to Git.
        const output = file.includes('/')
          ? `${outputDir}/evidence/grafana/source/${evidenceFileName(file)}`
          : `${outputDir}/evidence/grafana/${file}`;
        artifacts.set(output, data);
        sourceEvidence.push({ path: ref, output, sha256: sha(data) });
      }
      component.evidence = sourceEvidence;
      reconcileEvidence(found, component.license, `source ${component.path}`);
    }
  }
  const components = [];
  for (const [identity, matches] of [...byIdentity].sort(([a], [b]) => a.localeCompare(b, 'en'))) {
    const production = matches.filter((record) => [...record.scopes].some((scope) => PRODUCTION_SCOPES.has(scope)));
    const decision = policy.packages?.[identity] ?? {};
    const declaredLicense = matches[0].manifest.license ?? null;
    let license = declaredLicense;
    if (declaredLicense !== null) {
      try { validateSpdxExpression(declaredLicense); }
      catch (error) {
        if (!decision.unresolvedLicense || !decision.license) throw error;
        license = decision.license;
      }
    }
    if (decision.unresolvedLicense && decision.license) license = decision.license;
    const evidence = [];
    const evidenced = decision.unresolvedLicense ? [] : (production.length ? production : (decision.evidence?.length ? matches : []));
    for (const record of evidenced) {
      if (production.includes(record)) locked(record);
      const result = await packageEvidence(root, record.location, record.manifest, decision, outputDir, artifacts);
      if (evidence.length && result.license !== license) fail(`License conflict across physical copies: ${identity}`);
      license = result.license; evidence.push(...result.evidence); record.evidence = result.evidence;
    }
    if (license === null && !decision.unresolvedLicense) fail(`Missing explicit unresolved license decision for null license: ${identity}`);
    const reviewEvidence = [];
    const reviewPaths = sorted([...(decision.reviewReferences ?? []), ...(decision.unresolvedLicense?.references ?? [])]);
    for (const reference of reviewPaths) {
      const content = await bytes(root, reference);
      if (!content.length) fail(`Empty review evidence: ${reference}`);
      const item = { path: reference, sha256: sha(content) };
      reviewEvidence.push(item);
      const prior = inputEvidence.find((entry) => entry.path === reference);
      if (prior && prior.sha256 !== item.sha256) fail(`Review evidence identity conflict: ${reference}`);
      if (!prior) inputEvidence.push(item);
    }
    const scopes = sorted(matches.flatMap((record) => [...record.scopes]));
    if (!scopes.length) {
      scopes.push('installed-not-distributed');
    }
    const unresolved = Boolean(decision.unresolvedLicense || decision.conflict?.status === 'unresolved');
    components.push({ name: matches[0].manifest.name, version: matches[0].manifest.version, license,
      scopes, locations: sorted(matches.map((r) => r.location)), modules: sorted(matches.flatMap((r) => [...r.modules])),
      directIn: sorted(matches.flatMap((r) => [...r.direct])), relationship: matches.some((r) => r.direct.size) ? 'direct' : 'transitive',
      sourceUrl: sourceUrl(decision.sourceUrl ?? (typeof matches[0].manifest.repository === 'string' ? matches[0].manifest.repository : matches[0].manifest.repository?.url)),
      physicalComponents: matches.map((record) => ({ location: record.location,
        scopes: record.scopes.size ? sorted(record.scopes) : ['installed-not-distributed'],
        manifestSha256: sha(JSON.stringify(stable(record.manifest))), evidence: record.evidence ?? [],
      })),
      evidence, status: unresolved ? 'unresolved' : (production.length ? 'resolved' : 'not-distributed'),
      ...(reviewEvidence.length ? { reviewEvidence } : {}),
      ...(decision.conflict ? { conflict: decision.conflict, legalReviewRequired: decision.conflict.status === 'unresolved' } : {}),
      ...(decision.unresolvedLicense ? { unresolvedLicense: decision.unresolvedLicense, legalReviewRequired: true } : {}),
    });
  }
  const reviewComponents = components.filter((component) => component.legalReviewRequired).map((component) => `${component.name}@${component.version}`).sort();
  const publicationBlockers = components.filter((component) => component.legalReviewRequired && component.scopes.some((scope) => PRODUCTION_SCOPES.has(scope)))
    .map((component) => `${component.name}@${component.version}`).sort();
  const inventoryReview = reviewComponents.length
    ? { status: 'review-required', components: reviewComponents, note: 'The inventory records unresolved upstream licensing boundaries that require maintainer or qualified legal review.' }
    : { status: 'complete', components: [] };
  const releaseGate = publicationBlockers.length
    ? { status: 'blocked-legal-review', components: publicationBlockers, note: 'The current production distribution includes unresolved licensing boundaries that require maintainer or qualified legal review before publication.' }
    : { status: 'inventory-complete', components: [] };
  const dependencyInventory = { schemaVersion: 1, inventoryReview, releaseGate, components, inputs: inputEvidence.sort((a, b) => a.path.localeCompare(b.path, 'en')), emitted: emitted.sort((a, b) => a.path.localeCompare(b.path, 'en')) };
  const sourceInventory = { schemaVersion: 1, revision: sourceRevision, sourceUrl: sourceUrl(policy.source?.url), components: [...sources.values()].sort((a, b) => a.path.localeCompare(b.path, 'en')) };
  const assetInventory = { schemaVersion: 1, components: assetComponents };
  artifacts.set(`${outputDir}/dependency-inventory.json`, jsonBytes(dependencyInventory));
  artifacts.set(`${outputDir}/source-inventory.json`, jsonBytes(sourceInventory));
  artifacts.set(`${outputDir}/asset-inventory.json`, jsonBytes(assetInventory));
  const noticeLines = ['# Third-party notices', '', 'Generated from the reviewed distribution inventory. Authoritative evidence is copied verbatim under licenses/evidence.', ''];
  if (publicationBlockers.length) noticeLines.push('> **PUBLICATION BLOCKED — LEGAL REVIEW REQUIRED:** the current production closure contains unresolved licensing-boundary decisions for:', '', ...publicationBlockers.map((identity) => `> - ${identity}`), '', '> These notices do not resolve those questions or establish public-release approval.', '');
  const nonpublicationReviews = reviewComponents.filter((identity) => !publicationBlockers.includes(identity));
  if (nonpublicationReviews.length) noticeLines.push('## Inventory review questions outside the current publication closure', '', ...nonpublicationReviews.map((identity) => `- ${identity}`), '', 'These installed-only questions remain visible in the inventory but do not block publication of the current production closure.', '');
  if (policy.source) {
    noticeLines.push('## Grafana source provenance', '', `Pinned source revision: ${sourceRevision}`, '');
    for (const file of ['LICENSE', 'LICENSING.md', 'NOTICE.md']) {
      const output = `${outputDir}/evidence/grafana/${file}`;
      if (!artifacts.has(output)) fail(`Missing required Grafana provenance document: ${file}`);
      noticeLines.push(`- [Grafana ${file}](${markdownHref(output)})`);
    }
    noticeLines.push('');
  }
  for (const component of components.filter((c) => c.status === 'resolved')) {
    noticeLines.push(`## ${component.name} ${component.version}`, '', `License: ${component.license}`, '', `Scopes: ${component.scopes.join(', ')}`, '');
    for (const ref of component.evidence) noticeLines.push(`- [${ref.kind}: ${ref.path}](${markdownHref(ref.output)})`);
    noticeLines.push('');
  }
  for (const component of sourceInventory.components) {
    noticeLines.push(`## Grafana: ${component.path}`, '', `Revision: ${sourceRevision}; license: ${component.license}`, '');
    for (const ref of component.evidence) noticeLines.push(`- [${ref.path}](${markdownHref(ref.output)})`);
    noticeLines.push('');
  }
  for (const asset of assetComponents.filter((a) => a.included !== false && a.scopes.includes('asset'))) {
    noticeLines.push(`## Asset: ${asset.path}`, '', `License: ${asset.license ?? components.find((c) => `${c.name}@${c.version}` === asset.package)?.license}`, '');
    for (const ref of asset.evidence) noticeLines.push(`- [${ref.path}](${markdownHref(ref.output)})`);
    noticeLines.push('');
  }
  while (noticeLines.at(-1) === '') noticeLines.pop();
  artifacts.set(noticesPath, Buffer.from(`${noticeLines.join('\n')}\n`));
  artifacts.set(`${outputDir}/README.md`, Buffer.from('# License evidence inventories\n\nGenerated by scripts/third-party-license-gate.mjs. Do not edit generated files.\n\nProduction scopes: provider-bundled, host-bundled, external-peer, source-derived, asset, generated-helper. Nonproduction scopes: demo-only, test-only, development-only, installed-not-distributed.\n\n`dependency-inventory.json` separates every unresolved `inventoryReview` question from production-only `releaseGate` blockers; unexpected missing evidence still fails generation. Evidence files preserve upstream bytes. Passing this inventory gate does not establish source-availability compliance or public-release approval; issue #65 remains separate.\n'));
  return { artifacts, dependencyInventory, sourceInventory, assetInventory, outputDir, noticesPath };
}

async function listFiles(root, directory) {
  if (!await exists(root, directory)) return [];
  const files = [];
  async function visit(relative, depth = 0) {
    depthLimit(depth);
    for (const entry of await directoryEntries(root, relative)) {
      const file = `${relative}/${entry.name}`;
      if (entry.isDirectory()) await visit(file, depth + 1);
      else { await contained(root, file); files.push(file); }
    }
  }
  await visit(directory);
  return files.sort();
}

async function runGateInternal({ root: inputRoot = process.cwd(), mode = 'check', policyPath = 'compliance/third-party/policy.json' } = {}) {
  if (!['generate', 'check'].includes(mode)) fail('Usage: third-party-license-gate.mjs <generate|check> [--root directory] [--policy relative-file]');
  const root = await realpath(inputRoot);
  const policy = await json(root, policyPath);
  const result = await scanInventoryInternal({ root, policy, policyPath });
  for (const file of result.artifacts.keys()) await outputDestination(root, file);
  const stale = [];
  for (const file of await listFiles(root, result.outputDir)) {
    if (!result.artifacts.has(file)) stale.push(`Unexpected generated file: ${file}`);
  }
  if (mode === 'check') {
    for (const [file, content] of [...result.artifacts].sort(([a], [b]) => a.localeCompare(b, 'en'))) {
      if (!await exists(root, file) || !content.equals(await bytes(root, file))) stale.push(`Stale generated output: ${file}`);
    }
    if (stale.length) fail(stale.join('\n'));
  } else {
    if (stale.length) fail(stale.join('\n'));
    // Validate every destination before the first write; symlinks cannot escape.
    for (const file of result.artifacts.keys()) await outputDestination(root, file);
    for (const [file, content] of [...result.artifacts].sort(([a], [b]) => a.localeCompare(b, 'en'))) {
      const absolute = await outputDestination(root, file);
      await mkdir(path.dirname(absolute), { recursive: true });
      await writeFile(absolute, content);
    }
  }
  return result;
}

export function scanInventory(options) { return withBudget(options?.limits, () => scanInventoryInternal(options)); }
export function runGate(options = {}) { return withBudget(options.limits, () => runGateInternal(options)); }

async function main(args) {
  const [mode, ...flags] = args;
  const options = { mode };
  for (let i = 0; i < flags.length; i += 2) {
    if (!['--root', '--policy'].includes(flags[i]) || !flags[i + 1] || flags[i + 1].startsWith('--')) fail('Usage: third-party-license-gate.mjs <generate|check> [--root directory] [--policy relative-file]');
    options[flags[i] === '--root' ? 'root' : 'policyPath'] = flags[i + 1];
  }
  if (!['generate', 'check'].includes(mode)) fail('Usage: third-party-license-gate.mjs <generate|check> [--root directory] [--policy relative-file]');
  const result = await runGate(options);
  process.stdout.write(`License ${mode}: ${result.dependencyInventory.components.length} package identities; ${result.sourceInventory.components.length} source paths; ${result.assetInventory.components.length} assets\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).catch((error) => {
    // Paths in OS errors can contain machine-local details; emit bounded errors.
    process.stderr.write(`License gate: ${error.code ? `${error.code}: missing or unreadable repository evidence` : error.message}\n`);
    process.exitCode = 1;
  });
}
