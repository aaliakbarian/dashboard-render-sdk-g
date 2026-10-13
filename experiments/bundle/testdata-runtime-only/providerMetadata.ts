// POC / EXPERIMENT / NOT FOR PRODUCTION
// This is deliberately not Grafana's DataSourcePlugin registration object.
// The view/query-only provider needs only the exact upstream constructor.
import { TestDataDataSource } from 'grafana-experiment-testdata-runtime-source';

export const plugin = Object.freeze({
  DataSourceClass: TestDataDataSource,
});
