// POC / EXPERIMENT / NOT FOR PRODUCTION
import type { DataFrame, FieldType } from '@grafana/data';
import { describe, expect, it } from 'vitest';

import {
  executeDeclarative,
  executeExplicit,
  executeOrderedDiagnostic,
  inspectOperatorLoader,
  prepareTransformationPipeline,
  semanticFrameSnapshot,
} from '../../../experiments/transformations/conformance/execution.ts';

function frame(name = 'Phase 0 Pulse Raw'): DataFrame {
  return {
    fields: [
      { config: { displayName: 'timestamp' }, name: 'Time', type: 'time' as FieldType, values: [1, 2, 3] },
      {
        config: { custom: { lineWidth: 2 }, unit: 'percent' },
        labels: { source: 'testdata' },
        name,
        state: { displayName: name },
        type: 'number' as FieldType,
        values: [10, 20, 30],
      },
    ],
    length: 3,
    meta: { custom: { scenario: 'predictable_pulse' }, preferredVisualisationType: 'graph' },
    name: 'fixture',
    refId: 'A',
  };
}

const fixture = { id: 'renameByRegex', options: { regex: '/Raw/', renamePattern: 'Signal' } } as const;

describe('exact Grafana renameByRegex execution', () => {
  it('keeps the empty pipeline lazy and returns the original query data unchanged', async () => {
    const input = [frame()];
    const before = inspectOperatorLoader();
    const prepared = await prepareTransformationPipeline([]);
    const output = await prepared.execute(input);

    expect(output).toBe(input);
    expect(inspectOperatorLoader()).toEqual(before);
  });

  it('produces semantically equivalent explicit and declarative outputs', async () => {
    const input = [frame()];
    const explicit = await executeExplicit(fixture, input);
    const declarative = await executeDeclarative(fixture, input);

    expect(semanticFrameSnapshot(explicit)).toEqual(semanticFrameSnapshot(declarative));
    expect(semanticFrameSnapshot(explicit)).toEqual([
      {
        fields: [
          {
            config: { displayName: 'timestamp' },
            labels: undefined,
            name: 'Time',
            state: { displayName: 'timestamp', multipleFrames: false },
            type: 'time',
            values: [1, 2, 3],
          },
          {
            config: { custom: { lineWidth: 2 }, displayName: 'Phase 0 Pulse Signal testdata', unit: 'percent' },
            labels: { source: 'testdata' },
            name: 'Phase 0 Pulse Raw',
            state: { displayName: 'Phase 0 Pulse Signal testdata', multipleFrames: false },
            type: 'number',
            values: [10, 20, 30],
          },
        ],
        length: 3,
        meta: { custom: { scenario: 'predictable_pulse' }, preferredVisualisationType: 'graph' },
        name: 'fixture',
        refId: 'A',
      },
    ]);
  });

  it.each([
    ['/Raw/', 'Signal', 'Phase 0 Pulse Signal testdata'],
    ['/(Phase 0) (Pulse) (Raw)/', '$1 $2 Signal', 'Phase 0 Pulse Signal testdata'],
    ['/(Raw)/g', '$1-$1', 'Phase 0 Pulse Raw-Raw testdata'],
    ['Raw', 'Signal', undefined],
  ])('preserves pinned regex semantics for %s', async (regex, renamePattern, expected) => {
    const output = await executeExplicit(
      { id: 'renameByRegex', options: { regex, renamePattern } },
      [frame()]
    );
    expect(output[0]?.fields[1]?.config.displayName).toBe(expected);
  });

  it('demonstrates upstream sequence ordering while product admission stays length one', async () => {
    const firstThenSecond = await executeOrderedDiagnostic(
      [
        { id: 'renameByRegex', options: { regex: '/Raw/', renamePattern: 'Intermediate' } },
        { id: 'renameByRegex', options: { regex: '/Intermediate/', renamePattern: 'Signal' } },
      ],
      [frame()]
    );
    const reverse = await executeOrderedDiagnostic(
      [
        { id: 'renameByRegex', options: { regex: '/Intermediate/', renamePattern: 'Signal' } },
        { id: 'renameByRegex', options: { regex: '/Raw/', renamePattern: 'Intermediate' } },
      ],
      [frame()]
    );

    expect(firstThenSecond[0]?.fields[1]?.config.displayName).toBe('Phase 0 Pulse Signal testdata');
    expect(reverse[0]?.fields[1]?.config.displayName).toBe('Phase 0 Pulse Intermediate testdata');
  });

  it('classifies invalid regex execution and never returns raw data as success', async () => {
    await expect(
      executeExplicit(
        { id: 'renameByRegex', options: { regex: '/[/', renamePattern: 'Signal' } },
        [frame()]
      )
    ).rejects.toMatchObject({ code: 'TransformationExecutionFailure' });
  });
});
