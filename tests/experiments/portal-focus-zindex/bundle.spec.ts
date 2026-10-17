// POC / EXPERIMENT / NOT FOR PRODUCTION
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  assessHostReactOwner,
  assessReactExternalizedProvider,
  type BundleEvidence,
} from '../../../experiments/provider/react-externalized/analyzeProviderEvidence.ts';

describe('portal provider artifact boundary', () => {
  it('keeps React external to the provider and rejects shell/SystemJS ownership', () => {
    const providerPath = process.env.PORTAL_PROVIDER_BUNDLE_REPORT;
    const hostPath = process.env.PORTAL_HOST_BUNDLE_REPORT;
    const baselinePath = process.env.EMOTION_PROVIDER_BUNDLE_REPORT;
    if (!providerPath || !hostPath || !baselinePath) {
      throw new Error('Portal, host, and issue #41 baseline bundle reports are required.');
    }
    const provider = JSON.parse(readFileSync(providerPath, 'utf8')) as BundleEvidence;
    const host = JSON.parse(readFileSync(hostPath, 'utf8')) as BundleEvidence;
    const baseline = JSON.parse(readFileSync(baselinePath, 'utf8')) as BundleEvidence;
    const providerAssessment = assessReactExternalizedProvider(provider, baseline);
    const hostAssessment = assessHostReactOwner(host);
    expect(providerAssessment.bundledImplementations).toEqual({ jsxDevRuntime: [], jsxRuntime: [], react: [], reactDom: [] });
    expect(providerAssessment.systemJsModules).toEqual([]);
    expect(provider.categories.grafanaApplication).toEqual(baseline.categories.grafanaApplication);
    expect(providerAssessment.sizeDelta.raw).toBeGreaterThan(0);
    expect(providerAssessment.sizeDelta.gzip).toBeGreaterThan(0);
    expect(providerAssessment.referencedExternals).toEqual(expect.arrayContaining(['react', 'react-dom', 'react/jsx-runtime']));
    expect(hostAssessment.implementationOwners.react).toHaveLength(1);
    expect(hostAssessment.implementationOwners.reactDom).toHaveLength(1);
  });
});
