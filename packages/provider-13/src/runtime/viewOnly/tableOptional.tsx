import type { ReactNode } from 'react';

export const TableCellInspectorMode = Object.freeze({ code: 'code', text: 'text' });

export function Pagination(): null { return null; }
export function DataLinksActionsTooltip(): null { return null; }
export function TableCellInspector(): null { return null; }
export function TableCellActions(): null { return null; }
export function Filter(): null { return null; }
export function TableCellTooltip({ children }: { readonly children?: ReactNode }): ReactNode { return children; }
export function MaybeWrapWithLink({ children }: { readonly children?: ReactNode }): ReactNode { return children; }
export function isGeometry(): boolean { return false; }
