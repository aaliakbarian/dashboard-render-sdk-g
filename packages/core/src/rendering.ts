import type {
  DashboardRenderStatus,
  HostReactRuntime,
  HostTransportCapability,
  ManifestValidationSuccess,
  ProviderDashboardRendererProps,
} from '@dashboard-render-sdk-g/provider-contract';
import {
  Component,
  createElement,
  useId,
  useState,
  type ComponentType,
  type JSX,
} from 'react';

import type { CoreSdkConfiguration } from './contracts';
import { inspectConfiguredProvider } from './inspectConfiguredProvider';

export interface DashboardRenderSdkConfiguration extends CoreSdkConfiguration {
  readonly hostReact: HostReactRuntime;
  readonly namespace?: string;
  readonly renderer: ComponentType<ProviderDashboardRendererProps>;
  readonly transport: HostTransportCapability;
}

export interface DashboardRenderSdk {
  readonly providerId: string;
  readonly providerBuildId: string;
}

interface CreationError {
  readonly code: 'provider-manifest-invalid' | 'configuration-invalid';
  readonly path: string;
  readonly message: string;
}

export type DashboardRenderSdkCreationResult =
  | { readonly valid: true; readonly sdk: DashboardRenderSdk }
  | { readonly valid: false; readonly errors: readonly CreationError[] };

export interface GrafanaDashboardProps {
  readonly sdk: DashboardRenderSdk;
  readonly uid: string;
  readonly onStatusChange?: (status: DashboardRenderStatus) => void;
}

interface RenderConfiguration {
  readonly hostReact: HostReactRuntime;
  readonly namespace: string;
  readonly renderer: ComponentType<ProviderDashboardRendererProps>;
  readonly transport: HostTransportCapability;
  readonly manifest: ManifestValidationSuccess;
}

// Each handle owns its configuration. No process-wide lookup or registry.
class RenderSdkHandle implements DashboardRenderSdk {
  readonly providerId: string;
  readonly providerBuildId: string;
  readonly #configuration: RenderConfiguration;

  constructor(configuration: RenderConfiguration) {
    this.providerId = configuration.manifest.manifest.provider.id;
    this.providerBuildId = configuration.manifest.manifest.provider.buildId;
    this.#configuration = Object.freeze(configuration);
    Object.freeze(this);
  }

  static configuration(sdk: DashboardRenderSdk): RenderConfiguration {
    if (!(sdk instanceof RenderSdkHandle)) {
      throw new TypeError('Expected a dashboard render SDK handle.');
    }
    return sdk.#configuration;
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function boundedString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 253;
}

function rendererComponent(value: unknown): boolean {
  return typeof value === 'function' || (
    record(value) && [
      Symbol.for('react.memo'),
      Symbol.for('react.forward_ref'),
      Symbol.for('react.lazy'),
    ].includes(value.$$typeof as symbol)
  );
}

function failure(errors: readonly CreationError[]): DashboardRenderSdkCreationResult {
  return Object.freeze({
    valid: false,
    errors: Object.freeze(errors.map((error) => Object.freeze(error))),
  });
}

/** Inert configuration only; physical React/runtime admission belongs to the provider. */
export function createDashboardRenderSdk(
  configuration: DashboardRenderSdkConfiguration
): DashboardRenderSdkCreationResult {
  if (!record(configuration) || !record(configuration.provider)) {
    return failure([{
      code: 'configuration-invalid',
      path: '$.provider',
      message: 'A configured provider is required.',
    }]);
  }
  const manifest = inspectConfiguredProvider(configuration);
  if (!manifest.valid) {
    return failure(manifest.errors.map(({ path, message }) => ({
      code: 'provider-manifest-invalid', path, message,
    })));
  }
  const { hostReact, renderer, transport } = configuration;
  const namespace = configuration.namespace === undefined ? 'default' : configuration.namespace;
  const errors: CreationError[] = [];
  const invalid = (path: string, message: string) => errors.push({ code: 'configuration-invalid', path, message });
  if (typeof namespace !== 'string' ||
    !/^(?=.{1,63}$)[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(namespace)) {
    invalid('$.namespace', 'Namespace must be a bounded lowercase DNS label.');
  }
  if (!rendererComponent(renderer)) invalid('$.renderer', 'A React renderer component is required.');
  if (!record(transport) || !record(transport.descriptor) || typeof transport.execute !== 'function') {
    invalid('$.transport', 'A host transport capability is required.');
  }
  if (!record(hostReact) || !record(hostReact.versions) ||
    !boundedString(hostReact.versions.react) || !boundedString(hostReact.versions.reactDom) ||
    !record(hostReact.identities) ||
    !['react', 'reactDom', 'reactDomClient', 'jsxRuntime', 'jsxDevRuntime'].every(
      (key) => record(hostReact.identities[key as keyof HostReactRuntime['identities']])
    )) {
    invalid('$.hostReact', 'Host React versions and five opaque module identities are required.');
  }
  if (errors.length > 0) return failure(errors);
  return Object.freeze({
    valid: true,
    sdk: new RenderSdkHandle({ manifest, namespace, hostReact, renderer, transport }),
  });
}

interface GenerationProps extends GrafanaDashboardProps {
  readonly instanceId: string;
}

// Parent unmount runs before provider cleanup, closing even synchronous cleanup callbacks.
class RendererGeneration extends Component<GenerationProps> {
  #active = true;
  override componentDidMount() { this.#active = true; }
  override componentWillUnmount() { this.#active = false; }
  readonly #onStatusChange = (status: DashboardRenderStatus) => {
    if (this.#active && status.uid === this.props.uid) this.props.onStatusChange?.(status);
  };

  override render(): JSX.Element {
    const configuration = RenderSdkHandle.configuration(this.props.sdk);
    return createElement(configuration.renderer, {
      hostReact: configuration.hostReact,
      instanceId: this.props.instanceId,
      manifest: configuration.manifest,
      namespace: configuration.namespace,
      transport: configuration.transport,
      uid: this.props.uid,
      onStatusChange: this.#onStatusChange,
    });
  }
}

export function GrafanaDashboard(props: GrafanaDashboardProps): JSX.Element {
  const id = useId();
  const [generation, setGeneration] = useState({ sdk: props.sdk, uid: props.uid, number: 0 });
  if (generation.sdk !== props.sdk || generation.uid !== props.uid) {
    // React retries this component before committing its children; abandoned renders
    // cannot invalidate the currently committed provider's status callback.
    setGeneration({ sdk: props.sdk, uid: props.uid, number: generation.number + 1 });
  }
  const instanceId = `${id}:${generation.number}`;
  return createElement(RendererGeneration, { ...props, key: instanceId, instanceId });
}
