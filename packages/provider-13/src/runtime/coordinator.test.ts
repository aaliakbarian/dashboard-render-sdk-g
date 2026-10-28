import type { HostReactRuntime, HostTransportCapability } from '@dashboard-render-sdk-g/provider-contract';
import { describe, expect, it, vi } from 'vitest';

import { grafana13Provider } from '../provider';
import {
  createGrafana13RuntimeCoordinator,
  Grafana13RuntimeIdentityConflictError,
  Grafana13RuntimeInitializationError,
} from './coordinator';

function hostReact(
  seed = 0,
  versions: HostReactRuntime['versions'] = { react: '19.2.8', reactDom: '19.2.8' }
): HostReactRuntime {
  return {
    identities: {
      jsxDevRuntime: { seed }, jsxRuntime: { seed }, react: { seed },
      reactDom: { seed }, reactDomClient: { seed },
    },
    versions,
  };
}

function transport(scope = 'scope'): HostTransportCapability {
  return {
    descriptor: {
      basePath: '/grafana', requestPolicyId: 'policy', schemaVersion: 1,
      securityScopeId: scope, targetOrigin: 'https://host.example',
    },
    execute: async (request) => ({ kind: 'cancelled', requestId: request.requestId }),
  };
}

function fakeDocument() {
  const byId = new Map<string, any>();
  const body = {
    appendChild(element: any) { element.isConnected = true; element.parentNode = body; byId.set(element.id, element); },
  };
  return {
    body,
    createElement(tagName: string) {
      return {
        dataset: {}, id: '', isConnected: false, parentNode: undefined, tagName, textContent: '',
        remove() { byId.delete(this.id); this.isConnected = false; this.parentNode = undefined; },
        setAttribute(name: string, value: string) { (this as any)[name] = value; },
      };
    },
    getElementById(id: string) { return byId.get(id) ?? null; },
    head: { appendChild(element: any) { element.isConnected = true; element.parentNode = this; byId.set(element.id, element); } },
  };
}

function createHarness(options: { fail?: boolean } = {}) {
  const initialize = vi.fn(async () => {
    if (options.fail) throw new Error('secret-initialization-cause');
    return {
      cohort: { identity: 'cohort' },
      providerValues: { theme: { isLight: true } },
    };
  });
  const document = fakeDocument();
  const coordinator = createGrafana13RuntimeCoordinator({ document: document as never, initialize });
  return { coordinator, document, initialize };
}

function request(overrides: Record<string, unknown> = {}) {
  return {
    hostReact: hostReact(), namespace: 'default',
    providerId: '@dashboard-render-sdk-g/provider-13',
    providerBuildId: 'provider-13-grafana-13.2.3-text-markdown-view-v1',
    providerManifest: grafana13Provider.manifest,
    transport: transport(), ...overrides,
  };
}

describe('createGrafana13RuntimeCoordinator', () => {
  it('initializes once, shares the exact cohort, and becomes dormant after final release', async () => {
    const { coordinator, initialize } = createHarness();
    const input = request();
    const first = await coordinator.acquire(input);
    const second = await coordinator.acquire(input);
    expect(initialize).toHaveBeenCalledTimes(1);
    expect(first.cohort).toBe(second.cohort);
    expect(coordinator.inspect()).toMatchObject({ activeLeases: 2, status: 'ready' });
    first.release();
    expect(coordinator.inspect()).toMatchObject({ activeLeases: 1, status: 'ready' });
    second.release();
    expect(coordinator.inspect()).toMatchObject({ activeLeases: 0, status: 'dormant' });
    const third = await coordinator.acquire(input);
    expect(initialize).toHaveBeenCalledTimes(1);
    expect(third.cohort).toBe(first.cohort);
    third.release();
  });

  it.each([
    ['transport', (base: ReturnType<typeof request>) => ({ ...base, transport: transport('other') })],
    ['namespace', (base: ReturnType<typeof request>) => ({ ...base, namespace: 'other' })],
    ['provider ID', (base: ReturnType<typeof request>) => ({ ...base, providerId: '@dashboard-render-sdk-g/other' })],
    ['provider build', (base: ReturnType<typeof request>) => ({ ...base, providerBuildId: 'other-build' })],
    ['provider manifest object', (base: ReturnType<typeof request>) => ({ ...base, providerManifest: { ...grafana13Provider.manifest } })],
    ['React version', (base: ReturnType<typeof request>) => ({ ...base, hostReact: { ...base.hostReact, versions: { react: '19.2.7', reactDom: '19.2.8' } } })],
    ['ReactDOM version', (base: ReturnType<typeof request>) => ({ ...base, hostReact: { ...base.hostReact, versions: { react: '19.2.8', reactDom: '19.2.7' } } })],
    ['React identity', (base: ReturnType<typeof request>) => ({ ...base, hostReact: hostReact(1) })],
  ])('rejects conflicting %s before mutation or reuse', async (_label, conflicting) => {
    const { coordinator, initialize } = createHarness();
    const input = request();
    const lease = await coordinator.acquire(input);
    const before = coordinator.inspect();
    await expect(coordinator.acquire(conflicting(input) as never)).rejects.toBeInstanceOf(
      Grafana13RuntimeIdentityConflictError
    );
    expect(initialize).toHaveBeenCalledTimes(1);
    expect(coordinator.inspect()).toEqual(before);
    lease.release();
  });

  it('poisons initialization and never retries singleton initialization', async () => {
    const { coordinator, initialize } = createHarness({ fail: true });
    const input = request();
    const error = await coordinator.acquire(input).catch((value) => value);
    expect(error).toBeInstanceOf(Grafana13RuntimeInitializationError);
    expect(JSON.stringify(error)).not.toContain('secret-initialization-cause');
    await expect(coordinator.acquire(input)).rejects.toBe(error);
    expect(initialize).toHaveBeenCalledTimes(1);
    expect(coordinator.inspect()).toMatchObject({ activeLeases: 0, status: 'poisoned' });
  });

  it('reference-counts independent scopes while retaining the provider-lifetime portal/style baseline', async () => {
    const { coordinator, document } = createHarness();
    const input = request();
    const first = await coordinator.acquire(input);
    const second = await coordinator.acquire(input);
    const scopeA = first.acquireSceneScope('dashboard-a');
    const scopeB = second.acquireSceneScope('dashboard-b');
    expect(scopeA.portalRoot).toBe(scopeB.portalRoot);
    expect(scopeA.styleElement).toBe(scopeB.styleElement);
    expect(coordinator.inspect()).toMatchObject({
      activeSceneScopes: 2,
      portalReferences: 2,
      styleReferences: 2,
    });
    scopeA.release();
    expect(document.getElementById('grafana-portal-container')).toBe(scopeB.portalRoot);
    expect(document.getElementById('dashboard-render-sdk-g-styles')).toBe(scopeB.styleElement);
    scopeB.release();
    expect(document.getElementById('grafana-portal-container')).toBe(scopeB.portalRoot);
    expect(document.getElementById('dashboard-render-sdk-g-styles')).toBe(scopeB.styleElement);
    expect(coordinator.inspect()).toMatchObject({
      activeSceneScopes: 0,
      portalReferences: 0,
      styleReferences: 0,
    });
    first.release(); second.release();
  });
});
