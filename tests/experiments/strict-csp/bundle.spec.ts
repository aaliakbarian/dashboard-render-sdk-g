// POC / EXPERIMENT / NOT FOR PRODUCTION
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  assessHostReactOwner,
  assessReactExternalizedProvider,
  type BundleEvidence,
} from '../../../experiments/provider/react-externalized/analyzeProviderEvidence.ts';

const providerReportPath = process.env.STRICT_CSP_PROVIDER_BUNDLE_REPORT;
const hostReportPath = process.env.STRICT_CSP_HOST_BUNDLE_REPORT;
const forbiddenReportPath = process.env.STRICT_CSP_FORBIDDEN_IMPORT_REPORT;

interface ForbiddenImportReport {
  readonly violations: unknown[];
}

function readRequired<T>(path: string | undefined, description: string): T {
  if (!path) throw new Error(`${description} is required.`);
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

describe('strict CSP production-shaped bundles', () => {
  it('preserves host-owned React and the provider-owned Grafana cohort', () => {
    const provider = readRequired<BundleEvidence>(providerReportPath, 'Strict CSP provider bundle report');
    const host = readRequired<BundleEvidence>(hostReportPath, 'Strict CSP host bundle report');
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
    expect(hostAssessment.implementationOwners).toEqual({
      jsxDevRuntime: [expect.stringMatching(/^assets\/host-react-/)],
      jsxRuntime: [expect.stringMatching(/^assets\/host-react-/)],
      react: [expect.stringMatching(/^assets\/host-react-/)],
      reactDom: [expect.stringMatching(/^assets\/host-react-/)],
    });
  });

  it('keeps audited application-source exceptions inside the provider boundary', () => {
    const provider = readRequired<BundleEvidence>(providerReportPath, 'Strict CSP provider bundle report');
    const host = readRequired<BundleEvidence>(hostReportPath, 'Strict CSP host bundle report');
    const forbidden = readRequired<ForbiddenImportReport>(forbiddenReportPath, 'Strict CSP forbidden-import report');
    const providerCategories = provider.categories as typeof provider.categories & {
      readonly grafanaInternal: readonly string[];
      readonly workers: readonly string[];
    };
    const hostCategories = host.categories as typeof host.categories & {
      readonly grafanaInternal: readonly string[];
      readonly workers: readonly string[];
    };

    expect(providerCategories.grafanaApplication.length).toBeGreaterThan(0);
    expect(hostCategories.grafanaApplication).toEqual([]);
    expect(providerCategories.grafanaInternal).toEqual([]);
    expect(hostCategories.grafanaInternal).toEqual([]);
    expect(providerCategories.systemJs).toEqual([]);
    expect(hostCategories.systemJs).toEqual([]);
    expect(providerCategories.workers).toEqual([]);
    expect(hostCategories.workers).toEqual([]);
    expect(forbidden.violations).toEqual([]);
  });
});
