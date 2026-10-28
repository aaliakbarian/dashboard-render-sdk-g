import { describe, expect, it } from 'vitest';

import {
  createGrafana13ProviderResourceManager,
  Grafana13ProviderResourceConflictError,
} from './resources';

function documentWith(existing: Array<{ readonly id: string; readonly owner?: string }> = []) {
  const byId = new Map<string, any>();
  const create = (tagName: string) => ({
    dataset: {} as Record<string, string | undefined>, id: '', isConnected: false,
    parentNode: undefined as unknown, tagName, textContent: '',
    remove() { byId.delete(this.id); this.isConnected = false; this.parentNode = undefined; }, setAttribute() {},
  });
  const body = { appendChild(element: any) { element.isConnected = true; element.parentNode = body; byId.set(element.id, element); } };
  const head = { appendChild(element: any) { element.isConnected = true; element.parentNode = head; byId.set(element.id, element); } };
  for (const item of existing) {
    const element = create('div');
    element.id = item.id;
    if (item.owner) element.dataset.dashboardRenderSdkGOwner = item.owner;
    element.isConnected = true;
    element.parentNode = item.id === 'dashboard-render-sdk-g-styles' ? head : body;
    byId.set(item.id, element);
  }
  return {
    body,
    createElement: create,
    getElementById(id: string) { return byId.get(id) ?? null; },
    head,
    replace(id: string, owner = 'provider-13') {
      const element = create(id === 'dashboard-render-sdk-g-styles' ? 'style' : 'div');
      element.id = id;
      element.dataset.dashboardRenderSdkGOwner = owner;
      (id === 'dashboard-render-sdk-g-styles' ? head : body).appendChild(element);
      return element;
    },
  };
}

describe('createGrafana13ProviderResourceManager', () => {
  it('rejects an unowned pre-existing portal or style target', () => {
    for (const id of ['grafana-portal-container', 'dashboard-render-sdk-g-styles']) {
      const manager = createGrafana13ProviderResourceManager(documentWith([{ id }]) as never);
      expect(() => manager.acquire()).toThrow(Grafana13ProviderResourceConflictError);
    }
  });

  it('creates the exact published Grafana UI portal lookup target without body fallback', () => {
    const document = documentWith();
    const manager = createGrafana13ProviderResourceManager(document as never);
    const lease = manager.acquire();
    expect(lease.portalRoot.id).toBe('grafana-portal-container');
    expect(document.getElementById('grafana-portal-container')).toBe(lease.portalRoot);
    expect(lease.portalRoot.parentNode).toBe(document.body);
    expect(document.getElementById('dashboard-render-sdk-g-portal')).toBeNull();
  });

  it('fails closed when the dormant provider portal was removed', () => {
    const document = documentWith();
    const manager = createGrafana13ProviderResourceManager(document as never);
    const lease = manager.acquire();
    lease.release();
    lease.portalRoot.remove();
    expect(() => manager.acquire()).toThrow(Grafana13ProviderResourceConflictError);
  });

  it('fails closed when the dormant provider portal was replaced', () => {
    const document = documentWith();
    const manager = createGrafana13ProviderResourceManager(document as never);
    const lease = manager.acquire();
    lease.release();
    document.replace('grafana-portal-container');
    expect(() => manager.acquire()).toThrow(Grafana13ProviderResourceConflictError);
  });

  it('fails closed when an active provider portal is replaced', () => {
    const document = documentWith();
    const manager = createGrafana13ProviderResourceManager(document as never);
    manager.acquire();
    document.replace('grafana-portal-container');
    expect(() => manager.acquire()).toThrow(Grafana13ProviderResourceConflictError);
  });

  it('fails closed when an active provider portal is removed', () => {
    const document = documentWith();
    const manager = createGrafana13ProviderResourceManager(document as never);
    const lease = manager.acquire();
    lease.portalRoot.remove();
    expect(() => manager.acquire()).toThrow(Grafana13ProviderResourceConflictError);
  });

  it('fails closed when an active provider style is moved to the wrong parent', () => {
    const document = documentWith();
    const manager = createGrafana13ProviderResourceManager(document as never);
    const lease = manager.acquire();
    (lease.styleElement as any).parentNode = document.body;
    expect(() => manager.acquire()).toThrow(Grafana13ProviderResourceConflictError);
  });
});
