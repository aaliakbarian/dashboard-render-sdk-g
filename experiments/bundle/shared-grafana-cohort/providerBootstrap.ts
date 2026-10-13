// POC / EXPERIMENT / NOT FOR PRODUCTION
import type { PanelPlugin } from '@grafana/data';

import { createClosedLazyPanelCatalogForExperiment } from '../lazy-panel-chunks/closedLazyPanelCatalog.ts';
import type { LazyPanelEvidenceRecorder } from '../lazy-panel-chunks/closedLazyPanelCatalog.ts';
import {
  createSharedCohortLoaderForExperiment,
  type SharedCohortEvidenceRecorder,
  type SharedCohortFeatureId,
} from './sharedCohortLoader.ts';
import type { SharedCohortIdentity } from './sharedIdentity.ts';

interface PanelFeature {
  readonly cohortIdentity: SharedCohortIdentity;
  readonly plugin: PanelPlugin;
}

interface TestDataFeature {
  readonly cohortIdentity: SharedCohortIdentity;
  readonly plugin: { readonly DataSourceClass: new (...args: any[]) => any };
}

type ProviderFeature = PanelFeature | TestDataFeature;

const importFeature = (id: SharedCohortFeatureId): Promise<ProviderFeature> => {
  switch (id) {
    case 'text': return import('./features/text.ts');
    case 'stat': return import('./features/stat.ts');
    case 'timeseries': return import('./features/timeseries.ts');
    case 'testdata': return import('./features/testdata.ts');
  }
};

export interface SharedGrafanaCohortProviderOptions {
  readonly cohortEvidence?: SharedCohortEvidenceRecorder;
  readonly panelEvidence?: LazyPanelEvidenceRecorder;
}

export function createSharedGrafanaCohortProvider(
  options: SharedGrafanaCohortProviderOptions = {}
) {
  const loader = createSharedCohortLoaderForExperiment({
    evidence: options.cohortEvidence,
    loadCohort: () => import('./sharedIdentity.ts').then((module) => module.SHARED_COHORT_IDENTITY),
    loadFeature: async (id, cohort) => {
      const feature = await importFeature(id);
      if (feature.cohortIdentity !== cohort) {
        throw new Error(`Feature ${id} resolved a split Grafana cohort identity.`);
      }
      return feature;
    },
  });
  const panels = createClosedLazyPanelCatalogForExperiment({
    evidence: options.panelEvidence,
    loadStat: () => loader.load('stat').then((feature) => (feature as PanelFeature).plugin),
    loadText: () => loader.load('text').then((feature) => (feature as PanelFeature).plugin),
    loadTimeSeries: () => loader.load('timeseries').then((feature) => (feature as PanelFeature).plugin),
  });

  return {
    featureIds: loader.featureIds,
    loadTestData: () => loader.load('testdata').then((feature) => feature as TestDataFeature),
    panels,
  };
}

export const sharedGrafanaCohortProvider = createSharedGrafanaCohortProvider();
