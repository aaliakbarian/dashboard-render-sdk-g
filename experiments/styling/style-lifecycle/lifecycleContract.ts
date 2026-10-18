// POC / EXPERIMENT / NOT FOR PRODUCTION

export type ResourceLifetime =
  | 'ASSET / BROWSER CACHE LIFETIME'
  | 'DASHBOARD INSTANCE LIFETIME'
  | 'HOST LIFETIME'
  | 'PANEL LIFETIME'
  | 'PORTAL CHILD LIFETIME'
  | 'PROVIDER / RUNTIME LIFETIME'
  | 'QUERY LIFETIME';

export interface ResourceOwnership {
  readonly expectedLifetime: ResourceLifetime;
  readonly owner: string;
  readonly resource: string;
}

export const STYLE_LIFECYCLE_OWNERSHIP = Object.freeze([
  { resource: 'React', owner: 'host', expectedLifetime: 'HOST LIFETIME' },
  { resource: 'ReactDOM', owner: 'host', expectedLifetime: 'HOST LIFETIME' },
  { resource: 'host Emotion cache', owner: 'host', expectedLifetime: 'HOST LIFETIME' },
  { resource: 'provider Emotion cache', owner: 'renderer provider', expectedLifetime: 'PROVIDER / RUNTIME LIFETIME' },
  { resource: 'Grafana @emotion/css cache', owner: 'Grafana provider cohort', expectedLifetime: 'PROVIDER / RUNTIME LIFETIME' },
  { resource: 'style tags', owner: 'host/provider cache that emitted each tag', expectedLifetime: 'PROVIDER / RUNTIME LIFETIME' },
  { resource: 'CSS rules', owner: 'host/provider cache or provider static CSS', expectedLifetime: 'PROVIDER / RUNTIME LIFETIME' },
  { resource: 'Grafana runtime globals', owner: 'renderer provider', expectedLifetime: 'PROVIDER / RUNTIME LIFETIME' },
  { resource: 'BackendSrv', owner: 'renderer provider', expectedLifetime: 'PROVIDER / RUNTIME LIFETIME' },
  { resource: 'DataSourceSrv', owner: 'renderer provider', expectedLifetime: 'PROVIDER / RUNTIME LIFETIME' },
  { resource: 'plugin loaders/cache', owner: 'renderer provider', expectedLifetime: 'PROVIDER / RUNTIME LIFETIME' },
  { resource: 'datasource loader/cache', owner: 'renderer provider', expectedLifetime: 'PROVIDER / RUNTIME LIFETIME' },
  { resource: 'panel module cache', owner: 'renderer provider', expectedLifetime: 'PROVIDER / RUNTIME LIFETIME' },
  { resource: 'Scene roots', owner: 'dashboard instance', expectedLifetime: 'DASHBOARD INSTANCE LIFETIME' },
  { resource: 'SceneQueryRunner', owner: 'panel scene', expectedLifetime: 'PANEL LIFETIME' },
  { resource: 'transformations', owner: 'panel scene pipeline', expectedLifetime: 'PANEL LIFETIME' },
  { resource: 'observers', owner: 'dashboard/panel DOM owner', expectedLifetime: 'PANEL LIFETIME' },
  { resource: 'event listeners', owner: 'declaring host/provider/dashboard surface', expectedLifetime: 'DASHBOARD INSTANCE LIFETIME' },
  { resource: 'timers/intervals', owner: 'declaring provider/dashboard/query component', expectedLifetime: 'DASHBOARD INSTANCE LIFETIME' },
  { resource: 'requestAnimationFrame callbacks', owner: 'declaring dashboard/panel/portal component', expectedLifetime: 'PANEL LIFETIME' },
  { resource: 'requests', owner: 'dashboard generation/query', expectedLifetime: 'QUERY LIFETIME' },
  { resource: 'AbortControllers', owner: 'dashboard generation/query', expectedLifetime: 'QUERY LIFETIME' },
  { resource: 'subscriptions', owner: 'scene/query pipeline', expectedLifetime: 'QUERY LIFETIME' },
  { resource: 'portal root', owner: 'renderer provider', expectedLifetime: 'PROVIDER / RUNTIME LIFETIME' },
  { resource: 'portal children', owner: 'dashboard overlay', expectedLifetime: 'PORTAL CHILD LIFETIME' },
  { resource: 'modal inert state', owner: 'open modal', expectedLifetime: 'PORTAL CHILD LIFETIME' },
  { resource: 'focus restoration state', owner: 'open overlay', expectedLifetime: 'PORTAL CHILD LIFETIME' },
  { resource: 'asset manifest', owner: 'renderer provider deployment', expectedLifetime: 'ASSET / BROWSER CACHE LIFETIME' },
  { resource: 'font/icon/CSS resources', owner: 'provider deployment/browser cache', expectedLifetime: 'ASSET / BROWSER CACHE LIFETIME' },
] as const satisfies readonly ResourceOwnership[]);

export function assessLifecycleTrend(
  samples: readonly number[],
  options: { readonly baseline: number; readonly tolerance: number }
) {
  const final = samples.at(-1) ?? options.baseline;
  const monotonicGrowth = samples.length > 1 && samples.every((value, index) => index === 0 || value > samples[index - 1]!);
  const delta = final - options.baseline;
  return Object.freeze({
    bounded: delta <= options.tolerance && !monotonicGrowth,
    delta,
    monotonicGrowth,
    peak: Math.max(options.baseline, ...samples),
  });
}

interface ResourceExpectation {
  readonly expectedLifetime: ResourceLifetime;
  readonly owner: string;
}

export function buildResourceAccountingRows(input: {
  readonly afterAllDashboardsUnmount: Readonly<Record<string, number>>;
  readonly afterDashboardUnmount: Readonly<Record<string, number>>;
  readonly afterRemount: Readonly<Record<string, number>>;
  readonly baseline: Readonly<Record<string, number>>;
  readonly expected: Readonly<Record<string, ResourceExpectation>>;
  readonly peak: Readonly<Record<string, number>>;
}) {
  return Object.keys(input.expected).sort().map((resource) => {
    const baseline = input.baseline[resource] ?? 0;
    const afterAllDashboardsUnmount = input.afterAllDashboardsUnmount[resource] ?? 0;
    const peak = input.peak[resource] ?? baseline;
    return {
      resource,
      owner: input.expected[resource]!.owner,
      baseline,
      peak,
      afterDashboardUnmount: input.afterDashboardUnmount[resource] ?? 0,
      afterAllDashboardsUnmount,
      afterRemount: input.afterRemount[resource] ?? 0,
      expectedLifetime: input.expected[resource]!.expectedLifetime,
      status: afterAllDashboardsUnmount <= baseline && (input.afterRemount[resource] ?? 0) <= peak ? 'PASS' : 'FAIL',
    } as const;
  });
}
