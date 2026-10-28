import type { HostReactRuntime, HostTransportCapability, ProviderDashboardRendererProps, RendererProvider } from '@dashboard-render-sdk-g/provider-contract';
import type { ComponentType, JSX } from 'react';
import { createDashboardRenderSdk, GrafanaDashboard, type DashboardRenderSdk, type DashboardRenderSdkConfiguration, type GrafanaDashboardProps } from './index';

declare const provider: RendererProvider;
declare const renderer: ComponentType<ProviderDashboardRendererProps>;
declare const hostReact: HostReactRuntime;
declare const transport: HostTransportCapability;
declare const sdk: DashboardRenderSdk;
declare const dynamicUid: string;
const configuration: DashboardRenderSdkConfiguration = { provider, renderer, hostReact, transport };
const result = createDashboardRenderSdk(configuration);
const element: JSX.Element = GrafanaDashboard({ sdk, uid: dynamicUid });
// @ts-expect-error Host React identities are required.
createDashboardRenderSdk({ provider, renderer, transport });
// @ts-expect-error Host transport is required.
createDashboardRenderSdk({ provider, renderer, hostReact });
// @ts-expect-error Renderer must accept the provider-neutral props.
createDashboardRenderSdk({ ...configuration, renderer: (_props: { wrong: number }) => null });
// @ts-expect-error The handle is immutable.
sdk.providerId = 'replacement';
// @ts-expect-error The renderer remains opaque.
sdk.renderer;
// @ts-expect-error Core exposes no imperative mount API.
sdk.mount;
// @ts-expect-error Core exposes no session API.
sdk.createSession;
// @ts-expect-error Calendar support is deferred.
const calendarProps: GrafanaDashboardProps = { sdk, uid: dynamicUid, calendar: 'jalali' };
if (result.valid) {
  result.sdk.providerBuildId;
  // @ts-expect-error Successful creation has no errors.
  result.errors;
} else {
  const code: 'provider-manifest-invalid' | 'configuration-invalid' = result.errors[0]!.code;
  void code;
  // @ts-expect-error Failed creation has no SDK.
  result.sdk;
}
void element;
void calendarProps;
