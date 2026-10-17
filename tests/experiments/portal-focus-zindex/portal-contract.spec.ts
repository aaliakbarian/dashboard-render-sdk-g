// POC / EXPERIMENT / NOT FOR PRODUCTION
import { describe, expect, it } from 'vitest';

import {
  PortalContractError,
  validateProviderPortalRoot,
} from '../../../experiments/styling/portal-focus-zindex/portalContract.ts';
import {
  resolveOverlayBand,
  type OverlayPolicyInput,
} from '../../../experiments/styling/portal-focus-zindex/zIndexPolicy.ts';

function portalElement(overrides: Partial<{
  id: string;
  parent: 'body' | 'other';
  provider: string;
  runtime: string;
  surface: string;
}> = {}) {
  return {
    id: overrides.id ?? 'grafana-portal-container',
    parent: overrides.parent ?? 'body',
    provider: overrides.provider ?? 'grafana-13.2.3',
    runtime: overrides.runtime ?? 'portal-focus-zindex-v1',
    surface: overrides.surface ?? 'portal',
  };
}

describe('provider portal admission', () => {
  it('accepts an explicitly marked controlled body child', () => {
    expect(validateProviderPortalRoot(portalElement())).toEqual({
      controlledBodyChild: true,
      provider: 'grafana-13.2.3',
      runtime: 'portal-focus-zindex-v1',
    });
  });

  it('rejects an implicit document.body fallback', () => {
    expect(() => validateProviderPortalRoot(undefined)).toThrowError(
      expect.objectContaining<Partial<PortalContractError>>({ code: 'portal.body-fallback' })
    );
  });

  it('rejects roots with incompatible ownership markers', () => {
    expect(() => validateProviderPortalRoot(portalElement({ provider: 'another-provider' }))).toThrowError(
      expect.objectContaining<Partial<PortalContractError>>({ code: 'portal.root-conflict' })
    );
  });
});

describe('overlay policy candidates', () => {
  const cases: Array<[OverlayPolicyInput, { portal: number; popover: number; modal: number; nested: number }]> = [
    [{ model: 'fixed' }, { portal: 1061, popover: 1070, modal: 1080, nested: 1090 }],
    [{ model: 'provider-token', providerBase: 2000 }, { portal: 2000, popover: 2010, modal: 2020, nested: 2030 }],
    [{ model: 'host-base', hostBase: 4000 }, { portal: 4000, popover: 4010, modal: 4020, nested: 4030 }],
  ];

  it.each(cases)('resolves %o without unbounded escalation', (input, expected) => {
    expect(resolveOverlayBand(input)).toEqual(expected);
  });

  it('rejects missing or unsafe configurable bases', () => {
    expect(() => resolveOverlayBand({ model: 'host-base' })).toThrow(/host base/i);
    expect(() => resolveOverlayBand({ model: 'provider-token', providerBase: 1_000_000 })).toThrow(/bounded/i);
  });
});
