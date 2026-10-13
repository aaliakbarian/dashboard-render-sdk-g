import { gzipSync } from 'node:zlib';

import type { Plugin, Rolldown } from 'vite';

export interface BundleEvidencePluginOptions {
  reportFile?: string;
  repositoryRoot?: string;
}

function evidenceModuleId(id: string, repositoryRoot: string): string {
  const virtualSourcePrefix = 'poc-pinned-grafana-source:';
  const normalized = id.replace(/^\0+/, '').replaceAll('\\', '/');
  const normalizedRoot = repositoryRoot.replaceAll('\\', '/').replace(/\/$/, '');
  if (process.env.GRAFANA_SOURCE_DIR) {
    const sourceRoot = process.env.GRAFANA_SOURCE_DIR.replaceAll('\\', '/').replace(/\/$/, '');
    if (normalized.startsWith(`${sourceRoot}/`)) {
      return `<grafana-source>/${normalized.slice(sourceRoot.length + 1)}`;
    }
    if (normalized.startsWith(virtualSourcePrefix)) {
      const virtualSource = normalized.slice(virtualSourcePrefix.length);
      const separator = virtualSource.indexOf(':');
      const namespace = separator >= 0 ? virtualSource.slice(0, separator) : 'testdata';
      const relativeSource = (separator >= 0 ? virtualSource.slice(separator + 1) : virtualSource).replace(/\.js$/, '');
      const auditedRoot =
        namespace === 'text-baseline' || namespace === 'text-renderer-only'
          ? 'public/app/plugins/panel/text'
          : namespace === 'stat'
          ? 'public/app/plugins/panel/stat'
          : namespace === 'timeseries'
            ? 'public/app/plugins/panel/timeseries'
          : 'public/app/plugins/datasource/grafana-testdata-datasource';
      return `<grafana-source>/${auditedRoot}/${relativeSource}`;
    }
  }
  if (normalized.startsWith(`${normalizedRoot}/`)) {
    return `<repo>/${normalized.slice(normalizedRoot.length + 1)}`;
  }
  return normalized;
}

function bytes(source: string | Uint8Array): Uint8Array {
  return typeof source === 'string' ? Buffer.from(source) : source;
}

function classifyAsset(fileName: string): string {
  if (fileName.endsWith('.css')) return 'css';
  if (/\.(?:woff2?|ttf|otf)$/i.test(fileName)) return 'font';
  if (/\.(?:svg|png|jpe?g|gif|webp|avif|ico)$/i.test(fileName)) return 'image';
  if (fileName.endsWith('.wasm')) return 'wasm';
  if (fileName.endsWith('.map')) return 'source-map';
  if (fileName.endsWith('.json')) return 'json';
  return 'other';
}

function chunkEvidence(chunk: Rolldown.OutputChunk, repositoryRoot: string) {
  const content = Buffer.from(chunk.code);
  return {
    dynamicImports: [...chunk.dynamicImports].sort(),
    facadeModuleId: chunk.facadeModuleId
      ? evidenceModuleId(chunk.facadeModuleId, repositoryRoot)
      : null,
    fileName: chunk.fileName,
    gzipSize: gzipSync(content).byteLength,
    imports: [...chunk.imports].sort(),
    isDynamicEntry: chunk.isDynamicEntry,
    isEntry: chunk.isEntry,
    modules: Object.keys(chunk.modules)
      .map((id) => evidenceModuleId(id, repositoryRoot))
      .sort(),
    moduleRenderedBytes: Object.entries(chunk.modules)
      .map(([id, module]) => ({
        id: evidenceModuleId(id, repositoryRoot),
        renderedBytes: module.renderedLength,
      }))
      .sort((left, right) => left.id.localeCompare(right.id)),
    rawSize: content.byteLength,
  };
}

function assetEvidence(asset: Rolldown.OutputAsset) {
  const content = bytes(asset.source);
  return {
    category: classifyAsset(asset.fileName),
    fileName: asset.fileName,
    gzipSize: gzipSync(content).byteLength,
    rawSize: content.byteLength,
  };
}

export function bundleEvidencePlugin(options: BundleEvidencePluginOptions = {}): Plugin {
  const repositoryRoot = options.repositoryRoot ?? process.cwd();

  return {
    name: 'poc-bundle-evidence',
    generateBundle(_outputOptions, bundle) {
      const chunks = Object.values(bundle)
        .filter((entry): entry is Rolldown.OutputChunk => entry.type === 'chunk')
        .map((chunk) => chunkEvidence(chunk, repositoryRoot))
        .sort((left, right) => left.fileName.localeCompare(right.fileName));
      const assets = Object.values(bundle)
        .filter((entry): entry is Rolldown.OutputAsset => entry.type === 'asset')
        .map(assetEvidence)
        .sort((left, right) => left.fileName.localeCompare(right.fileName));
      const moduleIds = [...this.getModuleIds()]
        .map((id) => evidenceModuleId(id, repositoryRoot))
        .sort();

      const report = {
        assets,
        categories: {
          css: moduleIds.filter((id) => id.endsWith('.css')),
          fonts: moduleIds.filter((id) => /\.(?:woff2?|ttf|otf)$/i.test(id)),
          grafanaApplication: moduleIds.filter((id) => id.includes('/public/app/')),
          grafanaInternal: moduleIds.filter((id) => /@grafana\/[^/]+\/internal/.test(id)),
          systemJs: moduleIds.filter((id) => /(?:^|\/)systemjs(?:\/|$)/i.test(id)),
          wasm: moduleIds.filter((id) => id.endsWith('.wasm')),
          workers: moduleIds.filter((id) => /(?:\?|&)worker(?:&|$)|\.worker\.[cm]?[jt]s$/i.test(id)),
        },
        chunks,
        generatedBy: 'poc-bundle-evidence-v1',
        moduleIds,
      };

      this.emitFile({
        fileName: options.reportFile ?? 'evidence/bundle-evidence.json',
        source: `${JSON.stringify(report, null, 2)}\n`,
        type: 'asset',
      });
    },
  };
}
