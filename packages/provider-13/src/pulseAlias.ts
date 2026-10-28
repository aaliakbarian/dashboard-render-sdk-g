/** Shared private DTO/runtime contract; no template evaluation or runtime loading. */
export function isGrafana13PulseAlias(value: unknown): value is string {
  return typeof value === 'string' && /^[\x20-\x7e]{0,256}$/.test(value) && !/\$|\[\[/.test(value);
}
