// POC / EXPERIMENT / NOT FOR PRODUCTION
export type StrictCspSurfaceUse = 'DIAGNOSTIC_ONLY' | 'NOT_USED' | 'UNKNOWN' | 'USED';

export const STRICT_CSP_SURFACE_INVENTORY = Object.freeze({
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
} satisfies Record<string, StrictCspSurfaceUse>);

export class StrictCspContractError extends Error {
  override readonly name = 'StrictCspContractError';
  readonly code = 'csp.nonce-invalid';
}

export function normalizeStrictCspNonce(input: string): string {
  if (input.length < 16 || !/^[A-Za-z0-9+/_-]+={0,2}$/.test(input)) {
    throw new StrictCspContractError('The strict-CSP nonce must be a base64/base64url token of at least 16 characters.');
  }
  return input;
}

export function buildStrictCspPolicy(inputNonce: string): string {
  const nonce = normalizeStrictCspNonce(inputNonce);
  return [
    "default-src 'none'",
    "script-src 'self' 'report-sample'",
    "script-src-attr 'none'",
    `style-src 'self' 'nonce-${nonce}'`,
    `style-src-elem 'self' 'nonce-${nonce}'`,
    "style-src-attr 'none'",
    "font-src 'self'",
    "img-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "worker-src 'none'",
    "media-src 'none'",
    "form-action 'none'",
  ].join('; ');
}
