export interface Grafana13ProviderElement {
  dataset: Record<string, string | undefined>;
  id: string;
  readonly isConnected: boolean;
  parentNode?: unknown;
  textContent: string;
  remove(): void;
  setAttribute(name: string, value: string): void;
}

export interface Grafana13ProviderDocument {
  readonly body: { appendChild(element: Grafana13ProviderElement): unknown };
  readonly head: { appendChild(element: Grafana13ProviderElement): unknown };
  createElement(tagName: string): Grafana13ProviderElement;
  getElementById(id: string): Grafana13ProviderElement | null;
}

export interface Grafana13ProviderResourceLease {
  readonly portalRoot: Grafana13ProviderElement;
  readonly styleElement: Grafana13ProviderElement;
  release(): void;
}

export class Grafana13ProviderResourceConflictError extends Error {
  override readonly name = 'Grafana13ProviderResourceConflictError';
  readonly code = 'provider-resource-conflict' as const;
  constructor() { super('A provider portal or style identifier is owned by another page resource.'); }
}

const STYLE_TEXT = `
[data-dashboard-render-sdk-g-surface] { box-sizing: border-box; color-scheme: light; }
[data-dashboard-render-sdk-g-surface] *, [data-dashboard-render-sdk-g-surface] *::before, [data-dashboard-render-sdk-g-surface] *::after { box-sizing: border-box; }
[data-dashboard-render-sdk-g-surface] .dashboard-render-sdk-g-not-supported { background: #fff; color: #1f1f20; display: flex; flex-direction: column; height: 100%; min-height: 0; padding: 12px; }
`.trim();

const PORTAL_ID = 'grafana-portal-container';
const STYLE_ID = 'dashboard-render-sdk-g-styles';
const OWNER = 'provider-13';

/**
 * Owns the provider-lifetime Grafana UI portal lookup target and scoped style
 * element. The current Text-only slice creates no portal children. A future
 * overlay surface must add real dashboard-instance routing/ownership; an
 * unused per-instance child here would not redirect Grafana UI portals.
 */
export function createGrafana13ProviderResourceManager(document: Grafana13ProviderDocument) {
  let portalRoot: Grafana13ProviderElement | undefined;
  let styleElement: Grafana13ProviderElement | undefined;
  let references = 0;

  function validate(
    element: Grafana13ProviderElement,
    id: string,
    parent: unknown
  ): void {
    if (
      document.getElementById(id) !== element ||
      element.id !== id ||
      element.dataset.dashboardRenderSdkGOwner !== OWNER ||
      element.isConnected !== true ||
      element.parentNode !== parent
    ) {
      throw new Grafana13ProviderResourceConflictError();
    }
  }

  return {
    acquire(): Grafana13ProviderResourceLease {
      const currentPortal = document.getElementById(PORTAL_ID);
      const currentStyle = document.getElementById(STYLE_ID);
      if (portalRoot) validate(portalRoot, PORTAL_ID, document.body);
      else if (currentPortal) validate(currentPortal, PORTAL_ID, document.body);
      if (styleElement) validate(styleElement, STYLE_ID, document.head);
      else if (currentStyle) validate(currentStyle, STYLE_ID, document.head);

      portalRoot ??= currentPortal ?? undefined;
      if (!portalRoot) {
        portalRoot = document.createElement('div');
        portalRoot.id = PORTAL_ID;
        portalRoot.dataset.dashboardRenderSdkGOwner = OWNER;
        document.body.appendChild(portalRoot);
        validate(portalRoot, PORTAL_ID, document.body);
      }
      styleElement ??= currentStyle ?? undefined;
      if (!styleElement) {
        styleElement = document.createElement('style');
        styleElement.id = STYLE_ID;
        styleElement.dataset.dashboardRenderSdkGOwner = OWNER;
        styleElement.textContent = STYLE_TEXT;
        document.head.appendChild(styleElement);
        validate(styleElement, STYLE_ID, document.head);
      }
      references += 1;
      let active = true;
      const acquiredPortal = portalRoot;
      const acquiredStyle = styleElement;
      return {
        portalRoot: acquiredPortal,
        styleElement: acquiredStyle,
        release() {
          if (!active) return;
          active = false;
          references = Math.max(0, references - 1);
        },
      };
    },
    inspect() { return { references }; },
  };
}
