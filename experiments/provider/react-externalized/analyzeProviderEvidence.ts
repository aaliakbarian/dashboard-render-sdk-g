// POC / EXPERIMENT / NOT FOR PRODUCTION
import { FEATURE_APPLICATION_SOURCES } from '../../bundle/shared-grafana-cohort/sourceIdentity.ts';
import { REACT_EXTERNALS } from './compatibility.ts';

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

const unique = (values: readonly string[]) => [...new Set(values)].sort();

function total(report: BundleEvidence) {
  const entries = [...report.chunks, ...report.assets];
  return {
    gzip: entries.reduce((sum, entry) => sum + entry.gzipSize, 0),
    raw: entries.reduce((sum, entry) => sum + entry.rawSize, 0),
  };
}

export function assessReactExternalizedProvider(
  report: BundleEvidence,
  experimentD?: BundleEvidence
) {
  const emittedModules = unique(report.chunks.flatMap((chunk) => chunk.modules));
  const owners = new Map<string, string[]>();
  for (const chunk of report.chunks) {
    for (const moduleId of chunk.modules) {
      owners.set(moduleId, [...(owners.get(moduleId) ?? []), chunk.fileName]);
    }
  }
  const matchingOwners = (pattern: RegExp) => unique(
    emittedModules.filter((moduleId) => pattern.test(moduleId)).flatMap((moduleId) => owners.get(moduleId) ?? [])
  );
  const featureOwners = Object.fromEntries(
    Object.entries(FEATURE_APPLICATION_SOURCES).map(([feature, sources]) => [
      feature,
      unique(sources.flatMap((source) => owners.get(`<grafana-source>/${source}`) ?? [])),
    ])
  ) as Record<keyof typeof FEATURE_APPLICATION_SOURCES, string[]>;
  const providerSize = total(report);
  const baselineSize = experimentD ? total(experimentD) : providerSize;
  const allImports = unique(report.chunks.flatMap((chunk) => chunk.imports));
  const bootstrap = report.chunks.find((chunk) => chunk.isEntry);

  return {
    bundledImplementations: {
      jsxDevRuntime: emittedModules.filter((moduleId) => /node_modules\/react\/(?:cjs\/)?react-jsx-dev-runtime/.test(moduleId)),
      jsxRuntime: emittedModules.filter((moduleId) => /node_modules\/react\/(?:cjs\/)?react-jsx-runtime/.test(moduleId)),
      react: emittedModules.filter((moduleId) => /node_modules\/react\//.test(moduleId)),
      reactDom: emittedModules.filter((moduleId) => /node_modules\/react-dom\//.test(moduleId)),
    },
    configuredExternals: [...REACT_EXTERNALS],
    bootstrap: bootstrap ? {
      dynamicImports: [...bootstrap.dynamicImports],
      fileName: bootstrap.fileName,
      modules: [...bootstrap.modules],
    } : undefined,
    featureOwners,
    invalidDuplicateOwners: [...owners]
      .filter(([, chunkOwners]) => new Set(chunkOwners).size > 1)
      .map(([moduleId, chunkOwners]) => ({ moduleId, owners: unique(chunkOwners) })),
    providerSize,
    referencedExternals: allImports.filter((specifier) =>
      REACT_EXTERNALS.some((external) => specifier === external || specifier.startsWith(`${external}/`)) ||
      specifier === 'react-dom/client'
    ),
    sharedOwners: {
      emotion: matchingOwners(/<repo>\/node_modules\/@emotion\//),
      grafana: matchingOwners(/<repo>\/node_modules\/@grafana\/(?:data|ui|runtime|schema|i18n|e2e-selectors)\//),
      rxjs: matchingOwners(/<repo>\/node_modules\/rxjs\//),
      scenes: matchingOwners(/<repo>\/node_modules\/@grafana\/scenes\//),
      uplot: matchingOwners(/<repo>\/node_modules\/uplot\//),
    },
    sizeDelta: {
      gzip: providerSize.gzip - baselineSize.gzip,
      raw: providerSize.raw - baselineSize.raw,
    },
    systemJsModules: [...report.categories.systemJs],
  };
}

export function assessHostReactOwner(report: BundleEvidence) {
  const implementationPatterns = {
    jsxDevRuntime: /node_modules\/react\/(?:cjs\/)?react-jsx-dev-runtime/,
    jsxRuntime: /node_modules\/react\/(?:cjs\/)?react-jsx-runtime/,
    react: /node_modules\/react\//,
    reactDom: /node_modules\/react-dom\//,
  } as const;
  const ownersFor = (pattern: RegExp) => unique(report.chunks
    .filter((chunk) => chunk.modules.some((moduleId) => pattern.test(moduleId)))
    .map((chunk) => chunk.fileName));

  return {
    implementationModules: Object.fromEntries(
      Object.entries(implementationPatterns).map(([key, pattern]) => [
        key,
        unique(report.moduleIds.filter((moduleId) => pattern.test(moduleId))),
      ])
    ) as Record<keyof typeof implementationPatterns, string[]>,
    implementationOwners: Object.fromEntries(
      Object.entries(implementationPatterns).map(([key, pattern]) => [key, ownersFor(pattern)])
    ) as Record<keyof typeof implementationPatterns, string[]>,
  };
}
