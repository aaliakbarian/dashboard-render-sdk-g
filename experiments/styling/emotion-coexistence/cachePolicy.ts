// POC / EXPERIMENT / NOT FOR PRODUCTION
export const EMOTION_CACHE_KEYS = Object.freeze({
  host: 'grsdk-host',
  provider: 'grsdk-provider',
  providerCss: 'css',
});

export type EmotionCacheOwner = 'host-react' | 'provider-react';

export interface EmotionCacheOwnership {
  readonly key: string;
  readonly owner: EmotionCacheOwner;
}

export class EmotionCacheOwnershipError extends Error {
  readonly code = 'duplicate-emotion-cache-key';

  constructor(
    readonly key: string,
    readonly owners: readonly EmotionCacheOwner[],
  ) {
    super(`Independent Emotion owners cannot share cache key ${key}.`);
    this.name = 'EmotionCacheOwnershipError';
  }
}

export function assertUniqueEmotionCacheOwnership(ownership: readonly EmotionCacheOwnership[]): void {
  const ownersByKey = new Map<string, EmotionCacheOwner[]>();
  for (const entry of ownership) {
    const owners = ownersByKey.get(entry.key) ?? [];
    owners.push(entry.owner);
    ownersByKey.set(entry.key, owners);
  }

  for (const [key, owners] of ownersByKey) {
    if (new Set(owners).size > 1) throw new EmotionCacheOwnershipError(key, owners);
  }
}
