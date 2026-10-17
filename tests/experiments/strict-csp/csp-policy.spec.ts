// POC / EXPERIMENT / NOT FOR PRODUCTION
import { describe, expect, it } from 'vitest';

import {
  STRICT_CSP_SURFACE_INVENTORY,
  StrictCspContractError,
  buildStrictCspPolicy,
  normalizeStrictCspNonce,
} from '../../../experiments/security/strict-csp/cspPolicy.ts';

function directives(policy: string) {
  return Object.fromEntries(policy.split(';').map((part) => part.trim()).filter(Boolean).map((part) => {
    const [name, ...values] = part.split(/\s+/);
    return [name, values];
  }));
}

describe('strict CSP experiment policy', () => {
  it('separates script, style-element, and style-attribute authority without broad sources', () => {
    const policy = buildStrictCspPolicy('grsdkCspNonce20261017');
    const parsed = directives(policy);

    expect(parsed).toMatchObject({
      'base-uri': ["'none'"],
      'connect-src': ["'self'"],
      'default-src': ["'none'"],
      'font-src': ["'self'"],
      'form-action': ["'none'"],
      'frame-src': ["'none'"],
      'img-src': ["'self'"],
      'media-src': ["'none'"],
      'object-src': ["'none'"],
      'script-src': ["'self'", "'report-sample'"],
      'script-src-attr': ["'none'"],
      'style-src-attr': ["'none'"],
      'worker-src': ["'none'"],
    });
    expect(parsed['style-src']).toEqual(["'self'", "'nonce-grsdkCspNonce20261017'"]);
    expect(parsed['style-src-elem']).toEqual(["'self'", "'nonce-grsdkCspNonce20261017'"]);
    expect(policy).not.toMatch(/unsafe-eval/);
    expect(policy).not.toMatch(/unsafe-inline/);
    expect(parsed['script-src']).not.toContain("'unsafe-inline'");
    expect(policy).not.toMatch(/https?:|data:|blob:/);
  });

  it('rejects a missing or syntactically unsafe nonce before policy construction', () => {
    for (const nonce of ['', 'short', 'contains space', `quote'break`, '<markup>']) {
      expect(() => normalizeStrictCspNonce(nonce), nonce).toThrowError(StrictCspContractError);
    }
    expect(normalizeStrictCspNonce('A9-_+/bcdefghijklmno==')).toBe('A9-_+/bcdefghijklmno==');
  });

  it('declares every requested CSP surface as used, unused, or diagnostic-only', () => {
    expect(STRICT_CSP_SURFACE_INVENTORY).toEqual({
      baseUri: 'NOT_USED',
      blobUrl: 'NOT_USED',
      connectFetch: 'USED',
      dataUrl: 'NOT_USED',
      evalNewFunction: 'DIAGNOSTIC_ONLY',
      font: 'USED',
      formAction: 'NOT_USED',
      frame: 'NOT_USED',
      imageSvg: 'USED',
      inlineEventHandler: 'DIAGNOSTIC_ONLY',
      media: 'NOT_USED',
      object: 'NOT_USED',
      script: 'USED',
      styleAttribute: 'USED',
      styleElement: 'USED',
      worker: 'NOT_USED',
    });
  });
});
