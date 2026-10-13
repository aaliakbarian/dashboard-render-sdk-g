// POC / EXPERIMENT / NOT FOR PRODUCTION
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import {
  assessTestDataBundle,
  type BundleEvidence,
} from './analyzeBundleEvidence.ts';

const evidenceRoot = resolve('artifacts/experiments/testdata-runtime-only');

function readAssessment(variant: 'baseline' | 'runtime-only') {
  const report = JSON.parse(
    readFileSync(resolve(evidenceRoot, variant, 'evidence/bundle-evidence.json'), 'utf8')
  ) as BundleEvidence;
  return assessTestDataBundle(report);
}

const baseline = readAssessment('baseline');
const runtimeOnly = readAssessment('runtime-only');
const reduction = (before: number, after: number) =>
  Number((((before - after) / before) * 100).toFixed(2));

const result = {
  baseline,
  generatedAt: 'reproducible-local-experiment',
  reductions: {
    applicationSourcePercent: reduction(
      baseline.applicationSources.length,
      runtimeOnly.applicationSources.length
    ),
    gzipJsPercent: reduction(baseline.gzipJsBytes, runtimeOnly.gzipJsBytes),
    modulePercent: reduction(baseline.moduleCount, runtimeOnly.moduleCount),
    rawJsPercent: reduction(baseline.rawJsBytes, runtimeOnly.rawJsBytes),
  },
  runtimeOnly,
};

const destination = resolve(evidenceRoot, 'comparison.json');
mkdirSync(dirname(destination), { recursive: true });
writeFileSync(destination, `${JSON.stringify(result, null, 2)}\n`);
console.log(
  JSON.stringify({
    baseline: {
      applicationSources: baseline.applicationSources.length,
      chunks: baseline.chunkCount,
      gzipJsBytes: baseline.gzipJsBytes,
      modules: baseline.moduleCount,
      rawJsBytes: baseline.rawJsBytes,
    },
    reductions: result.reductions,
    runtimeOnly: {
      applicationSources: runtimeOnly.applicationSources.length,
      chunks: runtimeOnly.chunkCount,
      gzipJsBytes: runtimeOnly.gzipJsBytes,
      modules: runtimeOnly.moduleCount,
      rawJsBytes: runtimeOnly.rawJsBytes,
    },
  })
);
