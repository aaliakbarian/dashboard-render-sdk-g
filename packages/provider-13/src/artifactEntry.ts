/**
 * Production browser-artifact entry.
 *
 * Keep the package's broader source API in `index.ts`; the browser artifact
 * exposes only the inert provider descriptor and React renderer. Panel,
 * Scenes, and Grafana Runtime modules remain behind the renderer's admitted
 * dynamic implementation boundary.
 */
export { grafana13Provider } from './provider';
export { Grafana13DashboardRenderer } from './react/Grafana13DashboardRenderer';
export { assertCompatibleHostReactRuntime } from './react/reactIdentity';
