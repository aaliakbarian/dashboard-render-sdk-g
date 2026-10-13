// POC / EXPERIMENT / NOT FOR PRODUCTION
import { describe, expect, it } from 'vitest';

import {
  SharedCohortFeatureError,
  createSharedCohortLoaderForExperiment,
  type SharedCohortEvent,
} from '../../../experiments/bundle/shared-grafana-cohort/sharedCohortLoader.ts';

describe('shared Grafana cohort loader', () => {
  it('initializes the cohort once across concurrent independent feature loads', async () => {
    const events: SharedCohortEvent[] = [];
    let cohortLoads = 0;
    let releaseCohort: (() => void) | undefined;
    const cohortReady = new Promise<void>((resolve) => {
      releaseCohort = resolve;
    });
    const featureValues = {
      stat: { id: 'stat' },
      testdata: { id: 'testdata' },
      text: { id: 'text' },
      timeseries: { id: 'timeseries' },
    } as const;
    const loader = createSharedCohortLoaderForExperiment({
      evidence: { record: (event) => events.push(structuredClone(event)) },
      loadCohort: async () => {
        cohortLoads += 1;
        await cohortReady;
        return { identity: 'cohort' };
      },
      loadFeature: async (id) => featureValues[id],
    });

    const text = loader.load('text');
    const stat = loader.load('stat');
    const timeseries = loader.load('timeseries');
    const testdata = loader.load('testdata');
    releaseCohort?.();

    await expect(Promise.all([text, stat, timeseries, testdata])).resolves.toEqual([
      featureValues.text,
      featureValues.stat,
      featureValues.timeseries,
      featureValues.testdata,
    ]);
    expect(cohortLoads).toBe(1);
    expect(events.filter((event) => event.scope === 'cohort' && event.type === 'start')).toHaveLength(1);
    expect(events.filter((event) => event.scope === 'cohort' && event.type === 'success')).toHaveLength(1);
  });

  it('coalesces same-feature loads and evicts a failed feature for retry', async () => {
    let statAttempts = 0;
    const loader = createSharedCohortLoaderForExperiment({
      loadCohort: async () => ({ identity: 'cohort' }),
      loadFeature: async (id) => {
        if (id === 'stat' && ++statAttempts === 1) throw new Error('controlled');
        return { id };
      },
    });

    const textA = loader.load('text');
    const textB = loader.load('text');
    expect(textA).toBe(textB);
    await expect(textA).resolves.toEqual({ id: 'text' });
    await expect(loader.load('stat')).rejects.toBeInstanceOf(SharedCohortFeatureError);
    await expect(loader.load('stat')).resolves.toEqual({ id: 'stat' });
    expect(statAttempts).toBe(2);
  });

  it('rejects unknown feature IDs without constructing a URL', async () => {
    const loader = createSharedCohortLoaderForExperiment({
      loadCohort: async () => ({ identity: 'cohort' }),
      loadFeature: async (id) => ({ id }),
    });

    await expect(loader.load('../text')).rejects.toMatchObject({
      code: 'shared-cohort-feature-unsupported',
    });
  });
});

