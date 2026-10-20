import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = fileURLToPath(new URL('../../../..', import.meta.url));

export function resolveRepositoryPath(...segments: string[]): string {
  return resolve(repositoryRoot, ...segments);
}
