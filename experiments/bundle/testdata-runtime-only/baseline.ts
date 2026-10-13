// POC / EXPERIMENT / NOT FOR PRODUCTION
import type { DataSourceApi, DataSourcePlugin } from '@grafana/data';

import { plugin } from 'grafana-experiment-testdata-baseline';

export const baselineTestDataPlugin: DataSourcePlugin<DataSourceApi> = plugin;
