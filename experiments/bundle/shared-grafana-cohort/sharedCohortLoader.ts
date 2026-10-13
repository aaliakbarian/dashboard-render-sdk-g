// POC / EXPERIMENT / NOT FOR PRODUCTION
export const SHARED_COHORT_FEATURE_IDS = ['text', 'stat', 'timeseries', 'testdata'] as const;
export type SharedCohortFeatureId = (typeof SHARED_COHORT_FEATURE_IDS)[number];

export type SharedCohortEvent =
  | { readonly scope: 'cohort'; readonly type: 'start' | 'success' | 'cache-hit' }
  | {
      readonly featureId: SharedCohortFeatureId;
      readonly scope: 'feature';
      readonly type: 'start' | 'success' | 'cache-hit' | 'failure';
    }
  | { readonly category: 'unsupported-feature'; readonly scope: 'feature'; readonly type: 'failure' };

export interface SharedCohortEvidenceRecorder {
  record(event: SharedCohortEvent): void;
}

export class UnsupportedSharedCohortFeatureError extends Error {
  readonly code = 'shared-cohort-feature-unsupported';

  constructor(readonly featureId: string) {
    super(`Feature ${featureId || '<empty>'} is outside the closed shared-cohort experiment.`);
    this.name = 'UnsupportedSharedCohortFeatureError';
  }
}

export class SharedCohortFeatureError extends Error {
  readonly code = 'shared-cohort-feature-load-failed';

  constructor(readonly featureId: SharedCohortFeatureId, options?: ErrorOptions) {
    super(`Shared-cohort feature ${featureId} could not be loaded.`, options);
    this.name = 'SharedCohortFeatureError';
  }
}

export interface SharedCohortLoaderOptions<Cohort, Feature> {
  readonly evidence?: SharedCohortEvidenceRecorder;
  readonly loadCohort: () => Promise<Cohort>;
  readonly loadFeature: (id: SharedCohortFeatureId, cohort: Cohort) => Promise<Feature>;
}

export interface SharedCohortLoader<Feature> {
  readonly featureIds: typeof SHARED_COHORT_FEATURE_IDS;
  load(id: string): Promise<Feature>;
}

const isFeatureId = (id: string): id is SharedCohortFeatureId =>
  (SHARED_COHORT_FEATURE_IDS as readonly string[]).includes(id);

export function createSharedCohortLoaderForExperiment<Cohort, Feature>({
  evidence,
  loadCohort,
  loadFeature,
}: SharedCohortLoaderOptions<Cohort, Feature>): SharedCohortLoader<Feature> {
  let cohortPromise: Promise<Cohort> | undefined;
  const features = new Map<SharedCohortFeatureId, Promise<Feature>>();

  const acquireCohort = () => {
    if (cohortPromise) {
      evidence?.record({ scope: 'cohort', type: 'cache-hit' });
      return cohortPromise;
    }
    evidence?.record({ scope: 'cohort', type: 'start' });
    cohortPromise = loadCohort()
      .then((cohort) => {
        evidence?.record({ scope: 'cohort', type: 'success' });
        return cohort;
      })
      .catch((error: unknown) => {
        cohortPromise = undefined;
        throw error;
      });
    return cohortPromise;
  };

  return {
    featureIds: SHARED_COHORT_FEATURE_IDS,
    load(id) {
      if (!isFeatureId(id)) {
        evidence?.record({ category: 'unsupported-feature', scope: 'feature', type: 'failure' });
        return Promise.reject(new UnsupportedSharedCohortFeatureError(id));
      }
      const existing = features.get(id);
      if (existing) {
        evidence?.record({ featureId: id, scope: 'feature', type: 'cache-hit' });
        return existing;
      }
      evidence?.record({ featureId: id, scope: 'feature', type: 'start' });
      const pending = acquireCohort()
        .then((cohort) => loadFeature(id, cohort))
        .then((feature) => {
          evidence?.record({ featureId: id, scope: 'feature', type: 'success' });
          return feature;
        })
        .catch((cause: unknown) => {
          features.delete(id);
          evidence?.record({ featureId: id, scope: 'feature', type: 'failure' });
          throw new SharedCohortFeatureError(id, { cause });
        });
      features.set(id, pending);
      return pending;
    },
  };
}

