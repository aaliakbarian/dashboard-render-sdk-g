// POC / EXPERIMENT / NOT FOR PRODUCTION
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { assessTextBundle, type BundleEvidence } from './analyzeBundleEvidence.ts';

const evidenceRoot = resolve('artifacts/experiments/text-renderer-only');

function readAssessment(variant: 'baseline' | 'renderer-only') {
  const report = JSON.parse(
    readFileSync(resolve(evidenceRoot, variant, 'evidence/bundle-evidence.json'), 'utf8')
  ) as BundleEvidence;
  return assessTextBundle(report);
}

const baseline = readAssessment('baseline');
const rendererOnly = readAssessment('renderer-only');
const reduction = (before: number, after: number) =>
  Number((((before - after) / before) * 100).toFixed(2));

const result = {
  baseline,
  generatedAt: 'reproducible-local-experiment',
  rendererOnly,
  reductions: {
    gzipJsPercent: reduction(baseline.gzipJsBytes, rendererOnly.gzipJsBytes),
    modulePercent: reduction(baseline.moduleCount, rendererOnly.moduleCount),
    rawJsPercent: reduction(baseline.rawJsBytes, rendererOnly.rawJsBytes),
  },
};

const destination = resolve(evidenceRoot, 'comparison.json');
mkdirSync(dirname(destination), { recursive: true });
writeFileSync(destination, `${JSON.stringify(result, null, 2)}\n`);
console.log(
  JSON.stringify({
    baseline: {
      chunks: baseline.chunkCount,
      gzipJsBytes: baseline.gzipJsBytes,
      modules: baseline.moduleCount,
      rawJsBytes: baseline.rawJsBytes,
    },
    rendererOnly: {
      chunks: rendererOnly.chunkCount,
      gzipJsBytes: rendererOnly.gzipJsBytes,
      modules: rendererOnly.moduleCount,
      rawJsBytes: rendererOnly.rawJsBytes,
    },
    reductions: result.reductions,
  })
);
