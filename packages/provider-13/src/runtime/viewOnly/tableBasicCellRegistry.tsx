import { createElement, memo } from 'react';
import type { Field, GrafanaTheme2 } from '@grafana/data';
import { TableCellDisplayMode } from '@grafana/schema';
import { AutoCell, getStyles as getAutoCellStyles } from 'grafana-provider13-native-table-auto-cell';

interface BasicCellProps {
  readonly value: unknown;
  readonly field: Field;
  readonly rowIdx: number;
}

export const AutoCellRenderer = memo((props: BasicCellProps) =>
  createElement(AutoCell, { value: props.value, field: props.field, rowIdx: props.rowIdx })
);
AutoCellRenderer.displayName = 'AutoCellRenderer';

export function getCellRenderer(): typeof AutoCellRenderer {
  return AutoCellRenderer;
}

export function getCellSpecificStyles(
  _cellType: string,
  _field: Field,
  theme: GrafanaTheme2,
  options: Record<string, unknown>
): string | undefined {
  return getAutoCellStyles(theme, options);
}

export function getAutoRendererDisplayMode(): TableCellDisplayMode {
  return TableCellDisplayMode.Auto;
}
