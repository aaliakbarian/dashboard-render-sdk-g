// POC / EXPERIMENT / NOT FOR PRODUCTION
import { resolve } from 'node:path';

import type { Plugin } from 'vite';

const RENDERER_NAMESPACE = '\0poc-pinned-grafana-source:text-renderer-only:';

export interface TextRendererOnlyImportsOptions {
  readonly experimentRoot: string;
  readonly publishedImportMode?: 'cohort' | 'leaf';
  readonly repositoryRoot: string;
  readonly sourceRoot: string;
}

function isExactTextRendererImporter(importer: string | undefined, sourceRoot: string): boolean {
  if (!importer) return false;
  const normalized = importer.replaceAll('\\', '/');
  return (
    normalized.startsWith(RENDERER_NAMESPACE) ||
    normalized === resolve(sourceRoot, 'v1/TextPanel.tsx').replaceAll('\\', '/')
  );
}

export function isTextRendererOnlyExperimentImporter(
  importer: string | undefined,
  experimentRoot: string
): boolean {
  if (!importer) return false;
  const normalizedImporter = importer.replaceAll('\\', '/').split('?')[0] ?? importer;
  const normalizedRoot = resolve(experimentRoot).replaceAll('\\', '/').replace(/\/$/, '');
  return (
    normalizedImporter === normalizedRoot ||
    normalizedImporter.startsWith(`${normalizedRoot}/`)
  );
}

export function textRendererOnlyImportsPlugin({
  experimentRoot,
  publishedImportMode = 'leaf',
  repositoryRoot,
  sourceRoot,
}: TextRendererOnlyImportsOptions): Plugin {
  return {
    name: 'text-renderer-only-import-boundary',
    enforce: 'pre',
    resolveId(source, importer) {
      const publishedModules: Readonly<Record<string, string>> = {
        'grafana-experiment-data-markdown':
          'node_modules/@grafana/data/dist/esm/text/markdown.mjs',
        'grafana-experiment-data-panel-plugin':
          'node_modules/@grafana/data/dist/esm/panel/PanelPlugin.mjs',
        'grafana-experiment-data-sanitize':
          'node_modules/@grafana/data/dist/esm/text/sanitize.mjs',
        'grafana-experiment-runtime-config':
          'node_modules/@grafana/runtime/dist/esm/config.mjs',
        'grafana-experiment-ui-scroll-container':
          'node_modules/@grafana/ui/dist/esm/components/ScrollContainer/ScrollContainer.mjs',
        'grafana-experiment-ui-theme-context':
          'node_modules/@grafana/ui/dist/esm/themes/ThemeContext.mjs',
      };
      const publishedModule = publishedModules[source];
      if (publishedModule) {
        if (!isTextRendererOnlyExperimentImporter(importer, experimentRoot)) {
          return null;
        }
        if (publishedImportMode === 'cohort') {
          if (source.startsWith('grafana-experiment-data-')) {
            return resolve(experimentRoot, 'browserCohortData.ts');
          }
          if (source === 'grafana-experiment-runtime-config') {
            return resolve(experimentRoot, 'browserCohortRuntime.ts');
          }
          return resolve(experimentRoot, 'browserCohortUi.ts');
        }
        return resolve(repositoryRoot, publishedModule);
      }
      if (!isExactTextRendererImporter(importer, sourceRoot)) {
        return null;
      }
      if (source === '@grafana/ui') {
        return resolve(experimentRoot, 'uiViewOnly.tsx');
      }
      if (source === '@grafana/data') {
        return resolve(experimentRoot, 'dataViewOnly.ts');
      }
      if (source === 'app/core/config') {
        return resolve(experimentRoot, 'runtimeConfigViewOnly.ts');
      }
      return null;
    },
  };
}
