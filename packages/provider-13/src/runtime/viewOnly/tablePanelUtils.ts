import type { DataFrame, FieldConfigSource } from '@grafana/data';

export function getCurrentFrameIndex(frames: DataFrame[], options: { frameIndex: number }): number {
  return options.frameIndex > 0 && options.frameIndex < frames.length ? options.frameIndex : 0;
}

export function onColumnResize(
  _fieldDisplayName: string,
  _width: number,
  _fieldScope: unknown,
  _props: { fieldConfig: FieldConfigSource }
): void {}

export function onSortByChange(_sortBy: readonly unknown[], _props: unknown): void {}
