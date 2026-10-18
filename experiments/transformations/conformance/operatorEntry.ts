// POC / EXPERIMENT / NOT FOR PRODUCTION
import type { DataTransformerInfo } from '@grafana/data';

import { TransformationConformanceError } from './capabilityCatalogue.ts';

let loadAttempts = 0;
let loaded: DataTransformerInfo | undefined;

export async function loadRenameByRegexOperator(): Promise<DataTransformerInfo> {
  if (loaded) return loaded;
  loadAttempts += 1;
  try {
    const module = await import('transformation-conformance-rename-by-regex');
    if (module.renameByRegexTransformer.id !== 'renameByRegex') {
      throw new TransformationConformanceError(
        'TransformationVersionMismatch',
        'The pinned operator entry did not export renameByRegex.'
      );
    }
    loaded = module.renameByRegexTransformer;
    return loaded;
  } catch (error: unknown) {
    if (error instanceof TransformationConformanceError) throw error;
    throw new TransformationConformanceError(
      'TransformationLoadFailure',
      'The exact Grafana Data 13.2.3 renameByRegex entry failed to load.',
      { cause: error }
    );
  }
}

export function inspectOperatorLoader() {
  return {
    implementationIdentity:
      '@grafana/data@13.2.3/dist/esm/transformations/transformers/renameByRegex.mjs',
    loadAttempts,
    loaded: loaded !== undefined,
    operatorId: loaded?.id,
  };
}
