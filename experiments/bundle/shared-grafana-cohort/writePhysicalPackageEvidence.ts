// POC / EXPERIMENT / NOT FOR PRODUCTION
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PACKAGE_VERSIONS } from './sourceIdentity.ts';

const experimentRoot = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(experimentRoot, '../../..');
const searchRoots = ['node_modules', 'apps', 'packages'].map((path) => resolve(repositoryRoot, path));
const manifests = [
  'package.json',
  'apps/poc-host/package.json',
  'packages/poc-compat/package.json',
  'packages/poc-grafana-bridge/package.json',
].map((path) => ({ path, value: JSON.parse(readFileSync(resolve(repositoryRoot, path), 'utf8')) as Record<string, any> }));

const packages = Object.entries(PACKAGE_VERSIONS).map(([name, expected]) => {
  const suffix = `/node_modules/${name}/package.json`;
  const output = execFileSync('find', [...searchRoots, '-path', `*${suffix}`, '-type', 'f'], {
    encoding: 'utf8',
  }).trim();
  const manifestPaths = output ? output.split('\n') : [];
  const physicalPaths = [...new Set(manifestPaths.map((path) => realpathSync(dirname(path))))].sort();
  const versions = [...new Set(physicalPaths.map((path) => JSON.parse(readFileSync(resolve(path, 'package.json'), 'utf8')).version))];
  if (versions.length !== 1 || versions[0] !== expected) {
    throw new Error(`${name} resolved versions ${versions.join(', ') || '<none>'}; expected ${expected}.`);
  }
  const workspaces = manifests
    .filter(({ value }) => [value.dependencies, value.devDependencies, value.peerDependencies, value.resolutions]
      .some((group) => group && name in group))
    .map(({ path }) => path);
  return {
    name,
    paths: physicalPaths.map((path) => `<repo>/${relative(repositoryRoot, path).replaceAll('\\', '/')}`),
    physicalCopies: physicalPaths.length,
    version: versions[0],
    workspaces,
  };
});

const output = resolve(repositoryRoot, 'artifacts/experiments/shared-grafana-cohort/physical-packages.json');
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, `${JSON.stringify({ packages }, null, 2)}\n`);
console.log(JSON.stringify({ packages }));

