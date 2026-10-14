// POC / EXPERIMENT / NOT FOR PRODUCTION
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as ReactDOMClient from 'react-dom/client';
import * as JsxDevRuntime from 'react/jsx-dev-runtime';
import * as JsxRuntime from 'react/jsx-runtime';

export const REACT_EXTERNALS = [
  'react',
  'react-dom',
  'react/jsx-runtime',
  'react/jsx-dev-runtime',
] as const;

export const PROVIDER_COMPATIBILITY_CELL = Object.freeze({
  grafana: '13.2.3',
  react: '19.2.8',
  reactDom: '19.2.8',
  scenes: '8.13.5',
  strictMode: true,
} as const);

export type ReactExternalizedCompatibilityErrorCode =
  | 'duplicate-react-runtime'
  | 'unsupported-react-version';

export class ReactExternalizedCompatibilityError extends Error {
  override readonly name = 'ReactExternalizedCompatibilityError';

  constructor(
    readonly code: ReactExternalizedCompatibilityErrorCode,
    message: string
  ) {
    super(message);
  }
}

export interface HostReactContract {
  readonly identities: {
    readonly JsxDevRuntime: typeof JsxDevRuntime;
    readonly JsxRuntime: typeof JsxRuntime;
    readonly React: typeof React;
    readonly ReactDOM: typeof ReactDOM;
    readonly ReactDOMClient: typeof ReactDOMClient;
  };
  readonly versions: {
    readonly react: string;
    readonly reactDom: string;
  };
}

export function createHostReactContract(input: {
  readonly JsxDevRuntime: typeof JsxDevRuntime;
  readonly JsxRuntime: typeof JsxRuntime;
  readonly React: typeof React;
  readonly ReactDOM: typeof ReactDOM;
  readonly ReactDOMClient: typeof ReactDOMClient;
  readonly reactDomVersion: string;
  readonly reactVersion: string;
}): HostReactContract {
  return Object.freeze({
    identities: Object.freeze({
      JsxDevRuntime: input.JsxDevRuntime,
      JsxRuntime: input.JsxRuntime,
      React: input.React,
      ReactDOM: input.ReactDOM,
      ReactDOMClient: input.ReactDOMClient,
    }),
    versions: Object.freeze({ react: input.reactVersion, reactDom: input.reactDomVersion }),
  });
}

const providerIdentities: HostReactContract['identities'] = Object.freeze({
  JsxDevRuntime,
  JsxRuntime,
  React,
  ReactDOM,
  ReactDOMClient,
});

export function validateHostReactContract(host: HostReactContract) {
  if (
    host.versions.react !== PROVIDER_COMPATIBILITY_CELL.react ||
    host.versions.reactDom !== PROVIDER_COMPATIBILITY_CELL.reactDom
  ) {
    throw new ReactExternalizedCompatibilityError(
      'unsupported-react-version',
      `Provider requires React/ReactDOM ${PROVIDER_COMPATIBILITY_CELL.react}; received ${host.versions.react}/${host.versions.reactDom}.`
    );
  }

  const split = (Object.keys(providerIdentities) as Array<keyof typeof providerIdentities>)
    .filter((key) => host.identities[key] !== providerIdentities[key]);
  if (split.length > 0) {
    throw new ReactExternalizedCompatibilityError(
      'duplicate-react-runtime',
      `Host/provider React runtime identity mismatch: ${split.join(', ')}.`
    );
  }

  return Object.freeze({
    jsxDevRuntimeIdentity: true,
    jsxRuntimeIdentity: true,
    reactCreateContextIdentity: host.identities.React.createContext === React.createContext,
    reactCreateElementIdentity: host.identities.React.createElement === React.createElement,
    reactDomClientIdentity: true,
    reactDomCreateRootIdentity: host.identities.ReactDOMClient.createRoot === ReactDOMClient.createRoot,
    reactDomIdentity: true,
    reactIdentity: true,
    reactUseStateIdentity: host.identities.React.useState === React.useState,
    versionCell: PROVIDER_COMPATIBILITY_CELL,
  } as const);
}

export async function loadReactExternalizedProvider<T = typeof import('./runtimeProvider.tsx')>(options: {
  readonly host: HostReactContract;
  readonly loadImplementation?: () => Promise<T>;
}) {
  const admission = validateHostReactContract(options.host);
  const loadImplementation = options.loadImplementation ??
    (() => import('./runtimeProvider.tsx') as Promise<T>);
  return Object.freeze({ admission, implementation: await loadImplementation() });
}
