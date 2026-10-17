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
  loadStrictCspProvider,
  type StrictCspPanelId,
} from 'strict-csp-provider-artifact';

import '../../../styling/host-css-containment/host-profiles.css';
import '../../../styling/provider-assets/host/host.css';

declare const __STRICT_CSP_PROFILE__: 'nested' | 'root';

const nonce = document.querySelector<HTMLMetaElement>('meta[name="grsdk-csp-nonce"]')?.content;
if (!nonce) throw new Error('csp.nonce-missing: the host did not receive the response nonce.');

const query = new URLSearchParams(window.location.search);
const requestedView = query.get('view');
const panelIds: readonly StrictCspPanelId[] = requestedView === 'text' || requestedView === 'stat' || requestedView === 'timeseries'
  ? [requestedView]
  : ['text', 'stat', 'timeseries'];
const assetBasePath = new URL('strict-csp-provider/', document.baseURI).pathname;
globalThis.__PORTAL_FOCUS_PROVIDER_CONFIG__ = { hostBase: 4000, model: 'host-base' };
document.body.dataset.hostCssProfile = 'controls';

const hostCache = createCache({ key: 'grsdk-host', nonce });
const hostContract = createHostReactContract({
  JsxDevRuntime,
  JsxRuntime,
  React,
  ReactDOM,
  ReactDOMClient,
  reactDomVersion: ReactDOM.version,
  reactVersion: React.version,
});
const loaded = await loadStrictCspProvider({ assetBasePath, host: hostContract, nonce, panelIds });
const {
  StrictCspProviderApp,
  inspectStrictCspProvider,
  strictCspProviderCommand,
} = loaded.implementation;
const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Strict CSP experiment host root is missing.');

let setMounted: ((value: boolean) => void) | undefined;

function styleOwner(dataEmotion: string) {
  if (dataEmotion.startsWith('grsdk-host')) return 'host-react';
  if (dataEmotion.startsWith('grsdk-provider')) return 'provider-react';
  if (dataEmotion.startsWith('css')) return 'provider-css';
  return 'unknown';
}

function inspectStyles() {
  return [...document.querySelectorAll<HTMLStyleElement>('style[data-emotion]')].map((style) => {
    let rules = 0;
    try { rules = style.sheet?.cssRules.length ?? 0; } catch { rules = -1; }
    const dataEmotion = style.dataset.emotion ?? '';
    return {
      dataEmotion,
      // Browsers deliberately hide nonce values from getAttribute(); the IDL
      // property is the observable nonce ownership contract.
      nonce: style.nonce,
      owner: styleOwner(dataEmotion),
      rules,
    };
  });
}

function inspectInlineEventAttributes() {
  return [...document.querySelectorAll<HTMLElement>('*')].flatMap((element) =>
    [...element.attributes]
      .filter((attribute) => /^on/i.test(attribute.name))
      .map((attribute) => `${element.tagName.toLowerCase()}[${attribute.name}]`)
  );
}

function inspectFont() {
  return {
    medium: document.fonts.check('500 14px "Grsdk Provider Inter"'),
    regular: document.fonts.check('400 14px "Grsdk Provider Inter"'),
  };
}

function Host() {
  const [mounted, updateMounted] = useState(true);
  setMounted = updateMounted;
  return (
    <CacheProvider value={hostCache}>
      <ClassNames>
        {({ css }) => (
          <main className={`asset-host ${css({ border: '3px solid #ea580c' })}`} data-testid="strict-csp-host">
            <div className="asset-host-status">
              <strong>Strict CSP provider</strong>
              <output data-testid="deployment-profile">{__STRICT_CSP_PROFILE__}</output>
              <button
                data-testid="csp-eval-probe"
                onClick={() => {
                  try {
                    Function('return 42')();
                    document.body.dataset.cspEvalRejected = 'false';
                  } catch {
                    document.body.dataset.cspEvalRejected = 'true';
                  }
                }}
                type="button"
              >
                Probe blocked eval
              </button>
            </div>
            {mounted ? <StrictCspProviderApp /> : <output data-testid="provider-unmounted">Provider unmounted</output>}
          </main>
        )}
      </ClassNames>
    </CacheProvider>
  );
}

Object.assign(window, {
  __STRICT_CSP_EXPERIMENT__: {
    command: (command: 'resize' | 'switchUidWithOpenModal' | 'togglePrimary' | 'toggleSecondary') => strictCspProviderCommand(command),
    inspect: () => ({
      admission: loaded.admission,
      assetBasePath,
      font: inspectFont(),
      inlineEventAttributes: inspectInlineEventAttributes(),
      nonce,
      profile: __STRICT_CSP_PROFILE__,
      provider: inspectStrictCspProvider(hostCache),
      styles: inspectStyles(),
      zodJitless: globalThis.__zod_globalConfig?.jitless === true,
    }),
    mountProvider: () => setMounted?.(true),
    unmountProvider: () => setMounted?.(false),
  },
});

createRoot(rootElement).render(<StrictMode><Host /></StrictMode>);
