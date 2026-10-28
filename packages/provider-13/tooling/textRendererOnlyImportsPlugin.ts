import { resolve } from 'node:path';

import type { Plugin } from 'vite';

const VIRTUAL_PREFIX = '\0provider-13-pinned-grafana-source:text:';

function isRenderer(importer: string | undefined, sourceRoot: string): boolean {
  if (!importer) return false;
  const normalized = importer.replaceAll('\\', '/').split('?')[0] ?? importer;
  return (
    normalized === `${resolve(sourceRoot, 'v1/TextPanel.tsx').replaceAll('\\', '/')}` ||
    normalized === `${VIRTUAL_PREFIX}v1/TextPanel.tsx.js`
  );
}

function isViewOnlyShim(importer: string | undefined, providerRoot: string): boolean {
  if (!importer) return false;
  const normalized = importer.replaceAll('\\', '/').split('?')[0] ?? importer;
  const root = resolve(providerRoot, 'tooling/viewOnly').replaceAll('\\', '/');
  return normalized.startsWith(`${root}/`);
}

export function textRendererOnlyImportsPlugin(options: {
  readonly providerRoot: string;
  readonly sourceRoot: string;
}): Plugin {
  return {
    name: 'provider-13-text-renderer-only-imports',
    enforce: 'pre',
    resolveId(source, importer) {
      if (
        source === 'grafana-provider13-data-panel-plugin' &&
        importer?.replaceAll('\\', '/').split('?')[0]?.endsWith(
          '/packages/provider-13/src/panels/textPlugin.ts'
        )
      ) {
        return resolve(options.providerRoot, '../..', 'node_modules/@grafana/data/dist/esm/panel/PanelPlugin.mjs');
      }
      if (
        source === '@grafana/data' &&
        importer?.replaceAll('\\', '/').split('?')[0]?.endsWith(
          '/node_modules/@grafana/ui/dist/esm/themes/ThemeContext.mjs'
        )
      ) {
        return resolve(options.providerRoot, '../..', 'node_modules/@grafana/data/dist/esm/themes/context.mjs');
      }
      if (isViewOnlyShim(importer, options.providerRoot)) {
        const leafModules: Readonly<Record<string, string>> = {
          'grafana-provider13-data-markdown':
            'node_modules/@grafana/data/dist/esm/text/markdown.mjs',
          'grafana-provider13-data-sanitize':
            'node_modules/@grafana/data/dist/esm/text/sanitize.mjs',
          'grafana-provider13-runtime-config':
            'node_modules/@grafana/runtime/dist/esm/config.mjs',
          'grafana-provider13-ui-scroll-container':
            'node_modules/@grafana/ui/dist/esm/components/ScrollContainer/ScrollContainer.mjs',
          'grafana-provider13-ui-theme-context':
            'node_modules/@grafana/ui/dist/esm/themes/ThemeContext.mjs',
        };
        const leaf = leafModules[source];
        if (leaf) return resolve(options.providerRoot, '../..', leaf);
      }
      if (!isRenderer(importer, options.sourceRoot)) return null;
      if (source === '@grafana/data') return resolve(options.providerRoot, 'tooling/viewOnly/data.ts');
      if (source === '@grafana/ui') return resolve(options.providerRoot, 'tooling/viewOnly/ui.tsx');
      if (source === 'app/core/config') {
        return resolve(options.providerRoot, 'tooling/viewOnly/runtimeConfig.ts');
      }
      return null;
    },
  };
}
