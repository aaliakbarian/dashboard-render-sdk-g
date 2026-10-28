import type { ComponentType } from 'react';
import type { ProviderDashboardRendererProps, RendererProvider } from '@dashboard-render-sdk-g/provider-contract';

// Vite resolves these public exports to the separately built provider artifact.
declare module '@dashboard-render-sdk-g/provider-13' {
  export const Grafana13DashboardRenderer: ComponentType<ProviderDashboardRendererProps>;
  export const grafana13Provider: RendererProvider;
}
