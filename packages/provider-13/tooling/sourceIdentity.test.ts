import { describe, expect, it } from 'vitest';

import {
  GRAFANA_13_APPLICATION_SOURCES,
  GRAFANA_13_SOURCE_REVISION,
  Grafana13SourceIdentityError,
  assertGrafana13SourceIdentity,
} from './sourceIdentity';

describe('provider-13 pinned source identity', () => {
  it('admits only the exact clean Grafana OSS source checkout', () => {
    expect(() =>
      assertGrafana13SourceIdentity({
        dirty: false,
        revision: '6193dc03311b631b9727b560d24369e683dc396e',
      })
    ).not.toThrow();
    expect(() =>
      assertGrafana13SourceIdentity({
        dirty: false,
        revision: '90ffed056f0884267356c12a0eeb72a022af53f1',
      })
    ).toThrow(Grafana13SourceIdentityError);
    expect(() =>
      assertGrafana13SourceIdentity({
        dirty: true,
        revision: GRAFANA_13_SOURCE_REVISION,
      })
    ).toThrow(/clean/i);
  });

  it('closes application source provenance over the renderer and generated config only', () => {
    expect(GRAFANA_13_APPLICATION_SOURCES).toEqual([
      'public/app/plugins/panel/text/panelcfg.gen.ts',
      'public/app/plugins/panel/text/v1/TextPanel.tsx',
    ]);
    expect(Object.isFrozen(GRAFANA_13_APPLICATION_SOURCES)).toBe(true);
  });
});
