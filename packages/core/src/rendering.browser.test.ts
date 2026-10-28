// Test-only browser entry; ReactDOM belongs to the host, never to core production.
import type { DashboardRenderStatus, ProviderDashboardRendererProps, ProviderCompatibilityManifest } from '@dashboard-render-sdk-g/provider-contract';
import { createElement, StrictMode, useLayoutEffect } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { createDashboardRenderSdk, GrafanaDashboard } from './index';

export function exercise(manifest: ProviderCompatibilityManifest) {
  const callbacks: NonNullable<ProviderDashboardRendererProps['onStatusChange']>[] = [];
  const instances: string[] = [];
  const statuses: DashboardRenderStatus[] = [];
  const cleanup: string[] = [];
  const hostReact = { versions: { react: '19.2.8', reactDom: '19.2.8' }, identities: { react: {}, reactDom: {}, reactDomClient: {}, jsxRuntime: {}, jsxDevRuntime: {} } };
  function Renderer(props: ProviderDashboardRendererProps) {
    useLayoutEffect(() => {
      instances.push(props.instanceId);
      callbacks.push(props.onStatusChange!);
      props.onStatusChange!({ kind: 'loading', uid: props.uid });
      return () => { cleanup.push(props.uid); props.onStatusChange!({ kind: 'ready', uid: props.uid, supportedPanelCount: 0, unsupportedPanelCount: 0 }); };
    }, []);
    return createElement('div', { 'data-uid': props.uid }, props.uid);
  }
  const result = createDashboardRenderSdk({ provider: { manifest }, hostReact, renderer: Renderer, namespace: 'custom', transport: { descriptor: { schemaVersion: 1, targetOrigin: 'https://example.invalid', basePath: '/', securityScopeId: 'scope', requestPolicyId: 'policy' }, execute: async (request) => ({ kind: 'cancelled', requestId: request.requestId }) } });
  if (!result.valid) throw new Error('SDK creation failed');
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const render = (uid: string, strict = false) => {
    const dashboard = createElement(GrafanaDashboard, { sdk: result.sdk, uid, onStatusChange: (status) => statuses.push(status) });
    flushSync(() => root.render(strict ? createElement(StrictMode, null, dashboard) : dashboard));
  };
  render('a');
  const first = container.firstElementChild;
  render('b');
  const replaced = first !== container.firstElementChild && !first!.isConnected && container.textContent === 'b';
  callbacks[0]!({ kind: 'loading', uid: 'a' });
  callbacks[1]!({ kind: 'loading', uid: 'wrong' });
  callbacks[1]!({ kind: 'loading', uid: 'b' });
  const beforeUnmount = statuses.map((status) => `${status.kind}:${status.uid}`);
  flushSync(() => root.unmount());
  callbacks[1]!({ kind: 'loading', uid: 'b' });
  const afterUnmount = statuses.map((status) => `${status.kind}:${status.uid}`);
  const strictRoot = createRoot(container);
  flushSync(() => strictRoot.render(createElement(StrictMode, null, createElement(GrafanaDashboard, { sdk: result.sdk, uid: 'strict', onStatusChange: (status) => statuses.push(status) }))));
  const strictStart = statuses.length;
  callbacks.at(-1)!({ kind: 'loading', uid: 'strict' });
  const strictActive = statuses.length === strictStart + 1;
  flushSync(() => strictRoot.unmount());
  container.remove();
  return { replaced, instances: instances.slice(0, 2), cleanup: cleanup.slice(0, 2), beforeUnmount, afterUnmount, strictActive };
}
