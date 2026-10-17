// POC / EXPERIMENT / NOT FOR PRODUCTION
export type OverlayPolicyModel = 'fixed' | 'provider-token' | 'host-base';

export interface OverlayPolicyInput {
  readonly hostBase?: number;
  readonly model: OverlayPolicyModel;
  readonly providerBase?: number;
}

export interface OverlayBand {
  readonly portal: number;
  readonly popover: number;
  readonly modal: number;
  readonly nested: number;
}

const MAX_CONFIGURABLE_BASE = 100_000;

function boundedBase(value: number | undefined, owner: 'host' | 'provider') {
  if (value === undefined) throw new Error(`${owner} base is required for this overlay policy.`);
  if (!Number.isInteger(value) || value < 0 || value > MAX_CONFIGURABLE_BASE) {
    throw new Error(`${owner} base must be a bounded non-negative integer.`);
  }
  return value;
}

export function resolveOverlayBand(input: OverlayPolicyInput): OverlayBand {
  const base = input.model === 'fixed'
    ? 1061
    : input.model === 'provider-token'
      ? boundedBase(input.providerBase, 'provider')
      : boundedBase(input.hostBase, 'host');
  return {
    portal: base,
    popover: base + (input.model === 'fixed' ? 9 : 10),
    modal: base + (input.model === 'fixed' ? 19 : 20),
    nested: base + (input.model === 'fixed' ? 29 : 30),
  };
}
