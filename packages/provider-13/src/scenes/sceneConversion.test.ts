import { describe, expect, it } from 'vitest';

import type { Grafana13PartialPreflightResult } from '../partialContracts';
import { partialPreflightGrafana13DashboardV1 } from '../partialPreflight';
import { grafana13Provider } from '../provider';
import { fixtureDashboard } from '../testFixtures.test';
import { validateProviderCompatibilityManifest } from '@dashboard-render-sdk-g/provider-contract';
import { convertPartialDashboardToGrafana13Scene, inspectGrafana13Scene } from './sceneConversion';

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

const scenes = {
  ConstantVariable: FakeConstantVariable,
  SceneGridItem: FakeGridItem,
  SceneGridLayout: FakeGridLayout,
  SceneObjectBase: FakeObject,
  SceneReactObject: FakeReactObject,
  SceneTimeRange: FakeTimeRange,
  SceneVariableSet: FakeVariableSet,
  VizPanel: FakeVizPanel,
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
    ['grsdk-phase0-poc', 4, 3],
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
