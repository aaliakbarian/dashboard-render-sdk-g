import type { Plugin } from 'vite';

export interface Provider13ForbiddenImport {
  readonly category: string;
  readonly source: string;
}

const allowedApplicationSources = [
  'public/app/plugins/panel/text/panelcfg.gen.ts',
  'public/app/plugins/panel/text/v1/TextPanel.tsx',
] as const;

function normalizedApplicationSource(source: string): string | undefined {
  const normalized = source.replace(/^\0+/, '').replaceAll('\\', '/').split('?')[0] ?? source;
  const virtualPrefix = 'provider-13-pinned-grafana-source:text:';
  if (normalized.startsWith(virtualPrefix)) {
    return `public/app/plugins/panel/text/${normalized.slice(virtualPrefix.length).replace(/\.js$/, '')}`;
  }
  const marker = '/public/app/';
  const index = normalized.indexOf(marker);
  if (index >= 0) return normalized.slice(index + 1);
  return normalized.startsWith('public/app/') ? normalized : undefined;
}

function isAuditedNonUiEditorRegistry(source: string): boolean {
  return (
    source === '../field/standardFieldConfigEditorRegistry.mjs' ||
    source === './standardFieldConfigEditorRegistry.mjs' ||
    source === '@grafana/data/dist/esm/field/standardFieldConfigEditorRegistry.mjs' ||
    /\/node_modules\/@grafana\/data\/dist\/esm\/field\/standardFieldConfigEditorRegistry\.mjs$/.test(
      source
    )
  );
}

export function classifyProvider13ForbiddenImport(
  source: string,
  transformedCode?: string
): Provider13ForbiddenImport | undefined {
  const normalized = source.replaceAll('\\', '/');
  const applicationSource = normalizedApplicationSource(normalized);
  if (
    applicationSource &&
    !(allowedApplicationSources as readonly string[]).includes(applicationSource)
  ) {
    return { category: 'unallowlisted-grafana-application-source', source };
  }
  if (/^(?:app)(?:\/|$)/.test(normalized)) {
    return { category: 'broad-grafana-application-alias', source };
  }
  if (
    !isAuditedNonUiEditorRegistry(normalized) &&
    /(?:monaco-editor|@monaco-editor|\/Monaco\/|codicon|@codemirror|react-codemirror|(?:^|\/)[^/]*editor[^/]*(?:\/|$))/i.test(
      normalized
    )
  ) {
    return { category: 'editor-module', source };
  }
  if (/(?:^|\/)systemjs(?:\/|$)/i.test(normalized)) {
    return { category: 'arbitrary-systemjs', source };
  }
  if (/^@grafana\/[^/]+\/internal(?:\/|$)/.test(normalized)) {
    return { category: 'grafana-internal', source };
  }
  if (/\bGrafanaApp\s*\.\s*init\s*\(/.test(transformedCode ?? '')) {
    return { category: 'grafana-app-init', source };
  }
  if (/\bSystem\s*\.\s*import\s*\(/.test(transformedCode ?? '')) {
    return { category: 'arbitrary-systemjs', source };
  }
  return undefined;
}

export function forbiddenGrafanaImportPlugin(): Plugin {
  const inspect = (source: string, code?: string, importer?: string) => {
    const finding = classifyProvider13ForbiddenImport(source, code);
    if (finding) {
      throw new Error(
        `Provider-13 bundle boundary: ${finding.category}: ${source}` +
          (importer ? ` imported by ${importer}` : '')
      );
    }
  };
  return {
    name: 'provider-13-forbidden-grafana-imports',
    enforce: 'pre',
    resolveId(source, importer) {
      inspect(source, undefined, importer);
      return null;
    },
    moduleParsed(moduleInfo) {
      inspect(moduleInfo.id);
      for (const imported of [...moduleInfo.importedIds, ...moduleInfo.dynamicallyImportedIds]) {
        inspect(imported);
      }
    },
    transform(code, id) {
      inspect(id, code);
      return null;
    },
  };
}
