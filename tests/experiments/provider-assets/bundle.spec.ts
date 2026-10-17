// POC / EXPERIMENT / NOT FOR PRODUCTION
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

interface AssetEvidence {
  readonly inventory: Array<{
    category: string;
    file: string;
    hash: string;
    licenseEvidence: string;
    owner: string;
    source: string;
    sourcePackage: string;
    sourceVersion: string;
    url: string;
  }>;
  readonly profile: string;
  readonly cssUrls: string[];
  readonly forbiddenEditorAssets: string[];
  readonly externalUrls: string[];
}

function load(name: 'root' | 'nested') {
  const path = process.env[`PROVIDER_ASSET_${name.toUpperCase()}_EVIDENCE`];
  if (!path) throw new Error(`${name} asset evidence path is required.`);
  return JSON.parse(readFileSync(path, 'utf8')) as AssetEvidence;
}

describe('provider asset artifacts', () => {
  it('emits an exact local view-only asset inventory for root and nested profiles', () => {
    const root = load('root');
    const nested = load('nested');
    for (const [profile, evidence] of [['root', root], ['nested', nested]] as const) {
      expect(evidence.profile).toBe(profile);
      expect(evidence.forbiddenEditorAssets).toEqual([]);
      expect(evidence.externalUrls).toEqual([]);
      expect(evidence.inventory.some((entry) => entry.category === 'FONT' && /Inter-Regular-.*\.woff2$/.test(entry.file))).toBe(true);
      expect(evidence.inventory.some((entry) => entry.category === 'FONT' && /Inter-Medium-.*\.woff2$/.test(entry.file))).toBe(true);
      expect(evidence.inventory.some((entry) => entry.category === 'ICON' && entry.file.endsWith('img/icons/unicons/times.svg'))).toBe(true);
      expect(evidence.inventory.some((entry) => entry.category === 'VISUALIZATION_ASSET' && entry.source.includes('uPlot.min.css'))).toBe(true);
      expect(evidence.inventory.every((entry) => entry.hash.startsWith('sha256-'))).toBe(true);
      expect(evidence.inventory.every((entry) => entry.licenseEvidence && entry.sourcePackage && entry.sourceVersion)).toBe(true);
      expect(evidence.inventory.every((entry) => entry.owner === 'host' || entry.owner === 'provider')).toBe(true);
    }
    expect(nested.cssUrls.every((url) => !url.startsWith('/assets/'))).toBe(true);
    expect(nested.inventory.filter((entry) => entry.category !== 'CSS').every((entry) => entry.url.startsWith('/app/sdk/'))).toBe(true);
  });
});
