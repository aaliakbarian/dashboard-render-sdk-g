import { useCallback, useMemo } from 'react';
import { cacheFieldDisplayNames, type DataFrame, type Field, type FieldConfigSource } from '@grafana/data';
import type { TableOptions } from '@grafana/schema';

export function useCacheFieldDisplayNames(series: DataFrame[]): void {
  useMemo(() => cacheFieldDisplayNames(series), [series]);
}

export function useCellActions() {
  return useCallback((_frame: DataFrame, _field: Field, _rowIndex: number) => [], []);
}

export function useTableSharedCrosshair(): boolean {
  return false;
}

export function useCommonTableProps(options: TableOptions, fieldConfig: FieldConfigSource) {
  return useMemo(() => ({
    noHeader: !options.showHeader,
    noValue: fieldConfig.defaults.noValue,
    showTypeIcons: options.showTypeIcons,
    resizable: true,
    sortBy: options.sortBy,
    frozenColumns: 0,
    enablePagination: false,
    pageSize: undefined,
    cellHeight: options.cellHeight,
    maxRowHeight: undefined,
    disableKeyboardEvents: false,
    disableSanitizeHtml: false,
    contentAwareWidthsEnabled: false,
  }), [options, fieldConfig.defaults.noValue]);
}
