import type { DataFrame } from '@grafana/data';

export function hasDeprecatedParentRowIndex(_frames: DataFrame[]): boolean {
  return false;
}

export function migrateFromParentRowIndexToNestedFrames(frames: DataFrame[]): DataFrame[] {
  return frames;
}
