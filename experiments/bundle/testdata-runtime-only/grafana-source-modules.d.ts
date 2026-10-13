// POC / EXPERIMENT / NOT FOR PRODUCTION
declare module 'grafana-experiment-testdata-baseline' {
  import type { DataSourceApi, DataSourcePlugin } from '@grafana/data';
  export const plugin: DataSourcePlugin<DataSourceApi>;
}

declare module 'grafana-experiment-testdata-runtime-source' {
  import type { DataSourceApi, DataSourceInstanceSettings } from '@grafana/data';
  import type { TemplateSrv } from '@grafana/runtime';
  export class TestDataDataSource extends DataSourceApi {
    constructor(instanceSettings: DataSourceInstanceSettings, templateSrv?: TemplateSrv);
  }
}

declare module 'grafana-experiment-data-array-frame' { export const ArrayDataFrame: any; }
declare module 'grafana-experiment-data-circular-frame' { export const CircularDataFrame: any; }
declare module 'grafana-experiment-data-csv' { export const CSVReader: any; }
declare module 'grafana-experiment-data-dataframe-json' { export const dataFrameFromJSON: any; export const dataFrameToJSON: any; }
declare module 'grafana-experiment-data-datasource' { export const DataSourceApi: any; }
declare module 'grafana-experiment-data-datasource-utils' { export const getDataSourceRef: any; }
declare module 'grafana-experiment-data-deprecation' { export const deprecationWarning: any; }
declare module 'grafana-experiment-data-display' { export const getDisplayProcessor: any; }
declare module 'grafana-experiment-data-field-color' { export const FieldColorModeId: any; }
declare module 'grafana-experiment-data-frame-types' { export const FieldType: any; }
declare module 'grafana-experiment-data-frame-utils' { export const addRow: any; }
declare module 'grafana-experiment-data-live' { export const LiveChannelScope: any; export const parseLiveChannelAddress: any; }
declare module 'grafana-experiment-data-match-plugin' { export const matchPluginId: any; }
declare module 'grafana-experiment-data-mutable-frame' { export const MutableDataFrame: any; }
declare module 'grafana-experiment-data-node-graph' { export const NodeGraphDataFrameFieldNames: any; }
declare module 'grafana-experiment-data-process-frame' { export const createDataFrame: any; export const toDataFrame: any; }
declare module 'grafana-experiment-data-query' { export const DataTopic: any; }
declare module 'grafana-experiment-data-runtime-types' { export const isObject: any; export const LoadingState: any; }
declare module 'grafana-experiment-data-streaming-frame' { export const StreamingDataFrame: any; export const StreamingFrameAction: any; }
declare module 'grafana-experiment-data-store' { export const store: any; }
declare module 'grafana-experiment-data-theme' { export const createTheme: any; }
declare module 'grafana-experiment-data-theme-registry' { export const getThemeById: any; }
declare module 'grafana-experiment-data-time-formats' { export const systemDateFormats: any; }
declare module 'grafana-experiment-data-use-plugin-context' { export const usePluginContext: any; }
declare module 'grafana-experiment-data-url' { export const urlUtil: any; }
declare module 'grafana-experiment-data-uuid' { export const generateUUID: any; }
declare module 'grafana-experiment-data-variable-types' { export const StandardVariableSupport: any; }
declare module 'grafana-experiment-data-variable-utils' { export const getSearchFilterScopedVar: any; }
declare module 'grafana-experiment-data-make-class' { export const makeClassES5Compatible: any; }
declare module 'grafana-experiment-runtime-backend' { export const getBackendSrv: any; }
declare module 'grafana-experiment-runtime-datasource-backend' { export const DataSourceWithBackend: any; }
declare module 'grafana-experiment-runtime-live' { export const getGrafanaLiveSrv: any; }
declare module 'grafana-experiment-runtime-template' { export const getTemplateSrv: any; }
declare module 'grafana-experiment-ui-debug' { export const attachDebugger: any; }
declare module 'grafana-experiment-ui-logger' { export const createLogger: any; }
