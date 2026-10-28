import type { DataFrame, DataQueryError, DataQueryRequest, DataQueryResponse, DataSourceApi, LoadingState, PanelData } from '@grafana/data';
import { from, Observable } from 'rxjs';
import { GRAFANA_13_TESTDATA_TYPE, GRAFANA_13_TESTDATA_UID, isGrafana13PulseTarget } from '../datasource/contracts';

export type Grafana13RunRequest = (datasource: DataSourceApi, request: DataQueryRequest, queryFunction?: DataSourceApi['query']) => Observable<PanelData>;
const queryError = (): DataQueryError => ({ message: 'The controlled datasource query failed.' });

export function createGrafana13RunRequest(): Grafana13RunRequest {
  return (datasource, request, queryFunction) => new Observable<PanelData>(subscriber => {
    const initial: PanelData = { state: 'Loading' as LoadingState, series: [], annotations: [], request, timeRange: request.range };
    subscriber.next(initial);
    if (subscriber.closed) return;
    const fail = () => { if (!subscriber.closed) { subscriber.next({ ...initial, state: 'Error' as LoadingState, error: queryError() }); subscriber.complete(); } };
    let result: Observable<DataQueryResponse>;
    try {
      const visible = request.targets.filter(t => !t.hide);
      if (datasource.uid !== GRAFANA_13_TESTDATA_UID || datasource.type !== GRAFANA_13_TESTDATA_TYPE ||
          visible.length > 1 || !visible.every(isGrafana13PulseTarget)) { fail(); return; }
      if (visible.length === 0) { subscriber.next({ ...initial, state: 'Done' as LoadingState }); subscriber.complete(); return; }
      result = from(queryFunction ? queryFunction(request) : datasource.query(request));
    } catch { fail(); return; }
    const packets = new Map<string, DataQueryResponse>();
    let received = false;
    const subscription = result.subscribe({
      next(packet) {
        if (subscriber.closed) return;
        try {
          if (!packet || !Array.isArray(packet.data) || packet.data.some(frame => !frame || typeof frame !== 'object')) { fail(); return; }
          received = true;
          packets.set(packet.key ?? packet.data[0]?.refId ?? 'A', packet);
          const hidden = new Set(request.targets.filter(t => t.hide).map(t => t.refId));
          const series: DataFrame[] = []; const annotations: DataFrame[] = [];
          let error = false;
          for (const p of packets.values()) {
            error ||= !!p.error || !!p.errors?.length || p.state === 'Error';
            for (const frame of p.data as DataFrame[]) {
              if (frame.refId && hidden.has(frame.refId)) continue;
              (frame.meta?.dataTopic === 'annotations' ? annotations : series).push(frame);
            }
          }
          request.endTime = Date.now();
          subscriber.next({ ...initial, series, annotations, state: (error ? 'Error' : packet.state ?? 'Done') as LoadingState,
            ...(error ? { error: queryError(), errors: [queryError()] } : {}) });
        } catch { fail(); }
      },
      error: fail,
      complete() {
        if (!received && !subscriber.closed) subscriber.next({ ...initial, state: 'Done' as LoadingState });
        subscriber.complete();
      },
    });
    return () => subscription.unsubscribe();
  });
}
