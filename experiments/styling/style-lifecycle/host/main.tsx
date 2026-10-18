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
  loadStyleLifecycleProvider,
} from 'style-lifecycle-provider-artifact';

import '../../host-css-containment/host-profiles.css';
import './host.css';

declare const __STYLE_LIFECYCLE_PROFILE__: 'nested' | 'root';

const nonce = document.querySelector<HTMLMetaElement>('meta[name="grsdk-csp-nonce"]')?.content;
if (!nonce) throw new Error('csp.nonce-missing: the host did not receive the response nonce.');
if (globalThis.__zod_globalConfig?.jitless !== true) {
  throw new Error('csp.zod-jitless-late: the external prelude did not run before the host module.');
}

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
const assetBasePath = new URL('style-lifecycle-provider/', document.baseURI).pathname;
const failFirstPanel = new URLSearchParams(location.search).get('failPanel');
const startDormant = new URLSearchParams(location.search).get('startDormant') === '1';
const loaded = await loadStyleLifecycleProvider({
  assetBasePath,
  host: hostContract,
  nonce,
  startDormant,
  ...(failFirstPanel === 'stat' || failFirstPanel === 'text' || failFirstPanel === 'timeseries'
    ? { failFirstPanel }
    : {}),
});
const {
  StrictCspProviderApp,
  inspectStyleLifecycleProvider,
  probeIncompatibleRuntimeIdentity,
  styleLifecycleProviderCommand,
} = loaded.implementation;
const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Style lifecycle experiment host root is missing.');

let setProviderMounted: ((value: boolean) => void) | undefined;

function styleOwner(dataEmotion: string) {
  if (dataEmotion.startsWith('grsdk-host')) return 'host-react';
  if (dataEmotion.startsWith('grsdk-provider')) return 'provider-react';
  if (dataEmotion.startsWith('css')) return 'provider-css';
  return 'static-or-unknown';
}

function inspectStyles() {
  const tags = [...document.querySelectorAll<HTMLStyleElement>('style[data-emotion]')].map((style) => {
    let rules = 0;
    try { rules = style.sheet?.cssRules.length ?? 0; } catch { rules = -1; }
    const dataEmotion = style.dataset.emotion ?? '';
    return { dataEmotion, nonce: style.nonce, owner: styleOwner(dataEmotion), rules };
  });
  return {
    emotionElements: tags.length,
    staticElements: document.querySelectorAll('style:not([data-emotion]), link[rel="stylesheet"]').length,
    tags,
    totalRules: tags.reduce((sum, tag) => sum + Math.max(0, tag.rules), 0),
  };
}

function inspectHostSentinels() {
  const button = document.querySelector<HTMLElement>('[data-testid="host-sentinel-button"]');
  const shell = document.querySelector<HTMLElement>('[data-testid="host-sentinels"]');
  if (!button || !shell) return undefined;
  const buttonStyle = getComputedStyle(button);
  const shellStyle = getComputedStyle(shell);
  return {
    buttonBackground: buttonStyle.backgroundColor,
    buttonBorderRadius: buttonStyle.borderRadius,
    buttonFontFamily: buttonStyle.fontFamily,
    shellBackground: shellStyle.backgroundColor,
    shellBorderWidth: shellStyle.borderWidth,
    shellFontFamily: shellStyle.fontFamily,
  };
}

function Host() {
  const [providerMounted, updateProviderMounted] = useState(true);
  const [hostActions, setHostActions] = useState(0);
  setProviderMounted = updateProviderMounted;
  return (
    <CacheProvider value={hostCache}>
      <ClassNames>
        {({ css }) => (
          <main className={`style-lifecycle-host ${css({ outline: '2px solid #ea580c' })}`} data-testid="style-lifecycle-host">
            <section className="host-css-sentinels" data-testid="host-sentinels">
              <h1>Host presentation sentinel</h1>
              <div className="host-css-controls">
                <button data-testid="host-sentinel-button" onClick={() => setHostActions((value) => value + 1)} type="button">
                  Host action
                </button>
                <output data-testid="host-action-count">{hostActions}</output>
              </div>
            </section>
            <div className="style-lifecycle-status">
              <strong>Production-shaped style lifecycle</strong>
              <output data-testid="deployment-profile">{__STYLE_LIFECYCLE_PROFILE__}</output>
            </div>
            {providerMounted ? <StrictCspProviderApp /> : <output data-testid="provider-unmounted">Provider unmounted</output>}
          </main>
        )}
      </ClassNames>
    </CacheProvider>
  );
}

Object.assign(window, {
  __STYLE_LIFECYCLE_EXPERIMENT__: {
    command: (command: 'closeAll' | 'mountPrimary' | 'refresh' | 'resize' | 'switchUidWithOpenModal' | 'timeRange' | 'togglePrimary' | 'toggleSecondary') => styleLifecycleProviderCommand(command),
    inspect: () => ({
      admission: loaded.admission,
      assetBasePath,
      hostCache: { inserted: Object.keys(hostCache.inserted).length, key: hostCache.key, tags: hostCache.sheet.tags.length },
      hostSentinels: inspectHostSentinels(),
      nonce,
      profile: __STYLE_LIFECYCLE_PROFILE__,
      provider: inspectStyleLifecycleProvider(),
      shadowRoots: [...document.querySelectorAll('*')].filter((element) => element.shadowRoot).length,
      styles: inspectStyles(),
      zodJitless: globalThis.__zod_globalConfig?.jitless === true,
    }),
    mountProvider: () => setProviderMounted?.(true),
    probeIncompatibleRuntimeIdentity,
    unmountProvider: () => setProviderMounted?.(false),
  },
});

createRoot(rootElement).render(<StrictMode><Host /></StrictMode>);
