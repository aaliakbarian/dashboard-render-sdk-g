declare module 'grafana-provider13-testdata-runtime' {
  export const TestDataDataSource: import('../datasource/contracts').Grafana13TestDataConstructor;
}
declare module 'grafana-provider13-query-services' {
  export const queryServices: import('../runtime/installQueryRuntime').Grafana13QueryCohort;
}
