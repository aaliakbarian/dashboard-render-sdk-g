import { existsSync, readFileSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';

import { transformWithOxc, type Plugin } from 'vite';

export interface PinnedGrafanaSourcePluginOptions {
  readonly allowedEntryImporters: readonly string[];
  readonly feature?: 'text' | 'testdata' | 'native';
  readonly reviewedFiles?: readonly string[];
  readonly entryAlias: string;
  readonly entrypoint: string;
  readonly sourceRoot: string;
}

export function pinnedGrafanaSourcePlugin(options: PinnedGrafanaSourcePluginOptions): Plugin {
  const VIRTUAL_PREFIX = `\0provider-13-pinned-grafana-source:${options.feature ?? 'text'}:`;
  const sourceRoot = resolve(options.sourceRoot).replaceAll('\\', '/').replace(/\/$/, '');
  const allowedEntryImporters = new Set(
    options.allowedEntryImporters.map((importer) => resolve(importer).replaceAll('\\', '/'))
  );
  const assertInside = (file: string) => {
    const absolute = resolve(file).replaceAll('\\', '/');
    if (absolute !== sourceRoot && !absolute.startsWith(`${sourceRoot}/`)) {
      throw new Error(`Pinned Grafana module is outside the audited source root: ${file}`);
    }
    if (options.reviewedFiles && !options.reviewedFiles.includes(relative(sourceRoot, absolute).split(sep).join('/'))) {
      throw new Error('Pinned Grafana module is outside the reviewed file inventory.');
    }
    return absolute;
  };
  const toVirtual = (file: string) =>
    `${VIRTUAL_PREFIX}${relative(sourceRoot, assertInside(file)).split(sep).join('/')}.js`;
  const fromVirtual = (id: string) =>
    assertInside(resolve(sourceRoot, id.slice(VIRTUAL_PREFIX.length).replace(/\.js$/, '')));
  const resolveSource = (candidate: string) => {
    const candidates = /\.[cm]?[jt]sx?$/.test(candidate)
      ? [candidate]
      : [candidate, `${candidate}.ts`, `${candidate}.tsx`, `${candidate}.js`, `${candidate}.jsx`];
    return candidates.find((file) => existsSync(file));
  };

  return {
    name: 'provider-13-pinned-grafana-source',
    enforce: 'pre',
    resolveId(source, importer) {
      if (source === options.entryAlias) {
        const normalizedImporter = importer === undefined
          ? undefined
          : resolve(importer.split('?')[0]).replaceAll('\\', '/');
        return normalizedImporter !== undefined && allowedEntryImporters.has(normalizedImporter)
          ? toVirtual(resolve(sourceRoot, options.entrypoint))
          : null;
      }
      if (!importer?.startsWith(VIRTUAL_PREFIX) || !source.startsWith('.')) return null;
      const importerFile = fromVirtual(importer);
      const resolved = resolveSource(resolve(importerFile, '..', source));
      if (!resolved) throw new Error(`Audited Grafana source import could not be resolved: ${source}`);
      return toVirtual(resolved);
    },
    load(id) {
      if (!id.startsWith(VIRTUAL_PREFIX)) return null;
      return readFileSync(fromVirtual(id), 'utf8');
    },
    async transform(code, id) {
      if (!id.startsWith(VIRTUAL_PREFIX)) return null;
      const sourcefile = fromVirtual(id);
      const result = await transformWithOxc(code, sourcefile, {
        jsx: { runtime: 'automatic' },
        sourcemap: false,
        tsconfig: { compilerOptions: { jsx: 'react-jsx' } },
      });
      return { code: result.code, map: result.map };
    },
  };
}
