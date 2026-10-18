// POC / EXPERIMENT / NOT FOR PRODUCTION
export interface TransformationEvidenceChunk {
  readonly fileName: string;
  readonly gzipSize: number;
  readonly modules: readonly string[];
  readonly rawSize: number;
}

export interface TransformationBundleEvidence {
  readonly assets: ReadonlyArray<{
    readonly category: string;
    readonly fileName: string;
    readonly gzipSize: number;
    readonly rawSize: number;
  }>;
  readonly categories: {
    readonly grafanaApplication: readonly string[];
  };
  readonly chunks: readonly TransformationEvidenceChunk[];
  readonly moduleIds: readonly string[];
}

const operatorSuffix =
  '/node_modules/@grafana/data/dist/esm/transformations/transformers/renameByRegex.mjs';

export function assessTransformationCapabilityBundle(report: TransformationBundleEvidence) {
  const operatorModules = report.moduleIds.filter((id) => id.endsWith(operatorSuffix));
  const operatorChunks = report.chunks
    .filter((chunk) => chunk.modules.some((id) => id.endsWith(operatorSuffix)))
    .map((chunk) => ({
      fileName: chunk.fileName,
      gzipBytes: chunk.gzipSize,
      rawBytes: chunk.rawSize,
      transformId: 'renameByRegex',
    }));
  return {
    broadApplicationRegistryModules: report.moduleIds.filter((id) =>
      /public\/app\/features\/transformers\/(?:standardTransformers|init)/.test(id)
    ),
    codiconAssets: report.assets.filter((asset) => /codicon/i.test(asset.fileName)),
    editorModules: report.moduleIds.filter((id) => /transformers\/.*(?:Editor|editor)/.test(id)),
    grafanaApplicationModules: [...report.categories.grafanaApplication],
    moduleCount: report.moduleIds.length,
    monacoModules: report.moduleIds.filter((id) => /monaco/i.test(id)),
    operatorChunks,
    operatorModules,
    previewImages: report.assets.filter((asset) =>
      /transform|preview/i.test(asset.fileName) && /\.(?:svg|png|jpe?g|webp)$/i.test(asset.fileName)
    ),
    unrelatedTransformerModules: report.moduleIds.filter(
      (id) =>
        id.includes('/node_modules/@grafana/data/dist/esm/transformations/transformers/') &&
        !id.endsWith('/renameByRegex.mjs') &&
        !id.endsWith('/ids.mjs')
    ),
  };
}
