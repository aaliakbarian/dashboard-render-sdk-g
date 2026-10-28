import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';

import type { Page } from '@playwright/test';

import type {
  DomResourceSnapshot,
  ResourceCounts,
} from '../../../packages/poc-compat/src/instrumentation/resourceTracker';

export interface BrowserResourceEvidenceSnapshot {
  dom: DomResourceSnapshot;
  iframes: {
    current: number;
    observations: Array<{ phase: 'initial' | 'mutation'; sequence: number }>;
  };
  instance: ResourceCounts;
  label: string;
  page: ResourceCounts;
}

function safeArtifactPath(path: string): string {
  const artifactsRoot = resolve('artifacts');
  const target = resolve(path);
  if (target !== artifactsRoot && !target.startsWith(`${artifactsRoot}${sep}`)) {
    throw new Error(`Evidence path must remain under artifacts/: ${relative(process.cwd(), target)}`);
  }
  return target;
}

export async function installResourceEvidence(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const kinds = [
      'abortController',
      'animationFrame',
      'eventListener',
      'fetch',
      'interval',
      'mutationObserver',
      'portal',
      'portalChild',
      'resizeObserver',
      'sceneActivation',
      'styleElement',
      'subscription',
      'timeout',
    ] as const;
    type Kind = (typeof kinds)[number];
    type Lifetime = 'instance' | 'page';
    const emptyCounts = () => Object.fromEntries(kinds.map((kind) => [kind, 0])) as Record<Kind, number>;
    const counts = { instance: emptyCounts(), page: emptyCounts() };
    const releases = new Set<() => void>();
    // Automatically observed browser resources belong to the host page.
    // Later dashboard adapters use mark() to identify instance-owned work.
    const acquire = (kind: Kind, lifetime: Lifetime = 'page') => {
      counts[lifetime][kind] += 1;
      let active = true;
      const release = () => {
        if (!active) return;
        active = false;
        counts[lifetime][kind] = Math.max(0, counts[lifetime][kind] - 1);
        releases.delete(release);
      };
      releases.add(release);
      return release;
    };

    const iframeObservations: Array<{ phase: 'initial' | 'mutation'; sequence: number }> = [];
    const recordIframes = (phase: 'initial' | 'mutation', number: number) => {
      for (let index = 0; index < number; index += 1) {
        iframeObservations.push({ phase, sequence: iframeObservations.length + 1 });
      }
    };
    recordIframes('initial', document.querySelectorAll('iframe').length);
    const NativeMutationObserver = globalThis.MutationObserver;
    const iframeObserver = new NativeMutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (!(node instanceof Element)) continue;
          recordIframes(
            'mutation',
            (node.tagName.toLowerCase() === 'iframe' ? 1 : 0) + node.querySelectorAll('iframe').length
          );
        }
      }
    });
    iframeObserver.observe(document, { childList: true, subtree: true });

    const nativeSetTimeout = window.setTimeout.bind(window);
    const nativeClearTimeout = window.clearTimeout.bind(window);
    const timeoutReleases = new Map<number, () => void>();
    window.setTimeout = ((handler: TimerHandler, timeout?: number, ...arguments_: unknown[]) => {
      let timer = 0;
      const release = acquire('timeout');
      const wrapped = (...callbackArguments: unknown[]) => {
        timeoutReleases.delete(timer);
        release();
        if (typeof handler === 'function') handler(...callbackArguments);
        else window.eval(handler);
      };
      timer = nativeSetTimeout(wrapped, timeout, ...arguments_);
      timeoutReleases.set(timer, release);
      return timer;
    }) as typeof window.setTimeout;
    window.clearTimeout = ((timer?: number) => {
      timeoutReleases.get(timer ?? 0)?.();
      timeoutReleases.delete(timer ?? 0);
      nativeClearTimeout(timer);
    }) as typeof window.clearTimeout;

    const nativeSetInterval = window.setInterval.bind(window);
    const nativeClearInterval = window.clearInterval.bind(window);
    const intervalReleases = new Map<number, () => void>();
    window.setInterval = ((handler: TimerHandler, timeout?: number, ...arguments_: unknown[]) => {
      const timer = nativeSetInterval(handler, timeout, ...arguments_);
      intervalReleases.set(timer, acquire('interval'));
      return timer;
    }) as typeof window.setInterval;
    window.clearInterval = ((timer?: number) => {
      intervalReleases.get(timer ?? 0)?.();
      intervalReleases.delete(timer ?? 0);
      nativeClearInterval(timer);
    }) as typeof window.clearInterval;

    const nativeRequestAnimationFrame = globalThis.requestAnimationFrame.bind(globalThis);
    const nativeCancelAnimationFrame = globalThis.cancelAnimationFrame.bind(globalThis);
    const frameReleases = new Map<number, () => void>();
    globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) => {
      let frame = 0;
      const release = acquire('animationFrame');
      frame = nativeRequestAnimationFrame((time) => {
        frameReleases.delete(frame);
        release();
        callback(time);
      });
      frameReleases.set(frame, release);
      return frame;
    }) as typeof globalThis.requestAnimationFrame;
    globalThis.cancelAnimationFrame = ((frame: number) => {
      frameReleases.get(frame)?.();
      frameReleases.delete(frame);
      nativeCancelAnimationFrame(frame);
    }) as typeof globalThis.cancelAnimationFrame;

    const nativeFetch = globalThis.fetch.bind(globalThis);
    globalThis.fetch = (async (...arguments_: Parameters<typeof fetch>) => {
      const release = acquire('fetch');
      try {
        return await nativeFetch(...arguments_);
      } finally {
        release();
      }
    }) as typeof globalThis.fetch;

    const NativeAbortController = globalThis.AbortController;
    globalThis.AbortController = class TrackedAbortController extends NativeAbortController {
      constructor() {
        super();
        const release = acquire('abortController');
        this.signal.addEventListener('abort', release, { once: true });
      }
    };

    const NativeResizeObserver = globalThis.ResizeObserver;
    const resizeObserverEvents: Array<{
      entries?: number;
      event: 'construct' | 'delivery' | 'disconnect' | 'unobserve';
      stack?: string;
    }> = [];
    if (NativeResizeObserver) {
      const resizeObserverState = new WeakMap<
        ResizeObserver,
        { active: boolean; release: () => void; targets: Set<Element> }
      >();
      globalThis.ResizeObserver = class TrackedResizeObserver extends NativeResizeObserver {
        constructor(callback: ResizeObserverCallback) {
          // Actual delivery, record identity/order, scheduling, and callback error
          // behavior remain owned by the browser's native observer.
          super((entries, observer) => {
            resizeObserverEvents.push({ entries: entries.length, event: 'delivery' });
            callback(entries, observer);
          });
          resizeObserverEvents.push({
            event: 'construct',
            stack: (new Error('ResizeObserver constructed').stack ?? '<stack unavailable>')
              .split('\n')
              .slice(1, 8)
              .join('\n'),
          });
          resizeObserverState.set(this, {
            active: false,
            release: () => undefined,
            targets: new Set(),
          });
        }

        override disconnect() {
          super.disconnect();
          resizeObserverEvents.push({ event: 'disconnect' });
          const state = resizeObserverState.get(this);
          if (state?.active) {
            state.release();
            state.active = false;
          }
          state?.targets.clear();
        }

        override observe(target: Element, options?: ResizeObserverOptions) {
          super.observe(target, options);
          const state = resizeObserverState.get(this);
          if (state) {
            state.targets.add(target);
            if (!state.active) {
              state.release = acquire('resizeObserver');
              state.active = true;
            }
          }
        }

        override unobserve(target: Element) {
          super.unobserve(target);
          resizeObserverEvents.push({ event: 'unobserve' });
          const state = resizeObserverState.get(this);
          state?.targets.delete(target);
          if (state?.active && state.targets.size === 0) {
            state.release();
            state.active = false;
          }
        }
      };
    }

    const mutationObserverState = new WeakMap<
      MutationObserver,
      { active: boolean; release: () => void }
    >();
    const mutationObserverCreations: string[] = [];
    globalThis.MutationObserver = class TrackedMutationObserver extends NativeMutationObserver {
      constructor(callback: MutationCallback) {
        super(callback);
        mutationObserverCreations.push(
          (new Error('MutationObserver constructed').stack ?? '<stack unavailable>')
            .split('\n')
            .slice(1, 8)
            .join('\n')
        );
        mutationObserverState.set(this, {
          active: true,
          release: acquire('mutationObserver'),
        });
      }

      override disconnect() {
        super.disconnect();
        const state = mutationObserverState.get(this);
        if (state?.active) {
          state.release();
          state.active = false;
        }
      }

      override observe(target: Node, options?: MutationObserverInit) {
        super.observe(target, options);
        const state = mutationObserverState.get(this);
        if (state && !state.active) {
          state.release = acquire('mutationObserver');
          state.active = true;
        }
      }
    };

    const nativeAddEventListener = EventTarget.prototype.addEventListener;
    const nativeRemoveEventListener = EventTarget.prototype.removeEventListener;
    const activeEventListeners = new Set<{ type: string; target: string; stack: string }>();
    const listenerTargets = new WeakMap<object, WeakRef<EventTarget>>();
    const listenerReleases = new WeakMap<object, () => void>();
    // Keep bookkeeping closures out of the native listener's lexical context:
    // a shared V8 context can otherwise retain the original EventTarget itself.
    const releaseObservedListener = (record: { type: string; target: string; stack: string }, releaseCount: () => void) =>
      () => { activeEventListeners.delete(record); releaseCount(); };
    const listenerRecords = new WeakMap<
      EventTarget,
      Map<EventListenerOrEventListenerObject, Map<string, { release: () => void; wrapped: EventListener }>>
    >();
    const listenerKey = (type: string, options?: boolean | AddEventListenerOptions) =>
      `${type}:${typeof options === 'boolean' ? options : Boolean(options?.capture)}`;
    EventTarget.prototype.addEventListener = function (type, listener, options) {
      if (!listener) return nativeAddEventListener.call(this, type, listener, options);
      const byListener = listenerRecords.get(this) ?? new Map();
      listenerRecords.set(this, byListener);
      const byOption = byListener.get(listener) ?? new Map();
      byListener.set(listener, byOption);
      const key = listenerKey(type, options);
      if (byOption.has(key)) return;
      const record = {
        type,
        target: this === window ? 'window' : this === document ? 'document' :
          this instanceof Element ? `${this.tagName.toLowerCase()}.${this.className}` : this.constructor.name,
        stack: (new Error('Event listener acquired').stack ?? '').split('\n').slice(1, 7).join('\n'),
      };
      activeEventListeners.add(record);
      listenerTargets.set(record, new WeakRef(this));
      const releaseCount = acquire('eventListener');
      const release = releaseObservedListener(record, releaseCount);
      listenerReleases.set(record, release);
      const wrapped: EventListener = (event) => {
        if (typeof listener === 'function') listener.call(this, event);
        else listener.handleEvent(event);
        if (typeof options === 'object' && options.once) {
          release();
          byOption.delete(key);
          if (byOption.size === 0) byListener.delete(listener);
          if (byListener.size === 0) listenerRecords.delete(this);
        }
      };
      byOption.set(key, { release, wrapped });
      nativeAddEventListener.call(this, type, wrapped, options);
    };
    EventTarget.prototype.removeEventListener = function (type, listener, options) {
      if (!listener) return nativeRemoveEventListener.call(this, type, listener, options);
      const key = listenerKey(type, options);
      const record = listenerRecords.get(this)?.get(listener)?.get(key);
      if (record) {
        record.release();
        const byListener = listenerRecords.get(this)!;
        const byOption = byListener.get(listener)!;
        byOption.delete(key);
        if (byOption.size === 0) byListener.delete(listener);
        if (byListener.size === 0) listenerRecords.delete(this);
        return nativeRemoveEventListener.call(this, type, record.wrapped, options);
      }
      return nativeRemoveEventListener.call(this, type, listener, options);
    };

    const snapshot = (label: string) => ({
      dom: {
        emotionStyleElements: document.querySelectorAll('style[data-emotion]').length,
        iframeElements: document.querySelectorAll('iframe').length,
        portalChildren: document.querySelector('#grafana-portal-container')?.childElementCount ?? 0,
        portalRoots: document.querySelectorAll('#grafana-portal-container').length,
        styleElements: document.querySelectorAll('style').length,
      },
      iframes: {
        current: document.querySelectorAll('iframe').length,
        observations: iframeObservations.map((observation) => ({ ...observation })),
      },
      instance: { ...counts.instance },
      label,
      page: { ...counts.page },
    });
    Object.defineProperty(globalThis, '__POC_RESOURCE_EVIDENCE__', {
      configurable: false,
      value: {
        mark(kind: Kind, lifetime: Lifetime = 'instance') {
          return acquire(kind, lifetime);
        },
        snapshot,
        activeEventListeners() {
          return [...activeEventListeners].map(record => {
            const target = listenerTargets.get(record)?.deref();
            return { ...record, connected: target instanceof Node ? target.isConnected : undefined };
          });
        },
        // Removing a DOM subtree does not call removeEventListener on its
        // children. Only retire a historical count after the browser has
        // actually collected the target, never merely because it disconnected.
        sweepCollectedEventListeners() {
          for (const record of activeEventListeners) {
            if (!listenerTargets.get(record)?.deref()) listenerReleases.get(record)?.();
          }
        },
        mutationObserverCreations() {
          return [...mutationObserverCreations];
        },
        resizeObserverEvents() {
          return resizeObserverEvents.map((event) => ({ ...event }));
        },
      },
      writable: false,
    });
  });
}

export async function captureResourceEvidence(
  page: Page,
  label: string
): Promise<BrowserResourceEvidenceSnapshot> {
  return page.evaluate((snapshotLabel) => {
    const evidence = (
      globalThis as typeof globalThis & {
        __POC_RESOURCE_EVIDENCE__?: {
          snapshot(label: string): BrowserResourceEvidenceSnapshot;
        };
      }
    ).__POC_RESOURCE_EVIDENCE__;
    if (!evidence) {
      throw new Error('POC resource evidence was not installed before navigation.');
    }
    return evidence.snapshot(snapshotLabel);
  }, label);
}

export async function writeResourceEvidence(
  path: string,
  snapshots: readonly BrowserResourceEvidenceSnapshot[]
): Promise<void> {
  const target = safeArtifactPath(path);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, `${JSON.stringify(snapshots, null, 2)}\n`, 'utf8');
}
