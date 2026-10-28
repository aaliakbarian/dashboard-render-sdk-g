import { expect, it } from 'vitest';
import { configureGrafana13TimeSeriesPlugin } from './timeSeriesConfig';
import { classifyGrafana13PanelProfile } from '../preflightProfiles';
import { fixtureDashboard } from '../testFixtures.test';

it('registers exactly the admitted custom field processors with inert editor functions', () => {
  const entries: any[] = [];
  const plugin = { useFieldConfig(config: any) { config.useCustomConfig({ addCustomEditor(item: unknown) { entries.push(item); } }); return this; } };
  expect(configureGrafana13TimeSeriesPlugin(plugin)).toBe(plugin);
  const result = classifyGrafana13PanelProfile(fixtureDashboard('grsdk-phase0-poc').spec.panels[2]);
  if (result.kind !== 'supported' || result.model.type !== 'timeseries') throw new Error('Expected Time series profile');
  const custom = result.model.fieldConfig.defaults.custom;
  expect(entries.map(e => e.path).sort()).toEqual(Object.keys(custom).sort());
  for (const entry of entries) {
    const value = custom[entry.path as keyof typeof custom];
    expect(entry.process(value)).toBe(value);
    expect(entry.editor()).toBeNull(); expect(entry.override()).toBeNull();
  }
});
