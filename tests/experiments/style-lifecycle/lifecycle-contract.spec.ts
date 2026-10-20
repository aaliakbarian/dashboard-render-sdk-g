// POC / EXPERIMENT / NOT FOR PRODUCTION
import { describe, expect, it } from 'vitest';

import {
  STYLE_LIFECYCLE_OWNERSHIP,
  assessLifecycleTrend,
  assessTimerSettlement,
  buildResourceAccountingRows,
} from '../../../experiments/styling/style-lifecycle/lifecycleContract.ts';

describe('production-shaped style lifecycle contract', () => {
  it('assigns every required resource to one explicit lifetime owner', () => {
    expect(STYLE_LIFECYCLE_OWNERSHIP.map(({ resource }) => resource).sort()).toEqual([
      'AbortControllers',
      'BackendSrv',
      'CSS rules',
      'DataSourceSrv',
      'Grafana @emotion/css cache',
      'Grafana runtime globals',
      'React',
      'ReactDOM',
      'Scene roots',
      'SceneQueryRunner',
      'asset manifest',
      'datasource loader/cache',
      'event listeners',
      'focus restoration state',
      'font/icon/CSS resources',
      'host Emotion cache',
      'modal inert state',
      'observers',
      'panel module cache',
      'plugin loaders/cache',
      'portal children',
      'portal root',
      'provider Emotion cache',
      'requests',
      'requestAnimationFrame callbacks',
      'style tags',
      'subscriptions',
      'timers/intervals',
      'transformations',
    ].sort());
    expect(STYLE_LIFECYCLE_OWNERSHIP.every(({ expectedLifetime, owner }) => owner && expectedLifetime)).toBe(true);
  });

  it('accepts bounded repeated-cycle samples and rejects monotonic instance growth', () => {
    expect(assessLifecycleTrend([3, 4, 4, 3, 4], { baseline: 3, tolerance: 1 })).toMatchObject({
      bounded: true,
      delta: 1,
      monotonicGrowth: false,
    });
    expect(assessLifecycleTrend([0, 1, 2, 3, 4], { baseline: 0, tolerance: 1 })).toMatchObject({
      bounded: false,
      delta: 4,
      monotonicGrowth: true,
    });
  });

  it('treats transient PanelChrome timers as diagnostics but requires exact quiescent settlement', () => {
    const transient = [18, 34, 22].map((active) => ({ active, byDelay: { '2000': active } }));

    expect(assessTimerSettlement({
      allowedTransientDelays: [2_000],
      settled: { active: 0, byDelay: {} },
      transient,
    })).toEqual({
      conformant: true,
      internallyConsistent: true,
      settled: true,
      transientPeak: 34,
      transientSpread: 16,
      unexpectedTransientDelays: [],
    });

    expect(assessTimerSettlement({
      allowedTransientDelays: [2_000],
      settled: { active: 1, byDelay: { '2000': 1 } },
      transient,
    })).toMatchObject({ conformant: false, settled: false });
  });

  it('produces the required before/during/after accounting shape', () => {
    expect(buildResourceAccountingRows({
      afterAllDashboardsUnmount: { portalChildren: 0 },
      afterDashboardUnmount: { portalChildren: 1 },
      afterRemount: { portalChildren: 0 },
      baseline: { portalChildren: 0 },
      expected: { portalChildren: { expectedLifetime: 'PORTAL CHILD LIFETIME', owner: 'dashboard overlay' } },
      peak: { portalChildren: 2 },
    })).toEqual([{
      afterAllDashboardsUnmount: 0,
      afterDashboardUnmount: 1,
      afterRemount: 0,
      baseline: 0,
      expectedLifetime: 'PORTAL CHILD LIFETIME',
      owner: 'dashboard overlay',
      peak: 2,
      resource: 'portalChildren',
      status: 'PASS',
    }]);
  });
});
