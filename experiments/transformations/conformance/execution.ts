// POC / EXPERIMENT / NOT FOR PRODUCTION
import type {
  DataFrame,
  DataTransformerConfig,
  DataTransformerInfo,
  TransformerRegistryItem,
} from '@grafana/data';
import { firstValueFrom, of } from 'rxjs';

import {
  asGrafanaConfigs,
  preflightTransformationPipeline,
  TransformationConformanceError,
  type RenameByRegexConfiguration,
  validateSeriesInput,
} from './capabilityCatalogue.ts';
import { inspectOperatorLoader, loadRenameByRegexOperator } from './operatorEntry.ts';
import { standardTransformersRegistry } from 'transformation-conformance-registry';
import { transformDataFrame } from 'transformation-conformance-transform-data-frame';

export { inspectOperatorLoader };

let registryConfigured = false;

function registryItem(operator: DataTransformerInfo): TransformerRegistryItem {
  return {
    defaultOptions: operator.defaultOptions,
    description: operator.description,
    editor: () => null,
    id: 'renameByRegex',
    imageDark: '',
    imageLight: '',
    name: operator.name,
    transformation: () => Promise.resolve(operator),
  };
}

export async function ensureDeclarativeRegistry(operator: DataTransformerInfo) {
  if (!registryConfigured) {
    try {
      standardTransformersRegistry.setInit(() => [registryItem(operator)]);
    } catch (error: unknown) {
      if (!(error instanceof Error) || error.message !== 'Registry already initialized') {
        throw new TransformationConformanceError(
          'TransformationRegistryUnavailable',
          'The exact one-entry registry mirror could not be configured.',
          { cause: error }
        );
      }
    }
    registryConfigured = true;
  }
  const entry = standardTransformersRegistry.getIfExists('renameByRegex');
  const resolved = entry ? await entry.transformation() : undefined;
  if (!entry || resolved !== operator || standardTransformersRegistry.list().length !== 1) {
    throw new TransformationConformanceError(
      'TransformationVersionMismatch',
      'The Grafana registry mirror does not match the closed provider operator identity.'
    );
  }
  return entry;
}

async function executeOperator(
  operator: DataTransformerInfo,
  config: RenameByRegexConfiguration,
  input: readonly DataFrame[]
): Promise<DataFrame[]> {
  validateSeriesInput(input);
  try {
    const context = { interpolate: (value: string) => value };
    return await firstValueFrom(
      operator.operator(config.options, context)(of(input as DataFrame[]))
    );
  } catch (error: unknown) {
    throw new TransformationConformanceError(
      'TransformationExecutionFailure',
      'renameByRegex failed without falling back to raw query data.',
      { cause: error }
    );
  }
}

export async function executeExplicit(
  config: RenameByRegexConfiguration,
  input: readonly DataFrame[]
): Promise<DataFrame[]> {
  const pipeline = preflightTransformationPipeline([config]);
  if (pipeline.kind !== 'renameByRegex') {
    throw new TransformationConformanceError('TransformationPipelineInvalid', 'Expected renameByRegex.');
  }
  return executeOperator(await loadRenameByRegexOperator(), pipeline.transformations[0], input);
}

export async function executeDeclarative(
  config: RenameByRegexConfiguration,
  input: readonly DataFrame[]
): Promise<DataFrame[]> {
  const pipeline = preflightTransformationPipeline([config]);
  if (pipeline.kind !== 'renameByRegex') {
    throw new TransformationConformanceError('TransformationPipelineInvalid', 'Expected renameByRegex.');
  }
  validateSeriesInput(input);
  const operator = await loadRenameByRegexOperator();
  await ensureDeclarativeRegistry(operator);
  try {
    return await firstValueFrom(
      transformDataFrame([...asGrafanaConfigs(pipeline)], input as DataFrame[], {
        interpolate: (value: string) => value,
      })
    );
  } catch (error: unknown) {
    throw new TransformationConformanceError(
      'TransformationExecutionFailure',
      'Declarative renameByRegex failed without falling back to raw query data.',
      { cause: error }
    );
  }
}

export async function executeOrderedDiagnostic(
  configurations: readonly RenameByRegexConfiguration[],
  input: readonly DataFrame[]
) {
  let output = input as DataFrame[];
  const operator = await loadRenameByRegexOperator();
  for (const config of configurations) output = await executeOperator(operator, config, output);
  return output;
}

export async function prepareTransformationPipeline(input: unknown) {
  const pipeline = preflightTransformationPipeline(input);
  if (pipeline.kind === 'empty') {
    return Object.freeze({
      execute: async (frames: readonly DataFrame[]) => frames,
      kind: pipeline.kind,
    });
  }
  const operator = await loadRenameByRegexOperator();
  return Object.freeze({
    execute: (frames: readonly DataFrame[]) => executeOperator(operator, pipeline.transformations[0], frames),
    kind: pipeline.kind,
  });
}

export function semanticFrameSnapshot(frames: readonly DataFrame[]) {
  return frames.map((frame) => ({
    fields: frame.fields.map((field) => ({
      config: structuredClone(field.config),
      labels: field.labels ? structuredClone(field.labels) : undefined,
      name: field.name,
      state: field.state ? structuredClone(field.state) : undefined,
      type: field.type,
      values: [...field.values],
    })),
    length: frame.length,
    meta: frame.meta ? structuredClone(frame.meta) : undefined,
    name: frame.name,
    refId: frame.refId,
  }));
}

export function inspectRegistryIdentity() {
  return {
    ids: standardTransformersRegistry.list().map(({ id }) => id),
    registryObject: standardTransformersRegistry,
  };
}
