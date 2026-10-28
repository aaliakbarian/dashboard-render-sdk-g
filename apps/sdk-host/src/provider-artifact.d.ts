import type { ComponentType } from 'react';
import type {
  HostReactRuntime,
  ProviderDashboardRendererProps,
  RendererProvider,
} from '@dashboard-render-sdk-g/provider-contract';

declare module '@dashboard-render-sdk-g/provider-13' {
  export const Grafana13DashboardRenderer: ComponentType<ProviderDashboardRendererProps>;
  export const grafana13Provider: RendererProvider;
  export function assertCompatibleHostReactRuntime(hostReact: HostReactRuntime): unknown;
}
