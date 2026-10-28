import {
  validateProviderCompatibilityManifest,
  type DashboardRenderStatus,
  type HostReactRuntime,
  type ManifestValidationSuccess,
  type ProviderDashboardRendererProps,
} from '@dashboard-render-sdk-g/provider-contract';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as ReactDOMClient from 'react-dom/client';
import * as JsxDevRuntime from 'react/jsx-dev-runtime';
import * as JsxRuntime from 'react/jsx-runtime';
import { createElement, StrictMode } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';

import type { Grafana13PartialDashboardLoadResult } from '../partialContracts';
import { grafana13Provider } from '../provider';
import { createGrafana13TextPanelCatalog } from '../panels/catalog';
import { createGrafana13RuntimeDashboardMounter } from '../runtime/implementation';
import { Grafana13ErrorBoundaryAlert } from '../runtime/errorBoundaryAlert';
import {
  createGrafana13DashboardRenderer,
  Grafana13PanelRenderBoundary,
  type Grafana13RuntimeDashboardMount,
  type Grafana13RuntimeImplementation,
} from './Grafana13DashboardRenderer';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

const manifestResult = validateProviderCompatibilityManifest(grafana13Provider.manifest);
if (!manifestResult.valid) throw new Error('Expected the concrete provider manifest to be valid.');
const manifest: ManifestValidationSuccess = manifestResult;

const hostReact: HostReactRuntime = {
  identities: {
    jsxDevRuntime: JsxDevRuntime,
    jsxRuntime: JsxRuntime,
    react: React,
    reactDom: ReactDOM,
    reactDomClient: ReactDOMClient,
  },
  versions: { react: React.version, reactDom: ReactDOM.version },
};

const transport = {
  descriptor: {
    basePath: '/grafana',
    requestPolicyId: 'test-policy',
    schemaVersion: 1 as const,
    securityScopeId: 'test-scope',
    targetOrigin: 'https://grafana.example.test',
  },
  execute: async (request: { readonly requestId: string }) => ({
    kind: 'cancelled' as const,
    requestId: request.requestId,
  }),
};

function renderable(uid: string): Grafana13PartialDashboardLoadResult {
  return {
    dashboard: {
      constantVariables: [],
      kind: 'renderable',
      panels: [],
      supportedPanelCount: 1,
      timeRange: { from: 'now-1h', to: 'now' },
      timezone: 'browser',
      title: 'Dashboard',
      uid,
      unsupportedPanelCount: uid === 'primary' ? 3 : 0,
    },
    kind: 'renderable',
    requestIds: {
      dashboard: `${uid}-dashboard`,
      discovery: `${uid}-discovery`,
      health: `${uid}-health`,
    },
  };
}

function props(uid: string, statuses: DashboardRenderStatus[]): ProviderDashboardRendererProps {
  return {
    hostReact,
    instanceId: 'test-instance',
    manifest,
    namespace: 'default',
    onStatusChange: (status) => statuses.push(status),
    transport,
    uid,
  };
}

async function settle() {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await Promise.resolve();
}

export async function exerciseStatusAndSanitation() {
  const statuses: DashboardRenderStatus[] = [];
  const released: string[] = [];
  const retrievalResults: Grafana13PartialDashboardLoadResult[] = [
    {
      diagnostics: [], diagnosticsTruncated: false, kind: 'unsupported-dashboard',
      reason: 'target-version',
    },
    {
      diagnostics: [], diagnosticsTruncated: false, kind: 'unsupported-dashboard',
      reason: 'dashboard-schema',
    },
    {
      diagnostics: [], diagnosticsTruncated: false, kind: 'unsupported-dashboard',
      reason: 'dashboard-profile',
    },
    {
      error: {
        code: 'dashboard.unauthorized', message: 'safe', requestId: 'request-401',
        stage: 'dashboard-v1', status: 401,
      }, kind: 'failure',
    },
    {
      error: {
        code: 'dashboard.forbidden', message: 'safe', requestId: 'request-403',
        stage: 'dashboard-v1', status: 403,
      }, kind: 'failure',
    },
    {
      error: {
        code: 'dashboard.not-found', message: 'safe', requestId: 'request-404',
        stage: 'dashboard-v1', status: 404,
      }, kind: 'failure',
    },
    {
      error: {
        code: 'dashboard.transport-policy-error', message: 'safe', requestId: 'request-policy',
        stage: 'dashboard-v1', transportPolicyCode: 'invalid-request',
      }, kind: 'failure',
    },
    {
      error: {
        code: 'dashboard.network-error', message: 'safe', requestId: 'request-network',
        stage: 'dashboard-v1',
      }, kind: 'failure',
    },
    {
      error: {
        code: 'dashboard.http-error', message: 'safe', requestId: 'request-http',
        stage: 'dashboard-v1', status: 500,
      }, kind: 'failure',
    },
    {
      error: {
        code: 'dashboard.response-malformed', message: 'safe', requestId: 'request-malformed',
        stage: 'dashboard-v1',
      }, kind: 'failure',
    },
    {
      error: {
        code: 'dashboard.input-invalid', message: 'safe', stage: 'input',
      }, kind: 'failure',
    },
    renderable('ready'),
  ];
  const Renderer = createGrafana13DashboardRenderer({
    admitAndLoad: (_host, load) => load(),
    loadImplementation: async () => ({
      mountDashboard: async ({ dashboard }) => ({
        element: createElement('div', { 'data-mounted': dashboard.uid }, dashboard.uid),
        release: () => released.push(dashboard.uid),
      }),
    }),
    retrieve: async () => retrievalResults.shift()!,
  });
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  flushSync(() => root.render(createElement(Renderer, props('target', statuses))));
  await settle();
  flushSync(() => root.render(createElement(Renderer, props('schema', statuses))));
  await settle();
  const unsupported = container.textContent;
  flushSync(() => root.render(createElement(Renderer, props('profile', statuses))));
  await settle();
  flushSync(() => root.render(createElement(Renderer, props('unauthorized', statuses))));
  await settle();
  const unauthorized = container.textContent;
  for (const uid of ['forbidden', 'not-found', 'policy', 'network', 'http', 'malformed', 'invalid']) {
    flushSync(() => root.render(createElement(Renderer, props(uid, statuses))));
    await settle();
  }
  flushSync(() => root.render(createElement(Renderer, props('ready', statuses))));
  await settle();
  const ready = container.textContent;
  flushSync(() => root.unmount());
  container.remove();
  return {
    released,
    statuses,
    text: { ready, unauthorized, unsupported },
    serialized: JSON.stringify(statuses),
  };
}

export async function exerciseRace(stage: 'retrieval' | 'implementation' | 'runtime') {
  const statuses: DashboardRenderStatus[] = [];
  const oldRetrieval = deferred<Grafana13PartialDashboardLoadResult>();
  const oldImplementation = deferred<{
    mountDashboard(input: { readonly dashboard: { readonly uid: string } }): Promise<Grafana13RuntimeDashboardMount>;
  }>();
  const oldRuntime = deferred<Grafana13RuntimeDashboardMount>();
  const releaseCounts: Record<string, number> = {};
  const signals: Record<string, AbortSignal> = {};
  const mount = (uid: string): Grafana13RuntimeDashboardMount => ({
    element: createElement('div', { 'data-mounted': uid }, uid),
    release: () => { releaseCounts[uid] = (releaseCounts[uid] ?? 0) + 1; },
  });
  let oldLoadCalls = 0;
  const Renderer = createGrafana13DashboardRenderer({
    admitAndLoad: (_host, load) => load(),
    retrieve: async ({ signal, uid }) => {
      signals[uid] = signal;
      return uid === 'old' ? oldRetrieval.promise : renderable(uid);
    },
    loadImplementation: async () => {
      oldLoadCalls += 1;
      if (stage === 'implementation' && oldLoadCalls === 1) return oldImplementation.promise;
      return {
        mountDashboard: async ({ dashboard }) => {
          if (stage === 'runtime' && dashboard.uid === 'old') return oldRuntime.promise;
          return mount(dashboard.uid);
        },
      };
    },
  });
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  flushSync(() => root.render(createElement(Renderer, props('old', statuses))));
  await settle();
  if (stage !== 'retrieval') oldRetrieval.resolve(renderable('old'));
  await settle();
  flushSync(() => root.render(createElement(Renderer, props('new', statuses))));
  await settle();
  if (stage === 'retrieval') oldRetrieval.resolve(renderable('old'));
  if (stage === 'implementation') {
    oldImplementation.resolve({ mountDashboard: async ({ dashboard }) => mount(dashboard.uid) });
  }
  if (stage === 'runtime') oldRuntime.resolve(mount('old'));
  await settle();
  const text = container.textContent;
  const beforeUnmount = { ...releaseCounts };
  flushSync(() => root.unmount());
  container.remove();
  return { beforeUnmount, oldAborted: signals.old?.aborted, releaseCounts, statuses, text };
}

export async function exerciseLateRejection(stage: 'retrieval' | 'implementation' | 'runtime') {
  const statuses: DashboardRenderStatus[] = [];
  const pendingRetrieval = deferred<Grafana13PartialDashboardLoadResult>();
  const pendingImplementation = deferred<Grafana13RuntimeImplementation>();
  const pendingRuntime = deferred<Grafana13RuntimeDashboardMount>();
  const Renderer = createGrafana13DashboardRenderer({
    admitAndLoad: (_host, load) => load(),
    retrieve: async () => stage === 'retrieval' ? pendingRetrieval.promise : renderable('late'),
    loadImplementation: async () => {
      if (stage === 'implementation') return pendingImplementation.promise;
      return { mountDashboard: async () => stage === 'runtime' ? pendingRuntime.promise : {
        element: null, release() {},
      } };
    },
  });
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  flushSync(() => root.render(createElement(Renderer, props('late', statuses))));
  await settle();
  flushSync(() => root.unmount());
  const rejected = new Error('secret-late-rejection');
  if (stage === 'retrieval') pendingRetrieval.reject(rejected);
  if (stage === 'implementation') pendingImplementation.reject(rejected);
  if (stage === 'runtime') pendingRuntime.reject(rejected);
  await settle();
  container.remove();
  return { statuses };
}

export async function exerciseUnmountAndStrictMode(stage: 'retrieval' | 'implementation' | 'runtime') {
  const statuses: DashboardRenderStatus[] = [];
  const pendingRetrieval = deferred<Grafana13PartialDashboardLoadResult>();
  const pendingImplementation = deferred<{
    mountDashboard(input: { readonly dashboard: { readonly uid: string } }): Promise<Grafana13RuntimeDashboardMount>;
  }>();
  const pendingRuntime = deferred<Grafana13RuntimeDashboardMount>();
  let retrievals = 0;
  let imports = 0;
  let mounts = 0;
  let releases = 0;
  const Renderer = createGrafana13DashboardRenderer({
    admitAndLoad: (_host, load) => load(),
    retrieve: async () => {
      retrievals += 1;
      return stage === 'retrieval' ? pendingRetrieval.promise : renderable('strict');
    },
    loadImplementation: async () => {
      imports += 1;
      if (stage === 'implementation') return pendingImplementation.promise;
      return {
        mountDashboard: async () => {
          mounts += 1;
          return stage === 'runtime' ? pendingRuntime.promise : {
            element: createElement('div', null, 'strict'), release: () => { releases += 1; },
          };
        },
      };
    },
  });
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  flushSync(() => root.render(createElement(StrictMode, null, createElement(Renderer, props('strict', statuses)))));
  await settle();
  flushSync(() => root.unmount());
  if (stage === 'retrieval') pendingRetrieval.resolve(renderable('strict'));
  if (stage === 'implementation') pendingImplementation.resolve({
    mountDashboard: async () => ({ element: null, release: () => { releases += 1; } }),
  });
  if (stage === 'runtime') pendingRuntime.resolve({ element: null, release: () => { releases += 1; } });
  await settle();
  container.remove();
  return { imports, mounts, releases, retrievals, statuses };
}

export async function exerciseHostileFailures() {
  const statuses: DashboardRenderStatus[] = [];
  let mode: 'import' | 'runtime' = 'import';
  const Renderer = createGrafana13DashboardRenderer({
    admitAndLoad: (_host, load) => load(),
    retrieve: async ({ uid }) => renderable(uid),
    loadImplementation: async () => {
      if (mode === 'import') throw new Error('secret-import-cause Authorization: Bearer secret');
      return { mountDashboard: async () => { throw new Error('secret-runtime-cause Cookie: secret'); } };
    },
  });
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  flushSync(() => root.render(createElement(Renderer, props('import-failure', statuses))));
  await settle();
  mode = 'runtime';
  flushSync(() => root.render(createElement(Renderer, props('runtime-failure', statuses))));
  await settle();
  const serialized = JSON.stringify(statuses);
  flushSync(() => root.unmount());
  container.remove();
  return { serialized, statuses };
}

export async function exercisePanelBoundary() {
  const failures: string[] = [];
  function ThrowingPanel(): React.JSX.Element { throw new Error('secret-panel-cause'); }
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  flushSync(() => root.render(createElement('div', null,
    createElement(Grafana13PanelRenderBoundary, {
      onFailure: () => failures.push('failed'), panelId: 1, uid: 'dashboard',
    }, createElement(ThrowingPanel)),
    createElement('div', { 'data-independent-fallback': true }, 'Not-Supported')
  )));
  await settle();
  const result = {
    error: container.querySelector('[data-dashboard-panel-error="1"]')?.textContent,
    failures,
    independent: container.querySelector('[data-independent-fallback]')?.textContent,
    secretPresent: container.textContent?.includes('secret') ?? false,
  };
  flushSync(() => root.unmount());
  container.remove();
  return result;
}

export async function exerciseActualCatalogueFailure() {
  const statuses: DashboardRenderStatus[] = [];
  const releaseOrder: string[] = [];
  const catalog = createGrafana13TextPanelCatalog({
    loadTextPlugin: async () => {
      throw new Error('secret Text loader cause Cookie: secret');
    },
  });
  const mountDashboard = createGrafana13RuntimeDashboardMounter({
    acquire: async () => ({
      acquireSceneScope: () => { throw new Error('scope must not be acquired'); },
      cohort: { runtime: { getPluginImportUtils: () => catalog }, scenes: {} },
      providerValues: {},
      release: () => releaseOrder.push('lease'),
    } as never),
    convert: () => { throw new Error('conversion must not run'); },
    createProviderElement: () => { throw new Error('provider must not render'); },
  });
  const Renderer = createGrafana13DashboardRenderer({
    admitAndLoad: (_host, load) => load(),
    loadImplementation: async () => ({ mountDashboard }),
    retrieve: async () => {
      const result = renderable('catalogue-failure');
      if (result.kind === 'renderable') return { ...result, dashboard: { ...result.dashboard, panels: [{ kind: 'supported', panelType: 'text' }] } } as never;
      return result;
    },
  });
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  flushSync(() => root.render(createElement(Renderer, props('catalogue-failure', statuses))));
  await settle();
  const result = {
    releaseOrder,
    serialized: JSON.stringify(statuses),
    status: statuses.at(-1),
    text: container.textContent,
  };
  flushSync(() => root.unmount());
  container.remove();
  return result;
}

export async function exerciseProjectedInnerBoundary() {
  const failures: number[] = [];
  function ThrowingPanel(): React.JSX.Element {
    throw new Error('secret nested panel error Authorization: Bearer secret');
  }
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  flushSync(() => root.render(createElement('div', null,
    createElement(Grafana13PanelRenderBoundary, {
      onFailure: (panelId) => failures.push(panelId), panelId: 7, uid: 'dashboard',
    }, createElement(Grafana13ErrorBoundaryAlert, null, createElement(ThrowingPanel))),
    createElement('div', { 'data-independent-fallback': true }, 'Not-Supported')
  )));
  await settle();
  const result = {
    error: container.querySelector('[data-dashboard-panel-error="7"]')?.textContent,
    failures,
    independent: container.querySelector('[data-independent-fallback]')?.textContent,
    secretPresent: container.textContent?.includes('secret') ?? false,
  };
  flushSync(() => root.unmount());
  container.remove();
  return result;
}
