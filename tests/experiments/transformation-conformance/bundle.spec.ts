// POC / EXPERIMENT / NOT FOR PRODUCTION
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  assessTransformationCapabilityBundle,
  type TransformationBundleEvidence,
} from '../../../experiments/transformations/conformance/analyzeBundleEvidence.ts';

const evidencePath = 'artifacts/experiments/transformation-conformance/capability/evidence/bundle-evidence.json';

describe('isolated transformation capability artifact', () => {
  it('contains the exact operator without broad application or editor closure', () => {
    const report = JSON.parse(readFileSync(evidencePath, 'utf8')) as TransformationBundleEvidence;
    const assessment = assessTransformationCapabilityBundle(report);

    expect(assessment.operatorModules).toEqual([
      '<repo>/node_modules/@grafana/data/dist/esm/transformations/transformers/renameByRegex.mjs',
    ]);
    expect(assessment.grafanaApplicationModules).toEqual([]);
    expect(assessment.broadApplicationRegistryModules).toEqual([]);
    expect(assessment.editorModules).toEqual([]);
    expect(assessment.monacoModules).toEqual([]);
    expect(assessment.codiconAssets).toEqual([]);
    expect(assessment.previewImages).toEqual([]);
    expect(assessment.unrelatedTransformerModules).toEqual([]);
    expect(assessment.operatorChunks).toHaveLength(1);
    expect(assessment.operatorChunks[0]).toMatchObject({ transformId: 'renameByRegex' });
    expect(assessment.moduleCount).toBeGreaterThan(0);
  });
});
