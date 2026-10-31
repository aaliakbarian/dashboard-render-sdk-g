import type { ComponentType } from 'react';

/**
 * Provider-only replacements for integrations that are absent from the admitted
 * dashboard profile. The exact TimeSeriesPanel/TimeSeries/GraphNG renderer remains
 * upstream source; these replacements prevent assistant, annotations, actions,
 * and editor/dashboard services from entering the standalone runtime.
 */
export const AssistantTooltipButton: ComponentType<Record<string, unknown>> = () => null;
export const AnnotationsPlugin: ComponentType<Record<string, unknown>> = () => null;
export const ExemplarsPlugin: ComponentType<Record<string, unknown>> = () => null;
export const ANNOTATION_LANE_SIZE = 24;

export function getAssistantTooltipContext() {
  return undefined;
}

export function getFieldActions() {
  return [];
}

export function getFilterByGroupedLabels() {
  return undefined;
}

export function getPrepareTimeseriesSuggestion() {
  return undefined;
}

export function getVisibleLabels() {
  return [];
}

export function getThresholdItems() {
  return [];
}

export function getValueMappingItems() {
  return [];
}

export function getXAnnotationFrames() {
  return [];
}
