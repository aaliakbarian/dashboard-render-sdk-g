// POC / EXPERIMENT / NOT FOR PRODUCTION
import createCache, { type EmotionCache, type Options as EmotionCacheOptions } from '@emotion/cache';
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
  loadEmotionCoexistenceProvider,
} from 'emotion-coexistence-provider-artifact';

import { EMOTION_CACHE_KEYS, EmotionCacheOwnershipError, assertUniqueEmotionCacheOwnership } from '../cachePolicy.ts';

import 'emotion-coexistence-provider-style';
import '../../host-css-containment/host-profiles.css';

type InsertionModel = 'head' | 'marked' | 'prepend';
type MountOrder = 'host-first' | 'provider-first';

const query = new URLSearchParams(window.location.search);
const requestedModel = query.get('model');
const model: InsertionModel = requestedModel === 'marked' || requestedModel === 'prepend' ? requestedModel : 'head';
const order: MountOrder = query.get('order') === 'provider-first' ? 'provider-first' : 'host-first';
document.body.dataset.hostCssProfile = 'controls';

function insertionPoint(owner: 'host' | 'provider') {
  const marker = document.createElement('meta');
  marker.dataset.emotionInsertionPoint = owner;
  marker.setAttribute('name', `emotion-insertion-point-${owner}`);
  document.head.append(marker);
  return marker;
}

const hostMarker = insertionPoint('host');
const providerMarker = insertionPoint('provider');
const hostOptions: EmotionCacheOptions = { key: EMOTION_CACHE_KEYS.host };
if (model === 'marked') hostOptions.insertionPoint = hostMarker;
const hostCache = createCache(hostOptions);
globalThis.__EMOTION_COEXISTENCE_PROVIDER_CONFIG__ = {
  ...(model === 'marked' ? { insertionPoint: providerMarker } : {}),
  model,
};

const hostContract = createHostReactContract({
  JsxDevRuntime,
  JsxRuntime,
  React,
  ReactDOM,
  ReactDOMClient,
  reactDomVersion: ReactDOM.version,
  reactVersion: React.version,
});
const loaded = await loadEmotionCoexistenceProvider({ host: hostContract });
const {
  EmotionCoexistenceProviderApp,
  inspectEmotionCoexistenceProvider,
  resizeEmotionProvider,
  switchEmotionProviderUid,
  toggleEmotionProviderSecondary,
} = loaded.implementation;
const rootElement = document.getElementById('root');
const portalTarget = document.getElementById('provider-portal');
if (!rootElement || !portalTarget) throw new Error('Emotion coexistence host DOM is incomplete.');
const providerPortal = portalTarget;

interface HostController {
  mountProvider(): void;
  showDynamicHost(): void;
  showHost(): void;
  unmountProvider(): void;
}
let hostController: HostController | undefined;

function cacheEvidence(cache: EmotionCache, id: string) {
  return { id, inserted: Object.keys(cache.inserted).length, key: cache.key, tags: cache.sheet.tags.length };
}

function ownerFor(dataEmotion: string) {
  if (dataEmotion.startsWith(EMOTION_CACHE_KEYS.host)) return 'host-react';
  if (dataEmotion.startsWith(EMOTION_CACHE_KEYS.provider)) return 'provider-react';
  if (dataEmotion.startsWith(`${EMOTION_CACHE_KEYS.providerCss}`)) return 'provider-css';
  return 'unknown';
}

function inspectStyleTags() {
  return [...document.querySelectorAll<HTMLStyleElement>('style[data-emotion]')].map((style) => {
    let rules = 0;
    try { rules = style.sheet?.cssRules.length ?? 0; } catch { rules = -1; }
    const dataEmotion = style.dataset.emotion ?? '';
    return {
      dataEmotion,
      index: [...document.head.children].indexOf(style),
      owner: ownerFor(dataEmotion),
      rules,
    };
  });
}

function classNames(prefix: string) {
  return [...document.querySelectorAll<HTMLElement>('[class]')]
    .flatMap((element) => [...element.classList])
    .filter((name, index, values) => name.startsWith(prefix) && values.indexOf(name) === index)
    .sort();
}

function HostSentinels({ dynamic }: { readonly dynamic: boolean }) {
  return (
    <ClassNames>
      {({ css }) => {
        const heading = css({ color: '#4c1d95', fontFamily: 'Georgia, serif', fontSize: 27, lineHeight: 1.2 });
        const control = css({ backgroundColor: '#fff', border: '2px solid #6d28d9', borderRadius: 6, color: '#241247', padding: '6px 9px' });
        const container = css({ backgroundColor: '#fff7d6', border: '3px solid #6d28d9', color: '#241247', padding: 18 });
        return (
          <section className={container} data-testid="emotion-host-container">
            <h1 className={heading} data-testid="emotion-host-heading">Host Emotion owner</h1>
            <p>Host-owned Emotion styles must survive provider activity.</p>
            <button className={control} data-testid="emotion-host-button" type="button">Host button</button>
            <input className={control} data-testid="emotion-host-input" defaultValue="Host input" />
            {dynamic ? (
              <output
                className={css({ backgroundColor: '#ede9fe', color: '#5b21b6', display: 'block', marginTop: 8, padding: 5 })}
                data-testid="emotion-host-dynamic"
              >
                dynamic-host-style
              </output>
            ) : null}
          </section>
        );
      }}
    </ClassNames>
  );
}

function ExperimentHost() {
  const [hostVisible, setHostVisible] = useState(order === 'host-first');
  const [dynamicHost, setDynamicHost] = useState(false);
  const [providerMounted, setProviderMounted] = useState(order === 'provider-first');
  hostController = {
    mountProvider: () => setProviderMounted(true),
    showDynamicHost: () => setDynamicHost(true),
    showHost: () => setHostVisible(true),
    unmountProvider: () => setProviderMounted(false),
  };
  return (
    <CacheProvider value={hostCache}>
      <main data-testid="emotion-coexistence-host">
        <output data-testid="emotion-host-ready">ready</output>
        {hostVisible ? <HostSentinels dynamic={dynamicHost} /> : null}
        {providerMounted
          ? <EmotionCoexistenceProviderApp portalTarget={providerPortal} />
          : <output data-testid="provider-unmounted">Provider unmounted</output>}
      </main>
    </CacheProvider>
  );
}

const { versionCell: _versionCell, ...admission } = loaded.admission;
Object.assign(window, {
  __EMOTION_COEXISTENCE__: {
    inspect: () => {
      const provider = inspectEmotionCoexistenceProvider(hostCache);
      return {
        admission,
        cacheObjectsDistinct: provider.cacheObjectsDistinct,
        caches: { host: cacheEvidence(hostCache, 'host-react-cache-1'), ...provider.caches },
        classes: {
          host: classNames(`${EMOTION_CACHE_KEYS.host}-`),
          provider: classNames(`${EMOTION_CACHE_KEYS.provider}-`),
        },
        cohort: provider.cohort,
        model,
        styleTags: inspectStyleTags(),
      };
    },
    mountProvider: () => hostController?.mountProvider(),
    resize: resizeEmotionProvider,
    runDuplicateKeyProbe: () => {
      try {
        assertUniqueEmotionCacheOwnership([
          { key: 'grsdk-conflict', owner: 'host-react' },
          { key: 'grsdk-conflict', owner: 'provider-react' },
        ]);
      } catch (error: unknown) {
        if (error instanceof EmotionCacheOwnershipError) {
          return { code: error.code, key: error.key, owners: error.owners, rejected: true };
        }
        throw error;
      }
      throw new Error('Duplicate Emotion cache ownership was not rejected.');
    },
    showDynamicHost: () => hostController?.showDynamicHost(),
    showHost: () => hostController?.showHost(),
    switchUid: switchEmotionProviderUid,
    toggleSecondary: toggleEmotionProviderSecondary,
    unmountProvider: () => hostController?.unmountProvider(),
  },
});

createRoot(rootElement).render(
  <StrictMode>
    <ExperimentHost />
  </StrictMode>
);
