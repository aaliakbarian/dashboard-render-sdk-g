import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import type { PocDashboardV1Result } from './types';
import {
  POC_TASK7_PANEL_CATALOG,
  PocSceneConversionError,
  preflightFixtureV1,
} from './preflightFixture';

function fixtureResult(name = 'grsdk-phase0-poc'): PocDashboardV1Result {
  const spec = JSON.parse(
    readFileSync(resolve(`dev/grafana/provisioning/dashboards/${name}.json`), 'utf8')
  ) as Record<string, unknown>;

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
      spec: spec as PocDashboardV1Result['dto']['spec'],
      status: { conversion: { failed: false, storedVersion: 'v1' } },
    },
    family: 'v1',
    requestedUid: name,
    v2Available: true,
  };
}

function altered(
  mutate: (spec: Record<string, unknown>) => void,
  name = 'grsdk-phase0-poc'
): PocDashboardV1Result {
  const result = structuredClone(fixtureResult(name));
  mutate(result.dto.spec);
  return result;
}

function expectConversionError(action: () => unknown, code: string, path?: string) {
  const failure = (() => {
    try {
      action();
      return undefined;
    } catch (error) {
      return error;
    }
  })();
  expect(failure).toBeInstanceOf(PocSceneConversionError);
  expect(failure).toMatchObject({ code, ...(path ? { path } : {}) });
}

describe('Task 7 fixture preflight', () => {
  it('accepts the exact primary and lifecycle fixtures as current-schema V1', () => {
    const primary = preflightFixtureV1(fixtureResult(), POC_TASK7_PANEL_CATALOG);
    const alternate = preflightFixtureV1(
      fixtureResult('grsdk-phase0-poc-alt'),
      POC_TASK7_PANEL_CATALOG
    );

    expect(primary).toMatchObject({
      refresh: '',
      schemaVersion: 42,
      title: 'Dashboard Render SDK G Phase 0 POC',
      uid: 'grsdk-phase0-poc',
    });
    expect(primary.panels.map(({ id, type }) => ({ id, type }))).toEqual([
      { id: 1, type: 'text' },
      { id: 2, type: 'stat' },
      { id: 3, type: 'timeseries' },
      { id: 4, type: 'table' },
    ]);
    expect(primary.variables).toEqual([
      expect.objectContaining({ name: 'environment', type: 'constant', value: 'phase0' }),
    ]);
    expect(alternate.panels).toHaveLength(1);
    expect(alternate.panels[0]).toMatchObject({
      gridPos: { h: 8, w: 24, x: 0, y: 0 },
      id: 1,
      type: 'text',
    });
  });

  it('recognizes the exact server-canonical default annotation and preserves API panel order', () => {
    const canonical = altered((spec) => {
      spec.annotations = {
        list: [
          {
            builtIn: 1,
            datasource: { type: 'grafana', uid: '-- Grafana --' },
            enable: true,
            hide: true,
            iconColor: 'rgba(0, 211, 255, 1)',
            name: 'Annotations & Alerts',
            type: 'dashboard',
          },
        ],
      };
      const panels = spec.panels as Array<Record<string, unknown>>;
      delete panels[0]!.fieldConfig;
      spec.panels = [panels[0], panels[1], panels[3], panels[2]];
    });

    const result = preflightFixtureV1(canonical, POC_TASK7_PANEL_CATALOG);

    expect(result.annotationPolicy).toBe('builtin-default-omitted');
    expect(result.panels.map(({ id }) => id)).toEqual([1, 2, 4, 3]);
    expect(result.panels[0]!.fieldConfig).toEqual({ defaults: {}, overrides: [] });
  });

  it('requires stable V1 schema 42 and rejects a V2-shaped input', () => {
    expectConversionError(
      () =>
        preflightFixtureV1(
          altered((spec) => {
            spec.schemaVersion = 41;
          }),
          POC_TASK7_PANEL_CATALOG
        ),
      'unsupported-schema',
      'spec.schemaVersion'
    );
    const v2 = structuredClone(fixtureResult()) as unknown as {
      apiVersion: string;
      family: string;
    };
    v2.apiVersion = 'v2';
    v2.family = 'v2';
    expectConversionError(
      () => preflightFixtureV1(v2 as never, POC_TASK7_PANEL_CATALOG),
      'unsupported-schema',
      'family'
    );
  });

  it('rejects unsupported panel types and selects only panels admitted by the active gate', () => {
    expectConversionError(
      () =>
        preflightFixtureV1(
          altered((spec) => {
            (spec.panels as Array<Record<string, unknown>>)[1]!.type = 'gauge';
          }),
          POC_TASK7_PANEL_CATALOG
        ),
      'unsupported-panel-type',
      'spec.panels[1].type'
    );
    const textOnly = preflightFixtureV1(fixtureResult(), {
      identity: 'text-only-gate',
      panelIds: ['text'],
    });
    expect(textOnly.panels.map(({ id, type }) => ({ id, type }))).toEqual([
      { id: 1, type: 'text' },
    ]);
    expectConversionError(
      () => preflightFixtureV1(fixtureResult(), { identity: 'empty-gate', panelIds: [] }),
      'unsupported-panel-type',
      'catalog.panelIds'
    );
  });

  it('rejects rows, changed grid geometry, repeats, library panels, alerts, and panel links', () => {
    expectConversionError(
      () =>
        preflightFixtureV1(
          altered((spec) => {
            (spec.panels as Array<Record<string, unknown>>)[0]!.type = 'row';
          }),
          POC_TASK7_PANEL_CATALOG
        ),
      'unsupported-layout'
    );
    expectConversionError(
      () =>
        preflightFixtureV1(
          altered((spec) => {
            const panel = (spec.panels as Array<Record<string, unknown>>)[0]!;
            (panel.gridPos as Record<string, unknown>).w = 7;
          }),
          POC_TASK7_PANEL_CATALOG
        ),
      'unsupported-layout',
      'spec.panels[0].gridPos'
    );

    for (const [field, value] of [
      ['repeat', 'environment'],
      ['libraryPanel', { uid: 'library' }],
      ['alert', { name: 'legacy-alert' }],
      ['links', [{ title: 'interaction' }]],
    ] as const) {
      expectConversionError(
        () =>
          preflightFixtureV1(
            altered((spec) => {
              (spec.panels as Array<Record<string, unknown>>)[0]![field] = value;
            }),
            POC_TASK7_PANEL_CATALOG
          ),
        'unsupported-dashboard-feature'
      );
    }
  });

  it('rejects annotations, dashboard links, query variables, Live/shared data, and unknown transforms', () => {
    const cases: Array<(spec: Record<string, unknown>) => void> = [
      (spec) => {
        spec.annotations = { list: [{ name: 'annotation' }] };
      },
      (spec) => {
        spec.links = [{ title: 'dashboard link' }];
      },
      (spec) => {
        spec.templating = { list: [{ name: 'query', type: 'query' }] };
      },
      (spec) => {
        spec.liveNow = true;
      },
      (spec) => {
        spec.preload = true;
      },
      (spec) => {
        spec.timepicker = { refresh_intervals: ['5s'] };
      },
      (spec) => {
        const panel = (spec.panels as Array<Record<string, unknown>>)[1]!;
        panel.datasource = { type: 'grafana', uid: '-- Dashboard --' };
      },
      (spec) => {
        (spec.panels as Array<Record<string, unknown>>)[2]!.transformations = [
          { id: 'organize', options: {} },
        ];
      },
    ];

    for (const mutate of cases) {
      expectConversionError(
        () => preflightFixtureV1(altered(mutate), POC_TASK7_PANEL_CATALOG),
        'unsupported-dashboard-feature'
      );
    }
  });

  it('rejects unknown material top-level fields, panel options, and malformed validated input', () => {
    expectConversionError(
      () =>
        preflightFixtureV1(
          altered((spec) => {
            spec.snapshot = { externalUrl: 'https://example.invalid' };
          }),
          POC_TASK7_PANEL_CATALOG
        ),
      'unsupported-dashboard-feature',
      'spec.snapshot'
    );
    expectConversionError(
      () =>
        preflightFixtureV1(
          altered((spec) => {
            const options = (spec.panels as Array<Record<string, unknown>>)[0]!
              .options as Record<string, unknown>;
            options.experimental = true;
          }),
          POC_TASK7_PANEL_CATALOG
        ),
      'unsupported-dashboard-feature',
      'spec.panels[0].options.experimental'
    );
    expectConversionError(
      () =>
        preflightFixtureV1(
          altered((spec) => {
            const options = (spec.panels as Array<Record<string, unknown>>)[1]!
              .options as Record<string, unknown>;
            (options.reduceOptions as Record<string, unknown>).experimental = true;
          }),
          POC_TASK7_PANEL_CATALOG
        ),
      'unsupported-dashboard-feature',
      'spec.panels[1].options.reduceOptions.experimental'
    );
    expectConversionError(
      () =>
        preflightFixtureV1(
          altered((spec) => {
            const defaults = ((spec.panels as Array<Record<string, unknown>>)[2]!
              .fieldConfig as Record<string, unknown>).defaults as Record<string, unknown>;
            (defaults.custom as Record<string, unknown>).experimental = true;
          }),
          POC_TASK7_PANEL_CATALOG
        ),
      'unsupported-dashboard-feature',
      'spec.panels[2].fieldConfig.defaults.custom.experimental'
    );
    expectConversionError(
      () =>
        preflightFixtureV1(
          altered((spec) => {
            delete spec.title;
          }),
          POC_TASK7_PANEL_CATALOG
        ),
      'malformed-validated-input',
      'spec.title'
    );
  });
});
