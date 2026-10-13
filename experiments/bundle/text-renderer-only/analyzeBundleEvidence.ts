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

const MONACO_IDENTITY = /(?:^|\/)(?:@monaco-editor\/react|monaco-editor)(?:\/|$)|ReactMonacoEditor|\/components\/Monaco\//i;
const CODEMIRROR_IDENTITY = /(?:^|\/)(?:@codemirror|@uiw\/react-codemirror)(?:\/|$)|\/CodeEditor(?:\.|\/)/i;
const TEXT_EDITOR_IDENTITY = /TextPanelEditor/i;
const QUERY_OR_CONFIG_EDITOR_IDENTITY = /(?:Query|Config)Editor(?:\.|\/)/i;
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
    if (!chunk) continue;
    pending.push(...chunk.imports, ...chunk.dynamicImports);
  }

  return chunks.filter((chunk) => visited.has(chunk.fileName));
}

export interface TextBundleAssessment {
  readonly applicationSources: readonly string[];
  readonly assets: readonly EvidenceAsset[];
  readonly chunkCount: number;
  readonly chunks: readonly string[];
  readonly chunkBreakdown: ReadonlyArray<{
    readonly fileName: string;
    readonly gzipSize: number;
    readonly moduleCount: number;
    readonly rawSize: number;
  }>;
  readonly codeMirrorModules: readonly string[];
  readonly codeAttribution: {
    readonly grafanaApplication: number;
    readonly grafanaPublishedPackages: number;
    readonly hostPoc: number;
    readonly rendererAdapters: number;
    readonly thirdPartyShared: number;
    readonly other: number;
  };
  readonly codiconAssets: readonly string[];
  readonly cssAssets: readonly EvidenceAsset[];
  readonly editorModules: readonly string[];
  readonly gzipJsBytes: number;
  readonly moduleCount: number;
  readonly pocHostModules: readonly string[];
  readonly monacoModules: readonly string[];
  readonly queryOrConfigEditorModules: readonly string[];
  readonly rawJsBytes: number;
  readonly reactImplementationModules: readonly string[];
  readonly systemJsModules: readonly string[];
  readonly textPanelEditorModules: readonly string[];
}

export function assessTextBundle(report: BundleEvidence): TextBundleAssessment {
  const chunks = reachableChunks(report.chunks);
  const moduleIds = uniqueSorted(chunks.flatMap((chunk) => chunk.modules));
  const assets = report.assets.filter((asset) => !asset.fileName.startsWith('evidence/'));
  const monacoModules = moduleIds.filter((id) => MONACO_IDENTITY.test(id));
  const codeMirrorModules = moduleIds.filter((id) => CODEMIRROR_IDENTITY.test(id));
  const textPanelEditorModules = moduleIds.filter((id) => TEXT_EDITOR_IDENTITY.test(id));
  const queryOrConfigEditorModules = moduleIds.filter((id) => QUERY_OR_CONFIG_EDITOR_IDENTITY.test(id));
  const renderedModules = chunks.flatMap((chunk) => chunk.moduleRenderedBytes ?? []);
  const renderedBytes = (predicate: (id: string) => boolean) =>
    renderedModules
      .filter(({ id }) => predicate(id))
      .reduce((total, { renderedBytes }) => total + renderedBytes, 0);
  const isHostPoc = (id: string) =>
    /<repo>\/(?:apps\/poc-host|packages\/(?:poc-compat|poc-grafana-bridge))\//.test(id);
  const isRendererAdapter = (id: string) =>
    id.startsWith('<repo>/experiments/bundle/text-renderer-only/');
  const isGrafanaApplication = (id: string) => id.startsWith('<grafana-source>/public/app/');
  const isGrafanaPublished = (id: string) => id.startsWith('<repo>/node_modules/@grafana/');
  const isThirdParty = (id: string) =>
    id.startsWith('<repo>/node_modules/') && !isGrafanaPublished(id);
  const classified = (id: string) =>
    isGrafanaApplication(id) ||
    isGrafanaPublished(id) ||
    isHostPoc(id) ||
    isRendererAdapter(id) ||
    isThirdParty(id);

  return {
    applicationSources: uniqueSorted(
      moduleIds.filter((id) => report.categories.grafanaApplication.includes(id))
    ),
    assets,
    chunkCount: chunks.length,
    chunks: chunks.map((chunk) => chunk.fileName).sort(),
    chunkBreakdown: chunks
      .map((chunk) => ({
        fileName: chunk.fileName,
        gzipSize: chunk.gzipSize,
        moduleCount: chunk.modules.length,
        rawSize: chunk.rawSize,
      }))
      .sort((a, b) => a.fileName.localeCompare(b.fileName)),
    codeMirrorModules,
    codeAttribution: {
      grafanaApplication: renderedBytes(isGrafanaApplication),
      grafanaPublishedPackages: renderedBytes(isGrafanaPublished),
      hostPoc: renderedBytes(isHostPoc),
      rendererAdapters: renderedBytes(isRendererAdapter),
      thirdPartyShared: renderedBytes(isThirdParty),
      other: renderedBytes((id) => !classified(id)),
    },
    codiconAssets: assets
      .map((asset) => asset.fileName)
      .filter((fileName) => /codicon/i.test(fileName))
      .sort(),
    cssAssets: assets.filter((asset) => asset.category === 'css'),
    editorModules: uniqueSorted([
      ...monacoModules,
      ...codeMirrorModules,
      ...textPanelEditorModules,
      ...queryOrConfigEditorModules,
    ]),
    gzipJsBytes: chunks.reduce((total, chunk) => total + chunk.gzipSize, 0),
    moduleCount: moduleIds.length,
    monacoModules,
    pocHostModules: moduleIds.filter(isHostPoc),
    queryOrConfigEditorModules,
    rawJsBytes: chunks.reduce((total, chunk) => total + chunk.rawSize, 0),
    reactImplementationModules: moduleIds.filter((id) => REACT_IMPLEMENTATION_IDENTITY.test(id)),
    systemJsModules: uniqueSorted(report.categories.systemJs),
    textPanelEditorModules,
  };
}
