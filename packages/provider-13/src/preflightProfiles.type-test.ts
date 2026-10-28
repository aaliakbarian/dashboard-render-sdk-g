import type {
  Grafana13QueryPanelModel,
  Grafana13PredictablePulseQueryProfile,
} from './partialContracts';

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Expect<T extends true> = T;
type _Seven = Expect<Equal<Grafana13QueryPanelModel['type'], 'stat' | 'timeseries' | 'table' | 'gauge' | 'bargauge' | 'piechart' | 'barchart'>>;

declare const panel: Grafana13QueryPanelModel;
declare const query: Grafana13PredictablePulseQueryProfile;
// @ts-expect-error immutable detached target tuple
query.targets[0].alias = 'changed';
// @ts-expect-error no second query target
query.targets[1];
if (panel.type === 'table') {
  const small: 'sm' = panel.options.cellHeight;
  // @ts-expect-error exact view-only options
  panel.options.enablePagination = true;
  void small;
}
if (panel.type === 'stat' || panel.type === 'gauge' || panel.type === 'bargauge' || panel.type === 'piechart') {
  const reducer: 'lastNotNull' = panel.options.reduceOptions.calcs[0];
  void reducer;
}
// @ts-expect-error unsupported field overrides
panel.fieldConfig.overrides[0];
// @ts-expect-error the query profile is provider private, never an executable scene
panel.$data;
