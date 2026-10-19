// POC / EXPERIMENT / NOT FOR PRODUCTION
import createCache, { type EmotionCache, type Options as EmotionCacheOptions } from '@emotion/cache';
import { cache as providerCssCache } from '@emotion/css';
import { CacheProvider, ClassNames } from '@emotion/react';
import {
  GrafanaDashboard,
  POC_GATE_C_TEXT_STAT_TIMESERIES_PANEL_CATALOG,
  PocGrafanaProviders,
  acquirePocRuntime,
  createPocQueryEvidenceRecorder,
  createPocStyleModeManager,
  inspectPocRuntime,
  type PocDashboardSceneRoot,
  type PocRuntimeLease,
} from '@dashboard-render-sdk-g/poc-compat';
import { createPortal } from 'react-dom';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { createSharedGrafanaCohortProvider } from '../../bundle/shared-grafana-cohort/providerBootstrap.ts';
import type { SharedCohortEvent } from '../../bundle/shared-grafana-cohort/sharedCohortLoader.ts';
import type { LazyPanelLoadEvent } from '../../bundle/lazy-panel-chunks/closedLazyPanelCatalog.ts';
import { EMOTION_CACHE_KEYS } from './cachePolicy.ts';

import '../../bundle/lazy-panel-chunks/browser.css';
import '../host-css-containment/provider-containment.css';

type InsertionModel = 'head' | 'marked' | 'prepend';

interface ProviderConfiguration {
  readonly insertionPoint?: HTMLElement;
  readonly model: InsertionModel;
}

declare global {
  // eslint-disable-next-line no-var
  var __EMOTION_COEXISTENCE_PROVIDER_CONFIG__: ProviderConfiguration | undefined;
}

const configuration = globalThis.__EMOTION_COEXISTENCE_PROVIDER_CONFIG__ ?? { model: 'head' };
const providerCacheOptions: EmotionCacheOptions = { key: EMOTION_CACHE_KEYS.provider };
if (configuration.model === 'marked' && configuration.insertionPoint) {
  providerCacheOptions.insertionPoint = configuration.insertionPoint;
} else if (configuration.model === 'prepend') {
  providerCacheOptions.prepend = true;
}
const providerCache = createCache(providerCacheOptions);
const browserRequest = window.fetch.bind(window);
const cohortEvents: SharedCohortEvent[] = [];
const pluginEvents: LazyPanelLoadEvent[] = [];
const queryEvidence = createPocQueryEvidenceRecorder();
const scenes: PocDashboardSceneRoot[] = [];
const provider = createSharedGrafanaCohortProvider({
  cohortEvidence: { record: (event) => cohortEvents.push(structuredClone(event)) },
  panelEvidence: { record: (event) => pluginEvents.push(structuredClone(event)) },
});
const runtimePanelCatalog = Object.freeze({
  ...POC_GATE_C_TEXT_STAT_TIMESERIES_PANEL_CATALOG,
  pluginImportUtils: provider.panels,
});
const loadTestDataClass = async () => (await provider.loadTestData()).plugin.DataSourceClass;
const styleManager = createPocStyleModeManager(document.documentElement);

interface ProviderController {
  resize(): void;
  switchUid(): void;
  toggleSecondary(): void;
}

let providerController: ProviderController | undefined;

function cacheEvidence(cache: EmotionCache, id: string) {
  return {
    id,
    inserted: Object.keys(cache.inserted).length,
    key: cache.key,
    tags: cache.sheet.tags.length,
  };
}

function markGrafanaPortal() {
  const portal = document.getElementById('grafana-portal-container');
  if (!portal) return;
  portal.dataset.grsdkProvider = 'grafana-13.2.3';
  portal.dataset.grsdkSurface = 'portal';
  portal.dataset.grsdkTheme = 'light';
}

export function inspectEmotionCoexistenceProvider(hostCache?: EmotionCache) {
  return {
    cacheObjectsDistinct: {
      hostVsProvider: hostCache ? hostCache !== providerCache : true,
      hostVsProviderCss: hostCache ? hostCache !== providerCssCache : true,
      providerVsProviderCss: providerCache !== providerCssCache,
    },
    caches: {
      provider: cacheEvidence(providerCache, 'provider-react-cache-1'),
      providerCss: cacheEvidence(providerCssCache, 'provider-css-cache-1'),
    },
    cohort: {
      cohortEvents: structuredClone(cohortEvents),
      pluginEvents: structuredClone(pluginEvents),
      queryEvents: queryEvidence.snapshot(),
      runtime: inspectPocRuntime(),
      scenes: scenes.map((scene) => ({ active: scene.isActive, uid: scene.state.uid })),
    },
    configuration: {
      container: providerCache.sheet.container === document.head ? 'document.head' : 'custom',
      insertionPoint: configuration.insertionPoint?.dataset.emotionInsertionPoint,
      model: configuration.model,
      nonce: providerCache.nonce,
      prepend: configuration.model === 'prepend',
    },
  };
}

export function resizeEmotionProvider() {
  providerController?.resize();
}

export function switchEmotionProviderUid() {
  providerController?.switchUid();
}

export function toggleEmotionProviderSecondary() {
  providerController?.toggleSecondary();
}

export interface EmotionCoexistenceProviderAppProps {
  readonly portalTarget: Element;
}

function ProviderDashboard() {
  const [runtime, setRuntime] = useState<PocRuntimeLease>();
  const [runtimeError, setRuntimeError] = useState<string>();
  const [uid, setUid] = useState<'grsdk-phase0-poc' | 'grsdk-phase0-poc-alt'>('grsdk-phase0-poc');
  const [width, setWidth] = useState(1120);
  const [showSecond, setShowSecond] = useState(false);
  const converterCatalog = useMemo(() => ({
    identity: 'emotion-coexistence-text-stat-timeseries',
    panelIds: ['text', 'stat', 'timeseries'] as const,
  }), []);

  providerController = {
    resize: () => setWidth((value) => value === 1120 ? 640 : 1120),
    switchUid: () => setUid((value) => value === 'grsdk-phase0-poc' ? 'grsdk-phase0-poc-alt' : 'grsdk-phase0-poc'),
    toggleSecondary: () => setShowSecond((value) => !value),
  };

  useEffect(() => {
    let disposed = false;
    let lease: PocRuntimeLease | undefined;
    const styleLease = styleManager.acquire('minimum-scoped');
    void acquirePocRuntime({
      assetBasePath: '/grafana/public/',
      grafanaBasePath: '/grafana',
      locale: 'en-US',
      namespace: 'default',
      panelCatalog: runtimePanelCatalog,
      request: browserRequest,
      theme: 'light',
      timezone: 'browser',
    }).then(async (acquired) => {
      lease = acquired;
      await acquired.acquireQueryRuntime({
        evidence: queryEvidence,
        loadDataSourceClass: loadTestDataClass,
        moduleIdentity: 'public/app/plugins/datasource/grafana-testdata-datasource/datasource.ts',
      });
      await Promise.all([
        provider.panels.importPanelPlugin('text'),
        provider.panels.importPanelPlugin('stat'),
        provider.panels.importPanelPlugin('timeseries'),
      ]);
      if (disposed) acquired.release();
      else setRuntime(acquired);
    }).catch((error: unknown) => {
      lease?.release();
      if (!disposed) setRuntimeError(error instanceof Error ? error.message : 'Runtime failed.');
    });
    return () => {
      disposed = true;
      providerController = undefined;
      lease?.release();
      styleLease.release();
    };
  }, []);

  const recordScene = useCallback((scene: PocDashboardSceneRoot) => {
    scenes.push(scene);
    markGrafanaPortal();
  }, []);

  return (
    <section
      aria-label="Grafana provider surface"
      className="grsdk-experiment-provider-surface"
      data-grsdk-provider="grafana-13.2.3"
      data-grsdk-surface="dashboard"
      data-grsdk-theme="light"
      data-testid="emotion-provider-surface"
      style={{ width }}
    >
      {runtimeError ? <div data-testid="runtime-error">{runtimeError}</div> : null}
      {runtime ? (
        <PocGrafanaProviders values={runtime.providerValues}>
          <div className="grsdk-experiment-dashboard-list">
            <GrafanaDashboard
              catalog={converterCatalog}
              instanceId="emotion-primary"
              onSceneReady={recordScene}
              runtime={runtime}
              uid={uid}
            />
            {showSecond ? (
              <GrafanaDashboard
                catalog={converterCatalog}
                instanceId="emotion-secondary"
                onSceneReady={recordScene}
                runtime={runtime}
                uid="grsdk-phase0-poc"
              />
            ) : null}
          </div>
        </PocGrafanaProviders>
      ) : <div data-testid="provider-loading">Preparing provider.</div>}
    </section>
  );
}

export function EmotionCoexistenceProviderApp({ portalTarget }: EmotionCoexistenceProviderAppProps) {
  return (
    <CacheProvider value={providerCache}>
      <ClassNames>
        {({ css }) => (
          <output
            className={css({ backgroundColor: '#d1fae5', color: '#065f46', display: 'block', padding: 6 })}
            data-testid="provider-emotion-sentinel"
          >
            provider-emotion-ready
          </output>
        )}
      </ClassNames>
      {createPortal(
        <ClassNames>
          {({ css }) => (
            <output
              className={css({ backgroundColor: '#cffafe', color: '#155e75', display: 'block', padding: 4 })}
              data-testid="provider-emotion-portal"
            >
              provider-portal-styled
            </output>
          )}
        </ClassNames>,
        portalTarget
      )}
      <ProviderDashboard />
    </CacheProvider>
  );
}
