// POC / EXPERIMENT / NOT FOR PRODUCTION
import type { DataFrame, DataTransformerConfig } from '@grafana/data';

import {
  preflightTransformationPipeline,
  TransformationConformanceError,
} from './capabilityCatalogue.ts';
import { inspectTransformationConformance } from './providerAdapter.ts';
import {
  inspectStyleLifecycleProvider,
  styleLifecycleProviderCommand,
} from '../../styling/style-lifecycle/runtimeProbe.ts';

interface Scene {
  readonly isActive: boolean;
  readonly state: {
    readonly $timeRange: { updateFromUrl(value: { from: string; to: string }): void };
    readonly body: { readonly state: { readonly children: unknown[] } };
    readonly legacyPanelIds: readonly number[];
  };
}

function activeScenes(): Scene[] {
  const references = globalThis.__STYLE_LIFECYCLE_SCENE_REFS__ ?? [];
  return references
    .map((reference) => reference.deref())
    .filter((scene): scene is Scene => scene?.isActive === true) as Scene[];
}

function timeSeriesState() {
  const scene = activeScenes()[0];
  if (!scene) throw new Error('No active transformation-conformance scene exists.');
  const state = scene.state as unknown as {
    body: { state: { children: ReadonlyArray<{ state: { body: { state: { $data?: unknown; fieldConfig?: unknown } } } }> } };
    legacyPanelIds: readonly number[];
  };
  const index = state.legacyPanelIds.indexOf(3);
  const viz = state.body.state.children[index]?.state.body;
  const transformer = viz?.state.$data as {
    state: { $data: { state: { data?: { series?: DataFrame[] } } }; data?: { series?: DataFrame[] } };
  } | undefined;
  const raw = transformer?.state.$data.state.data?.series;
  const transformed = transformer?.state.data?.series;
  if (!raw || !transformed) throw new Error('The real query/transform pipeline is not Done.');
  return { fieldConfig: viz?.state.fieldConfig, raw, transformed };
}

export function inspectTransformationProvider() {
  return {
    conformance: inspectTransformationConformance(),
    provider: inspectStyleLifecycleProvider(),
  };
}

export function transformationProviderCommand(
  command: 'mountPrimary' | 'refresh' | 'resize' | 'switchUidWithOpenModal' | 'timeRange' | 'togglePrimary' | 'toggleSecondary'
) {
  styleLifecycleProviderCommand(command);
}

export function probeTransformationPipeline(input: unknown) {
  try {
    preflightTransformationPipeline(input);
    return { accepted: true, category: 'accepted' };
  } catch (error: unknown) {
    return {
      accepted: false,
      category: error instanceof TransformationConformanceError ? error.code : 'unknown',
    };
  }
}

export async function runRealTransformationParity() {
  const {
    executeDeclarative,
    executeExplicit,
    semanticFrameSnapshot,
  } = await import('./execution.ts');
  const { fieldConfig, raw, transformed } = timeSeriesState();
  const config: DataTransformerConfig = {
    id: 'renameByRegex',
    options: { regex: '/Raw/', renamePattern: 'Signal' },
  };
  const explicit = await executeExplicit(config as never, raw);
  const declarative = await executeDeclarative(config as never, raw);
  const rawNumber = raw[0]?.fields.find((field) => field.type === 'number');
  const transformedNumber = transformed[0]?.fields.find((field) => field.type === 'number');
  return {
    actualDisplayName: transformedNumber?.state?.displayName,
    declarative: semanticFrameSnapshot(declarative),
    explicit: semanticFrameSnapshot(explicit),
    fieldConfig: structuredClone(fieldConfig),
    rawDisplayName: rawNumber?.state?.displayName,
    refId: transformed[0]?.refId,
  };
}
