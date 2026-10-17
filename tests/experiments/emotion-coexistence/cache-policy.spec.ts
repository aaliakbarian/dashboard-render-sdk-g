// POC / EXPERIMENT / NOT FOR PRODUCTION
import { describe, expect, it } from 'vitest';

import {
  EMOTION_CACHE_KEYS,
  EmotionCacheOwnershipError,
  assertUniqueEmotionCacheOwnership,
} from '../../../experiments/styling/emotion-coexistence/cachePolicy.ts';

describe('Emotion coexistence cache policy', () => {
  it('assigns a distinct key to each independently owned React Emotion cache', () => {
    expect(EMOTION_CACHE_KEYS).toEqual({
      host: 'grsdk-host',
      provider: 'grsdk-provider',
      providerCss: 'css',
    });

    expect(() => assertUniqueEmotionCacheOwnership([
      { key: EMOTION_CACHE_KEYS.host, owner: 'host-react' },
      { key: EMOTION_CACHE_KEYS.provider, owner: 'provider-react' },
    ])).not.toThrow();
  });

  it('rejects same-key ownership before the invalid configuration renders', () => {
    expect(() => assertUniqueEmotionCacheOwnership([
      { key: 'grsdk-conflict', owner: 'host-react' },
      { key: 'grsdk-conflict', owner: 'provider-react' },
    ])).toThrowError(expect.objectContaining({
      code: 'duplicate-emotion-cache-key',
      key: 'grsdk-conflict',
      name: 'EmotionCacheOwnershipError',
      owners: ['host-react', 'provider-react'],
    } satisfies Partial<EmotionCacheOwnershipError>));
  });
});
