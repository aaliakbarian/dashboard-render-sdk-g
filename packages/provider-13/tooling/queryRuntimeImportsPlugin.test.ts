import { expect, it } from 'vitest';
import { queryRuntimeImportsPlugin } from './queryRuntimeImportsPlugin';
it('resolves the fixed lazy query services only from the provider initializer', () => {
  const plugin: any = queryRuntimeImportsPlugin({ providerRoot: '/repo/packages/provider-13', repositoryRoot: '/repo' });
  expect(plugin.resolveId('grafana-provider13-query-services', '/repo/packages/provider-13/src/runtime/installQueryRuntime.ts')).toBe('/repo/packages/provider-13/tooling/viewOnly/queryServices.ts');
  expect(plugin.resolveId('grafana-provider13-query-services', '/repo/other.ts')).toBeNull();
  expect(plugin.resolveId('@grafana/runtime', '\0provider-13-pinned-grafana-source:testdata:datasource.ts.js')).toBe('/repo/packages/provider-13/tooling/viewOnly/queryRuntime.ts');
  expect(plugin.resolveId('@grafana/runtime', '/repo/other.ts')).toBeNull();
  expect(plugin.resolveId('../services/index.mjs', '/repo/node_modules/@grafana/runtime/dist/esm/utils/DataSourceWithBackend.mjs')).toBe('/repo/packages/provider-13/tooling/viewOnly/queryServicesInstalled.ts');
  expect(plugin.resolveId('../../utils/logging.mjs', '/repo/node_modules/@grafana/runtime/dist/esm/services/logging/registry.mjs')).toBe('/repo/packages/provider-13/tooling/viewOnly/queryMonitoring.ts');
});
