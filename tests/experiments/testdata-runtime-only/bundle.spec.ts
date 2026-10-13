// POC / EXPERIMENT / NOT FOR PRODUCTION
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { classifyForbiddenGrafanaImport } from '../../../apps/poc-host/build/forbiddenGrafanaImportPlugin.ts';
import {
  assessTestDataBundle,
  type BundleEvidence,
} from '../../../experiments/bundle/testdata-runtime-only/analyzeBundleEvidence.ts';
import {
  BASELINE_APPLICATION_SOURCES,
  RUNTIME_ONLY_APPLICATION_SOURCES,
} from '../../../experiments/bundle/testdata-runtime-only/sourceIdentity.ts';

const baselineReportPath = process.env.TESTDATA_RUNTIME_BASELINE_REPORT;
const runtimeReportPath = process.env.TESTDATA_RUNTIME_ONLY_BUNDLE_REPORT;

function readReport(path: string | undefined, variable: string): BundleEvidence {
  if (!path) throw new Error(`${variable} must identify generated bundle evidence.`);
  return JSON.parse(readFileSync(path, 'utf8')) as BundleEvidence;
}

const upstreamIdentity = (source: string) => `<grafana-source>/${source}`;

describe('TestData runtime-only emitted graph', () => {
  it('admits the runtime-only alias only inside the bounded experiment directory', () => {
    const experimentRoot = '/workspace/experiments/bundle/testdata-runtime-only';

    expect(
      classifyForbiddenGrafanaImport(
        'grafana-experiment-testdata-runtime-source',
        `${experimentRoot}/providerMetadata.ts`,
        { testDataRuntimeExperimentRoot: experimentRoot }
      )
    ).toBeUndefined();
    expect(
      classifyForbiddenGrafanaImport(
        'grafana-experiment-testdata-runtime-source',
        '/workspace/apps/poc-host/src/App.tsx',
        { testDataRuntimeExperimentRoot: experimentRoot }
      )
    ).toMatchObject({ category: 'grafana-application-source-outside-bridge' });
  });

  it('retains the complete TestData module as an authoring-closure control', () => {
    const assessment = assessTestDataBundle(
      readReport(baselineReportPath, 'TESTDATA_RUNTIME_BASELINE_REPORT')
    );

    expect(assessment.applicationSources).toEqual(
      BASELINE_APPLICATION_SOURCES.map(upstreamIdentity).sort()
    );
    expect(assessment.editorModules.length).toBeGreaterThan(0);
    expect(assessment.monacoModules.length).toBeGreaterThan(0);
    expect(assessment.codiconAssets.length).toBeGreaterThan(0);
  });

  it('keeps the exact TestData query runtime and excludes authoring/editor dependencies', () => {
    const report = readReport(runtimeReportPath, 'TESTDATA_RUNTIME_ONLY_BUNDLE_REPORT');
    const assessment = assessTestDataBundle(report);

    expect(assessment.applicationSources).toEqual(
      RUNTIME_ONLY_APPLICATION_SOURCES.map(upstreamIdentity).sort()
    );
    expect(assessment.applicationSources).not.toContain(
      '<grafana-source>/public/app/plugins/datasource/grafana-testdata-datasource/module.tsx'
    );
    expect(assessment.editorModules).toEqual([]);
    expect(assessment.monacoModules).toEqual([]);
    expect(assessment.codeMirrorModules).toEqual([]);
    expect(assessment.codiconAssets).toEqual([]);
    expect(assessment.cssAssets).toEqual([]);
    expect(assessment.reactImplementationModules).toEqual([]);
    expect(assessment.systemJsModules).toEqual([]);
    expect(assessment.codeAttribution.hostPoc).toBe(0);
    // Vite transforms these published-package candidates while analyzing exact
    // leaf dependencies, then tree-shakes them. Keep the distinction explicit:
    // none may enter the emitted/reachable artifact asserted above.
    expect(assessment.transformedCandidateMonacoModules).toEqual([
      '<repo>/node_modules/@grafana/data/dist/esm/monaco/languageRegistry.mjs',
    ]);
    expect(assessment.transformedCandidateEditorInfrastructureModules).toEqual([
      '<repo>/node_modules/@grafana/data/dist/esm/field/standardFieldConfigEditorRegistry.mjs',
      '<repo>/node_modules/@grafana/data/dist/esm/panel/suggestions/getPanelDataSummary.mjs',
      '<repo>/node_modules/@grafana/data/dist/esm/types/suggestions.mjs',
    ]);
  });
});
