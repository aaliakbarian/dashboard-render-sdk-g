// POC / EXPERIMENT / NOT FOR PRODUCTION
import * as React from 'react';
import { StrictMode, createContext } from 'react';
import * as ReactDOM from 'react-dom';
import * as ReactDOMClient from 'react-dom/client';
import { createRoot, type Root } from 'react-dom/client';
import * as JsxDevRuntime from 'react/jsx-dev-runtime';
import * as JsxRuntime from 'react/jsx-runtime';
import {
  createHostReactContract,
  loadReactExternalizedProvider,
} from 'react-externalized-provider-artifact';

import '../../../bundle/lazy-panel-chunks/browser.css';

const rootElement = document.getElementById('root');
const portalTarget = document.getElementById('provider-portal');
if (!rootElement || !portalTarget) throw new Error('Experiment host DOM is incomplete.');
const mountNode = rootElement;
const providerPortal = portalTarget;

const host = createHostReactContract({
  JsxDevRuntime,
  JsxRuntime,
  React,
  ReactDOM,
  ReactDOMClient,
  reactDomVersion: ReactDOM.version,
  reactVersion: React.version,
});
const admissionProbe = new URLSearchParams(window.location.search).get('admission');
if (admissionProbe === 'duplicate' || admissionProbe === 'unsupported-version') {
  let implementationLoads = 0;
  const incompatibleHost = admissionProbe === 'duplicate'
    ? {
        ...host,
        identities: { ...host.identities, React: { ...React } as typeof React },
      }
    : {
        ...host,
        versions: { ...host.versions, react: '19.2.7' },
      };
  try {
    await loadReactExternalizedProvider({
      host: incompatibleHost,
      loadImplementation: async () => {
        implementationLoads += 1;
        return {};
      },
    });
    throw new Error('The incompatible host was unexpectedly admitted.');
  } catch (error: unknown) {
    const code = error && typeof error === 'object' && 'code' in error
      ? String(error.code)
      : 'unexpected-error';
    const sentinel = document.createElement('output');
    sentinel.dataset.testid = 'admission-rejected';
    sentinel.textContent = `${admissionProbe}:${code}`;
    mountNode.replaceChildren(sentinel);
    Object.assign(globalThis, {
      __REACT_EXTERNALIZED_ADMISSION_PROBE__: { code, implementationLoads },
    });
  }
} else {
  const loaded = await loadReactExternalizedProvider({ host });
  const { ReactExternalizedProviderApp, inspectReactExternalizedRuntime } = loaded.implementation;
  const HostContext = createContext('missing-host-context');
  let root: Root | undefined;

  function render() {
    if (root) return;
    root = createRoot(mountNode);
    root.render(
      <StrictMode>
        <HostContext.Provider value="host-context-value">
          <ReactExternalizedProviderApp hostContext={HostContext} portalTarget={providerPortal} />
        </HostContext.Provider>
      </StrictMode>
    );
  }

  function unmount() {
    root?.unmount();
    root = undefined;
  }

  const { versionCell: _versionCell, ...admission } = loaded.admission;
  Object.assign(globalThis, {
    __REACT_EXTERNALIZED_PROVIDER__: {
      inspect: () => ({ admission, ...inspectReactExternalizedRuntime() }),
      remount: render,
      unmount,
    },
  });
  render();
}
