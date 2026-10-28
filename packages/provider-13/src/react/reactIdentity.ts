import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as ReactDOMClient from 'react-dom/client';
import * as JsxDevRuntime from 'react/jsx-dev-runtime';
import * as JsxRuntime from 'react/jsx-runtime';

import type { HostReactRuntime } from '@dashboard-render-sdk-g/provider-contract';

export const GRAFANA_13_REACT_CELL = Object.freeze({
  react: '19.2.8',
  reactDom: '19.2.8',
} as const);

export class Grafana13ReactCompatibilityError extends Error {
  override readonly name = 'Grafana13ReactCompatibilityError';
  readonly code = 'runtime-react-incompatible' as const;

  constructor(message: string) {
    super(message);
  }
}

const providerIdentities: HostReactRuntime['identities'] = Object.freeze({
  jsxDevRuntime: JsxDevRuntime,
  jsxRuntime: JsxRuntime,
  react: React,
  reactDom: ReactDOM,
  reactDomClient: ReactDOMClient,
});

/**
 * Reads only provider-owned static imports. Bundlers may expose ESM namespace
 * exports through accessors, so hostile-input reflection rules do not apply to
 * these trusted module objects. Host-supplied containers remain data-only.
 */
export function readTrustedProviderReactVersions(
  reactNamespace: unknown,
  reactDomNamespace: unknown
) {
  return Object.freeze({
    react: (reactNamespace as { readonly version?: unknown }).version,
    reactDom: (reactDomNamespace as { readonly version?: unknown }).version,
  });
}

const providerVersions = readTrustedProviderReactVersions(React, ReactDOM);

function readOwnDataProperty(
  container: unknown,
  property: PropertyKey,
  message: string
): unknown {
  if (
    container === null ||
    (typeof container !== 'object' && typeof container !== 'function')
  ) {
    throw new Grafana13ReactCompatibilityError(message);
  }
  let descriptor: PropertyDescriptor | undefined;
  try {
    descriptor = Object.getOwnPropertyDescriptor(container, property);
  } catch {
    throw new Grafana13ReactCompatibilityError(message);
  }
  if (!descriptor || !('value' in descriptor)) {
    throw new Grafana13ReactCompatibilityError(message);
  }
  return descriptor.value;
}

export function assertCompatibleHostReactRuntime(hostReact: HostReactRuntime) {
  const versions = readOwnDataProperty(
    hostReact,
    'versions',
    'The host React runtime version evidence is invalid.'
  );
  const claimedReactVersion = readOwnDataProperty(
    versions,
    'react',
    'The host React runtime version evidence is invalid.'
  );
  const claimedReactDomVersion = readOwnDataProperty(
    versions,
    'reactDom',
    'The host React runtime version evidence is invalid.'
  );
  if (
    claimedReactVersion !== GRAFANA_13_REACT_CELL.react ||
    claimedReactDomVersion !== GRAFANA_13_REACT_CELL.reactDom
  ) {
    throw new Grafana13ReactCompatibilityError(
      'The host React and ReactDOM versions are outside the exact provider compatibility cell.'
    );
  }

  if (
    providerVersions.react !== GRAFANA_13_REACT_CELL.react ||
    providerVersions.reactDom !== GRAFANA_13_REACT_CELL.reactDom
  ) {
    throw new Grafana13ReactCompatibilityError(
      'The provider React namespaces are outside the exact provider compatibility cell.'
    );
  }
  const identities = readOwnDataProperty(
    hostReact,
    'identities',
    'The host React runtime identity evidence is invalid.'
  );
  const hostIdentities = Object.fromEntries(
    (Object.keys(providerIdentities) as Array<keyof typeof providerIdentities>).map(
      (identity) => [
        identity,
        readOwnDataProperty(
          identities,
          identity,
          'The host React runtime identity evidence is invalid.'
        ),
      ]
    )
  ) as Record<keyof typeof providerIdentities, unknown>;
  for (const identity of Object.keys(providerIdentities) as Array<keyof typeof providerIdentities>) {
    if (hostIdentities[identity] !== providerIdentities[identity]) {
      throw new Grafana13ReactCompatibilityError(
        `The host and provider do not share the ${identity} runtime identity.`
      );
    }
  }

  return Object.freeze({ cell: GRAFANA_13_REACT_CELL, hostReact });
}

export async function loadAfterHostReactAdmission<T>(
  hostReact: HostReactRuntime,
  loadImplementation: () => Promise<T>
): Promise<T> {
  assertCompatibleHostReactRuntime(hostReact);
  return loadImplementation();
}
