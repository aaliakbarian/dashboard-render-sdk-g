import type { DataTransformerInfo, TransformerRegistryItem } from '@grafana/data';
import { Grafana13QueryRuntimeError } from '../datasource/contracts';
export interface Grafana13TransformerRegistry { setInit(init: () => TransformerRegistryItem[]): void; }
const installed = new WeakMap<Grafana13TransformerRegistry, DataTransformerInfo>();
function unavailableEditor() { return null; }
export function installGrafana13Transformations(registry: Grafana13TransformerRegistry, transformer: DataTransformerInfo): void {
  if (transformer.id !== 'renameByRegex') throw new Grafana13QueryRuntimeError('query-runtime-initialization-failed');
  const previous = installed.get(registry);
  if (previous) {
    if (previous !== transformer) throw new Grafana13QueryRuntimeError('query-runtime-initialization-failed');
    return;
  }
  registry.setInit(() => [{ id: 'renameByRegex', name: transformer.name, description: transformer.description,
    defaultOptions: transformer.defaultOptions, editor: unavailableEditor, imageDark: '', imageLight: '',
    transformation: async () => transformer }]);
  installed.set(registry, transformer);
}
