// POC / EXPERIMENT / NOT FOR PRODUCTION
import createCache, { type EmotionCache } from '@emotion/cache';
import { cache as providerCssCache } from '@emotion/css';
import { CacheProvider, ClassNames } from '@emotion/react';
import { UNSAFE_PortalProvider } from '@react-aria/overlays';
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
} from '@grafana-react-sdk/poc-compat';
import {
  type Context,
  createContext,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import { createSharedGrafanaCohortProvider } from '../../bundle/shared-grafana-cohort/providerBootstrap.ts';
import type { SharedCohortEvent } from '../../bundle/shared-grafana-cohort/sharedCohortLoader.ts';
import type { LazyPanelLoadEvent } from '../../bundle/lazy-panel-chunks/closedLazyPanelCatalog.ts';
import { inspectProviderPortalRoot, validateProviderPortalRoot } from './portalContract.ts';
import { resolveOverlayBand, type OverlayBand, type OverlayPolicyInput } from './zIndexPolicy.ts';

import '../../bundle/lazy-panel-chunks/browser.css';
import '../host-css-containment/provider-containment.css';
import './provider.css';

type GrafanaUiModule = typeof import('@grafana/ui');

interface ProviderConfiguration extends OverlayPolicyInput {
  readonly providerBase?: number;
}

declare global {
  // eslint-disable-next-line no-var
  var __PORTAL_FOCUS_PROVIDER_CONFIG__: ProviderConfiguration | undefined;
}

const configuration = globalThis.__PORTAL_FOCUS_PROVIDER_CONFIG__ ?? { model: 'fixed' as const };
const overlayBand = resolveOverlayBand(configuration);
const providerCache = createCache({ key: 'grsdk-provider' });
const browserRequest = window.fetch.bind(window);
const cohortEvents: SharedCohortEvent[] = [];
const pluginEvents: LazyPanelLoadEvent[] = [];
const queryEvidence = createPocQueryEvidenceRecorder();
const scenes: PocDashboardSceneRoot[] = [];
const eventEvidence = {
  nativeDocument: 0,
  outside: 0,
  providerSynthetic: 0,
};
const provider = createSharedGrafanaCohortProvider({
  cohortEvidence: { record: (event) => cohortEvents.push(structuredClone(event)) },
  panelEvidence: { record: (event) => pluginEvents.push(structuredClone(event)) },
});
const runtimePanelCatalog = Object.freeze({
  ...POC_GATE_C_TEXT_STAT_TIMESERIES_PANEL_CATALOG,
  pluginImportUtils: provider.panels,
});
const converterCatalog = Object.freeze({
  identity: 'portal-focus-text-stat-timeseries',
  panelIds: ['text', 'stat', 'timeseries'] as const,
});
const loadTestDataClass = async () => (await provider.loadTestData()).plugin.DataSourceClass;
const styleManager = createPocStyleModeManager(document.documentElement);

type OwnerId = 'portal-primary' | 'portal-secondary';

interface ProviderController {
  closeAll(): void;
  mountPrimary(): void;
  resize(): void;
  switchUidWithOpenModal(): void;
  togglePrimary(): void;
  toggleSecondary(): void;
  unmountProvider(): void;
}

let providerController: ProviderController | undefined;
let providerPortalReferences = 0;
let providerOwnedPortalRoot: HTMLElement | undefined;

function markPortal() {
  const root = document.getElementById('grafana-portal-container');
  if (!root) throw new Error('portal.body-fallback: provider portal root was not acquired.');
  root.dataset.grsdkProvider = 'grafana-13.2.3';
  root.dataset.grsdkRuntime = 'portal-focus-zindex-v1';
  root.dataset.grsdkSurface = 'portal';
  root.dataset.grsdkTheme = 'light';
  root.dataset.grsdkReferences = String(providerPortalReferences);
  root.style.setProperty('--grsdk-overlay-portal', String(overlayBand.portal));
  root.style.setProperty('--grsdk-overlay-popover', String(overlayBand.popover));
  root.style.setProperty('--grsdk-overlay-modal', String(overlayBand.modal));
  root.style.setProperty('--grsdk-overlay-nested', String(overlayBand.nested));
  root.style.zIndex = String(overlayBand.portal);
  validateProviderPortalRoot(inspectProviderPortalRoot(root));
  return root;
}

function acquireProviderPortalRoot() {
  let root = document.getElementById('grafana-portal-container');
  if (root) {
    validateProviderPortalRoot(inspectProviderPortalRoot(root));
  } else {
    root = document.createElement('div');
    root.id = 'grafana-portal-container';
    document.body.append(root);
    providerOwnedPortalRoot = root;
  }
  providerPortalReferences += 1;
  markPortal();
  let active = true;
  return () => {
    if (!active) return;
    active = false;
    providerPortalReferences = Math.max(0, providerPortalReferences - 1);
    if (providerPortalReferences === 0 && providerOwnedPortalRoot) {
      providerOwnedPortalRoot.remove();
      providerOwnedPortalRoot = undefined;
    } else if (root?.isConnected) {
      root.dataset.grsdkReferences = String(providerPortalReferences);
    }
  };
}

function controlledPortalRoot() {
  const root = document.getElementById('grafana-portal-container');
  if (!root) {
    throw new Error('portal.body-fallback: Grafana UI resolved document.body instead of the provider root.');
  }
  validateProviderPortalRoot(inspectProviderPortalRoot(root));
  return root;
}

function markLogicalOwner(owner: OwnerId) {
  requestAnimationFrame(() => {
    const content = document.querySelector(`[data-grsdk-overlay-owner="${owner}"]`);
    const root = document.getElementById('grafana-portal-container');
    if (!content || !root) return;
    const child = [...root.children].find((candidate) => candidate.contains(content));
    if (child instanceof HTMLElement) child.dataset.grsdkOverlayOwner = owner;
    if (content.getAttribute('data-grsdk-overlay-kind') === 'modal') {
      content.closest('[role="dialog"]')?.setAttribute('aria-modal', 'true');
    }
  });
}

function setBackgroundInert(active: boolean) {
  const hostRoot = document.getElementById('root');
  if (!hostRoot) return;
  hostRoot.inert = active;
  if (active) hostRoot.setAttribute('aria-hidden', 'true');
  else hostRoot.removeAttribute('aria-hidden');
}

function restoreFocus(target: HTMLElement | null, fallback: HTMLElement | null) {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    if (target?.isConnected) target.focus();
    else if (fallback?.isConnected) fallback.focus();
  }));
}

interface OverlayControlsProps {
  readonly band: OverlayBand;
  readonly contextValue: string;
  readonly onModalState: (open: boolean) => void;
  readonly owner: OwnerId;
  readonly providerFallback: HTMLElement | null;
  readonly surface: HTMLElement | null;
  readonly ui: GrafanaUiModule;
}

function OverlayControls({ band, contextValue, onModalState, owner, providerFallback, surface, ui }: OverlayControlsProps) {
  const { Modal, Popover } = ui;
  const popoverTrigger = useRef<HTMLButtonElement>(null);
  const modalTrigger = useRef<HTMLButtonElement>(null);
  const nestedTrigger = useRef<HTMLButtonElement>(null);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [nestedOpen, setNestedOpen] = useState(false);

  const closeModal = useCallback((fallback = surface ?? providerFallback) => {
    const invoker = modalTrigger.current;
    setNestedOpen(false);
    setModalOpen(false);
    setBackgroundInert(false);
    onModalState(false);
    restoreFocus(invoker, fallback);
  }, [onModalState, providerFallback, surface]);

  useEffect(() => {
    if (!popoverOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPopoverOpen(false);
        popoverTrigger.current?.focus();
      }
    };
    const onPointer = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (
        target?.closest('[data-grsdk-overlay-owner]') ||
        target?.closest('[data-grsdk-overlay-control-owner]') ||
        popoverTrigger.current?.contains(target)
      ) return;
      eventEvidence.outside += 1;
      setPopoverOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('click', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('click', onPointer);
    };
  }, [owner, popoverOpen]);

  useEffect(() => () => {
    if (modalOpen) {
      setBackgroundInert(false);
      onModalState(false);
      restoreFocus(null, providerFallback);
    }
  }, [modalOpen, onModalState, providerFallback]);

  const openModal = () => {
    controlledPortalRoot();
    setModalOpen(true);
    setBackgroundInert(true);
    onModalState(true);
    markLogicalOwner(owner);
  };

  return (
    <div className="grsdk-overlay-controls" data-grsdk-overlay-control-owner={owner} data-testid={`overlay-controls-${owner}`}>
      <button
        className="grsdk-overlay-control"
        data-testid={`popover-trigger-${owner}`}
        onClick={() => {
          controlledPortalRoot();
          setPopoverOpen((value) => !value);
          markLogicalOwner(owner);
        }}
        ref={popoverTrigger}
        type="button"
      >
        Open non-modal overlay
      </button>
      {popoverTrigger.current ? (
        <Popover
          content={(
            <div
              className="grsdk-overlay-content"
              data-context-value={contextValue}
              data-grsdk-overlay-kind="popover"
              data-grsdk-overlay-owner={owner}
              data-testid={`popover-${owner}`}
              onClick={() => { eventEvidence.providerSynthetic += 1; }}
            >
              <strong>Provider popover {owner}</strong>
              <button data-testid={`popover-action-${owner}`} type="button">Popover action</button>
            </div>
          )}
          referenceElement={popoverTrigger.current}
          show={popoverOpen}
          style={{ zIndex: band.popover }}
          wrapperClassName="grsdk-nonmodal-overlay"
        />
      ) : null}
      <button
        className="grsdk-overlay-control"
        data-testid={`modal-trigger-${owner}`}
        onClick={openModal}
        ref={modalTrigger}
        type="button"
      >
        Open modal
      </button>
      <Modal
        isOpen={modalOpen}
        onDismiss={() => closeModal()}
        title={`Provider modal ${owner}`}
      >
        <div
          className="grsdk-overlay-content"
          data-context-value={contextValue}
          data-grsdk-overlay-kind="modal"
          data-grsdk-overlay-owner={owner}
          data-testid={`modal-content-${owner}`}
          onClick={() => { eventEvidence.providerSynthetic += 1; }}
          onKeyDownCapture={(event) => {
            if (event.key === 'Escape' && nestedOpen) {
              event.stopPropagation();
              setNestedOpen(false);
              nestedTrigger.current?.focus();
            }
          }}
        >
          <button data-testid={`modal-first-${owner}`} type="button">First action</button>
          <button data-testid={`nested-trigger-${owner}`} onClick={() => {
            setNestedOpen((value) => !value);
            markLogicalOwner(owner);
          }} ref={nestedTrigger} type="button">Nested popover</button>
          <button data-testid={`modal-last-${owner}`} onClick={() => closeModal()} type="button">Close modal</button>
          {nestedTrigger.current ? (
            <Popover
              content={(
                <div
                  className="grsdk-overlay-content"
                  data-grsdk-overlay-kind="nested"
                  data-grsdk-overlay-owner={owner}
                  data-testid={`nested-overlay-${owner}`}
                  style={{ position: 'relative', zIndex: band.nested }}
                >
                  Nested provider overlay
                </div>
              )}
              referenceElement={nestedTrigger.current}
              show={nestedOpen}
              style={{ zIndex: band.nested }}
            />
          ) : null}
        </div>
      </Modal>
    </div>
  );
}

interface DashboardOwnerProps {
  readonly context: Context<string>;
  readonly instanceId: OwnerId;
  readonly onSceneReady: (scene: PocDashboardSceneRoot) => void;
  readonly providerFallback: HTMLElement | null;
  readonly runtime: PocRuntimeLease;
  readonly uid: 'grsdk-phase0-poc' | 'grsdk-phase0-poc-alt';
  readonly ui: GrafanaUiModule;
  readonly width: number;
}

function DashboardOwner({ context: ProviderContext, instanceId, onSceneReady, providerFallback, runtime, uid, ui, width }: DashboardOwnerProps) {
  const surfaceRef = useRef<HTMLElement>(null);
  const [modalOpen, setModalOpen] = useState(false);
  return (
    <ProviderContext.Provider value={`context-${instanceId}`}>
      <section
        aria-label={`Dashboard owner ${instanceId}`}
        className="grsdk-portal-dashboard-owner"
        data-modal-open={modalOpen ? 'true' : 'false'}
        data-testid={`dashboard-owner-${instanceId}`}
        ref={surfaceRef}
        style={{ width }}
        tabIndex={-1}
      >
        <OverlayControls
          band={overlayBand}
          contextValue={`context-${instanceId}`}
          onModalState={setModalOpen}
          owner={instanceId}
          providerFallback={providerFallback}
          surface={surfaceRef.current}
          ui={ui}
        />
        <GrafanaDashboard
          catalog={converterCatalog}
          instanceId={instanceId}
          onSceneReady={onSceneReady}
          runtime={runtime}
          uid={uid}
        />
      </section>
    </ProviderContext.Provider>
  );
}

function cacheEvidence(cache: EmotionCache, id: string) {
  return { id, inserted: Object.keys(cache.inserted).length, key: cache.key, tags: cache.sheet.tags.length };
}

const ProviderContext = createContext('missing-provider-context');

function ProviderDashboard() {
  const providerSurface = useRef<HTMLElement>(null);
  const [runtime, setRuntime] = useState<PocRuntimeLease>();
  const [runtimeError, setRuntimeError] = useState<string>();
  const [grafanaUi, setGrafanaUi] = useState<GrafanaUiModule>();
  const [primaryUid, setPrimaryUid] = useState<'grsdk-phase0-poc' | 'grsdk-phase0-poc-alt'>('grsdk-phase0-poc');
  const [showPrimary, setShowPrimary] = useState(true);
  const [showSecondary, setShowSecondary] = useState(false);
  const [width, setWidth] = useState(1120);

  useEffect(() => {
    let disposed = false;
    let lease: PocRuntimeLease | undefined;
    const releasePortalRoot = acquireProviderPortalRoot();
    const styleLease = styleManager.acquire('minimum-scoped');
    const onNativeClick = () => { eventEvidence.nativeDocument += 1; };
    document.addEventListener('click', onNativeClick);
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
      const loadedGrafanaUi = await import('@grafana/ui');
      await acquired.acquireQueryRuntime({
        evidence: queryEvidence,
        loadDataSourceClass: loadTestDataClass,
        moduleIdentity: 'public/app/plugins/datasource/grafana-testdata-datasource/datasource.ts',
      });
      await Promise.all(['text', 'stat', 'timeseries'].map((id) => provider.panels.importPanelPlugin(id)));
      if (disposed) acquired.release();
      else {
        setGrafanaUi(loadedGrafanaUi);
        setRuntime(acquired);
      }
    }).catch((error: unknown) => {
      lease?.release();
      if (!disposed) setRuntimeError(error instanceof Error ? error.message : 'Runtime failed.');
    });
    return () => {
      disposed = true;
      document.removeEventListener('click', onNativeClick);
      setBackgroundInert(false);
      lease?.release();
      styleLease.release();
      releasePortalRoot();
    };
  }, []);

  const recordScene = useCallback((scene: PocDashboardSceneRoot) => {
    scenes.push(scene);
    markPortal();
  }, []);

  providerController = {
    closeAll: () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })),
    mountPrimary: () => setShowPrimary(true),
    resize: () => setWidth((value) => value === 1120 ? 640 : 1120),
    switchUidWithOpenModal: () => {
      setPrimaryUid((value) => value === 'grsdk-phase0-poc' ? 'grsdk-phase0-poc-alt' : 'grsdk-phase0-poc');
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    },
    togglePrimary: () => setShowPrimary((value) => !value),
    toggleSecondary: () => setShowSecondary((value) => !value),
    unmountProvider: () => undefined,
  };

  const content = runtime && grafanaUi ? (
    <PocGrafanaProviders values={runtime.providerValues}>
      {showPrimary ? (
        <DashboardOwner
          context={ProviderContext}
          instanceId="portal-primary"
          key={`portal-primary-${primaryUid}`}
          onSceneReady={recordScene}
          providerFallback={providerSurface.current}
          runtime={runtime}
          uid={primaryUid}
          ui={grafanaUi}
          width={width}
        />
      ) : null}
      {showSecondary ? (
        <DashboardOwner
          context={ProviderContext}
          instanceId="portal-secondary"
          key="portal-secondary-main"
          onSceneReady={recordScene}
          providerFallback={providerSurface.current}
          runtime={runtime}
          uid="grsdk-phase0-poc"
          ui={grafanaUi}
          width={width}
        />
      ) : null}
    </PocGrafanaProviders>
  ) : <div data-testid="provider-loading">Preparing provider.</div>;

  return (
    <section
      aria-label="Portal focus provider surface"
      className="grsdk-experiment-provider-surface grsdk-portal-experiment-surface"
      data-grsdk-provider="grafana-13.2.3"
      data-grsdk-surface="dashboard"
      data-testid="portal-provider-surface"
      ref={providerSurface}
      tabIndex={-1}
    >
      {runtimeError ? <div data-testid="runtime-error">{runtimeError}</div> : null}
      {runtime ? (
        <UNSAFE_PortalProvider getContainer={controlledPortalRoot}>
          {content}
        </UNSAFE_PortalProvider>
      ) : content}
    </section>
  );
}

export function inspectPortalFocusProvider(hostCache?: EmotionCache) {
  const root = document.getElementById('grafana-portal-container');
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
    events: structuredClone(eventEvidence),
    policy: { band: overlayBand, model: configuration.model },
    portal: {
      childCount: root?.childElementCount ?? 0,
      controlledBodyChild: root?.parentElement === document.body,
      directBodyFallbacks: [...document.body.children].filter((element) =>
        element !== root && element.querySelector?.('[data-grsdk-overlay-owner]')
      ).length,
      owners: root ? [...root.querySelectorAll<HTMLElement>('[data-grsdk-overlay-owner]')]
        .map((element) => element.dataset.grsdkOverlayOwner).filter(Boolean) : [],
      root: root ? inspectProviderPortalRoot(root) : undefined,
    },
  };
}

export function portalProviderCommand(command: keyof ProviderController) {
  providerController?.[command]();
}

export function PortalFocusProviderApp() {
  return (
    <CacheProvider value={providerCache}>
      <ClassNames>
        {({ css }) => (
          <output className={css({ color: '#065f46', display: 'block' })} data-testid="portal-provider-emotion">
            provider-portal-emotion-ready
          </output>
        )}
      </ClassNames>
      <ProviderDashboard />
    </CacheProvider>
  );
}
