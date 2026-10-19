import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import type { PocScenesModule } from '../config/loadGrafanaCohort';
import { POC_TASK7_PANEL_CATALOG } from '../dashboard/preflightFixture';
import type { PocDashboardV1Result } from '../dashboard/types';
import {
  convertFixtureV1ToScene,
  createSceneConversionEvidenceRecorder,
  inspectPocDashboardScene,
} from './convertFixtureV1';

class FakeSceneObject {
  readonly isActive = false;
  readonly parent = undefined;
  readonly renderBeforeActivation = false;

  constructor(readonly state: Record<string, any>) {}

  get Component() {
    return () => null;
  }
}

class FakeConstantVariable extends FakeSceneObject {}
class FakeSceneDataTransformer extends FakeSceneObject {}
class FakeSceneGridItem extends FakeSceneObject {}
class FakeSceneGridLayout extends FakeSceneObject {}
class FakeSceneQueryRunner extends FakeSceneObject {}
class FakeSceneTimeRange extends FakeSceneObject {}
class FakeSceneVariableSet extends FakeSceneObject {}
class FakeVizPanel extends FakeSceneObject {}

const scenes = {
  ConstantVariable: FakeConstantVariable,
  SceneDataTransformer: FakeSceneDataTransformer,
  SceneGridItem: FakeSceneGridItem,
  SceneGridLayout: FakeSceneGridLayout,
  SceneObjectBase: FakeSceneObject,
  SceneQueryRunner: FakeSceneQueryRunner,
  SceneTimeRange: FakeSceneTimeRange,
  SceneVariableSet: FakeSceneVariableSet,
  VizPanel: FakeVizPanel,
  loadResources: async () => undefined,
} as unknown as PocScenesModule;

function fixtureResult(name = 'grsdk-phase0-poc'): PocDashboardV1Result {
  const spec = JSON.parse(
    readFileSync(resolve(`dev/grafana/provisioning/dashboards/${name}.json`), 'utf8')
  ) as PocDashboardV1Result['dto']['spec'];
  return {
    apiVersion: 'v1',
    discovery: {
      advertisedVersions: ['v1', 'v2'],
      group: 'dashboard.grafana.app',
      preferredVersion: 'v2',
      stableV1Available: true,
      v2Available: true,
    },
    dto: {
      access: {},
      apiVersion: 'dashboard.grafana.app/v1',
      kind: 'DashboardWithAccessInfo',
      metadata: {
        generation: 1,
        name,
        namespace: 'default',
        resourceVersion: 'fixture',
      },
      spec,
      status: { conversion: { failed: false, storedVersion: 'v1' } },
    },
    family: 'v1',
    requestedUid: name,
    v2Available: true,
  };
}

describe('Task 7 fixture V1 to Scenes conversion', () => {
  it('enriches the Task 7 Stat SceneQueryRunner request with dashboard and panel identity', () => {
    const runtime = { scenes };
    const root = convertFixtureV1ToScene({
      catalog: { identity: 'task10-stat-query-only', panelIds: ['stat'] },
      input: fixtureResult(),
      runtime,
    });
    const gridItem = root.state.body.state.children[0];
    const panel = (gridItem?.state as { body?: FakeSceneObject } | undefined)?.body;
    const runner = panel?.state.$data;

    expect(root.enrichDataRequest?.(runner)).toEqual({
      dashboardTitle: 'Dashboard Render SDK G Phase 0 POC',
      dashboardUID: 'grsdk-phase0-poc',
      panelId: 2,
      panelName: 'Stat — predictable pulse',
      panelPluginId: 'stat',
    });
  });
  it('constructs the complete deterministic graph without activation', () => {
    const evidence = createSceneConversionEvidenceRecorder();
    const root = convertFixtureV1ToScene({
      catalog: POC_TASK7_PANEL_CATALOG,
      evidence,
      input: fixtureResult(),
      runtime: { scenes },
    });

    expect(inspectPocDashboardScene(root, scenes)).toEqual({
      active: false,
      layout: 'grid',
      panels: [
        { dataProvider: 'none', gridPos: { h: 6, w: 8, x: 0, y: 0 }, id: 1, queryCount: 0, type: 'text' },
        { dataProvider: 'query', gridPos: { h: 6, w: 8, x: 8, y: 0 }, id: 2, queryCount: 1, type: 'stat' },
        { dataProvider: 'transform', gridPos: { h: 10, w: 16, x: 0, y: 6 }, id: 3, queryCount: 1, type: 'timeseries' },
        { dataProvider: 'query', gridPos: { h: 10, w: 8, x: 16, y: 0 }, id: 4, queryCount: 1, type: 'table' },
      ],
      refresh: '',
      timeRange: { from: 'now-1h', timeZone: 'browser', to: 'now' },
      title: 'Dashboard Render SDK G Phase 0 POC',
      uid: 'grsdk-phase0-poc',
      variables: [{ hide: 2, name: 'environment', value: 'phase0' }],
    });
    expect(root.isActive).toBe(false);
    expect(root.state.body.isActive).toBe(false);
    expect(root.state.body.state.children.every((child) => !child.isActive)).toBe(true);
    expect(evidence.snapshot()).toEqual([
      {
        annotationPolicy: 'none',
        layout: 'grid',
        outcome: 'success',
        panelCount: 4,
        panelTypes: ['text', 'stat', 'timeseries', 'table'],
        uid: 'grsdk-phase0-poc',
      },
    ]);
  });

  it('preserves VizPanel options, field config, datasource, targets, and transformations', () => {
    const root = convertFixtureV1ToScene({
      catalog: POC_TASK7_PANEL_CATALOG,
      input: fixtureResult(),
      runtime: { scenes },
    });
    const panels = root.state.body.state.children.map(
      (item) => (item as unknown as { state: { body: FakeVizPanel } }).state.body
    );
    const originalPanels = fixtureResult().dto.spec.panels as Array<Record<string, unknown>>;

    expect(panels.map((panel) => panel.state.pluginId)).toEqual(['text', 'stat', 'timeseries', 'table']);
    expect(panels[0]!.state.$data).toBeUndefined();
    expect(panels[0]!.state.options).toEqual(originalPanels[0]!.options);
    expect(panels[1]!.state.$data).toBeInstanceOf(FakeSceneQueryRunner);
    expect(panels[1]!.state.$data!.state).toMatchObject({
      datasource: originalPanels[1]!.datasource,
      queries: originalPanels[1]!.targets,
      runQueriesMode: 'auto',
    });
    expect(panels[1]!.state.fieldConfig).toEqual(originalPanels[1]!.fieldConfig);
    expect(panels[2]!.state.$data).toBeInstanceOf(FakeSceneDataTransformer);
    expect(panels[2]!.state.$data!.state.transformations).toEqual(originalPanels[2]!.transformations);
    expect(panels[2]!.state.$data!.state.$data).toBeInstanceOf(FakeSceneQueryRunner);
    expect(panels[3]!.state.$data).toBeInstanceOf(FakeSceneQueryRunner);
  });

  it('uses a runtime-resolved transform operator when the compatibility runtime supplies one', () => {
    const operator = vi.fn();
    const resolveGateCTransformation = vi.fn(() => operator);
    const root = convertFixtureV1ToScene({
      catalog: POC_TASK7_PANEL_CATALOG,
      input: fixtureResult(),
      runtime: { scenes, resolveGateCTransformation },
    });
    const panels = root.state.body.state.children.map(
      (item) => (item as unknown as { state: { body: FakeVizPanel } }).state.body
    );

    expect(resolveGateCTransformation).toHaveBeenCalledWith({
      id: 'renameByRegex',
      options: { regex: '/Raw/', renamePattern: 'Signal' },
    });
    expect(panels[2]!.state.$data!.state.transformations).toEqual([operator]);
  });

  it('converts the alternate lifecycle dashboard without inventing a data provider', () => {
    const root = convertFixtureV1ToScene({
      catalog: POC_TASK7_PANEL_CATALOG,
      input: fixtureResult('grsdk-phase0-poc-alt'),
      runtime: { scenes },
    });
    const snapshot = inspectPocDashboardScene(root, scenes);

    expect(snapshot).toMatchObject({
      panels: [{ dataProvider: 'none', id: 1, queryCount: 0, type: 'text' }],
      title: 'Dashboard Render SDK G Phase 0 POC Alternate',
      uid: 'grsdk-phase0-poc-alt',
    });
  });

  it('creates a Text-only inactive graph for the sequential Gate A catalog', () => {
    const root = convertFixtureV1ToScene({
      catalog: { identity: 'gate-a-text-only', panelIds: ['text'] },
      input: fixtureResult(),
      runtime: { scenes },
    });

    expect(inspectPocDashboardScene(root, scenes).panels).toEqual([
      {
        dataProvider: 'none',
        gridPos: { h: 6, w: 8, x: 0, y: 0 },
        id: 1,
        queryCount: 0,
        type: 'text',
      },
    ]);
  });

  it('records only a sanitized category when preflight fails', () => {
    const evidence = createSceneConversionEvidenceRecorder();
    const input = structuredClone(fixtureResult());
    (input.dto.spec.panels as Array<Record<string, unknown>>)[0]!.type = 'secret-plugin';

    expect(() =>
      convertFixtureV1ToScene({
        catalog: POC_TASK7_PANEL_CATALOG,
        evidence,
        input,
        runtime: { scenes },
      })
    ).toThrowError(expect.objectContaining({ code: 'unsupported-panel-type' }));
    expect(evidence.snapshot()).toEqual([
      {
        category: 'unsupported-panel-type',
        layout: 'grid',
        outcome: 'failure',
        uid: 'grsdk-phase0-poc',
      },
    ]);
    expect(JSON.stringify(evidence.snapshot())).not.toMatch(/query|target|content|password|authorization/i);
  });

  it('wraps constructor failures as a typed conversion invariant violation', () => {
    class RejectingGridLayout extends FakeSceneGridLayout {
      constructor() {
        super({});
        throw new Error('constructor detail must not enter evidence');
      }
    }
    const evidence = createSceneConversionEvidenceRecorder();
    const brokenScenes = {
      ...scenes,
      SceneGridLayout: RejectingGridLayout,
    } as unknown as PocScenesModule;

    expect(() =>
      convertFixtureV1ToScene({
        catalog: POC_TASK7_PANEL_CATALOG,
        evidence,
        input: fixtureResult(),
        runtime: { scenes: brokenScenes },
      })
    ).toThrowError(expect.objectContaining({ code: 'conversion-invariant-violation' }));
    expect(evidence.snapshot()).toEqual([
      {
        category: 'conversion-invariant-violation',
        layout: 'grid',
        outcome: 'failure',
        uid: 'grsdk-phase0-poc',
      },
    ]);
    expect(JSON.stringify(evidence.snapshot())).not.toContain('constructor detail');
  });

  it('contains no Grafana application converter, model, shell, or router import', () => {
    const sourceFiles = [
      'packages/poc-compat/src/dashboard/preflightFixture.ts',
      'packages/poc-compat/src/scenes/PocDashboardSceneRoot.tsx',
      'packages/poc-compat/src/scenes/convertFixtureV1.ts',
      'packages/poc-compat/src/component/GrafanaDashboard.tsx',
    ];
    const source = sourceFiles
      .map((path) => readFileSync(resolve(path), 'utf8'))
      .join('\n');

    expect(source).not.toMatch(
      /from\s+['"](?:public\/app|app\/)|@grafana\/(?:data|runtime|ui)\/internal|\bDashboardModel\b|\bDashboardMigrator\b|\bDashboardScene\b|GrafanaApp\.init|react-router|<iframe/i
    );
  });
});
