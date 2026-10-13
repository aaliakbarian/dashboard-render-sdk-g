// POC / EXPERIMENT / NOT FOR PRODUCTION
import {
  createClosedLazyPanelCatalogForExperiment,
  type LazyPanelEvidenceRecorder,
} from './closedLazyPanelCatalog.ts';

export function createIndependentLazyPanelCatalog(evidence?: LazyPanelEvidenceRecorder) {
  return createIndependentLazyPanelCatalogWithOptions({ evidence });
}

export interface IndependentLazyPanelCatalogOptions {
  readonly evidence?: LazyPanelEvidenceRecorder;
  readonly failFirst?: 'stat' | 'text' | 'timeseries';
}

export function createIndependentLazyPanelCatalogWithOptions({
  evidence,
  failFirst,
}: IndependentLazyPanelCatalogOptions) {
  const failed = new Set<string>();
  const load = async <T>(id: 'stat' | 'text' | 'timeseries', importer: () => Promise<T>) => {
    if (failFirst === id && !failed.has(id)) {
      failed.add(id);
      throw new Error('Controlled lazy-panel experiment failure.');
    }
    return importer();
  };
  return createClosedLazyPanelCatalogForExperiment({
    evidence,
    loadStat: () => load('stat', () => import('./features/stat.ts')).then((module) => module.plugin),
    loadText: () => load('text', () => import('./features/text.ts')).then((module) => module.plugin),
    loadTimeSeries: () =>
      load('timeseries', () => import('./features/timeseries.ts')).then((module) => module.plugin),
  });
}

export const independentLazyPanelCatalog = createIndependentLazyPanelCatalog();
