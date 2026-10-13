// POC / EXPERIMENT / NOT FOR PRODUCTION

export interface EvidenceChunk {
  readonly dynamicImports: readonly string[];
  readonly fileName: string;
  readonly gzipSize: number;
  readonly imports: readonly string[];
  readonly isEntry: boolean;
  readonly modules: readonly string[];
  readonly moduleRenderedBytes?: ReadonlyArray<{
    readonly id: string;
    readonly renderedBytes: number;
  }>;
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
    readonly grafanaInternal: readonly string[];
    readonly systemJs: readonly string[];
  };
  readonly chunks: readonly EvidenceChunk[];
  readonly moduleIds: readonly string[];
}

const EDITOR_IDENTITY =
  /(?:ConfigEditor|QueryEditor|ScenarioEditor|MetaDataInspector|TestInfoTab|components\/.+Editor)/i;
const MONACO_IDENTITY =
  /(?:^|\/)(?:@monaco-editor\/react|monaco-editor)(?:\/|$)|ReactMonacoEditor|\/(?:components\/)?[Mm]onaco\//;
const CODEMIRROR_IDENTITY =
  /(?:^|\/)(?:@codemirror|@uiw\/react-codemirror)(?:\/|$)|\/CodeEditor(?:\.|\/)/i;
const EDITOR_INFRASTRUCTURE_IDENTITY =
  /standardFieldConfigEditorRegistry|\/panel\/suggestions\/|\/types\/suggestions\./i;
const REACT_IMPLEMENTATION_IDENTITY = /\/node_modules\/(?:react|react-dom)\//;

function uniqueSorted(values: Iterable<string>): string[] {
  return [...new Set(values)].sort();
}

function reachableChunks(chunks: readonly EvidenceChunk[]): EvidenceChunk[] {
  const byName = new Map(chunks.map((chunk) => [chunk.fileName, chunk]));
  const pending = chunks.filter((chunk) => chunk.isEntry).map((chunk) => chunk.fileName);
  const visited = new Set<string>();

  while (pending.length > 0) {
    const fileName = pending.pop();
    if (!fileName || visited.has(fileName)) continue;
    visited.add(fileName);
    const chunk = byName.get(fileName);
    if (chunk) pending.push(...chunk.imports, ...chunk.dynamicImports);
  }

  return chunks.filter((chunk) => visited.has(chunk.fileName));
}

export interface TestDataBundleAssessment {
  readonly applicationSources: readonly string[];
  readonly assets: readonly EvidenceAsset[];
  readonly chunkBreakdown: ReadonlyArray<{
    readonly fileName: string;
    readonly gzipSize: number;
    readonly moduleCount: number;
    readonly rawSize: number;
  }>;
  readonly chunkCount: number;
  readonly codeAttribution: {
    readonly grafanaApplication: number;
    readonly grafanaPublishedPackages: number;
    readonly hostPoc: number;
    readonly providerAdapters: number;
    readonly thirdPartyShared: number;
    readonly other: number;
  };
  readonly codeMirrorModules: readonly string[];
  readonly codiconAssets: readonly string[];
  readonly cssAssets: readonly EvidenceAsset[];
  readonly editorModules: readonly string[];
  readonly gzipJsBytes: number;
  readonly moduleCount: number;
  readonly monacoModules: readonly string[];
  readonly rawJsBytes: number;
  readonly reactImplementationModules: readonly string[];
  readonly systemJsModules: readonly string[];
  readonly transformedCandidateEditorInfrastructureModules: readonly string[];
  readonly transformedCandidateMonacoModules: readonly string[];
  readonly transformedModuleCount: number;
}

export function assessTestDataBundle(report: BundleEvidence): TestDataBundleAssessment {
  const chunks = reachableChunks(report.chunks);
  const moduleIds = uniqueSorted(chunks.flatMap((chunk) => chunk.modules));
  const assets = report.assets.filter((asset) => !asset.fileName.startsWith('evidence/'));
  const monacoModules = moduleIds.filter((id) => MONACO_IDENTITY.test(id));
  const codeMirrorModules = moduleIds.filter((id) => CODEMIRROR_IDENTITY.test(id));
  const editorModules = moduleIds.filter((id) => EDITOR_IDENTITY.test(id));
  const renderedModules = chunks.flatMap((chunk) => chunk.moduleRenderedBytes ?? []);
  const transformedModuleIds = uniqueSorted(report.moduleIds);
  const renderedBytes = (predicate: (id: string) => boolean) =>
    renderedModules
      .filter(({ id }) => predicate(id))
      .reduce((total, { renderedBytes }) => total + renderedBytes, 0);
  const isHostPoc = (id: string) =>
    /<repo>\/(?:apps\/poc-host|packages\/(?:poc-compat|poc-grafana-bridge))\//.test(id);
  const isProviderAdapter = (id: string) =>
    id.startsWith('<repo>/experiments/bundle/testdata-runtime-only/');
  const isGrafanaApplication = (id: string) => id.startsWith('<grafana-source>/public/app/');
  const isGrafanaPublished = (id: string) => id.startsWith('<repo>/node_modules/@grafana/');
  const isThirdParty = (id: string) =>
    id.startsWith('<repo>/node_modules/') && !isGrafanaPublished(id);
  const classified = (id: string) =>
    isGrafanaApplication(id) ||
    isGrafanaPublished(id) ||
    isHostPoc(id) ||
    isProviderAdapter(id) ||
    isThirdParty(id);

  return {
    applicationSources: uniqueSorted(moduleIds.filter(isGrafanaApplication)),
    assets,
    chunkBreakdown: chunks
      .map((chunk) => ({
        fileName: chunk.fileName,
        gzipSize: chunk.gzipSize,
        moduleCount: chunk.modules.length,
        rawSize: chunk.rawSize,
      }))
      .sort((a, b) => a.fileName.localeCompare(b.fileName)),
    chunkCount: chunks.length,
    codeAttribution: {
      grafanaApplication: renderedBytes(isGrafanaApplication),
      grafanaPublishedPackages: renderedBytes(isGrafanaPublished),
      hostPoc: renderedBytes(isHostPoc),
      providerAdapters: renderedBytes(isProviderAdapter),
      thirdPartyShared: renderedBytes(isThirdParty),
      other: renderedBytes((id) => !classified(id)),
    },
    codeMirrorModules,
    codiconAssets: assets
      .map((asset) => asset.fileName)
      .filter((fileName) => /codicon/i.test(fileName))
      .sort(),
    cssAssets: assets.filter((asset) => asset.category === 'css'),
    editorModules,
    gzipJsBytes: chunks.reduce((total, chunk) => total + chunk.gzipSize, 0),
    moduleCount: moduleIds.length,
    monacoModules,
    rawJsBytes: chunks.reduce((total, chunk) => total + chunk.rawSize, 0),
    reactImplementationModules: moduleIds.filter((id) =>
      REACT_IMPLEMENTATION_IDENTITY.test(id)
    ),
    systemJsModules: uniqueSorted(report.categories.systemJs),
    transformedCandidateEditorInfrastructureModules: transformedModuleIds.filter((id) =>
      EDITOR_INFRASTRUCTURE_IDENTITY.test(id)
    ),
    transformedCandidateMonacoModules: transformedModuleIds.filter((id) =>
      MONACO_IDENTITY.test(id)
    ),
    transformedModuleCount: transformedModuleIds.length,
  };
}
