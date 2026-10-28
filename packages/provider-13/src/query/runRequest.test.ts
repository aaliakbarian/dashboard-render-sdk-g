import type { DataFrame, DataQueryRequest, DataQueryResponse, DataSourceApi, PanelData } from '@grafana/data';
import { Observable, of, toArray, lastValueFrom, EMPTY, Subject, take, config } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { createGrafana13RunRequest } from './runRequest';

function request(): DataQueryRequest {
  return { requestId: 'drsdk-1-A', targets: [{ refId: 'A', scenarioId: 'predictable_pulse', alias: 'Raw Signal',
    pulseWave: { offCount: 5, offValue: 10, onCount: 5, onValue: 90, timeStep: 1 } }],
    range: { from: { valueOf: () => 1700000000000 }, to: { valueOf: () => 1700000060000 } }, interval: '1s', intervalMs: 1000, maxDataPoints: 300, scopedVars: {} } as unknown as DataQueryRequest;
}
const frame = { refId: 'A', length: 2, fields: [{ name: 'Time', type: 'time', values: [1, 2], config: {} }, { name: 'Raw Signal', type: 'number', values: [10, 90], config: {} }] } as DataFrame;
const source = (query: DataSourceApi['query']) => ({ uid: 'grsdk-testdata', type: 'grafana-testdata-datasource', query }) as DataSourceApi;
const malformedQueries: [string, () => unknown][] = [
  ['null packet', () => of(null)],
  ['null frame', () => of({ data: [null] })],
  ['throwing packet accessor', () => of({ get data(): never { throw new Error('private packet'); } })],
  ['invalid observable input', () => null],
];
describe('provider runRequest ownership', () => {
  it.each(malformedQueries)('sanitizes %s without escaped or unhandled RxJS errors', async (_label, query) => {
    const unhandled: unknown[] = [];
    const previous = config.onUnhandledError;
    config.onUnhandledError = error => { unhandled.push(error); };
    try {
      const packets = await lastValueFrom(createGrafana13RunRequest()(source(query as never), request()).pipe(toArray()))
        .catch(error => [{ state: 'escaped', error }]);
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(packets.map(p => p.state)).toEqual(['Loading', 'Error']);
      expect(JSON.stringify(packets.at(-1)!.error)).toBe('{"message":"The controlled datasource query failed."}');
      expect(unhandled).toEqual([]);
    } finally { config.onUnhandledError = previous; }
  });
  it('tears down a malformed source once and suppresses subsequent synchronous packets', async () => {
    let stops = 0;
    const packets = await lastValueFrom(createGrafana13RunRequest()(source(() => new Observable(sub => {
      sub.next({ data: null } as never); sub.next({ data: [frame] });
      return () => { stops++; };
    })), request()).pipe(toArray()));
    expect(packets.map(p => p.state)).toEqual(['Loading', 'Error']); expect(stops).toBe(1);
  });
  it('does not start work after cancellation during the Loading packet', () => {
    let calls = 0;
    createGrafana13RunRequest()(source(() => { calls++; return of({ data: [frame] }); }), request()).pipe(take(1)).subscribe();
    expect(calls).toBe(0);
  });
  it('publishes Loading then Done preserving exact decoded frame and request identities', async () => {
    const req = request();
    const packets = await lastValueFrom(createGrafana13RunRequest()(source(() => of({ data: [frame] })), req).pipe(toArray()));
    expect(packets.map(p => p.state)).toEqual(['Loading', 'Done']);
    expect(packets[1]!.series[0]).toBe(frame); expect(packets[1]!.request).toBe(req);
  });
  it.each([() => EMPTY, () => of({ data: [] })])('finishes an empty successful response without a fabricated series', async query => {
    const packets = await lastValueFrom(createGrafana13RunRequest()(source(query), request()).pipe(toArray()));
    expect(packets.map(p => p.state)).toEqual(['Loading', 'Done']); expect(packets.at(-1)!.series).toEqual([]);
  });
  it('merges streaming keys, excludes hidden refs and separates annotations without copying frames', async () => {
    const req = request(); req.targets.push({ refId: 'B', hide: true });
    const annotation = { ...frame, meta: { dataTopic: 'annotations' } } as DataFrame;
    const packets = await lastValueFrom(createGrafana13RunRequest()(source(() => of(
      { key: 'A', state: 'Streaming' as never, data: [frame] },
      { key: 'B', state: 'Streaming' as never, data: [{ ...frame, refId: 'B' }] },
      { key: 'annotations', data: [annotation] },
    )), req).pipe(toArray()));
    expect(packets[1]!.state).toBe('Streaming'); expect(packets.at(-1)!.series).toEqual([frame]); expect(packets.at(-1)!.annotations?.[0]).toBe(annotation);
  });
  it.each([
    () => { throw new Error('private auth body'); },
    () => new Observable<DataQueryResponse>(sub => sub.error({ message: 'private auth body', cause: 'secret' })),
    () => of({ data: [] , error: { message: 'private auth body' } }),
    () => of<DataQueryResponse>({ data: null } as unknown as DataQueryResponse),
  ])('sanitizes sync, async, packet and malformed query failures', async query => {
    const packets = await lastValueFrom(createGrafana13RunRequest()(source(query), request()).pipe(toArray()));
    expect(packets.at(-1)!.state).toBe('Error');
    expect(JSON.stringify(packets.at(-1)!.error)).not.toMatch(/private|auth|body|secret|cause/);
  });
  it('unsubscribes the source and never publishes a late packet', () => {
    let stops = 0; const subject = new Subject<any>(); const seen: PanelData[] = [];
    const subscription = createGrafana13RunRequest()(source(() => new Observable(sub => {
      const inner = subject.subscribe(sub); return () => { stops++; inner.unsubscribe(); };
    })), request()).subscribe(p => seen.push(p));
    subscription.unsubscribe(); subject.next({ data: [frame] });
    expect(stops).toBe(1); expect(seen.map(p => p.state)).toEqual(['Loading']);
  });
  it('rejects a foreign datasource or unsupported scenario before query invocation', async () => {
    let calls = 0; const ds = source(() => { calls++; return of({ data: [frame] }); });
    const req = request(); Object.assign(req.targets[0]!, { scenarioId: 'grafana_api' });
    const packets = await lastValueFrom(createGrafana13RunRequest()(ds, req).pipe(toArray()));
    expect(packets.at(-1)!.state).toBe('Error'); expect(calls).toBe(0);
  });
});
