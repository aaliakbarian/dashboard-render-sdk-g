import { useLayoutEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

const ROOT_ID = 'grafana-portal-container';
const OWNER = 'provider-13';

export class ControlledVisxPortalRootError extends Error {
  override readonly name = 'ControlledVisxPortalRootError';
  readonly code = 'provider-portal-root-unavailable' as const;
  constructor() {
    super('The controlled provider portal root is unavailable.');
  }
}

export function getControlledVisxPortalRoot(document: Document): HTMLElement {
  const root = document.getElementById(ROOT_ID);
  if (
    !root ||
    root.id !== ROOT_ID ||
    root.dataset.dashboardRenderSdkGOwner !== OWNER ||
    !root.isConnected ||
    root.parentNode !== document.body
  ) {
    throw new ControlledVisxPortalRootError();
  }
  return root;
}

export interface ControlledVisxPortalProps {
  readonly children: NonNullable<ReactNode>;
  readonly zIndex?: number | string;
}

/** Replaces only Visx's implicit body target; observation/rendering remain upstream Visx. */
export default function ControlledVisxPortal({ children, zIndex }: ControlledVisxPortalProps) {
  const [node, setNode] = useState<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const target = document.createElement('div');
    target.dataset.dashboardRenderSdkGOwner = OWNER;
    target.dataset.dashboardRenderSdkGSurface = 'visx-tooltip';
    if (zIndex !== undefined) target.style.zIndex = String(zIndex);
    getControlledVisxPortalRoot(document).appendChild(target);
    setNode(target);
    return () => {
      target.remove();
      setNode(null);
    };
  }, [zIndex]);

  return node ? createPortal(children, node) : null;
}
