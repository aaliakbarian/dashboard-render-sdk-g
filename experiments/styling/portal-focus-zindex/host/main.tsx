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
import { createHostReactContract, loadPortalFocusProvider } from 'portal-focus-provider-artifact';

import 'portal-focus-provider-style';
import '../../host-css-containment/host-profiles.css';
import './host.css';

const query = new URLSearchParams(window.location.search);
const requested = query.get('model');
const model = requested === 'provider-token' || requested === 'host-base' ? requested : 'fixed';
globalThis.__PORTAL_FOCUS_PROVIDER_CONFIG__ = {
  model,
  ...(model === 'provider-token' ? { providerBase: 2000 } : {}),
  ...(model === 'host-base' ? { hostBase: 4000 } : {}),
};
document.body.dataset.hostCssProfile = 'controls';

const hostCache = createCache({ key: 'grsdk-host' });
const hostContract = createHostReactContract({
  JsxDevRuntime,
  JsxRuntime,
  React,
  ReactDOM,
  ReactDOMClient,
  reactDomVersion: ReactDOM.version,
  reactVersion: React.version,
});
const loaded = await loadPortalFocusProvider({ host: hostContract });
const { PortalFocusProviderApp, inspectPortalFocusProvider, portalProviderCommand } = loaded.implementation;
const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Portal experiment host root is missing.');

interface HostController { mount(): void; unmount(): void; }
let hostController: HostController | undefined;

function styleTags() {
  return [...document.querySelectorAll<HTMLStyleElement>('style[data-emotion]')].map((style) => ({
    dataEmotion: style.dataset.emotion ?? '',
    rules: style.sheet?.cssRules.length ?? 0,
  }));
}

function Host() {
  const [mounted, setMounted] = useState(true);
  const [hostActions, setHostActions] = useState(0);
  hostController = { mount: () => setMounted(true), unmount: () => setMounted(false) };
  return (
    <CacheProvider value={hostCache}>
      <ClassNames>
        {({ css }) => (
          <main className={`host-shell ${css({ background: '#fffbeb', color: '#3f3f46' })}`} data-testid="portal-host">
            <header className="host-fixed-header" data-testid="host-fixed-header">Host fixed header</header>
            <div className="host-controls">
              <button className="host-button" data-testid="host-action" onClick={() => setHostActions((value) => value + 1)} type="button">
                Unrelated host action
              </button>
              <output data-testid="host-action-count">{hostActions}</output>
            </div>
            <div className="host-overlay-low" data-testid="host-overlay-low">Host overlay low</div>
            <div className="host-overlay-high" data-testid="host-overlay-high">Host overlay high</div>
            <div className="host-positioned-context" data-testid="host-positioned-context">
              <div className="host-transform-context" data-testid="host-transform-context">
                <div className="host-opacity-context" data-testid="host-opacity-context">
                  {mounted ? <PortalFocusProviderApp /> : <output data-testid="provider-unmounted">Provider unmounted</output>}
                </div>
              </div>
            </div>
          </main>
        )}
      </ClassNames>
    </CacheProvider>
  );
}

const { versionCell: _versionCell, ...admission } = loaded.admission;
Object.assign(window, {
  __PORTAL_FOCUS_EXPERIMENT__: {
    command: (command: 'closeAll' | 'mountPrimary' | 'resize' | 'switchUidWithOpenModal' | 'togglePrimary' | 'toggleSecondary') => portalProviderCommand(command),
    inspect: () => ({ admission, hostCache: { inserted: Object.keys(hostCache.inserted).length, key: hostCache.key, tags: hostCache.sheet.tags.length }, provider: inspectPortalFocusProvider(hostCache), styleTags: styleTags() }),
    mountProvider: () => hostController?.mount(),
    unmountProvider: () => hostController?.unmount(),
  },
});

createRoot(rootElement).render(<StrictMode><Host /></StrictMode>);
