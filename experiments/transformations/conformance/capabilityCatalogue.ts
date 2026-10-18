// POC / EXPERIMENT / NOT FOR PRODUCTION
import type { DataFrame, DataTransformerConfig } from '@grafana/data';

export type TransformationConformanceErrorCode =
  | 'UnsupportedTransformation'
  | 'TransformationVersionMismatch'
  | 'TransformationRegistryUnavailable'
  | 'TransformationOptionsInvalid'
  | 'TransformationInputUnsupported'
  | 'TransformationLoadFailure'
  | 'TransformationExecutionFailure'
  | 'TransformationPipelineInvalid';

export class TransformationConformanceError extends Error {
  constructor(
    readonly code: TransformationConformanceErrorCode,
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'TransformationConformanceError';
  }
}

export interface RenameByRegexConfiguration {
  readonly id: 'renameByRegex';
  readonly options: {
    readonly regex: string;
    readonly renamePattern: string;
  };
}

export type AdmittedTransformationPipeline =
  | { readonly kind: 'empty'; readonly transformations: readonly [] }
  | {
      readonly kind: 'renameByRegex';
      readonly transformations: readonly [RenameByRegexConfiguration];
    };

const catalogue = Object.freeze({
  executionMode: 'closed-explicit-operator',
  implementationIdentity:
    '@grafana/data@13.2.3/dist/esm/transformations/transformers/renameByRegex.mjs',
  maxChainLength: 1,
  optionsProfile: Object.freeze(['regex', 'renamePattern']),
  sourceCommit: '6193dc03311b631b9727b560d24369e683dc396e',
  supportedIds: Object.freeze(['renameByRegex']),
  topic: 'series',
  version: '13.2.3',
});

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TransformationConformanceError(
      'TransformationOptionsInvalid',
      `${label} must be an object.`
    );
  }
  return value as Record<string, unknown>;
}

export function inspectTransformationCatalogue() {
  return structuredClone(catalogue);
}

export function preflightTransformationPipeline(
  input: unknown
): AdmittedTransformationPipeline {
  if (!Array.isArray(input)) {
    throw new TransformationConformanceError(
      'TransformationPipelineInvalid',
      'The transformation pipeline must be an array.'
    );
  }
  if (input.length === 0) return { kind: 'empty', transformations: [] };
  if (input.length !== 1) {
    throw new TransformationConformanceError(
      'TransformationPipelineInvalid',
      'The verified profile admits at most one transformation.'
    );
  }

  const transformation = record(input[0], 'Transformation');
  const transformationKeys = Object.keys(transformation).sort();
  if (transformationKeys.join(',') !== 'id,options') {
    throw new TransformationConformanceError(
      'TransformationPipelineInvalid',
      'Filtered, disabled, topic-qualified, interpolated, or extended transformation forms are unsupported.'
    );
  }
  if (transformation.id !== 'renameByRegex') {
    throw new TransformationConformanceError(
      'UnsupportedTransformation',
      `Transformation ${String(transformation.id)} is outside the closed catalogue.`
    );
  }
  const options = record(transformation.options, 'renameByRegex options');
  if (
    Object.keys(options).sort().join(',') !== 'regex,renamePattern' ||
    typeof options.regex !== 'string' ||
    typeof options.renamePattern !== 'string'
  ) {
    throw new TransformationConformanceError(
      'TransformationOptionsInvalid',
      'renameByRegex requires exactly string regex and renamePattern options.'
    );
  }

  return {
    kind: 'renameByRegex',
    transformations: [
      {
        id: 'renameByRegex',
        options: { regex: options.regex, renamePattern: options.renamePattern },
      },
    ],
  };
}

export function validateSeriesInput(frames: readonly DataFrame[]): readonly DataFrame[] {
  for (const [index, frame] of frames.entries()) {
    if (!Array.isArray(frame.fields) || frame.fields.length < 2) {
      throw new TransformationConformanceError(
        'TransformationInputUnsupported',
        `Frame ${index} is outside the verified series profile.`
      );
    }
    const hasTime = frame.fields.some((field) => field.type === 'time');
    const hasNumber = frame.fields.some((field) => field.type === 'number');
    const lengthsMatch = frame.fields.every((field) => field.values.length === frame.length);
    if (!hasTime || !hasNumber || !lengthsMatch) {
      throw new TransformationConformanceError(
        'TransformationInputUnsupported',
        `Frame ${index} requires aligned time and number fields.`
      );
    }
  }
  return frames;
}

export function asGrafanaConfigs(
  pipeline: AdmittedTransformationPipeline
): readonly DataTransformerConfig[] {
  return pipeline.transformations as readonly DataTransformerConfig[];
}
