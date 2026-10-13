// POC / EXPERIMENT / NOT FOR PRODUCTION
// Browser-only provider binding: use the host's existing @grafana/data cohort.
// The isolated measured artifact resolves the same experiment aliases to the
// exact leaf ESM implementations instead.
export { PanelPlugin, renderTextPanelMarkdown, textUtil } from '@grafana/data';
