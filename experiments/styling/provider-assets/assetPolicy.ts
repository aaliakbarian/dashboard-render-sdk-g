// POC / EXPERIMENT / NOT FOR PRODUCTION
export type ProviderAssetCategory =
  | 'CSS'
  | 'EDITOR_ONLY'
  | 'FONT'
  | 'ICON'
  | 'IMAGE'
  | 'PORTAL_ASSET'
  | 'SVG'
  | 'UNKNOWN'
  | 'VISUALIZATION_ASSET';

export interface ProviderAssetInventoryEntry {
  readonly category: ProviderAssetCategory;
  readonly consumer: string;
  readonly file: string;
  readonly hash: string;
  readonly licenseEvidence: string;
  readonly loadTiming: string;
  readonly owner: 'host' | 'provider';
  readonly size: number;
  readonly sourceCommit: string | null;
  readonly sourcePackage: string;
  readonly source: string;
  readonly sourceVersion: string;
  readonly url: string;
}

export type ProviderAssetErrorCode =
  | 'asset.base-invalid'
  | 'asset.editor-forbidden'
  | 'asset.manifest-invalid'
  | 'asset.owner-unknown';

export class ProviderAssetContractError extends Error {
  constructor(readonly code: ProviderAssetErrorCode, message: string) {
    super(message);
    this.name = 'ProviderAssetContractError';
  }
}

export function normalizeProviderAssetBase(input: string): string {
  if (
    !input.startsWith('/') ||
    input.startsWith('//') ||
    input.includes('..') ||
    input.includes('?') ||
    input.includes('#') ||
    /^[a-z][a-z\d+.-]*:/i.test(input)
  ) {
    throw new ProviderAssetContractError('asset.base-invalid', 'Provider asset base must be a normalized same-origin path.');
  }
  return input.endsWith('/') ? input : `${input}/`;
}

export function logicalAssetUrl(base: string, relativePath: string): string {
  const normalized = normalizeProviderAssetBase(base);
  if (!relativePath || relativePath.startsWith('/') || relativePath.includes('..')) {
    throw new ProviderAssetContractError('asset.base-invalid', 'Logical asset path must remain beneath the provider asset base.');
  }
  return `${normalized}${relativePath}`;
}

export function validateViewAssetInventory(inventory: readonly ProviderAssetInventoryEntry[]) {
  for (const entry of inventory) {
    if (entry.category === 'EDITOR_ONLY') {
      throw new ProviderAssetContractError('asset.editor-forbidden', `Editor asset is forbidden: ${entry.file}`);
    }
    if (entry.category === 'UNKNOWN') {
      throw new ProviderAssetContractError('asset.owner-unknown', `Asset ownership is unknown: ${entry.file}`);
    }
    if (
      !entry.file || !entry.hash || !entry.licenseEvidence || !entry.source || !entry.sourcePackage ||
      !entry.sourceVersion || !entry.url || !['host', 'provider'].includes(entry.owner) || entry.size < 0
    ) {
      throw new ProviderAssetContractError('asset.manifest-invalid', `Asset inventory entry is incomplete: ${entry.file || '<missing>'}`);
    }
  }
  return {
    categories: [...new Set(inventory.map((entry) => entry.category))].sort(),
    count: inventory.length,
    editorOnly: inventory.filter((entry) => entry.category === 'EDITOR_ONLY').length,
    unknown: inventory.filter((entry) => entry.category === 'UNKNOWN').length,
  };
}
