import type { TemplateSrv } from '@grafana/runtime';
import { Grafana13QueryRuntimeError } from '../datasource/contracts';

/** Pulse profiles contain literal aliases only; no dashboard variable execution. */
export function createGrafana13TemplateSrv(): TemplateSrv {
  const containsTemplate = (target = '') => /\$|\[\[/.test(target);
  return Object.freeze({
    containsTemplate,
    getVariables: () => [],
    replace(target = '', _scopedVars, format) {
      if (containsTemplate(target) || (format !== undefined && format !== 'raw')) throw new Grafana13QueryRuntimeError('template-unsupported');
      return target;
    },
    updateTimeRange() {},
  } satisfies TemplateSrv);
}
