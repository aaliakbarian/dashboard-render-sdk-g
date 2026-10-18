// POC / EXPERIMENT / NOT FOR PRODUCTION
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  assessHostReactOwner,
  assessReactExternalizedProvider,
  type BundleEvidence,
} from '../../../experiments/provider/react-externalized/analyzeProviderEvidence.ts';

const providerPath = 'artifacts/experiments/style-lifecycle/provider/evidence/bundle-evidence.json';
const hostPath = 'artifacts/experiments/style-lifecycle/root/evidence/bundle-evidence.json';
const forbiddenPath = 'artifacts/experiments/style-lifecycle/provider/evidence/forbidden-import-report.json';

interface LifecycleBundleEvidence extends BundleEvidence {
  readonly categories: BundleEvidence['categories'] & {
    readonly css: readonly string[];
    readonly grafanaInternal: readonly string[];
    readonly workers: readonly string[];
  };
}

describe('production-shaped style lifecycle artifact', () => {
  it('keeps host React singular and the provider Grafana cohort shared', () => {
    const provider = JSON.parse(readFileSync(providerPath, 'utf8')) as LifecycleBundleEvidence;
    const host = JSON.parse(readFileSync(hostPath, 'utf8')) as LifecycleBundleEvidence;
    const providerAssessment = assessReactExternalizedProvider(provider);
    const hostAssessment = assessHostReactOwner(host);

    expect(providerAssessment.bundledImplementations).toEqual({
      jsxDevRuntime: [],
      jsxRuntime: [],
      react: [],
      reactDom: [],
    });
    expect(providerAssessment.sharedOwners.grafana).toHaveLength(1);
    expect(providerAssessment.sharedOwners.scenes).toHaveLength(1);
    expect(providerAssessment.sharedOwners.rxjs).toHaveLength(1);
    expect(providerAssessment.sharedOwners.emotion).toHaveLength(1);
    expect(providerAssessment.invalidDuplicateOwners).toEqual([]);
    expect(providerAssessment.systemJsModules).toEqual([]);
    expect(hostAssessment.implementationOwners.react).toHaveLength(1);
    expect(hostAssessment.implementationOwners.reactDom).toHaveLength(1);
    expect(hostAssessment.implementationOwners.jsxRuntime).toHaveLength(1);
    expect(hostAssessment.implementationOwners.jsxDevRuntime).toHaveLength(1);
  });

  it('removes harness-only global CSS and preserves audited source boundaries', () => {
    const provider = JSON.parse(readFileSync(providerPath, 'utf8')) as LifecycleBundleEvidence;
    const forbidden = JSON.parse(readFileSync(forbiddenPath, 'utf8')) as { readonly violations: readonly unknown[] };

    expect(provider.categories.css).not.toContain(
      '<repo>/experiments/bundle/lazy-panel-chunks/browser.css'
    );
    expect(provider.categories.grafanaApplication.length).toBeGreaterThan(0);
    expect(provider.categories.grafanaInternal).toEqual([]);
    expect(provider.categories.systemJs).toEqual([]);
    expect(provider.categories.workers).toEqual([]);
    expect(forbidden.violations).toEqual([]);
  });
});
