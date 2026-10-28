import type { FieldConfigPropertyItem } from '@grafana/data';
import { Grafana13QueryRuntimeError } from '../datasource/contracts';
type Processor = NonNullable<FieldConfigPropertyItem['process']>;
export interface Grafana13FieldProcessors {
  readonly stringOverrideProcessor: Processor;
  readonly identityOverrideProcessor: Processor;
  readonly numberOverrideProcessor: Processor;
  readonly thresholdsOverrideProcessor: Processor;
  readonly valueMappingsOverrideProcessor: Processor;
}
export interface Grafana13FieldRegistry { setInit(init: () => FieldConfigPropertyItem[]): void; }
const installed = new WeakMap<Grafana13FieldRegistry, Grafana13FieldProcessors>();
function unavailableEditor() { return null; }
export function installGrafana13FieldConfig(registry: Grafana13FieldRegistry, processors: Grafana13FieldProcessors): void {
  const previous = installed.get(registry);
  if (previous) {
    if (Object.keys(previous).some(key => previous[key as keyof Grafana13FieldProcessors] !== processors[key as keyof Grafana13FieldProcessors])) throw new Grafana13QueryRuntimeError('query-runtime-initialization-failed');
    return;
  }
  const definitions: [string, Processor][] = [
    ['unit', processors.stringOverrideProcessor], ['color', processors.identityOverrideProcessor],
    ['mappings', processors.valueMappingsOverrideProcessor], ['thresholds', processors.thresholdsOverrideProcessor],
    ['min', processors.numberOverrideProcessor], ['max', processors.numberOverrideProcessor],
  ];
  registry.setInit(() => definitions.map(([id, process]) => ({
    id, path: id, name: id, process, editor: unavailableEditor, override: unavailableEditor,
    shouldApply: field => id !== 'mappings' || field.type !== 'time',
  })));
  installed.set(registry, processors);
}
