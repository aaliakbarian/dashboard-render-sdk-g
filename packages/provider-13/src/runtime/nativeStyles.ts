import uPlotCss from 'uplot/dist/uPlot.min.css?inline';

// The pinned stylesheet contains only flat uPlot rules. Keep every selector
// inside the provider surface; the style node itself is dashboard-owned.
export const nativeVisualizationCss = uPlotCss.replace(/(^|})([^{}]+)\{/g, (_match, boundary: string, selectors: string) =>
  `${boundary}${selectors.split(',').map(selector => `[data-dashboard-render-sdk-g-surface] ${selector.trim()}`).join(', ')}{`
);
