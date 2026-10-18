// POC / EXPERIMENT / NOT FOR PRODUCTION
import type { DataFrame, FieldType } from '@grafana/data';
import { describe, expect, it } from 'vitest';

import {
  inspectTransformationCatalogue,
  preflightTransformationPipeline,
  validateSeriesInput,
} from '../../../experiments/transformations/conformance/capabilityCatalogue.ts';

const exact = {
  id: 'renameByRegex',
  options: { regex: '/Raw/', renamePattern: 'Signal' },
};

function seriesFrame(): DataFrame {
  return {
    fields: [
      { config: {}, name: 'Time', type: 'time' as FieldType, values: [1, 2] },
      { config: {}, name: 'Phase 0 Pulse Raw', type: 'number' as FieldType, values: [10, 20] },
    ],
    length: 2,
    meta: { preferredVisualisationType: 'graph' },
    name: 'fixture',
    refId: 'A',
  };
}

describe('closed transformation capability catalogue', () => {
  it('admits only an empty pipeline or one exact renameByRegex descriptor', () => {
    expect(preflightTransformationPipeline([])).toEqual({ kind: 'empty', transformations: [] });
    expect(preflightTransformationPipeline([exact])).toEqual({
      kind: 'renameByRegex',
      transformations: [exact],
    });
    expect(inspectTransformationCatalogue()).toMatchObject({
      maxChainLength: 1,
      supportedIds: ['renameByRegex'],
      topic: 'series',
      version: '13.2.3',
    });
  });

  it.each([
    ['UnsupportedTransformation', [{ id: 'reduce', options: {} }]],
    ['TransformationPipelineInvalid', [exact, exact]],
    ['TransformationOptionsInvalid', [{ id: 'renameByRegex', options: { regex: '/Raw/' } }]],
    ['TransformationOptionsInvalid', [{ id: 'renameByRegex', options: { ...exact.options, extra: true } }]],
    ['TransformationPipelineInvalid', [{ ...exact, disabled: true }]],
    ['TransformationPipelineInvalid', [{ ...exact, filter: { id: 'byRefId', options: 'A' } }]],
    ['TransformationPipelineInvalid', [{ ...exact, topic: 'annotations' }]],
  ])('rejects %s before execution', (code, transformations) => {
    expect(() => preflightTransformationPipeline(transformations)).toThrowError(
      expect.objectContaining({ code })
    );
  });

  it('admits only the verified Time series DataFrame profile', () => {
    expect(validateSeriesInput([seriesFrame()])).toEqual([seriesFrame()]);
    expect(() => validateSeriesInput([{ ...seriesFrame(), fields: seriesFrame().fields.slice(1) }])).toThrowError(
      expect.objectContaining({ code: 'TransformationInputUnsupported' })
    );
    expect(() => validateSeriesInput([{ ...seriesFrame(), fields: seriesFrame().fields.slice(0, 1) }])).toThrowError(
      expect.objectContaining({ code: 'TransformationInputUnsupported' })
    );
  });
});
