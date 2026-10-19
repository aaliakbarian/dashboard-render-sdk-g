// POC / EXPERIMENT / NOT FOR PRODUCTION
import type { CustomTransformOperator, DataFrame, DataTransformerConfig, DataTransformerInfo } from '@grafana/data';
import type { PocRuntimeLease } from '@dashboard-render-sdk-g/poc-compat';
import { catchError, map, throwError } from 'rxjs';

import {
  inspectTransformationCatalogue,
  preflightTransformationPipeline,
  TransformationConformanceError,
  validateSeriesInput,
} from './capabilityCatalogue.ts';
import { inspectOperatorLoader, loadRenameByRegexOperator } from './operatorEntry.ts';

let executions = 0;
let executionFailures = 0;
let failClosedContainments = 0;
let operatorIdentityMatchesRegistry = false;
let registryIds: string[] = [];
let runtimeOperator: DataTransformerInfo | undefined;

export async function prepareTransformationConformanceRuntime(runtime: PocRuntimeLease) {
  const operator = await loadRenameByRegexOperator();
  const { standardTransformersRegistry } = await import('transformation-conformance-registry');
  registryIds = [...runtime.inspectTransformerRegistry()];
  const registryEntry = standardTransformersRegistry.getIfExists('renameByRegex');
  const registryOperator = registryEntry ? await registryEntry.transformation() : undefined;
  operatorIdentityMatchesRegistry =
    registryIds.length === 1 &&
    registryIds[0] === 'renameByRegex' &&
    registryOperator === operator;
  if (!operatorIdentityMatchesRegistry) {
    throw new TransformationConformanceError(
      'TransformationVersionMismatch',
      'The provider operator does not match the one-entry runtime registry identity.'
    );
  }
  runtimeOperator = operator;
}

function resolveTransformation(config: DataTransformerConfig): CustomTransformOperator {
  const pipeline = preflightTransformationPipeline([config]);
  if (pipeline.kind !== 'renameByRegex') {
    throw new TransformationConformanceError(
      'TransformationPipelineInvalid',
      'The provider expected one renameByRegex transformation.'
    );
  }
  const admitted = pipeline.transformations[0];
  if (!runtimeOperator) {
    throw new TransformationConformanceError(
      'TransformationRegistryUnavailable',
      'The transformation runtime was not prepared before scene conversion.'
    );
  }
  const operator = runtimeOperator;
  return (context) => (source) => source.pipe(
    map((frames) => validateSeriesInput(frames) as DataFrame[]),
    operator.operator(admitted.options, context),
    map((frames) => {
      executions += 1;
      return frames;
    }),
    catchError((error: unknown) => {
      executionFailures += 1;
      return throwError(() => error instanceof TransformationConformanceError
        ? error
        : new TransformationConformanceError(
          'TransformationExecutionFailure',
          'The accepted renameByRegex pipeline failed without raw-data fallback.',
          { cause: error }
        ));
    })
  );
}

export function withTransformationConformance(runtime: PocRuntimeLease): PocRuntimeLease {
  const BaseTransformer = runtime.scenes.SceneDataTransformer;
  class FailClosedSceneDataTransformer extends BaseTransformer {
    constructor(state: ConstructorParameters<typeof BaseTransformer>[0]) {
      super(state);
      this.addActivationHandler(() => {
        const subscription = this.subscribeToState((current) => {
          const data = current.data;
          if (data?.state === 'Error' && data.series.length > 0) {
            failClosedContainments += 1;
            this.setState({ data: { ...data, series: [] } });
          }
        });
        return () => subscription.unsubscribe();
      });
    }
  }
  return Object.freeze({
    ...runtime,
    resolveGateCTransformation: resolveTransformation,
    scenes: Object.freeze({
      ...runtime.scenes,
      SceneDataTransformer: FailClosedSceneDataTransformer,
    }),
  });
}

export function inspectTransformationConformance() {
  return {
    catalogue: inspectTransformationCatalogue(),
    executionFailures,
    executions,
    failClosedContainments,
    grafanaDataIdentity: {
      copies: operatorIdentityMatchesRegistry ? 1 : 0,
      version: '13.2.3',
    },
    operatorIdentityMatchesRegistry,
    operatorLoader: inspectOperatorLoader(),
    registryIds: [...registryIds],
  };
}
