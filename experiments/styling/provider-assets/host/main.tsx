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
  loadProviderAssetExperiment,
  type ProviderAssetPanelId,
} from 'provider-assets-artifact';

import '../../host-css-containment/host-profiles.css';
import './host.css';

declare const __PROVIDER_ASSET_PROFILE__: 'nested' | 'root';

const query = new URLSearchParams(window.location.search);
const requestedFailure = query.get('assetFailure');
const requestedView = query.get('view');
const panelIds: readonly ProviderAssetPanelId[] = requestedView === 'text' || requestedView === 'stat' || requestedView === 'timeseries'
  ? [requestedView]
  : ['text', 'stat', 'timeseries'];
const normalBase = new URL('provider-assets/', document.baseURI).pathname;
const assetBasePath = requestedFailure === 'icon'
  ? new URL('provider-assets-missing/', document.baseURI).pathname
  : normalBase;
globalThis.__PORTAL_FOCUS_PROVIDER_CONFIG__ = { hostBase: 4000, model: 'host-base' };
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
const loaded = await loadProviderAssetExperiment({ assetBasePath, host: hostContract, panelIds });
const {
  ProviderAssetExperimentApp,
  inspectProviderAssetExperiment,
  providerAssetCommand,
} = loaded.implementation;
const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Provider asset experiment host root is missing.');

let setMounted: ((value: boolean) => void) | undefined;
const fontProbeText = 'Dashboard Render SDK G 0123456789';

function inspectFont() {
  const family = getComputedStyle(document.querySelector('[data-grsdk-surface="dashboard"]') ?? document.body).fontFamily;
  const context = document.createElement('canvas').getContext('2d');
  if (!context) throw new Error('Canvas font probe is unavailable.');
  context.font = `400 14px ${family}`;
  const sampleWidth = context.measureText(fontProbeText).width;
  context.font = '400 14px system-ui, sans-serif';
  return {
    fallbackSampleWidth: context.measureText(fontProbeText).width,
    family,
    medium: document.fonts.check('500 14px "Grsdk Provider Inter"'),
    regular: document.fonts.check('400 14px "Grsdk Provider Inter"'),
    sampleWidth,
  };
}

function Host() {
  const [mounted, updateMounted] = useState(true);
  setMounted = updateMounted;
  return (
    <CacheProvider value={hostCache}>
      <ClassNames>
        {({ css }) => (
          <main className={`asset-host ${css({ border: '3px solid #ea580c' })}`} data-testid="asset-host">
            <div className="asset-host-status">
              <strong>Provider assets</strong>
              <output data-testid="deployment-profile">{__PROVIDER_ASSET_PROFILE__}</output>
              <output data-testid="asset-base">{assetBasePath}</output>
              <output data-testid="asset-view">{panelIds.join(',')}</output>
            </div>
            {mounted ? <ProviderAssetExperimentApp /> : <output data-testid="provider-unmounted">Provider unmounted</output>}
          </main>
        )}
      </ClassNames>
    </CacheProvider>
  );
}

Object.assign(window, {
  __PROVIDER_ASSET_EXPERIMENT__: {
    command: (command: 'resize' | 'switchUidWithOpenModal' | 'togglePrimary' | 'toggleSecondary') => providerAssetCommand(command),
    inspect: () => ({
      admission: loaded.admission,
      assetBasePath,
      font: inspectFont(),
      profile: __PROVIDER_ASSET_PROFILE__,
      provider: inspectProviderAssetExperiment(hostCache),
    }),
    mountProvider: () => setMounted?.(true),
    unmountProvider: () => setMounted?.(false),
  },
});

createRoot(rootElement).render(<StrictMode><Host /></StrictMode>);
