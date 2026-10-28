import { TestDataDataSource } from 'grafana-provider13-testdata-runtime';
import type { Grafana13TestDataConstructor } from './contracts';

/** Exact upstream datasource.ts; deliberately excludes the authoring module. */
export const grafana13TestDataConstructor = TestDataDataSource as Grafana13TestDataConstructor;
