// POC / EXPERIMENT / NOT FOR PRODUCTION
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  assessSharedGrafanaCohort,
  type BundleEvidence,
  type PhysicalPackageEvidence,
} from '../../../experiments/bundle/shared-grafana-cohort/analyzeCohortEvidence.ts';
import {
  GRAFANA_SOURCE_COMMIT,
  PROVIDER_FEATURE_IDS,
} from '../../../experiments/bundle/shared-grafana-cohort/sourceIdentity.ts';

const bundleReportPath = process.env.SHARED_COHORT_BUNDLE_REPORT;
const packageReportPath = process.env.SHARED_COHORT_PACKAGE_REPORT;

describe('shared Grafana cohort emitted graph', () => {
  it('detects a module emitted into multiple owners', () => {
    const duplicate = '<repo>/node_modules/@grafana/data/shared.mjs';
    const report: BundleEvidence = {
      assets: [],
      categories: { grafanaApplication: [], systemJs: [] },
      chunks: [
        { dynamicImports: [], facadeModuleId: null, fileName: 'a.js', gzipSize: 1, imports: [], isDynamicEntry: true, isEntry: false, modules: [duplicate], rawSize: 1 },
        { dynamicImports: [], facadeModuleId: null, fileName: 'b.js', gzipSize: 1, imports: [], isDynamicEntry: true, isEntry: false, modules: [duplicate], rawSize: 1 },
      ],
      moduleIds: [duplicate],
    };

    expect(assessSharedGrafanaCohort(report).invalidDuplicates).toEqual([
      { moduleId: duplicate, owners: ['a.js', 'b.js'] },
    ]);
  });

  it('pins the exact source and four-feature catalogue', () => {
    expect(GRAFANA_SOURCE_COMMIT).toBe('6193dc03311b631b9727b560d24369e683dc396e');
    expect(PROVIDER_FEATURE_IDS).toEqual(['text', 'stat', 'timeseries', 'testdata']);
  });

  it('emits one auditable shared cohort while retaining independent features', () => {
    if (!bundleReportPath || !packageReportPath) {
      throw new Error('Shared-cohort bundle and package reports are required.');
    }
    const bundle = JSON.parse(readFileSync(bundleReportPath, 'utf8')) as BundleEvidence;
    const packages = JSON.parse(readFileSync(packageReportPath, 'utf8')) as PhysicalPackageEvidence;
    const result = assessSharedGrafanaCohort(bundle, packages);

    expect(result.invalidDuplicates).toEqual([]);
    expect(
      result.staticChunkCycles.filter((cycle) =>
        cycle.some((fileName) => /(?:^|\/)host-react/.test(fileName))
      )
    ).toEqual([]);
    expect(result.bootstrapApplicationSources).toEqual([]);
    expect(Object.keys(result.featureChunks).sort()).toEqual([...PROVIDER_FEATURE_IDS].sort());
    expect(new Set(Object.values(result.featureChunks).flat()).size).toBeGreaterThanOrEqual(4);
    expect(result.editorModules).toEqual([]);
    expect(result.editorAssets).toEqual([]);
    expect(result.systemJsModules).toEqual([]);
    for (const dependency of ['react', 'reactDom'] as const) {
      const entry = result.dependencyTable[dependency];
      if (entry.status === 'SHARED_ONCE') {
        expect(entry.emittedOwners).toHaveLength(1);
        expect(entry.emittedOwners[0]).toMatch(/(?:^|\/)host-react-/);
      } else {
        expect(entry.status).toBe('HOST_EXTERNAL');
      }
    }
    for (const dependency of [
      'grafanaData', 'grafanaUi', 'grafanaRuntime', 'grafanaSchema', 'grafanaI18n',
      'grafanaScenes', 'rxjs', 'emotion',
    ] as const) {
      expect(result.dependencyTable[dependency].status).toBe('SHARED_ONCE');
    }
    expect(result.dependencyTable.uplot.status).toBe('SHARED_ONCE');
    expect(result.physicalPackages.every((item) => item.physicalCopies === 1)).toBe(true);
  });
});
