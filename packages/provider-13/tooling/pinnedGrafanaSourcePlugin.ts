import { existsSync, readFileSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';

import { transformWithOxc, type Plugin } from 'vite';

const VIRTUAL_PREFIX = '\0provider-13-pinned-grafana-source:text:';

export interface PinnedGrafanaSourcePluginOptions {
  readonly entryAlias: string;
  readonly entrypoint: string;
  readonly sourceRoot: string;
}

export function pinnedGrafanaSourcePlugin(options: PinnedGrafanaSourcePluginOptions): Plugin {
  const sourceRoot = resolve(options.sourceRoot).replaceAll('\\', '/').replace(/\/$/, '');
  const assertInside = (file: string) => {
    const absolute = resolve(file).replaceAll('\\', '/');
    if (absolute !== sourceRoot && !absolute.startsWith(`${sourceRoot}/`)) {
      throw new Error(`Pinned Grafana module is outside the audited source root: ${file}`);
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
      if (source === options.entryAlias) return toVirtual(resolve(sourceRoot, options.entrypoint));
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
      });
      return { code: result.code, map: result.map };
    },
  };
}
