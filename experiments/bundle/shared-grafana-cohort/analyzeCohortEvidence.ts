// POC / EXPERIMENT / NOT FOR PRODUCTION
import { FEATURE_APPLICATION_SOURCES, PACKAGE_VERSIONS, PROVIDER_FEATURE_IDS } from './sourceIdentity.ts';

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

export interface PhysicalPackageEvidence {
  readonly packages: ReadonlyArray<{
    readonly name: keyof typeof PACKAGE_VERSIONS;
    readonly paths: readonly string[];
    readonly physicalCopies: number;
    readonly version: string;
    readonly workspaces: readonly string[];
  }>;
}

type DependencyStatus =
  | 'HOST_EXTERNAL'
  | 'SHARED_ONCE'
  | 'FEATURE_LOCAL'
  | 'DUPLICATED_ACCEPTABLE'
  | 'DUPLICATED_INVALID'
  | 'NOT_USED';

const dependencyPatterns = {
  react: /<repo>\/node_modules\/react\//,
  reactDom: /<repo>\/node_modules\/react-dom\//,
  grafanaData: /<repo>\/node_modules\/@grafana\/data\//,
  grafanaUi: /<repo>\/node_modules\/@grafana\/ui\//,
  grafanaRuntime: /<repo>\/node_modules\/@grafana\/runtime\//,
  grafanaSchema: /<repo>\/node_modules\/@grafana\/schema\//,
  grafanaI18n: /<repo>\/node_modules\/@grafana\/i18n\//,
  grafanaScenes: /<repo>\/node_modules\/@grafana\/scenes\//,
  rxjs: /<repo>\/node_modules\/rxjs\//,
  emotion: /<repo>\/node_modules\/@emotion\//,
  uplot: /<repo>\/node_modules\/uplot\//,
} as const;

const editorPattern = /(?:monaco-editor|@monaco-editor|@codemirror|@uiw\/react-codemirror|ReactMonacoEditor|\/components\/(?:Monaco|CodeMirror)\/|\/GlobalStyles\/queryEditor)/i;
const editorAssetPattern = /(?:codicon|monaco|codemirror|query-editor|config-editor|scenario-editor)/i;

function reachable(chunks: readonly EvidenceChunk[], roots: readonly EvidenceChunk[], dynamic: boolean) {
  const byName = new Map(chunks.map((chunk) => [chunk.fileName, chunk] as const));
  const pending = roots.map((chunk) => chunk.fileName);
  const seen = new Set<string>();
  while (pending.length) {
    const name = pending.pop();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    const chunk = byName.get(name);
    if (chunk) pending.push(...chunk.imports, ...(dynamic ? chunk.dynamicImports : []));
  }
  return chunks.filter((chunk) => seen.has(chunk.fileName));
}

function findStaticChunkCycles(chunks: readonly EvidenceChunk[]): string[][] {
  const chunkNames = new Set(chunks.map((chunk) => chunk.fileName));
  const edges = new Map(
    chunks.map((chunk) => [
      chunk.fileName,
      chunk.imports.filter((dependency) => chunkNames.has(dependency)),
    ])
  );
  const indexByName = new Map<string, number>();
  const lowLinkByName = new Map<string, number>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  const cycles: string[][] = [];
  let nextIndex = 0;

  const visit = (name: string) => {
    indexByName.set(name, nextIndex);
    lowLinkByName.set(name, nextIndex);
    nextIndex += 1;
    stack.push(name);
    onStack.add(name);

    for (const dependency of edges.get(name) ?? []) {
      if (!indexByName.has(dependency)) {
        visit(dependency);
        lowLinkByName.set(
          name,
          Math.min(lowLinkByName.get(name)!, lowLinkByName.get(dependency)!)
        );
      } else if (onStack.has(dependency)) {
        lowLinkByName.set(
          name,
          Math.min(lowLinkByName.get(name)!, indexByName.get(dependency)!)
        );
      }
    }

    if (lowLinkByName.get(name) !== indexByName.get(name)) return;
    const component: string[] = [];
    let member: string;
    do {
      member = stack.pop()!;
      onStack.delete(member);
      component.push(member);
    } while (member !== name);
    if (component.length > 1 || (edges.get(name) ?? []).includes(name)) {
      cycles.push(component.sort());
    }
  };

  for (const name of [...chunkNames].sort()) {
    if (!indexByName.has(name)) visit(name);
  }
  return cycles.sort((a, b) => a[0].localeCompare(b[0]));
}

export function assessSharedGrafanaCohort(
  report: BundleEvidence,
  physical: PhysicalPackageEvidence = { packages: [] }
) {
  const moduleOwners = new Map<string, string[]>();
  for (const chunk of report.chunks) {
    for (const moduleId of chunk.modules) {
      const owners = moduleOwners.get(moduleId) ?? [];
      owners.push(chunk.fileName);
      moduleOwners.set(moduleId, owners);
    }
  }
  const invalidDuplicates = [...moduleOwners]
    .filter(([, owners]) => new Set(owners).size > 1)
    .map(([moduleId, owners]) => ({ moduleId, owners: [...new Set(owners)].sort() }))
    .sort((a, b) => a.moduleId.localeCompare(b.moduleId));
  const entryClosure = reachable(report.chunks, report.chunks.filter((chunk) => chunk.isEntry), false);
  const featureChunks = Object.fromEntries(
    PROVIDER_FEATURE_IDS.map((feature) => {
      const wrapper = `<repo>/experiments/bundle/shared-grafana-cohort/features/${feature}.ts`;
      const sources = FEATURE_APPLICATION_SOURCES[feature].map((source) => `<grafana-source>/${source}`);
      return [
        feature,
        report.chunks
          .filter((chunk) => chunk.modules.includes(wrapper) || chunk.modules.some((id) => sources.includes(id)))
          .map((chunk) => chunk.fileName)
          .sort(),
      ];
    })
  ) as Record<(typeof PROVIDER_FEATURE_IDS)[number], string[]>;
  const externalSpecifiers = new Set(report.chunks.flatMap((chunk) => chunk.imports));
  const dependencyTable = Object.fromEntries(
    Object.entries(dependencyPatterns).map(([name, pattern]) => {
      const modules = [...moduleOwners.keys()].filter((id) => pattern.test(id)).sort();
      const owners = [...new Set(modules.flatMap((id) => moduleOwners.get(id) ?? []))].sort();
      const duplicated = modules.some((id) => (moduleOwners.get(id)?.length ?? 0) > 1);
      const hostExternal =
        (name === 'react' && [...externalSpecifiers].some((id) => /^react(?:\/|$)/.test(id))) ||
        (name === 'reactDom' && [...externalSpecifiers].some((id) => /^react-dom(?:\/|$)/.test(id)));
      let status: DependencyStatus = 'NOT_USED';
      if (duplicated) status = 'DUPLICATED_INVALID';
      else if (hostExternal && modules.length === 0) status = 'HOST_EXTERNAL';
      else if (modules.length > 0 && owners.length === 1) status = 'SHARED_ONCE';
      else if (modules.length > 0) status = 'FEATURE_LOCAL';
      return [name, { emittedOwners: owners, modules, status }];
    })
  ) as unknown as Record<keyof typeof dependencyPatterns, {
    readonly emittedOwners: readonly string[];
    readonly modules: readonly string[];
    readonly status: DependencyStatus;
  }>;

  const emittedModules = [...moduleOwners.keys()];
  return {
    applicationSourceOwners: report.categories.grafanaApplication.map((source) => ({
      owners: moduleOwners.get(source) ?? [],
      source,
    })),
    bootstrapApplicationSources: [...new Set(entryClosure.flatMap((chunk) => chunk.modules).filter((id) => id.includes('/public/app/')))].sort(),
    dependencyTable,
    editorAssets: report.assets.filter((asset) => editorAssetPattern.test(asset.fileName)),
    editorModules: emittedModules.filter((id) => editorPattern.test(id)).sort(),
    featureChunks,
    invalidDuplicates,
    physicalPackages: physical.packages,
    staticChunkCycles: findStaticChunkCycles(report.chunks),
    systemJsModules: [...report.categories.systemJs],
  };
}
