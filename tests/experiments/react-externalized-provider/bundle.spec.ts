// POC / EXPERIMENT / NOT FOR PRODUCTION
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  assessHostReactOwner,
  assessReactExternalizedProvider,
  type BundleEvidence,
} from '../../../experiments/provider/react-externalized/analyzeProviderEvidence.ts';
import { REACT_EXTERNALS } from '../../../experiments/provider/react-externalized/compatibility.ts';

const providerReportPath = process.env.REACT_EXTERNALIZED_PROVIDER_BUNDLE_REPORT;
const experimentDReportPath = process.env.SHARED_COHORT_BUNDLE_REPORT;
const hostReportPath = process.env.REACT_EXTERNALIZED_HOST_BUNDLE_REPORT;

describe('React-externalized provider artifact', () => {
  it('detects bundled React implementations independently of external references', () => {
    const report: BundleEvidence = {
      assets: [],
      categories: { grafanaApplication: [], systemJs: [] },
      chunks: [{
        dynamicImports: [],
        facadeModuleId: null,
        fileName: 'provider.js',
        gzipSize: 1,
        imports: ['react'],
        isDynamicEntry: false,
        isEntry: true,
        modules: ['<repo>/node_modules/react/index.js'],
        rawSize: 1,
      }],
      moduleIds: ['<repo>/node_modules/react/index.js'],
    };

    expect(assessReactExternalizedProvider(report).bundledImplementations.react).toHaveLength(1);
  });

  it('externalizes the complete React contract and preserves the shared lazy cohort', () => {
    if (!providerReportPath || !experimentDReportPath) {
      throw new Error('Provider and Experiment D bundle reports are required.');
    }
    const provider = JSON.parse(readFileSync(providerReportPath, 'utf8')) as BundleEvidence;
    const experimentD = JSON.parse(readFileSync(experimentDReportPath, 'utf8')) as BundleEvidence;
    const assessment = assessReactExternalizedProvider(provider, experimentD);

    expect(assessment.configuredExternals).toEqual([...REACT_EXTERNALS]);
    expect(assessment.bootstrap).toMatchObject({
      fileName: 'provider.js',
      modules: [
        '<repo>/experiments/provider/react-externalized/compatibility.ts',
        '<repo>/experiments/provider/react-externalized/entry.ts',
      ],
    });
    expect(assessment.bootstrap?.dynamicImports).toHaveLength(1);
    expect(assessment.bundledImplementations).toEqual({
      jsxDevRuntime: [],
      jsxRuntime: [],
      react: [],
      reactDom: [],
    });
    expect(assessment.referencedExternals).toEqual(expect.arrayContaining([
      'react',
      'react-dom',
      'react-dom/client',
      'react/jsx-runtime',
    ]));
    expect(assessment.featureOwners.text.length).toBeGreaterThan(0);
    expect(assessment.featureOwners.stat.length).toBeGreaterThan(0);
    expect(assessment.featureOwners.timeseries.length).toBeGreaterThan(0);
    expect(assessment.featureOwners.testdata.length).toBeGreaterThan(0);
    expect(assessment.sharedOwners.grafana).toHaveLength(1);
    expect(assessment.sharedOwners.scenes).toHaveLength(1);
    expect(assessment.sharedOwners.rxjs).toHaveLength(1);
    expect(assessment.sharedOwners.emotion).toHaveLength(1);
    expect(assessment.invalidDuplicateOwners).toEqual([]);
    expect(assessment.systemJsModules).toEqual([]);
    expect(assessment.sizeDelta.raw).toBeGreaterThanOrEqual(0);
  });

  it('leaves exactly one host-owned React implementation owner', () => {
    if (!hostReportPath) throw new Error('The externalized-provider host bundle report is required.');
    const host = JSON.parse(readFileSync(hostReportPath, 'utf8')) as BundleEvidence;
    const assessment = assessHostReactOwner(host);

    expect(assessment.implementationModules.react.length).toBeGreaterThan(0);
    expect(assessment.implementationModules.reactDom.length).toBeGreaterThan(0);
    expect(assessment.implementationModules.jsxRuntime.length).toBeGreaterThan(0);
    expect(assessment.implementationModules.jsxDevRuntime.length).toBeGreaterThan(0);
    expect(assessment.implementationOwners).toEqual({
      jsxDevRuntime: [expect.stringMatching(/^assets\/host-react-/)],
      jsxRuntime: [expect.stringMatching(/^assets\/host-react-/)],
      react: [expect.stringMatching(/^assets\/host-react-/)],
      reactDom: [expect.stringMatching(/^assets\/host-react-/)],
    });
  });
});
