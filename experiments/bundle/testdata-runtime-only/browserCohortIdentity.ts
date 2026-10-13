// POC / EXPERIMENT / NOT FOR PRODUCTION
import { plugin } from './providerMetadata.ts';
import * as host from './browserCohortHost.ts';
import * as provider from './browserCohortProvider.ts';

export function inspectTestDataRuntimeCohortIdentity() {
  return {
    data: host.DataSourceApi === provider.DataSourceApi,
    react: host.React.createElement === provider.React.createElement,
    reactDom: host.ReactDOM.createPortal === provider.ReactDOM.createPortal,
    runtime:
      host.DataSourceWithBackend === provider.DataSourceWithBackend &&
      host.getBackendSrv === provider.getBackendSrv,
    rxjs: host.Observable === provider.Observable,
    superclass:
      Object.getPrototypeOf(plugin.DataSourceClass.prototype) ===
      provider.DataSourceWithBackend.prototype,
  };
}
