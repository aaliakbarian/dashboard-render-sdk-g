// POC / EXPERIMENT / NOT FOR PRODUCTION
import { PANEL_APPLICATION_SOURCES } from './sourceIdentity.ts';

export interface EvidenceChunk {
  readonly dynamicImports: readonly string[];
  readonly facadeModuleId: string | null;
  readonly fileName: string;
  readonly gzipSize: number;
  readonly imports: readonly string[];
  readonly isDynamicEntry: boolean;
  readonly isEntry: boolean;
  readonly modules: readonly string[];
  readonly rawSize: number;
}

export interface EvidenceAsset {
  readonly category: string;
  readonly fileName: string;
  readonly gzipSize: number;
  readonly rawSize: number;
}

export interface BundleEvidence {
  readonly assets: readonly EvidenceAsset[];
  readonly categories: {
    readonly grafanaApplication: readonly string[];
    readonly systemJs: readonly string[];
  };
  readonly chunks: readonly EvidenceChunk[];
  readonly moduleIds: readonly string[];
}

type PanelId = keyof typeof PANEL_APPLICATION_SOURCES;
type DependencyClass =
  | 'EXTERNAL HOST'
  | 'SHARED PROVIDER CHUNK'
  | 'FEATURE-LOCAL'
  | 'DUPLICATED'
  | 'NOT USED';

function reachable(
  chunks: readonly EvidenceChunk[],
  roots: readonly EvidenceChunk[],
  includeDynamic: boolean
): EvidenceChunk[] {
  const byName = new Map(chunks.map((chunk) => [chunk.fileName, chunk]));
  const pending = roots.map((chunk) => chunk.fileName);
  const visited = new Set<string>();
  while (pending.length > 0) {
    const name = pending.pop();
    if (!name || visited.has(name)) continue;
    visited.add(name);
    const chunk = byName.get(name);
    if (!chunk) continue;
    pending.push(...chunk.imports, ...(includeDynamic ? chunk.dynamicImports : []));
  }
  return chunks.filter((chunk) => visited.has(chunk.fileName));
}

const upstream = (path: string) => `<grafana-source>/${path}`;

export function assessLazyPanelBundle(report: BundleEvidence) {
  const entryChunks = report.chunks.filter((chunk) => chunk.isEntry);
  const bootstrap = reachable(report.chunks, entryChunks, false);
  const panelChunks = Object.fromEntries(
    Object.entries(PANEL_APPLICATION_SOURCES).map(([panelId, sources]) => [
      panelId,
      report.chunks
        .filter((chunk) => sources.some((source) => chunk.modules.includes(upstream(source))))
        .map((chunk) => chunk.fileName)
        .sort(),
    ])
  ) as Record<PanelId, string[]>;
  const applicationSources = [...new Set(report.categories.grafanaApplication)].sort();
  const panelClosures = Object.fromEntries(
    Object.entries(panelChunks).map(([panelId, names]) => [
      panelId,
      reachable(
        report.chunks,
        report.chunks.filter(
          (chunk) =>
            chunk.facadeModuleId ===
              `<repo>/experiments/bundle/lazy-panel-chunks/features/${panelId}.ts` ||
            names.includes(chunk.fileName)
        ),
        false
      ),
    ])
  ) as Record<PanelId, EvidenceChunk[]>;
  const dependencies = {
    emotion: /\/node_modules\/@emotion\//,
    grafanaData: /\/node_modules\/@grafana\/data\//,
    grafanaRuntime: /\/node_modules\/@grafana\/runtime\//,
    grafanaScenes: /\/node_modules\/@grafana\/scenes\//,
    grafanaUi: /\/node_modules\/@grafana\/ui\//,
    react: /\/node_modules\/react\//,
    reactDom: /\/node_modules\/react-dom\//,
    rxjs: /\/node_modules\/rxjs\//,
    uplot: /\/node_modules\/uplot\//,
  } as const;
  const sharedDependencies = Object.fromEntries(
    Object.entries(panelClosures).map(([panelId, chunks]) => {
      const chunkNames = new Set(chunks.map((chunk) => chunk.fileName));
      return [
        panelId,
        Object.fromEntries(
          Object.entries(dependencies).map(([dependency, pattern]) => {
            const modules = [...new Set(chunks.flatMap((chunk) => chunk.modules).filter((id) => pattern.test(id)))];
            const external = chunks.some((chunk) =>
              [...chunk.imports].some((id) =>
                dependency === 'react'
                  ? /^react(?:\/|$)/.test(id)
                  : dependency === 'reactDom'
                    ? /^react-dom(?:\/|$)/.test(id)
                    : false
              )
            );
            const owners = report.chunks.filter((chunk) =>
              chunk.modules.some((id) => modules.includes(id))
            );
            const duplicated = modules.some(
              (moduleId) => report.chunks.filter((chunk) => chunk.modules.includes(moduleId)).length > 1
            );
            const shared = owners.some((owner) =>
              Object.entries(panelClosures).some(
                ([otherPanel, closure]) =>
                  otherPanel !== panelId && closure.some((chunk) => chunk.fileName === owner.fileName)
              )
            );
            let classification: DependencyClass = 'NOT USED';
            if (duplicated) classification = 'DUPLICATED';
            else if (external && modules.length === 0) classification = 'EXTERNAL HOST';
            else if (shared) classification = 'SHARED PROVIDER CHUNK';
            else if (modules.length > 0 || owners.some((owner) => chunkNames.has(owner.fileName))) {
              classification = 'FEATURE-LOCAL';
            }
            return [dependency, { classification, modules: modules.sort() }];
          })
        ),
      ];
    })
  );

  return {
    applicationSources,
    applicationSourceOwners: applicationSources.map((source) => ({
      chunks: report.chunks
        .filter((chunk) => chunk.modules.includes(source))
        .map((chunk) => chunk.fileName)
        .sort(),
      source,
    })),
    bootstrapApplicationSources: [
      ...new Set(bootstrap.flatMap((chunk) => chunk.modules).filter((id) => id.includes('/public/app/'))),
    ].sort(),
    codiconAssets: report.assets.filter((asset) => /codicon/i.test(asset.fileName)),
    monacoModules: report.moduleIds.filter((id) => /(?:monaco-editor|ReactMonacoEditor|\/Monaco\/)/i.test(id)),
    panelChunks,
    panelSizes: Object.fromEntries(
      Object.entries(panelChunks).map(([id, names]) => {
        const chunks = report.chunks.filter((chunk) => names.includes(chunk.fileName));
        return [id, {
          gzipBytes: chunks.reduce((total, chunk) => total + chunk.gzipSize, 0),
          rawBytes: chunks.reduce((total, chunk) => total + chunk.rawSize, 0),
        }];
      })
    ),
    featureClosures: Object.fromEntries(
      Object.entries(panelClosures).map(([id, chunks]) => [
        id,
        {
          chunks: chunks.map((chunk) => chunk.fileName).sort(),
          gzipBytes: chunks.reduce((total, chunk) => total + chunk.gzipSize, 0),
          rawBytes: chunks.reduce((total, chunk) => total + chunk.rawSize, 0),
        },
      ])
    ),
    reactImplementationModules: report.moduleIds.filter((id) => /\/node_modules\/(?:react|react-dom)\//.test(id)),
    sharedDependencies,
    systemJsModules: [...report.categories.systemJs],
  };
}
