// POC / EXPERIMENT / NOT FOR PRODUCTION
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { DataFrame, FieldType } from '@grafana/data';
import { afterAll, describe, expect, it } from 'vitest';

import { executeExplicit } from '../../../experiments/transformations/conformance/execution.ts';

const evidence: Array<Record<string, number>> = [];
const repositoryRoot = resolve(import.meta.dirname, '../../..');

function frames(frameCount: number, numericFields: number, points: number): DataFrame[] {
  return Array.from({ length: frameCount }, (_, frameIndex) => ({
    fields: [
      {
        config: {},
        name: 'Time',
        type: 'time' as FieldType,
        values: Array.from({ length: points }, (_, index) => index),
      },
      ...Array.from({ length: numericFields }, (_, fieldIndex) => ({
        config: {},
        name: `Frame ${frameIndex} Field ${fieldIndex} Raw`,
        type: 'number' as FieldType,
        values: Array.from({ length: points }, (_, index) => index % 101),
      })),
    ],
    length: points,
    name: `frame-${frameIndex}`,
    refId: `R${frameIndex}`,
  }));
}

afterAll(() => {
  const directory = resolve(repositoryRoot, 'artifacts/experiments/transformation-conformance');
  mkdirSync(directory, { recursive: true });
  writeFileSync(
    resolve(directory, 'performance-evidence.json'),
    `${JSON.stringify({ generatedBy: 'transformation-conformance-performance-v1', samples: evidence }, null, 2)}\n`
  );
});

describe('bounded renameByRegex performance observations', () => {
  it.each([
    [1, 1, 120],
    [1, 4, 3_600],
    [4, 8, 10_000],
  ])('processes %i frames × %i numeric fields × %i points without structural retention', async (frameCount, numericFields, points) => {
    const input = frames(frameCount, numericFields, points);
    const started = performance.now();
    const output = await executeExplicit(
      { id: 'renameByRegex', options: { regex: '/Raw/', renamePattern: 'Signal' } },
      input
    );
    const elapsedMs = performance.now() - started;

    expect(output).toHaveLength(frameCount);
    expect(output.every((frame) => frame.fields.length === numericFields + 1)).toBe(true);
    expect(output[0]?.fields[1]?.config.displayName).toContain('Signal');
    expect(elapsedMs).toBeLessThan(2_000);
    evidence.push({ elapsedMs, fields: frameCount * (numericFields + 1), frames: frameCount, points });
  });
});
