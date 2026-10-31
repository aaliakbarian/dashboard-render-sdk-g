import { describe, expect, it } from 'vitest';

import {
  ControlledVisxPortalRootError,
  getControlledVisxPortalRoot,
} from './controlledVisxPortal';

function portalDocument(root?: Record<string, unknown>) {
  const body = {};
  const value = root ? { ...root, parentNode: body } : null;
  return {
    body,
    getElementById: () => value,
  } as unknown as Document;
}

describe('controlled Visx tooltip portal', () => {
  it('accepts only the connected provider-owned body child', () => {
    const document = portalDocument({
      dataset: { dashboardRenderSdkGOwner: 'provider-13' },
      id: 'grafana-portal-container',
      isConnected: true,
    });
    expect(getControlledVisxPortalRoot(document)).toBe(document.getElementById('grafana-portal-container'));
  });

  it.each([
    undefined,
    { dataset: {}, id: 'grafana-portal-container', isConnected: true },
    { dataset: { dashboardRenderSdkGOwner: 'provider-13' }, id: 'wrong', isConnected: true },
    { dataset: { dashboardRenderSdkGOwner: 'provider-13' }, id: 'grafana-portal-container', isConnected: false },
  ])('rejects missing or conflicting roots before allowing an implicit body fallback', (root) => {
    expect(() => getControlledVisxPortalRoot(portalDocument(root))).toThrow(ControlledVisxPortalRootError);
  });
});
