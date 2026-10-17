// POC / EXPERIMENT / NOT FOR PRODUCTION
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  assessHostReactOwner,
  assessReactExternalizedProvider,
  type BundleEvidence,
} from '../../../experiments/provider/react-externalized/analyzeProviderEvidence.ts';

const providerReportPath = process.env.EMOTION_COEXISTENCE_PROVIDER_BUNDLE_REPORT;
const hostReportPath = process.env.EMOTION_COEXISTENCE_HOST_BUNDLE_REPORT;

describe('Emotion coexistence artifact boundary', () => {
  it('keeps React external to the provider and owned once by the host', () => {
    if (!providerReportPath || !hostReportPath) {
      throw new Error('Emotion coexistence provider and host bundle reports are required.');
    }

    const provider = JSON.parse(readFileSync(providerReportPath, 'utf8')) as BundleEvidence;
    const host = JSON.parse(readFileSync(hostReportPath, 'utf8')) as BundleEvidence;
    const providerAssessment = assessReactExternalizedProvider(provider);
    const hostAssessment = assessHostReactOwner(host);

    expect(providerAssessment.bundledImplementations).toEqual({
      jsxDevRuntime: [],
      jsxRuntime: [],
      react: [],
      reactDom: [],
    });
    expect(providerAssessment.referencedExternals).toEqual(expect.arrayContaining([
      'react',
      'react-dom',
      'react-dom/client',
      'react/jsx-runtime',
    ]));
    expect(providerAssessment.sharedOwners.emotion).toHaveLength(1);
    expect(providerAssessment.systemJsModules).toEqual([]);
    expect(hostAssessment.implementationOwners).toEqual({
      jsxDevRuntime: [expect.stringMatching(/^assets\/host-react-/)],
      jsxRuntime: [expect.stringMatching(/^assets\/host-react-/)],
      react: [expect.stringMatching(/^assets\/host-react-/)],
      reactDom: [expect.stringMatching(/^assets\/host-react-/)],
    });
  });
});
