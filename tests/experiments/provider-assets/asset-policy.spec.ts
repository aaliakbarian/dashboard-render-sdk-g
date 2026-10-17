// POC / EXPERIMENT / NOT FOR PRODUCTION
import { describe, expect, it } from 'vitest';

import {
  ProviderAssetContractError,
  logicalAssetUrl,
  normalizeProviderAssetBase,
  validateViewAssetInventory,
  type ProviderAssetInventoryEntry,
} from '../../../experiments/styling/provider-assets/assetPolicy.ts';

const requiredInventory: ProviderAssetInventoryEntry[] = [
  {
    category: 'CSS',
    consumer: 'provider-presentation',
    file: 'assets/provider-assets-a1.css',
    hash: 'sha256-css',
    licenseEvidence: '<repo>/LICENSE',
    loadTiming: 'eager',
    owner: 'provider',
    size: 120,
    sourceCommit: null,
    sourcePackage: 'grafana-react-sdk',
    source: '<repo>/experiments/styling/provider-assets/provider-assets.css',
    sourceVersion: 'unpublished-experiment',
    url: '/app/sdk/assets/provider-assets-a1.css',
  },
  {
    category: 'FONT',
    consumer: 'provider-typography',
    file: 'assets/Inter-Regular-a2.woff2',
    hash: 'sha256-font',
    licenseEvidence: '<grafana-source>/NOTICE.md',
    loadTiming: 'on-css-use',
    owner: 'provider',
    size: 240,
    sourceCommit: '6193dc03311b631b9727b560d24369e683dc396e',
    sourcePackage: 'grafana/grafana',
    source: '<grafana-source>/public/fonts/inter/Inter-Regular.woff2',
    sourceVersion: '13.2.3',
    url: '/app/sdk/assets/Inter-Regular-a2.woff2',
  },
  {
    category: 'ICON',
    consumer: 'grafana-modal-close',
    file: 'provider-assets/build/img/icons/unicons/times.svg',
    hash: 'sha256-icon',
    licenseEvidence: '<grafana-source>/NOTICE.md',
    loadTiming: 'on-overlay-open',
    owner: 'provider',
    size: 80,
    sourceCommit: '6193dc03311b631b9727b560d24369e683dc396e',
    sourcePackage: 'grafana/grafana',
    source: '<grafana-source>/public/img/icons/unicons/times.svg',
    sourceVersion: '13.2.3',
    url: '/app/sdk/provider-assets/build/img/icons/unicons/times.svg',
  },
];
const firstRequiredAsset = requiredInventory[0]!;

describe('provider asset contract', () => {
  it('normalizes root and nested same-origin deployment bases', () => {
    expect(normalizeProviderAssetBase('/provider-assets')).toBe('/provider-assets/');
    expect(normalizeProviderAssetBase('/app/sdk/provider-assets/')).toBe('/app/sdk/provider-assets/');
    expect(logicalAssetUrl('/app/sdk/provider-assets/', 'build/img/icons/unicons/times.svg'))
      .toBe('/app/sdk/provider-assets/build/img/icons/unicons/times.svg');
  });

  it.each([
    'https://cdn.example.test/provider-assets/',
    '//cdn.example.test/provider-assets/',
    '/app/../provider-assets/',
    '/provider-assets/?token=secret',
    '/provider-assets/#fragment',
  ])('rejects an unsafe asset base before provider initialization: %s', (assetBase) => {
    expect(() => normalizeProviderAssetBase(assetBase)).toThrowError(
      expect.objectContaining<Partial<ProviderAssetContractError>>({ code: 'asset.base-invalid' })
    );
  });

  it('accepts a complete attributed view inventory', () => {
    expect(validateViewAssetInventory(requiredInventory)).toEqual({
      categories: ['CSS', 'FONT', 'ICON'],
      count: 3,
      editorOnly: 0,
      unknown: 0,
    });
  });

  it.each([
    ['EDITOR_ONLY', 'asset.editor-forbidden'],
    ['UNKNOWN', 'asset.owner-unknown'],
  ] as const)('rejects %s assets from the view profile', (category, code) => {
    expect(() => validateViewAssetInventory([
      ...requiredInventory,
      { ...firstRequiredAsset, category, file: `assets/${category}.css` },
    ])).toThrowError(expect.objectContaining<Partial<ProviderAssetContractError>>({ code }));
  });

  it('rejects missing hashes and provenance', () => {
    expect(() => validateViewAssetInventory([
      { ...firstRequiredAsset, hash: '', source: '' },
    ])).toThrowError(expect.objectContaining<Partial<ProviderAssetContractError>>({
      code: 'asset.manifest-invalid',
    }));
  });
});
