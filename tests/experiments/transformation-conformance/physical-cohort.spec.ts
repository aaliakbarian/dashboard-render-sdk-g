// POC / EXPERIMENT / NOT FOR PRODUCTION
import { createHash } from 'node:crypto';
import { readFileSync, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const repositoryRoot = resolve(import.meta.dirname, '../../..');
const require = createRequire(import.meta.url);
const packageJsonPath = require.resolve('@grafana/data/package.json');
const operatorPath = resolve(
  dirname(packageJsonPath),
  'dist/esm/transformations/transformers/renameByRegex.mjs'
);
const pinnedSourcePath = resolve(
  repositoryRoot,
  '.grafana-source/grafana-v13.2.3/packages/grafana-data/src/transformations/transformers/renameByRegex.ts'
);

function sha256(path: string) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

describe('physical Grafana Data cohort', () => {
  it('resolves one installed @grafana/data 13.2.3 package and its exact compiled operator', () => {
    const manifest = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
      license: string;
      name: string;
      version: string;
    };
    expect(manifest).toMatchObject({ license: 'Apache-2.0', name: '@grafana/data', version: '13.2.3' });
    expect(realpathSync(packageJsonPath)).toBe(resolve(repositoryRoot, 'node_modules/@grafana/data/package.json'));
    expect(sha256(operatorPath)).toBe('0b8d1926d4da5e14e7812993f4ffcd10cdd63634af3a9f0d70c783816f1b9c35');
    expect(sha256(pinnedSourcePath)).toBe('369838a1c1492c06aeec78aefd4bb458d9a0eb64ccdb6805fa90ac00840d0b2d');
  });

  it('contains one locked 13.2.3 Grafana Data resolution', () => {
    const lock = readFileSync(resolve(repositoryRoot, 'yarn.lock'), 'utf8');
    const resolutions = [...lock.matchAll(/resolution: "@grafana\/data@npm:([^"]+)"/g)].map((match) => match[1]);
    expect([...new Set(resolutions)]).toEqual(['13.2.3']);
  });
});
