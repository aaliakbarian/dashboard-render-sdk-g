import { describe, expect, it } from 'vitest';

import type { Grafana13PartialPreflightResult } from '../partialContracts';
import { partialPreflightGrafana13DashboardV1 } from '../partialPreflight';
import { grafana13Provider } from '../provider';
import { fixtureDashboard } from '../testFixtures.test';
import { validateProviderCompatibilityManifest } from '@dashboard-render-sdk-g/provider-contract';
import { convertPartialDashboardToGrafana13Scene, inspectGrafana13Scene } from './sceneConversion';
import { classifyGrafana13PanelProfile } from '../preflightProfiles';
import { readFileSync } from 'node:fs';

class FakeObject {
  parent: FakeObject | undefined;
  readonly state: Record<string, any>;
  constructor(state: Record<string, any>) {
    this.state = state;
    for (const value of Object.values(state)) {
      if (value instanceof FakeObject) value.parent = this;
      if (Array.isArray(value)) {
        for (const child of value) if (child instanceof FakeObject) child.parent = this;
      }
    }
  }
}
class FakeVizPanel extends FakeObject {}
class FakeGridItem extends FakeObject {}
class FakeGridLayout extends FakeObject {}
class FakeTimeRange extends FakeObject {}
class FakeVariableSet extends FakeObject {}
class FakeConstantVariable extends FakeObject {}
class FakeReactObject extends FakeObject {}
class FakeQueryRunner extends FakeObject {}
class FakeTransformer extends FakeObject {}

const scenes = {
  ConstantVariable: FakeConstantVariable,
  SceneGridItem: FakeGridItem,
  SceneGridLayout: FakeGridLayout,
  SceneObjectBase: FakeObject,
  SceneReactObject: FakeReactObject,
  SceneTimeRange: FakeTimeRange,
  SceneVariableSet: FakeVariableSet,
  VizPanel: FakeVizPanel,
  SceneQueryRunner: FakeQueryRunner,
  SceneDataTransformer: FakeTransformer,
};

const primary: Extract<Grafana13PartialPreflightResult, { kind: 'renderable' }> = {
  constantVariables: [{ label: 'Environment', name: 'environment', value: 'phase0' }],
  kind: 'renderable' as const,
  panels: [
    {
      grid: { height: 6, width: 8, x: 0, y: 0 }, id: 1, index: 0,
      kind: 'supported' as const,
      model: {
        fieldConfig: { defaults: {}, overrides: [] }, id: 1,
        options: { code: { language: 'plaintext' as const, showLineNumbers: false as const, showMiniMap: false as const }, content: 'sentinel', mode: 'markdown' as const },
        pluginVersion: '13.2.3' as const, title: 'Text', type: 'text' as const,
      },
      panelType: 'text' as const, profile: 'text-markdown-view-v1' as const, title: 'Text',
    },
    {
      diagnostics: [{ code: 'panel.unsupported' as const, message: 'unsupported', path: '$.panels[1]' }],
      grid: { height: 10, width: 8, x: 16, y: 0 }, id: 4, index: 1,
      kind: 'unsupported' as const, panelType: 'table', title: 'Table',
    },
  ],
  supportedPanelCount: 1,
  timeRange: { from: 'now-1h', to: 'now' },
  timezone: 'browser' as const,
  title: 'Dashboard title',
  uid: 'grsdk-phase0-poc',
  unsupportedPanelCount: 1,
};

describe('convertPartialDashboardToGrafana13Scene', () => {
  it('attaches independent existing query runners to Gauge/Bar gauge/Bar chart while Table and Pie stay inert', () => {
    const manifest = validateProviderCompatibilityManifest({ ...grafana13Provider.manifest, capabilities: {
      ...grafana13Provider.manifest.capabilities, panels: ['text', 'stat', 'timeseries', 'gauge', 'bargauge', 'barchart'],
    } });
    if (!manifest.valid) throw new Error('Expected candidate manifest');
    const dashboard = partialPreflightGrafana13DashboardV1(fixtureDashboard('drsdk-g-phase2-visualizations'), manifest);
    if (dashboard.kind !== 'renderable') throw new Error('Expected renderable');
    expect(dashboard.panels.filter(panel => panel.kind === 'supported').map(panel => panel.panelType)).toEqual(['text', 'stat', 'timeseries', 'gauge', 'bargauge', 'barchart']);
    const graph = convertPartialDashboardToGrafana13Scene(dashboard, scenes as never);
    const bodies = graph.scene.state.body.state.children.map((item: any) => item.state.body);
    const native = [bodies[4], bodies[5], bodies[7]].map((body: any) => body.state.panel);
    const identities = [['gauge', 5], ['bargauge', 6], ['barchart', 8]] as const;
    for (const [index, viz] of native.entries()) {
      expect(viz.state.pluginId).toBe(identities[index]![0]);
      expect(viz.state.$data.state.datasource).toEqual({ type: 'grafana-testdata-datasource', uid: 'grsdk-testdata' });
      expect(viz.state.$data.state.queries[0]).toMatchObject({ refId: 'A', scenarioId: 'predictable_pulse' });
      expect(viz.state.$data.parent).toBe(viz);
      expect(graph.scene.enrichDataRequest(viz.state.$data)).toEqual({ dashboardUID: dashboard.uid, panelId: identities[index]![1] });
      const source = dashboard.panels.find(panel => panel.id === identities[index]![1]) as any;
      expect(viz.state.options).toEqual(source.model.options);
      expect(viz.state.fieldConfig).toEqual(source.model.fieldConfig);
    }
    expect(native[0].state.$data).not.toBe(native[1].state.$data);
    expect(native[1].state.$data).not.toBe(native[2].state.$data);
    for (const index of [3, 6]) expect(JSON.stringify(bodies[index].state)).not.toMatch(/\$data|queries|targets|datasource|pluginId/);
    const failed = convertPartialDashboardToGrafana13Scene(dashboard, scenes as never, { failedPluginIds: ['gauge'] });
    expect(JSON.stringify(failed.scene.state.body.state.children[4].state.body.state)).not.toMatch(/\$data|queries|targets|datasource|pluginId/);
    expect(failed.scene.state.body.state.children[5].state.body.state.panel.state.$data).toBeInstanceOf(FakeQueryRunner);
    expect(failed.scene.state.body.state.children[7].state.body.state.panel.state.$data).toBeInstanceOf(FakeQueryRunner);
  });
  it('parents independent real-query strategies under Stat and transformed Time series while preserving exact DTO state', () => {
    const fixture = JSON.parse(readFileSync('dev/grafana/provisioning/dashboards/drsdk-g-phase2-visualizations.json', 'utf8'));
    const queryPanels = fixture.panels.filter((p: any) => ['stat', 'timeseries'].includes(p.type)).map((p: any, index: number) => {
      const profile = classifyGrafana13PanelProfile(p);
      if (profile.kind !== 'supported') throw new Error('Expected admitted profile');
      return { ...primary.panels[0], id: p.id, index, panelType: p.type, profile: profile.profile, model: profile.model, title: p.title };
    });
    const graph = convertPartialDashboardToGrafana13Scene({ ...primary, panels: [...queryPanels, primary.panels[1]] } as never, scenes as never);
    const [stat, timeseries, fallback] = graph.scene.state.body.state.children.map((item: any) => item.state.body);
    const statViz = stat.state.panel;
    const tsViz = timeseries.state.panel;
    expect(statViz.state.pluginId).toBe('stat');
    expect(statViz.state.$data).toBeInstanceOf(FakeQueryRunner);
    expect(statViz.state.$data.state).toMatchObject({ datasource: { uid: 'grsdk-testdata' }, queries: queryPanels[0].model.query.targets, maxDataPoints: 300 });
    expect(tsViz.state.pluginId).toBe('timeseries');
    expect(tsViz.state.$data).toBeInstanceOf(FakeTransformer);
    expect(tsViz.state.$data.state.transformations).toEqual(queryPanels[1].model.transformations);
    expect(tsViz.state.$data.state.$data).toBeInstanceOf(FakeQueryRunner);
    expect(tsViz.state.$data.state.$data).not.toBe(statViz.state.$data);
    const tsRunner = tsViz.state.$data.state.$data;
    expect(statViz.state.$data.state.requestIdPrefix).toMatch(/^sdk13-g\d+-p2$/);
    expect(tsRunner.state.requestIdPrefix).toMatch(/^sdk13-g\d+-p3$/);
    expect(graph.scene.enrichDataRequest(statViz.state.$data)).toEqual({ dashboardUID: primary.uid, panelId: 2 });
    expect(graph.scene.enrichDataRequest(tsRunner)).toEqual({ dashboardUID: primary.uid, panelId: 3 });
    expect(graph.scene.enrichDataRequest({})).toBeNull();
    for (const [index, viz] of [statViz, tsViz].entries()) {
      expect(viz.state.options).toEqual(queryPanels[index].model.options);
      expect(viz.state.fieldConfig).toEqual(queryPanels[index].model.fieldConfig);
      expect(viz.state.options).not.toBe(queryPanels[index].model.options);
      expect(viz.state.$data.parent).toBe(viz);
    }
    expect(JSON.stringify(fallback.state)).not.toMatch(/\$data|datasource|queries|transformations/);
    const failed = convertPartialDashboardToGrafana13Scene({ ...primary, panels: queryPanels } as never, scenes as never, { failedPluginIds: ['stat'] });
    expect(failed.scene.state.body.state.children[1].state.body.state.panel.state.$data.state.$data.state.requestIdPrefix).not.toBe(tsRunner.state.requestIdPrefix);
    const failedStat = failed.scene.state.body.state.children[0].state.body;
    expect(failedStat).toBeInstanceOf(FakeReactObject);
    expect(failedStat.state.props).toMatchObject({ id: queryPanels[0].id, title: queryPanels[0].title });
    expect(JSON.stringify(failedStat.state)).not.toMatch(/\$data|queries|targets|transformations/);
  });
  it('preserves dashboard identity, range, constants, order, IDs and exact grid geometry', () => {
    const graph = convertPartialDashboardToGrafana13Scene(primary, scenes as never);
    expect(typeof graph.scene.constructor.Component).toBe('function');
    expect(inspectGrafana13Scene(graph, scenes as never)).toEqual({
      panels: [
        { executable: true, grid: { height: 6, width: 8, x: 0, y: 0 }, id: 1, kind: 'text', pluginId: 'text', title: 'Text' },
        { executable: false, grid: { height: 10, width: 8, x: 16, y: 0 }, id: 4, kind: 'fallback', panelType: 'table', title: 'Table' },
      ],
      timeRange: { from: 'now-1h', timeZone: 'browser', to: 'now' },
      title: 'Dashboard title',
      uid: 'grsdk-phase0-poc',
      variables: [{ label: 'Environment', name: 'environment', value: 'phase0' }],
    });
  });

  it.each([
    ['grsdk-phase0-poc', 4, 1],
    ['grsdk-phase0-poc-alt', 1, 0],
  ] as const)('converts the real %s fixture model without activating unsupported panels', (uid, panelCount, fallbackCount) => {
    const manifest = validateProviderCompatibilityManifest(grafana13Provider.manifest);
    if (!manifest.valid) throw new Error('Expected concrete manifest');
    const dashboard = partialPreflightGrafana13DashboardV1(fixtureDashboard(uid), manifest);
    if (dashboard.kind !== 'renderable') throw new Error('Expected renderable fixture model');
    const graph = convertPartialDashboardToGrafana13Scene(dashboard, scenes as never);
    const snapshot = inspectGrafana13Scene(graph, scenes as never);
    expect(snapshot.uid).toBe(uid);
    expect(snapshot.panels).toHaveLength(panelCount);
    expect(snapshot.panels.filter(({ executable }: { executable: boolean }) => !executable)).toHaveLength(fallbackCount);
  });

  it('creates Text VizPanel state without data and project fallback state without execution hooks', () => {
    const graph = convertPartialDashboardToGrafana13Scene(primary, scenes as never);
    const [textItem, fallbackItem] = graph.scene.state.body.state.children;
    expect(textItem.state.body).toBeInstanceOf(FakeObject);
    expect(textItem.state.body.state.panel).toBeInstanceOf(FakeVizPanel);
    expect(textItem.state.body.state.panel.state).toMatchObject({
      fieldConfig: { defaults: {}, overrides: [] },
      options: { content: 'sentinel', mode: 'markdown' },
      pluginId: 'text',
      pluginVersion: '13.2.3',
      title: 'Text',
    });
    expect(textItem.state.body.state.panel.state).not.toHaveProperty('$data');
    expect(fallbackItem.state.body).toBeInstanceOf(FakeReactObject);
    expect(fallbackItem.state.body.state.props).toEqual({ id: 4, panelType: 'table', title: 'Table' });
    expect(JSON.stringify(fallbackItem.state.body.state)).not.toMatch(
      /\$data|pluginId|loader|datasource|targets|transformations/
    );
  });

  it('parents the Text VizPanel directly into the scene graph so dashboard variables resolve', () => {
    const graph = convertPartialDashboardToGrafana13Scene(primary, scenes as never);
    const textBody = graph.scene.state.body.state.children[0].state.body;
    expect(textBody.state.panel).toBeInstanceOf(FakeVizPanel);
    expect(textBody.state.panel.parent).toBe(textBody);
    expect(textBody.parent?.parent?.parent).toBe(graph.scene);
  });
});
