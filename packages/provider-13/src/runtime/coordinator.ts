import type {
  HostReactRuntime,
  HostTransportCapability,
  ProviderCompatibilityManifest,
} from '@dashboard-render-sdk-g/provider-contract';

import { createGrafana13ProviderResourceManager, type Grafana13ProviderDocument, type Grafana13ProviderElement } from './resources';

export interface Grafana13RuntimeAcquireRequest {
  readonly hostReact: HostReactRuntime;
  readonly namespace: string;
  readonly providerId: string;
  readonly providerBuildId: string;
  readonly providerManifest: ProviderCompatibilityManifest;
  readonly transport: HostTransportCapability;
}

export interface Grafana13RuntimeInitialization {
  readonly acquireQueryRuntime?: () => Promise<unknown>;
  readonly cohort: unknown;
  readonly providerValues: unknown;
}

export interface Grafana13SceneScope {
  readonly instanceId: string;
  readonly portalRoot: Grafana13ProviderElement;
  readonly styleElement: Grafana13ProviderElement;
  release(): void;
}

export interface Grafana13RuntimeLease extends Grafana13RuntimeInitialization {
  acquireSceneScope(instanceId: string): Grafana13SceneScope;
  release(): void;
}

export class Grafana13RuntimeIdentityConflictError extends Error {
  override readonly name = 'Grafana13RuntimeIdentityConflictError';
  readonly code = 'runtime-identity-conflict' as const;
  constructor() { super('This JavaScript realm already owns an incompatible Grafana 13 runtime.'); }
}

export class Grafana13RuntimeInitializationError extends Error {
  override readonly name = 'Grafana13RuntimeInitializationError';
  readonly code = 'runtime-initialization-failed' as const;
  constructor() { super('The fixed Grafana 13 runtime could not be initialized.'); }
}

interface RuntimeIdentity {
  readonly basePath: string;
  readonly hostReact: HostReactRuntime['identities'];
  readonly namespace: string;
  readonly providerId: string;
  readonly providerBuildId: string;
  readonly providerManifest: ProviderCompatibilityManifest;
  readonly reactDomVersion: string;
  readonly reactVersion: string;
  readonly requestPolicyId: string;
  readonly securityScopeId: string;
  readonly targetOrigin: string;
}

function identityFor(request: Grafana13RuntimeAcquireRequest): RuntimeIdentity {
  return {
    basePath: request.transport.descriptor.basePath,
    hostReact: request.hostReact.identities,
    namespace: request.namespace,
    providerId: request.providerId,
    providerBuildId: request.providerBuildId,
    providerManifest: request.providerManifest,
    reactDomVersion: request.hostReact.versions.reactDom,
    reactVersion: request.hostReact.versions.react,
    requestPolicyId: request.transport.descriptor.requestPolicyId,
    securityScopeId: request.transport.descriptor.securityScopeId,
    targetOrigin: request.transport.descriptor.targetOrigin,
  };
}

function sameIdentity(left: RuntimeIdentity, right: RuntimeIdentity): boolean {
  if (
    left.basePath !== right.basePath || left.namespace !== right.namespace ||
    left.providerId !== right.providerId || left.providerBuildId !== right.providerBuildId ||
    left.providerManifest !== right.providerManifest ||
    left.reactDomVersion !== right.reactDomVersion || left.reactVersion !== right.reactVersion ||
    left.requestPolicyId !== right.requestPolicyId ||
    left.securityScopeId !== right.securityScopeId || left.targetOrigin !== right.targetOrigin
  ) return false;
  return left.hostReact.react === right.hostReact.react &&
    left.hostReact.reactDom === right.hostReact.reactDom &&
    left.hostReact.reactDomClient === right.hostReact.reactDomClient &&
    left.hostReact.jsxRuntime === right.hostReact.jsxRuntime &&
    left.hostReact.jsxDevRuntime === right.hostReact.jsxDevRuntime;
}

export function createGrafana13RuntimeCoordinator(environment: {
  readonly document: Grafana13ProviderDocument;
  readonly initialize: (request: Grafana13RuntimeAcquireRequest) => Promise<Grafana13RuntimeInitialization>;
}) {
  const resources = createGrafana13ProviderResourceManager(environment.document);
  const scopes = new Map<string, { readonly leaseId: number; readonly releaseResource: () => void }>();
  let activeLeases = 0;
  let nextLeaseId = 0;
  let status: 'empty' | 'initializing' | 'ready' | 'dormant' | 'poisoned' = 'empty';
  let identity: RuntimeIdentity | undefined;
  let initialization: Promise<Grafana13RuntimeInitialization> | undefined;
  let ready: Grafana13RuntimeInitialization | undefined;
  let poison: Grafana13RuntimeInitializationError | undefined;

  async function acquire(request: Grafana13RuntimeAcquireRequest): Promise<Grafana13RuntimeLease> {
    const requestedIdentity = identityFor(request);
    if (identity && !sameIdentity(identity, requestedIdentity)) {
      throw new Grafana13RuntimeIdentityConflictError();
    }
    if (poison) throw poison;
    if (!identity) identity = requestedIdentity;
    if (!initialization) {
      status = 'initializing';
      initialization = Promise.resolve().then(() => environment.initialize(request)).then(
        (value) => {
          ready = value;
          status = 'ready';
          return value;
        },
        () => {
          poison = new Grafana13RuntimeInitializationError();
          status = 'poisoned';
          throw poison;
        }
      );
    }
    const runtime = ready ?? await initialization;
    status = 'ready';
    activeLeases += 1;
    const leaseId = ++nextLeaseId;
    const ownedScopes = new Set<string>();
    let active = true;

    const releaseScope = (instanceId: string) => {
      const scope = scopes.get(instanceId);
      if (!scope || scope.leaseId !== leaseId) return;
      scope.releaseResource();
      scopes.delete(instanceId);
      ownedScopes.delete(instanceId);
    };

    return {
      ...runtime,
      acquireSceneScope(instanceId) {
        if (!active || scopes.has(instanceId)) {
          throw new Grafana13RuntimeIdentityConflictError();
        }
        const resource = resources.acquire();
        scopes.set(instanceId, { leaseId, releaseResource: resource.release });
        ownedScopes.add(instanceId);
        let scopeActive = true;
        return {
          instanceId,
          portalRoot: resource.portalRoot,
          styleElement: resource.styleElement,
          release() {
            if (!scopeActive) return;
            scopeActive = false;
            releaseScope(instanceId);
          },
        };
      },
      release() {
        if (!active) return;
        active = false;
        for (const instanceId of [...ownedScopes]) releaseScope(instanceId);
        activeLeases = Math.max(0, activeLeases - 1);
        if (activeLeases === 0 && status === 'ready') status = 'dormant';
      },
    };
  }

  return {
    acquire,
    inspect() {
      const resourceInspection = resources.inspect();
      return Object.freeze({
        activeLeases,
        activeSceneScopes: scopes.size,
        portalReferences: resourceInspection.references,
        status,
        styleReferences: resourceInspection.references,
      });
    },
  };
}
