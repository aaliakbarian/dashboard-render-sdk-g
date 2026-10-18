// POC / EXPERIMENT / NOT FOR PRODUCTION
declare module 'transformation-conformance-rename-by-regex' {
  import type { DataTransformerInfo, RenameByRegexTransformerOptions } from '@grafana/data';
  export const renameByRegexTransformer: DataTransformerInfo<RenameByRegexTransformerOptions>;
}

declare module 'transformation-conformance-registry' {
  import type { Registry, TransformerRegistryItem } from '@grafana/data';
  export const standardTransformersRegistry: Registry<TransformerRegistryItem>;
}

declare module 'transformation-conformance-transform-data-frame' {
  import type {
    DataFrame,
    DataTransformerConfig,
    DataTransformContext,
    CustomTransformOperator,
  } from '@grafana/data';
  import type { Observable } from 'rxjs';
  export function transformDataFrame(
    options: Array<DataTransformerConfig | CustomTransformOperator>,
    data: DataFrame[],
    ctx?: DataTransformContext
  ): Observable<DataFrame[]>;
}
