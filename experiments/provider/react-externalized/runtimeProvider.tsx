// POC / EXPERIMENT / NOT FOR PRODUCTION
import {
  Suspense,
  lazy,
  useContext,
  useEffect,
  useState,
  type Context,
} from 'react';
import { createPortal } from 'react-dom';

import {
  SharedGrafanaCohortApp,
  inspectSharedGrafanaCohort,
} from '../../bundle/shared-grafana-cohort/browserApp.tsx';

const behavior = {
  activeEffects: 0,
  cleanups: 0,
  lazyLoads: 0,
  setups: 0,
};

const LazyBoundarySentinel = lazy(async () => {
  behavior.lazyLoads += 1;
  return {
    default: () => <output data-testid="provider-lazy">lazy-ready</output>,
  };
});

export interface ReactExternalizedProviderAppProps {
  readonly hostContext: Context<string>;
  readonly portalTarget: Element;
}

export function ReactExternalizedProviderApp({
  hostContext,
  portalTarget,
}: ReactExternalizedProviderAppProps) {
  const contextValue = useContext(hostContext);
  const [count, setCount] = useState(0);

  useEffect(() => {
    behavior.activeEffects += 1;
    behavior.setups += 1;
    return () => {
      behavior.activeEffects -= 1;
      behavior.cleanups += 1;
    };
  }, []);

  return (
    <>
      <aside aria-label="React provider boundary">
        <output data-testid="provider-context">{contextValue}</output>
        <button data-testid="provider-state" onClick={() => setCount((value) => value + 1)}>
          state:{count}
        </button>
        <Suspense fallback={<output data-testid="provider-lazy">lazy-loading</output>}>
          <LazyBoundarySentinel />
        </Suspense>
        <output data-testid="provider-admitted">ready</output>
      </aside>
      {createPortal(<output data-testid="provider-portal">portal-ready</output>, portalTarget)}
      <SharedGrafanaCohortApp />
    </>
  );
}

export function inspectReactExternalizedRuntime() {
  return {
    behavior: structuredClone(behavior),
    cohort: inspectSharedGrafanaCohort(),
  };
}
