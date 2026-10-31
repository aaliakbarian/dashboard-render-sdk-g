import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const exactPackages = ['event', 'gradient', 'group', 'shape', 'tooltip'] as const;

describe('pinned Pie chart Visx dependency cohort', () => {
  it('matches the exact individual packages pinned by Grafana 13.2.3 without an umbrella package', () => {
    const provider = JSON.parse(readFileSync('packages/provider-13/package.json', 'utf8'));
    const grafana = JSON.parse(readFileSync('.grafana-source/grafana-v13.2.3/package.json', 'utf8'));
    for (const name of exactPackages) {
      const dependency = `@visx/${name}`;
      expect(grafana.dependencies[dependency]).toBe('3.12.0');
      expect(provider.dependencies[dependency]).toBe('3.12.0');
    }
    expect(provider.dependencies).not.toHaveProperty('@visx/visx');
  });

  it('pins the exact six renderer imports and no editor or umbrella entry', () => {
    const source = readFileSync('.grafana-source/grafana-v13.2.3/public/app/plugins/panel/piechart/PieChart.tsx', 'utf8');
    expect([...source.matchAll(/from ['"](@visx\/[^'"]+)['"]/g)].map(match => match[1]).sort()).toEqual([
      '@visx/event', '@visx/gradient', '@visx/group', '@visx/shape/lib/shapes/Pie',
      '@visx/tooltip', '@visx/tooltip/lib/hooks/useTooltip',
    ]);
    expect(source).not.toMatch(/@visx\/visx|Editor|module\.tsx/);
  });
});
