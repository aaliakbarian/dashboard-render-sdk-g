import { getBackendSrv } from 'grafana-provider13-query-backend';
import { getPluginImportUtils } from 'grafana-provider13-query-plugin';
import { getTemplateSrv, setTemplateSrv } from 'grafana-provider13-query-template';
import { getDataSourceSrv, setDataSourceSrv } from 'grafana-provider13-query-datasource-service';
import { getRunRequest, setRunRequest } from 'grafana-provider13-query-runner';
import { initializeLoggersRegistry } from 'grafana-provider13-query-logger';
import { registerRuntimeDataSourceInstance } from 'grafana-provider13-query-registration';
import { standardFieldConfigEditorRegistry } from 'grafana-provider13-query-fields';
import { standardTransformersRegistry } from 'grafana-provider13-query-transformers';
import { renameByRegexTransformer } from 'grafana-provider13-query-rename';
import * as processors from 'grafana-provider13-query-processors';

export const queryServices = Object.freeze({
  runtime: { getBackendSrv, getPluginImportUtils, getTemplateSrv, setTemplateSrv,
    getDataSourceSrv, setDataSourceSrv, getRunRequest, setRunRequest },
  initializeLoggersRegistry, registerRuntimeDataSourceInstance,
  fieldRegistry: standardFieldConfigEditorRegistry,
  transformerRegistry: standardTransformersRegistry,
  processors, renameByRegexTransformer,
});
