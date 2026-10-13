// POC / EXPERIMENT / NOT FOR PRODUCTION
// The Text renderer uses two runtime values from @grafana/data. Re-exporting
// their exact published ESM implementations avoids evaluating the package
// barrel and its unrelated editor/static-asset closure.
export { renderTextPanelMarkdown } from 'grafana-experiment-data-markdown';
export { textUtil } from 'grafana-experiment-data-sanitize';

// The remaining upstream imports are erased TypeScript contracts. They stay
// explicit here so the adapter boundary documents the renderer's full source
// contract without providing replacement runtime behavior.
export type {
  FieldConfigSource,
  InterpolateFunction,
  PanelData,
  TimeRange,
} from '@grafana/data';
