import type {
  DashboardRenderFailure,
  DashboardRenderFailureCode,
  DashboardRenderStatus,
  ProviderDashboardRendererProps,
} from '@dashboard-render-sdk-g/provider-contract';
import {
  Component,
  createElement,
  useEffect,
  useRef,
  useState,
  type ErrorInfo,
  type ReactNode,
} from 'react';

import type {
  Grafana13PartialDashboardLoadInput,
  Grafana13PartialDashboardLoadResult,
  Grafana13PartialPreflightResult,
} from '../partialContracts';
import { retrieveAndClassifyGrafana13DashboardV1 } from '../partialDashboardApi';
import { loadAfterHostReactAdmission } from './reactIdentity';

type RenderableDashboard = Grafana13PartialPreflightResult & { readonly kind: 'renderable' };

export interface Grafana13RuntimeDashboardMount {
  readonly element: ReactNode;
  release(): void;
}

export interface Grafana13RuntimeImplementation {
  mountDashboard(input: {
    readonly dashboard: RenderableDashboard;
    readonly hostReact: ProviderDashboardRendererProps['hostReact'];
    readonly instanceId: string;
    readonly manifest: ProviderDashboardRendererProps['manifest'];
    readonly namespace: string;
    readonly onPanelRenderFailure: (panelId: number) => void;
    readonly transport: ProviderDashboardRendererProps['transport'];
  }): Promise<Grafana13RuntimeDashboardMount>;
}

interface RendererDependencies {
  readonly admitAndLoad?: <T>(
    hostReact: ProviderDashboardRendererProps['hostReact'],
    loadImplementation: () => Promise<T>
  ) => Promise<T>;
  readonly loadImplementation: () => Promise<Grafana13RuntimeImplementation>;
  readonly retrieve: (
    input: Grafana13PartialDashboardLoadInput
  ) => Promise<Grafana13PartialDashboardLoadResult>;
}

interface PanelBoundaryProps {
  readonly children?: ReactNode;
  readonly onFailure: (panelId: number) => void;
  readonly panelId: number;
  readonly uid: string;
}

interface PanelBoundaryState { readonly failed: boolean }

/** Panel-local boundary: a native renderer failure leaves sibling panels intact. */
export class Grafana13PanelRenderBoundary extends Component<
  PanelBoundaryProps,
  PanelBoundaryState
> {
  override state: PanelBoundaryState = { failed: false };

  static getDerivedStateFromError(): PanelBoundaryState {
    return { failed: true };
  }

  override componentDidCatch(_error: unknown, _info: ErrorInfo): void {
    this.props.onFailure(this.props.panelId);
  }

  override render(): ReactNode {
    if (this.state.failed) {
      return createElement(
        'section',
        {
          'aria-label': 'Panel unavailable',
          'data-dashboard-panel-error': this.props.panelId,
          'data-dashboard-panel-uid': this.props.uid,
          className: 'dashboard-render-sdk-g-panel-error',
        },
        'Panel unavailable.'
      );
    }
    return this.props.children;
  }
}

type ViewState =
  | { readonly kind: 'loading'; readonly uid: string }
  | { readonly kind: 'unsupported'; readonly uid: string }
  | { readonly failure: DashboardRenderFailure; readonly kind: 'error'; readonly uid: string }
  | { readonly element: ReactNode; readonly kind: 'ready'; readonly uid: string };

let requestSequence = 0;

function requestIds() {
  const generation = ++requestSequence;
  return Object.freeze({
    dashboard: `provider-13-${generation}-dashboard`,
    discovery: `provider-13-${generation}-discovery`,
    health: `provider-13-${generation}-health`,
  });
}

function failure(
  uid: string,
  code: DashboardRenderFailureCode,
  message: string,
  fields: { readonly requestId?: string; readonly status?: number } = {}
): DashboardRenderFailure {
  return Object.freeze({ code, message, uid, ...fields });
}

const dashboardFailureCodes: Record<string, DashboardRenderFailureCode> = {
  'dashboard.forbidden': 'forbidden',
  'dashboard.http-error': 'http-error',
  'dashboard.identity-mismatch': 'response-malformed',
  'dashboard.input-invalid': 'dashboard-input-invalid',
  'dashboard.network-error': 'network-error',
  'dashboard.not-found': 'not-found',
  'dashboard.response-malformed': 'response-malformed',
  'dashboard.transport-policy-error': 'transport-policy-error',
  'dashboard.unauthorized': 'unauthorized',
};

function mapDashboardFailure(
  uid: string,
  result: Extract<Grafana13PartialDashboardLoadResult, { readonly kind: 'failure' }>
): DashboardRenderFailure {
  const code = dashboardFailureCodes[result.error.code] ?? 'response-malformed';
  return failure(uid, code, 'Dashboard loading failed.', {
    ...(result.error.requestId === undefined ? {} : { requestId: result.error.requestId }),
    ...(result.error.status === undefined ? {} : { status: result.error.status }),
  });
}

function runtimeFailure(uid: string, error: unknown): DashboardRenderFailure {
  let code: DashboardRenderFailureCode = 'runtime-initialization-failed';
  try {
    if (error && typeof error === 'object') {
      const descriptor = Object.getOwnPropertyDescriptor(error, 'code');
      if (descriptor && 'value' in descriptor) {
        if (descriptor.value === 'panel-render-failed') code = 'panel-render-failed';
        if (descriptor.value === 'runtime-react-incompatible') code = 'runtime-react-incompatible';
        if (descriptor.value === 'runtime-identity-conflict') code = 'runtime-identity-conflict';
      }
    }
  } catch {
    // Hostile errors are normalized below without reflecting further.
  }
  return failure(uid, code, 'The Grafana 13 rendering runtime is unavailable.');
}

function publishStatus(
  callback: ProviderDashboardRendererProps['onStatusChange'],
  status: DashboardRenderStatus
): void {
  callback?.(Object.freeze(status));
}

export function createGrafana13DashboardRenderer(dependencies: RendererDependencies) {
  return function Grafana13DashboardRendererComponent(
    props: ProviderDashboardRendererProps
  ) {
    const generation = useRef(0);
    const callback = useRef(props.onStatusChange);
    callback.current = props.onStatusChange;
    const [view, setView] = useState<ViewState>({ kind: 'loading', uid: props.uid });

    useEffect(() => {
      const currentGeneration = ++generation.current;
      const controller = new AbortController();
      let mounted: Grafana13RuntimeDashboardMount | undefined;
      let active = true;
      const current = () => active && generation.current === currentGeneration && !controller.signal.aborted;
      const release = (value: Grafana13RuntimeDashboardMount | undefined) => {
        if (!value) return;
        try { value.release(); } catch { /* cleanup cannot expose provider internals */ }
      };
      const loading = Object.freeze({ kind: 'loading' as const, uid: props.uid });
      setView(loading);
      publishStatus(callback.current, loading);

      void (async () => {
        // StrictMode's setup/cleanup rehearsal finishes before this continuation.
        await Promise.resolve();
        if (!current()) return;
        const result = await dependencies.retrieve({
          manifest: props.manifest,
          namespace: props.namespace,
          requestIds: requestIds(),
          signal: controller.signal,
          transport: props.transport,
          uid: props.uid,
        });
        if (!current() || result.kind === 'cancelled') return;
        if (result.kind === 'unsupported-dashboard') {
          const status = Object.freeze({
            kind: 'unsupported-dashboard' as const,
            reason: result.reason,
            uid: props.uid,
          });
          setView({ kind: 'unsupported', uid: props.uid });
          publishStatus(callback.current, status);
          return;
        }
        if (result.kind === 'failure') {
          const mapped = mapDashboardFailure(props.uid, result);
          setView({ failure: mapped, kind: 'error', uid: props.uid });
          publishStatus(callback.current, Object.freeze({ error: mapped, kind: 'error', uid: props.uid }));
          return;
        }

        const implementation = await (dependencies.admitAndLoad ?? loadAfterHostReactAdmission)(
          props.hostReact,
          dependencies.loadImplementation
        );
        if (!current()) return;
        const prepared = await implementation.mountDashboard({
          dashboard: result.dashboard,
          hostReact: props.hostReact,
          instanceId: props.instanceId,
          manifest: props.manifest,
          namespace: props.namespace,
          onPanelRenderFailure: () => {
            if (!current()) return;
            const mapped = failure(
              props.uid,
              'panel-render-failed',
              'A supported dashboard panel could not be rendered.'
            );
            publishStatus(callback.current, Object.freeze({
              error: mapped, kind: 'error', uid: props.uid,
            }));
          },
          transport: props.transport,
        });
        if (!current()) {
          release(prepared);
          return;
        }
        mounted = prepared;
        setView({ element: prepared.element, kind: 'ready', uid: props.uid });
        publishStatus(callback.current, Object.freeze({
          kind: 'ready',
          supportedPanelCount: result.dashboard.supportedPanelCount,
          uid: props.uid,
          unsupportedPanelCount: result.dashboard.unsupportedPanelCount,
        }));
      })().catch((error: unknown) => {
        if (!current()) return;
        const mapped = runtimeFailure(props.uid, error);
        setView({ failure: mapped, kind: 'error', uid: props.uid });
        publishStatus(callback.current, Object.freeze({ error: mapped, kind: 'error', uid: props.uid }));
      });

      return () => {
        active = false;
        controller.abort();
        const owned = mounted;
        mounted = undefined;
        release(owned);
      };
    }, [
      props.hostReact,
      props.instanceId,
      props.manifest,
      props.namespace,
      props.transport,
      props.uid,
    ]);

    const visible = view.uid === props.uid ? view : { kind: 'loading' as const, uid: props.uid };
    if (visible.kind === 'ready') return visible.element;
    if (visible.kind === 'unsupported') {
      return createElement(
        'section',
        { 'data-dashboard-render-status': 'unsupported-dashboard', role: 'status' },
        'Dashboard is not supported.'
      );
    }
    if (visible.kind === 'error') {
      return createElement(
        'section',
        {
          'data-dashboard-render-error': visible.failure.code,
          'data-dashboard-render-status': 'error',
          role: 'alert',
        },
        'Dashboard unavailable.'
      );
    }
    return createElement(
      'div',
      { 'data-dashboard-render-status': 'loading', role: 'status' },
      'Loading dashboard.'
    );
  };
}

export const Grafana13DashboardRenderer = createGrafana13DashboardRenderer({
  loadImplementation: () => import('../runtime/implementation'),
  retrieve: retrieveAndClassifyGrafana13DashboardV1,
});
