// POC / EXPERIMENT / NOT FOR PRODUCTION
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as ReactDOMClient from 'react-dom/client';
import * as JsxDevRuntime from 'react/jsx-dev-runtime';
import * as JsxRuntime from 'react/jsx-runtime';
import { describe, expect, it } from 'vitest';

import {
  PROVIDER_COMPATIBILITY_CELL,
  ReactExternalizedCompatibilityError,
  createHostReactContract,
  loadReactExternalizedProvider,
  validateHostReactContract,
} from '../../../experiments/provider/react-externalized/compatibility.ts';

const compatibleHost = () => createHostReactContract({
  JsxDevRuntime,
  JsxRuntime,
  React,
  ReactDOM,
  ReactDOMClient,
  reactDomVersion: '19.2.8',
  reactVersion: React.version,
});

describe('React-externalized provider admission', () => {
  it('admits only the exact verified version cell and runtime identities', () => {
    expect(PROVIDER_COMPATIBILITY_CELL).toEqual({
      grafana: '13.2.3',
      react: '19.2.8',
      reactDom: '19.2.8',
      scenes: '8.13.5',
      strictMode: true,
    });
    expect(validateHostReactContract(compatibleHost())).toMatchObject({
      reactCreateContextIdentity: true,
      reactCreateElementIdentity: true,
      reactIdentity: true,
      reactDomClientIdentity: true,
      reactDomCreateRootIdentity: true,
      reactDomIdentity: true,
      reactUseStateIdentity: true,
      versionCell: PROVIDER_COMPATIBILITY_CELL,
    });
  });

  it('rejects a second React identity before loading Grafana implementation code', async () => {
    let implementationLoads = 0;
    const host = compatibleHost();
    const duplicate = { ...React } as typeof React;

    await expect(loadReactExternalizedProvider({
      host: { ...host, identities: { ...host.identities, React: duplicate } },
      loadImplementation: async () => {
        implementationLoads += 1;
        return { identity: 'must-not-load' };
      },
    })).rejects.toMatchObject({
      code: 'duplicate-react-runtime',
      name: 'ReactExternalizedCompatibilityError',
    });
    expect(implementationLoads).toBe(0);
  });

  it('rejects an unsupported React version before loading Grafana implementation code', async () => {
    let implementationLoads = 0;
    const host = compatibleHost();

    await expect(loadReactExternalizedProvider({
      host: { ...host, versions: { ...host.versions, react: '19.2.7' } },
      loadImplementation: async () => {
        implementationLoads += 1;
        return { identity: 'must-not-load' };
      },
    })).rejects.toBeInstanceOf(ReactExternalizedCompatibilityError);
    expect(implementationLoads).toBe(0);
  });

  it('rejects a split ReactDOM client identity even when versions match', () => {
    const host = compatibleHost();
    expect(() => validateHostReactContract({
      ...host,
      identities: { ...host.identities, ReactDOMClient: { ...ReactDOMClient } },
    })).toThrowError(expect.objectContaining({ code: 'duplicate-react-runtime' }));
  });
});
