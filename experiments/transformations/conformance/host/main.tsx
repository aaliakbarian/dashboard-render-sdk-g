// POC / EXPERIMENT / NOT FOR PRODUCTION
import createCache from '@emotion/cache';
import { CacheProvider, ClassNames } from '@emotion/react';
import * as React from 'react';
import { StrictMode, useState } from 'react';
import * as ReactDOM from 'react-dom';
import * as ReactDOMClient from 'react-dom/client';
import { createRoot } from 'react-dom/client';
import * as JsxDevRuntime from 'react/jsx-dev-runtime';
import * as JsxRuntime from 'react/jsx-runtime';
import {
  createHostReactContract,
  loadTransformationConformanceProvider,
} from 'transformation-conformance-provider-artifact';

import '../../../styling/host-css-containment/host-profiles.css';
import '../../../styling/style-lifecycle/host/host.css';

const nonce = document.querySelector<HTMLMetaElement>('meta[name="grsdk-csp-nonce"]')?.content;
if (!nonce) throw new Error('csp.nonce-missing: the host did not receive the response nonce.');
if (globalThis.__zod_globalConfig?.jitless !== true) throw new Error('csp.zod-jitless-late');

globalThis.__STYLE_LIFECYCLE_INIT_EVENTS__ = ['host-csp-nonce-ready', 'zod-jitless-ready'];
globalThis.__PORTAL_FOCUS_PROVIDER_CONFIG__ = { hostBase: 4000, model: 'host-base' };
document.body.dataset.hostCssProfile = 'controls';
const hostCache = createCache({ key: 'grsdk-host', nonce });
globalThis.__STYLE_LIFECYCLE_INIT_EVENTS__.push('host-emotion-cache-ready');
const hostContract = createHostReactContract({
  JsxDevRuntime,
  JsxRuntime,
  React,
  ReactDOM,
  ReactDOMClient,
  reactDomVersion: ReactDOM.version,
  reactVersion: React.version,
});
const assetBasePath = new URL('transformation-conformance-provider/', document.baseURI).pathname;
const loaded = await loadTransformationConformanceProvider({ assetBasePath, host: hostContract, nonce });
const {
  StrictCspProviderApp,
  inspectTransformationProvider,
  probeTransformationPipeline,
  runRealTransformationParity,
  transformationProviderCommand,
} = loaded.implementation;
const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Transformation conformance host root is missing.');

function inspectStyles() {
  const tags = [...document.querySelectorAll<HTMLStyleElement>('style[data-emotion]')].map((style) => ({
    dataEmotion: style.dataset.emotion ?? '',
    nonce: style.nonce,
  }));
  return { emotionElements: tags.length, tags };
}

function Host() {
  const [actions, setActions] = useState(0);
  return (
    <CacheProvider value={hostCache}>
      <ClassNames>
        {({ css }) => (
          <main className={`style-lifecycle-host ${css({ outline: '2px solid #ea580c' })}`}>
            <section className="host-css-sentinels" data-testid="host-sentinels">
              <button data-testid="host-sentinel-button" onClick={() => setActions((value) => value + 1)} type="button">Host action</button>
              <output>{actions}</output>
            </section>
            <StrictCspProviderApp />
          </main>
        )}
      </ClassNames>
    </CacheProvider>
  );
}

Object.assign(window, {
  __TRANSFORMATION_CONFORMANCE_EXPERIMENT__: {
    command: transformationProviderCommand,
    inspect: () => ({
      admission: loaded.admission,
      assetBasePath,
      ...inspectTransformationProvider(),
      styles: inspectStyles(),
    }),
    probePipeline: probeTransformationPipeline,
    runRealParity: runRealTransformationParity,
  },
});

createRoot(rootElement).render(<StrictMode><Host /></StrictMode>);
