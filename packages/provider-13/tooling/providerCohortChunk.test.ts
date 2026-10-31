import { describe, expect, it } from 'vitest';

import { providerCohortChunk } from './providerCohortChunk';

describe('provider cohort chunk ownership', () => {
  it('keeps the Pie renderer graph acyclic and owns its exact dependency closure', () => {
    expect(providerCohortChunk('/repo/packages/provider-13/src/panels/pieChartPlugin.ts')).toBeUndefined();
    expect(
      providerCohortChunk('native:public/app/plugins/panel/piechart/PieChart.tsx')
    ).toBe('provider-piechart');

    for (const id of [
      '/repo/packages/provider-13/tooling/viewOnly/controlledVisxPortal.tsx',
      '/repo/node_modules/@visx/tooltip/esm/hooks/useTooltipInPortal.js',
      '/repo/node_modules/react-use-measure/dist/index.js',
      '/repo/node_modules/debounce/index.js',
      '/repo/node_modules/classnames/index.js',
      '/repo/node_modules/d3-path/src/index.js',
      '/repo/node_modules/d3-shape/src/pie.js',
    ]) {
      expect(providerCohortChunk(id), id).toBe('provider-piechart-dependencies');
    }
  });

  it('does not absorb unrelated application or dependency modules', () => {
    expect(providerCohortChunk('/repo/packages/provider-13/src/panels/barChartPlugin.ts')).toBe(
      'provider-barchart'
    );
    expect(providerCohortChunk('/repo/node_modules/lodash/map.js')).toBeUndefined();
  });
});
