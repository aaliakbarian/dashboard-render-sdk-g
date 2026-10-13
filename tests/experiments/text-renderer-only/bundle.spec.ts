// POC / EXPERIMENT / NOT FOR PRODUCTION
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { classifyForbiddenGrafanaImport } from '../../../apps/poc-host/build/forbiddenGrafanaImportPlugin.ts';
import { isTextRendererOnlyExperimentImporter } from '../../../apps/poc-host/build/textRendererOnlyImportsPlugin.ts';
import {
  assessTextBundle,
  type BundleEvidence,
} from '../../../experiments/bundle/text-renderer-only/analyzeBundleEvidence.ts';
import {
  GRAFANA_SOURCE_COMMIT,
  RENDERER_ONLY_APPLICATION_SOURCES,
} from '../../../experiments/bundle/text-renderer-only/sourceIdentity.ts';

const reportPath = process.env.TEXT_RENDERER_ONLY_BUNDLE_REPORT;
const baselineReportPath = process.env.TEXT_RENDERER_ONLY_BASELINE_REPORT;

describe('Text renderer-only emitted graph', () => {
  it('retains the full Text module as an editor-closure control', () => {
    if (!baselineReportPath) {
      throw new Error('TEXT_RENDERER_ONLY_BASELINE_REPORT must identify generated baseline evidence.');
    }

    const report = JSON.parse(readFileSync(baselineReportPath, 'utf8')) as BundleEvidence;
    const assessment = assessTextBundle(report);

    expect(assessment.applicationSources).toEqual([
      '<grafana-source>/public/app/core/config.ts',
      '<grafana-source>/public/app/plugins/panel/text/panelcfg.gen.ts',
      '<grafana-source>/public/app/plugins/panel/text/v1/TextPanel.tsx',
      '<grafana-source>/public/app/plugins/panel/text/v1/TextPanelEditor.tsx',
      '<grafana-source>/public/app/plugins/panel/text/v1/module.tsx',
      '<grafana-source>/public/app/plugins/panel/text/v1/textPanelMigrationHandler.ts',
    ]);
    expect(assessment.monacoModules.length).toBeGreaterThan(0);
    expect(assessment.textPanelEditorModules).toHaveLength(1);
    expect(assessment.codiconAssets).toHaveLength(1);
  });

  it('keeps the real renderer and excludes the editor/Monaco closure', () => {
    if (!reportPath) {
      throw new Error('TEXT_RENDERER_ONLY_BUNDLE_REPORT must identify generated bundle evidence.');
    }

    const report = JSON.parse(readFileSync(reportPath, 'utf8')) as BundleEvidence;
    const assessment = assessTextBundle(report);

    expect(assessment.applicationSources).toEqual([
      '<grafana-source>/public/app/plugins/panel/text/panelcfg.gen.ts',
      '<grafana-source>/public/app/plugins/panel/text/v1/TextPanel.tsx',
    ]);
    expect(assessment.monacoModules).toEqual([]);
    expect(assessment.codeMirrorModules).toEqual([]);
    expect(assessment.textPanelEditorModules).toEqual([]);
    expect(assessment.queryOrConfigEditorModules).toEqual([]);
    expect(assessment.codiconAssets).toEqual([]);
    expect(assessment.systemJsModules).toEqual([]);
    expect(assessment.reactImplementationModules).toEqual([]);
    expect(assessment.pocHostModules).toEqual([]);
    expect(assessment.codeAttribution.hostPoc).toBe(0);
    expect(assessment.codeAttribution.grafanaApplication).toBeGreaterThan(0);
    expect(assessment.codeAttribution.rendererAdapters).toBeGreaterThan(0);
    expect(assessment.codeAttribution.grafanaPublishedPackages).toBeGreaterThan(0);
    expect(assessment.codeAttribution.thirdPartyShared).toBeGreaterThan(0);
    expect(assessment.chunks).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^assets\/shared-dependencies-/),
        expect.stringMatching(/^assets\/text-renderer-/),
      ])
    );
  });

  it('pins the exact renderer provenance', () => {
    expect(GRAFANA_SOURCE_COMMIT).toBe('6193dc03311b631b9727b560d24369e683dc396e');
    expect(RENDERER_ONLY_APPLICATION_SOURCES).toEqual([
      'public/app/plugins/panel/text/panelcfg.gen.ts',
      'public/app/plugins/panel/text/v1/TextPanel.tsx',
    ]);
  });

  it('admits experiment aliases only from the bounded experiment directory', () => {
    expect(
      isTextRendererOnlyExperimentImporter(
        '/workspace/experiments/bundle/text-renderer-only/dataViewOnly.ts',
        '/workspace/experiments/bundle/text-renderer-only'
      )
    ).toBe(true);
    expect(
      isTextRendererOnlyExperimentImporter(
        '/workspace/packages/poc-grafana-bridge/src/panels/text.ts',
        '/workspace/experiments/bundle/text-renderer-only'
      )
    ).toBe(false);
    expect(
      classifyForbiddenGrafanaImport(
        'grafana-experiment-text-renderer',
        '/workspace/experiments/bundle/text-renderer-only/rendererOnly.ts',
        { textRendererExperimentRoot: '/workspace/experiments/bundle/text-renderer-only' }
      )
    ).toBeUndefined();
    expect(
      classifyForbiddenGrafanaImport(
        'grafana-experiment-text-renderer',
        '/workspace/apps/spoof/experiments/bundle/text-renderer-only/rendererOnly.ts',
        { textRendererExperimentRoot: '/workspace/experiments/bundle/text-renderer-only' }
      )
    ).toMatchObject({
      category: 'grafana-application-source-outside-bridge',
    });
    expect(
      classifyForbiddenGrafanaImport(
        'grafana-experiment-data-panel-plugin',
        '/workspace/packages/poc-grafana-bridge/src/panels/text.ts'
      )
    ).toMatchObject({
      category: 'grafana-application-source-outside-bridge',
    });
  });
});
