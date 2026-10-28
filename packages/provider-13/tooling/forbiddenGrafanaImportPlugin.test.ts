import { describe, expect, it } from 'vitest';

import { classifyProvider13ForbiddenImport } from './forbiddenGrafanaImportPlugin';

describe('provider-13 Grafana import boundary', () => {
  it.each([
    'public/app/plugins/panel/text/v1/module.tsx',
    'public/app/plugins/panel/stat/module.tsx',
    'public/app/plugins/panel/timeseries/module.tsx',
    'public/app/plugins/panel/stat/StatMigrations.ts',
    'app',
    '@grafana/ui/dist/esm/components/Monaco/MonacoEditor.mjs',
    '@grafana/ui/dist/esm/components/DataLinks/DataLinksInlineEditor.mjs',
    '@grafana/data/dist/esm/transformations/editors/TransformationEditor.js',
    '@grafana/data/dist/esm/field/fieldConfigEditorRegistry.js',
    'monaco-editor',
    '@vscode/codicons/dist/codicon.css',
    'public/app/routes/routes.ts',
    'public/app/core/components/AppChrome/AppChrome.tsx',
    'systemjs',
  ])('rejects unallowlisted, broad, editor, shell, and SystemJS import %s', (source) => {
    expect(classifyProvider13ForbiddenImport(source)).toBeDefined();
  });

  it.each([
    'public/app/plugins/panel/text/v1/TextPanel.tsx',
    'public/app/plugins/panel/text/panelcfg.gen.ts',
    'public/app/plugins/panel/stat/StatPanel.tsx',
    'public/app/plugins/panel/timeseries/TimeSeriesPanel.tsx',
    '@grafana/data/dist/esm/field/standardFieldConfigEditorRegistry.mjs',
  ])('admits exact audited renderer source/module %s', (source) => {
    expect(classifyProvider13ForbiddenImport(source)).toBeUndefined();
  });

  it('rejects GrafanaApp.init and arbitrary System.import in transformed code', () => {
    expect(classifyProvider13ForbiddenImport('/repo/source.ts', 'GrafanaApp.init({})')).toBeDefined();
    expect(classifyProvider13ForbiddenImport('/repo/source.ts', 'System.import(url)')).toBeDefined();
  });
});
