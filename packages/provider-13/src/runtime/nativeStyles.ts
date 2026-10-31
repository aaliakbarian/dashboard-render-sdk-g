import uPlotCss from 'uplot/dist/uPlot.min.css?inline';
import tableDataGridCss from '@grafana/react-data-grid/lib/styles.css?inline';

// The pinned stylesheet contains only flat uPlot rules. Keep every selector
// inside the provider surface; the style node itself is dashboard-owned.
export const nativeVisualizationCss = uPlotCss.replace(/(^|})([^{}]+)\{/g, (_match, boundary: string, selectors: string) =>
  `${boundary}${selectors.split(',').map(selector => `[data-dashboard-render-sdk-g-surface] ${selector.trim()}`).join(', ')}{`
);

// react-data-grid uses top-level generated class selectors with nested rules
// inside CSS layers. Prefix only those roots; their nested selectors then stay
// inside the already-scoped class without rewriting CSS syntax.
export function scopeTableDataGridCss(css: string): string {
  return css.replace(/^(\.[^{]+)\{/gm, (_match, selectors: string) =>
    `${selectors.split(',').map((selector) => `[data-dashboard-render-sdk-g-surface] ${selector.trim()}`).join(', ')}{`
  );
}

export const nativeTableCss = scopeTableDataGridCss(tableDataGridCss);
