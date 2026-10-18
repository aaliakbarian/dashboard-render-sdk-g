// POC / EXPERIMENT / NOT FOR PRODUCTION
import type { Page } from '@playwright/test';

export interface LifecycleListenerSnapshot {
  readonly aborted: number;
  readonly activeComparable: number;
  readonly detachedNodes: number;
  readonly instrumentationAbortListeners: number;
  readonly byTarget: Record<string, number>;
  readonly byTargetType: Record<string, number>;
  readonly registered: number;
  readonly removed: number;
}

export interface LifecycleTimerSnapshot {
  readonly active: number;
  readonly byDelay: Record<string, number>;
}

export async function installLifecycleResourceEvidence(page: Page) {
  await page.addInitScript(() => {
    interface ListenerRecord {
      active: boolean;
      readonly signal?: WeakRef<AbortSignal>;
      readonly target: WeakRef<EventTarget>;
      readonly targetKind: string;
      readonly type: string;
    }

    const inheritedAdd = EventTarget.prototype.addEventListener;
    const inheritedRemove = EventTarget.prototype.removeEventListener;
    const records: ListenerRecord[] = [];
    const mappings = new WeakMap<EventTarget, WeakMap<object, Map<string, { record: ListenerRecord; wrapped: EventListener }>>>();
    let removed = 0;
    const keyFor = (type: string, options?: boolean | AddEventListenerOptions) =>
      `${type}:${typeof options === 'boolean' ? options : Boolean(options?.capture)}`;
    const classify = (target: EventTarget) => {
      if (target === window) return 'window';
      if (target === document) return 'document';
      if (target instanceof AbortSignal) return 'abort-signal';
      if (target instanceof Element && target.id === 'grafana-portal-container') return 'provider-portal-root';
      if (target instanceof Element && target.id === 'root') return 'host-root';
      if (target instanceof Node) return 'dom-node';
      return target.constructor?.name || 'event-target';
    };

    const inheritedSetTimeout = window.setTimeout.bind(window);
    const inheritedClearTimeout = window.clearTimeout.bind(window);
    const timers = new Map<number, number>();
    window.setTimeout = ((handler: TimerHandler, timeout?: number, ...arguments_: unknown[]) => {
      let timer = 0;
      const wrapped = (...callbackArguments: unknown[]) => {
        timers.delete(timer);
        if (typeof handler === 'function') handler(...callbackArguments);
        else window.eval(handler);
      };
      timer = inheritedSetTimeout(wrapped, timeout, ...arguments_);
      timers.set(timer, timeout ?? 0);
      return timer;
    }) as typeof window.setTimeout;
    window.clearTimeout = ((timer?: number) => {
      timers.delete(timer ?? 0);
      inheritedClearTimeout(timer);
    }) as typeof window.clearTimeout;

    EventTarget.prototype.addEventListener = function (type, listener, options) {
      if (!listener) return inheritedAdd.call(this, type, listener, options);
      const listenerObject = listener as object;
      const byListener = mappings.get(this) ?? new WeakMap();
      mappings.set(this, byListener);
      const byKey = byListener.get(listenerObject) ?? new Map();
      byListener.set(listenerObject, byKey);
      const key = keyFor(type, options);
      if (byKey.has(key)) return;
      const record: ListenerRecord = {
        active: true,
        ...(typeof options === 'object' && options.signal ? { signal: new WeakRef(options.signal) } : {}),
        target: new WeakRef(this),
        targetKind: classify(this),
        type,
      };
      const wrapped: EventListener = (event) => {
        if (typeof listener === 'function') listener.call(this, event);
        else listener.handleEvent(event);
        if (typeof options === 'object' && options.once && record.active) {
          record.active = false;
          removed += 1;
          byKey.delete(key);
        }
      };
      records.push(record);
      byKey.set(key, { record, wrapped });
      inheritedAdd.call(this, type, wrapped, options);
    };

    EventTarget.prototype.removeEventListener = function (type, listener, options) {
      if (!listener) return inheritedRemove.call(this, type, listener, options);
      const key = keyFor(type, options);
      const mapped = mappings.get(this)?.get(listener as object)?.get(key);
      if (!mapped) return inheritedRemove.call(this, type, listener, options);
      if (mapped.record.active) {
        mapped.record.active = false;
        removed += 1;
      }
      mappings.get(this)?.get(listener as object)?.delete(key);
      return inheritedRemove.call(this, type, mapped.wrapped, options);
    };

    Object.defineProperty(globalThis, '__STYLE_LIFECYCLE_RESOURCES__', {
      configurable: false,
      value: {
        listenerSnapshot() {
          let aborted = 0;
          let activeComparable = 0;
          let detachedNodes = 0;
          let instrumentationAbortListeners = 0;
          const byTarget: Record<string, number> = {};
          const byTargetType: Record<string, number> = {};
          for (const record of records) {
            if (!record.active) continue;
            const signal = record.signal?.deref();
            if (signal?.aborted) {
              aborted += 1;
              continue;
            }
            const target = record.target.deref();
            if (!target) continue;
            if (target instanceof Node && target !== document && !target.isConnected) {
              detachedNodes += 1;
              continue;
            }
            if (record.targetKind === 'abort-signal') {
              instrumentationAbortListeners += 1;
              continue;
            }
            activeComparable += 1;
            byTarget[record.targetKind] = (byTarget[record.targetKind] ?? 0) + 1;
            const targetType = `${record.targetKind}:${record.type}`;
            byTargetType[targetType] = (byTargetType[targetType] ?? 0) + 1;
          }
          return {
            aborted,
            activeComparable,
            byTarget,
            byTargetType,
            detachedNodes,
            instrumentationAbortListeners,
            registered: records.length,
            removed,
          };
        },
        timerSnapshot() {
          const byDelay: Record<string, number> = {};
          for (const delay of timers.values()) {
            const key = String(delay);
            byDelay[key] = (byDelay[key] ?? 0) + 1;
          }
          return { active: timers.size, byDelay };
        },
      },
      writable: false,
    });
  });
}

export async function captureLifecycleTimerEvidence(page: Page): Promise<LifecycleTimerSnapshot> {
  return page.evaluate(() => (
    globalThis as typeof globalThis & {
      __STYLE_LIFECYCLE_RESOURCES__: { timerSnapshot(): LifecycleTimerSnapshot };
    }
  ).__STYLE_LIFECYCLE_RESOURCES__.timerSnapshot());
}

export async function captureLifecycleListenerEvidence(page: Page): Promise<LifecycleListenerSnapshot> {
  return page.evaluate(() => (
    globalThis as typeof globalThis & {
      __STYLE_LIFECYCLE_RESOURCES__: { listenerSnapshot(): LifecycleListenerSnapshot };
    }
  ).__STYLE_LIFECYCLE_RESOURCES__.listenerSnapshot());
}
