// POC / EXPERIMENT / NOT FOR PRODUCTION
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  assessLazyPanelBundle,
  type BundleEvidence,
} from '../../../experiments/bundle/lazy-panel-chunks/analyzeBundleEvidence.ts';
import {
  GRAFANA_SOURCE_COMMIT,
  PANEL_APPLICATION_SOURCES,
} from '../../../experiments/bundle/lazy-panel-chunks/sourceIdentity.ts';

const reportPath = process.env.LAZY_PANEL_BUNDLE_REPORT;

describe('independent lazy panel emitted graph', () => {
  it('pins the exact successful renderer source provenance', () => {
    expect(GRAFANA_SOURCE_COMMIT).toBe('6193dc03311b631b9727b560d24369e683dc396e');
    expect(PANEL_APPLICATION_SOURCES.text).toHaveLength(2);
    expect(PANEL_APPLICATION_SOURCES.stat).toEqual([
      'public/app/plugins/panel/stat/StatPanel.tsx',
    ]);
    expect(PANEL_APPLICATION_SOURCES.timeseries).toHaveLength(8);
  });

  it('emits independent closed renderer chunks without eager bootstrap reachability', () => {
    if (!reportPath) throw new Error('LAZY_PANEL_BUNDLE_REPORT must identify generated evidence.');
    const report = JSON.parse(readFileSync(reportPath, 'utf8')) as BundleEvidence;
    const assessment = assessLazyPanelBundle(report);

    expect(assessment.bootstrapApplicationSources).toEqual([]);
    expect(assessment.panelChunks.text).toHaveLength(1);
    expect(assessment.panelChunks.stat).toHaveLength(1);
    expect(assessment.panelChunks.timeseries).toHaveLength(1);
    expect(new Set(Object.values(assessment.panelChunks).flat()).size).toBe(3);
    expect(assessment.applicationSources).toEqual(
      Object.values(PANEL_APPLICATION_SOURCES)
        .flat()
        .map((source) => `<grafana-source>/${source}`)
        .sort()
    );
    expect(assessment.applicationSourceOwners.every((item) => item.chunks.length === 1)).toBe(true);
    expect(assessment.systemJsModules).toEqual([]);
    expect(assessment.reactImplementationModules).toEqual([]);
    expect(
      Object.values(assessment.sharedDependencies).flatMap((dependencies) =>
        Object.values(dependencies).map(({ classification }) => classification)
      )
    ).not.toContain('DUPLICATED');
  });
});
