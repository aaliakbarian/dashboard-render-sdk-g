// POC / EXPERIMENT / NOT FOR PRODUCTION
export type PortalContractErrorCode = 'portal.body-fallback' | 'portal.root-conflict';

export class PortalContractError extends Error {
  constructor(readonly code: PortalContractErrorCode, message: string) {
    super(message);
    this.name = 'PortalContractError';
  }
}

export interface ProviderPortalIdentity {
  readonly id: string;
  readonly parent: 'body' | 'other';
  readonly provider: string;
  readonly runtime: string;
  readonly surface: string;
}

const EXPECTED_PROVIDER = 'grafana-13.2.3';
const EXPECTED_RUNTIME = 'portal-focus-zindex-v1';

export function validateProviderPortalRoot(root: ProviderPortalIdentity | undefined) {
  if (!root) {
    throw new PortalContractError(
      'portal.body-fallback',
      'The provider portal root must exist before an overlay can open; document.body fallback is forbidden.'
    );
  }
  if (
    root.id !== 'grafana-portal-container' ||
    root.provider !== EXPECTED_PROVIDER ||
    root.runtime !== EXPECTED_RUNTIME ||
    root.surface !== 'portal'
  ) {
    throw new PortalContractError(
      'portal.root-conflict',
      `The portal root has incompatible ownership markers: ${JSON.stringify(root)}.`
    );
  }
  return {
    controlledBodyChild: root.parent === 'body',
    provider: root.provider,
    runtime: root.runtime,
  } as const;
}

export function inspectProviderPortalRoot(root: HTMLElement | null): ProviderPortalIdentity | undefined {
  if (!root) return undefined;
  return {
    id: root.id,
    parent: root.parentElement === document.body ? 'body' : 'other',
    provider: root.dataset.grsdkProvider ?? '',
    runtime: root.dataset.grsdkRuntime ?? '',
    surface: root.dataset.grsdkSurface ?? '',
  };
}
