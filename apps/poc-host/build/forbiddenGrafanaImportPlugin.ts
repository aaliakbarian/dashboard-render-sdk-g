import type { Plugin } from 'vite';

export interface ForbiddenGrafanaImport {
  category:
    | 'application-entrypoint'
    | 'application-navigation-chrome'
    | 'application-routing'
    | 'arbitrary-systemjs'
    | 'dashboard-edit-shell'
    | 'general-plugin-loader'
    | 'grafana-application-source-outside-bridge'
    | 'grafana-internal-outside-bridge';
  id: string;
  importer?: string;
  reason: string;
}

export interface ForbiddenGrafanaImportOptions {
  repositoryRoot?: string;
  reportFile?: string;
  sourceBridgeFiles?: string[];
  sourceBridgeRoots?: string[];
  testDataRuntimeExperimentRoot?: string;
  textRendererExperimentRoot?: string;
}

function normalizeModuleId(id: string): string {
  const normalized = id.replace(/^\0+/, '').replaceAll('\\', '/').split('?')[0] ?? id;
  const virtualPrefix = 'poc-pinned-grafana-source:';
  if (process.env.GRAFANA_SOURCE_DIR && normalized.startsWith(virtualPrefix)) {
    const sourceRoot = process.env.GRAFANA_SOURCE_DIR.replaceAll('\\', '/').replace(/\/$/, '');
    const virtualSource = normalized.slice(virtualPrefix.length);
    const separator = virtualSource.indexOf(':');
    const namespace = separator >= 0 ? virtualSource.slice(0, separator) : 'testdata';
    const relativeSource = (separator >= 0 ? virtualSource.slice(separator + 1) : virtualSource).replace(/\.js$/, '');
    const auditedRoot =
      namespace === 'text-baseline' || namespace === 'text-renderer-only'
        ? 'public/app/plugins/panel/text'
        : namespace === 'stat'
        ? 'public/app/plugins/panel/stat'
        : namespace === 'timeseries'
          ? 'public/app/plugins/panel/timeseries'
        : 'public/app/plugins/datasource/grafana-testdata-datasource';
    return `${sourceRoot}/${auditedRoot}/${relativeSource}`;
  }
  return normalized;
}

function evidenceModuleId(id: string, repositoryRoot: string): string {
  const normalized = normalizeModuleId(id);
  const normalizedRoot = normalizeModuleId(repositoryRoot).replace(/\/$/, '');
  if (process.env.GRAFANA_SOURCE_DIR) {
    const sourceRoot = normalizeModuleId(process.env.GRAFANA_SOURCE_DIR).replace(/\/$/, '');
    if (normalized.startsWith(`${sourceRoot}/`)) {
      return `<grafana-source>/${normalized.slice(sourceRoot.length + 1)}`;
    }
  }
  if (normalized.startsWith(`${normalizedRoot}/`)) {
    return `<repo>/${normalized.slice(normalizedRoot.length + 1)}`;
  }
  return normalized;
}

function isInsideAllowedSourceBoundary(importer: string | undefined, roots: readonly string[]): boolean {
  if (!importer) {
    return false;
  }
  const normalizedImporter = normalizeModuleId(importer);
  return roots.some((root) => {
    const normalizedRoot = normalizeModuleId(root).replace(/\/$/, '');
    return (
      normalizedImporter === normalizedRoot ||
      normalizedImporter.startsWith(`${normalizedRoot}/`) ||
      normalizedImporter.endsWith(normalizedRoot) ||
      normalizedImporter.includes(`${normalizedRoot}/`)
    );
  });
}

function isInsideExactSourceBoundary(importer: string | undefined, root: string | undefined): boolean {
  if (!importer || !root) {
    return false;
  }
  const normalizedImporter = normalizeModuleId(importer);
  const normalizedRoot = normalizeModuleId(root).replace(/\/$/, '');
  return normalizedImporter === normalizedRoot || normalizedImporter.startsWith(`${normalizedRoot}/`);
}

function isBridgeModule(id: string | undefined): boolean {
  return isInsideAllowedSourceBoundary(id, ['/packages/poc-grafana-bridge/']);
}

function isReviewedSource(
  id: string | undefined,
  roots: readonly string[],
  files: readonly string[]
): boolean {
  if (!id) {
    return false;
  }
  const normalizedId = normalizeModuleId(id);
  return (
    isInsideAllowedSourceBoundary(normalizedId, roots) ||
    files.some((file) => normalizedId === normalizeModuleId(file))
  );
}

function isPublishedFaroSuiteInternalImport(source: string, importer: string | undefined): boolean {
  return (
    /^@grafana\/faro-[^/]+\/internal(?:\/|$)/.test(source) &&
    importer !== undefined &&
    /\/node_modules\/@grafana\/faro-[^/]+\//.test(normalizeModuleId(importer))
  );
}

export function isReviewedDormantRuntimeSystemImport(code: string, id: string): boolean {
  const normalizedId = normalizeModuleId(id);
  const isPublishedUtility =
    /\/node_modules\/@grafana\/runtime\/dist\/esm\/utils\/plugin\.mjs$/.test(normalizedId);
  const isRuntimeOptimizerChunk =
    /\/apps\/poc-host\/node_modules\/\.vite\/deps\/esm-[^/]+\.js$/.test(normalizedId) &&
    code.includes('pluginImportUtils should only be set once, when Grafana is starting.');
  if (!isPublishedUtility && !isRuntimeOptimizerChunk) {
    return false;
  }
  const systemImports = code.match(/\b(?:window\s*\.\s*)?System\s*\.\s*import\s*\(/g) ?? [];
  return systemImports.length === 1 && /return\s+window\.System\.import\(cssPath\)\s*;/.test(code);
}

export function classifyForbiddenGrafanaImport(
  source: string,
  importer?: string,
  options: ForbiddenGrafanaImportOptions = {}
): ForbiddenGrafanaImport | undefined {
  const id = normalizeModuleId(source);
  const roots = options.sourceBridgeRoots ?? [];
  const files = options.sourceBridgeFiles ?? [];
  const violation = (
    category: ForbiddenGrafanaImport['category'],
    reason: string
  ): ForbiddenGrafanaImport => ({ category, id, ...(importer ? { importer } : {}), reason });

  if (
    (id === 'grafana-poc-text-panel' ||
      id === 'grafana-poc-stat-panel' ||
      id === 'grafana-poc-timeseries-panel' ||
      id === 'grafana-poc-testdata-datasource') &&
    !isInsideAllowedSourceBoundary(importer, ['/packages/poc-grafana-bridge/'])
  ) {
    return violation(
      'grafana-application-source-outside-bridge',
      'Audited Grafana source aliases may only be imported from the POC Grafana source bridge.'
    );
  }

  if (
    (id === 'grafana-experiment-testdata-runtime-source' ||
      id === 'grafana-experiment-testdata-runtime-provider') &&
    !isInsideExactSourceBoundary(importer, options.testDataRuntimeExperimentRoot)
  ) {
    return violation(
      'grafana-application-source-outside-bridge',
      'Experimental TestData runtime-only aliases may only be imported from the bounded experiment.'
    );
  }

  if (
    (id === 'grafana-experiment-text-renderer' ||
      id === 'grafana-experiment-data-markdown' ||
      id === 'grafana-experiment-data-panel-plugin' ||
      id === 'grafana-experiment-data-sanitize' ||
      id === 'grafana-experiment-runtime-config' ||
      id === 'grafana-experiment-ui-scroll-container' ||
      id === 'grafana-experiment-ui-theme-context') &&
    !isInsideExactSourceBoundary(importer, options.textRendererExperimentRoot)
  ) {
    return violation(
      'grafana-application-source-outside-bridge',
      'Experimental Text renderer aliases may only be imported from the bounded experiment.'
    );
  }

  if (/(?:^|\/)public\/app\/app(?:\.[cm]?[jt]sx?)?$/i.test(id)) {
    return violation('application-entrypoint', 'Grafana application entrypoint is forbidden.');
  }
  if (/(?:^|\/)public\/app\/(?:routes|core\/navigation)(?:\/|$)/i.test(id)) {
    return violation('application-routing', 'Grafana route registration and navigation state are forbidden.');
  }
  if (
    /(?:^|\/)public\/app\/core\/components\/(?:AppChrome|NavBar|MegaMenu|TopNav)(?:\/|$)/i.test(
      id
    )
  ) {
    return violation('application-navigation-chrome', 'Grafana navigation and application chrome are forbidden.');
  }
  if (
    /(?:^|\/)public\/app\/features\/(?:dashboard\/components\/(?:PanelEditor|DashboardSettings|DashNav)|dashboard-scene\/(?:settings|scene\/(?:DashboardScene|SceneEditPanel)))(?:\/|\.|$)/i.test(
      id
    )
  ) {
    return violation('dashboard-edit-shell', 'Grafana dashboard editing and shell modules are forbidden.');
  }
  if (
    /(?:^|\/)public\/app\/features\/plugins\/(?:builtInPlugins|importPanelPlugin|plugin_loader)(?:\/|\.|$)/i.test(
      id
    )
  ) {
    return violation('general-plugin-loader', 'Grafana general plugin loading is outside the fixed POC catalogue.');
  }
  if (/(?:^|\/)systemjs(?:\/|$)|^systemjs$/i.test(id)) {
    return violation('arbitrary-systemjs', 'Arbitrary SystemJS plugin loading is forbidden.');
  }
  if (
    /^@grafana\/[^/]+\/internal(?:\/|$)/.test(id) &&
    !isPublishedFaroSuiteInternalImport(id, importer) &&
    !isReviewedSource(importer, roots, files)
  ) {
    return violation(
      'grafana-internal-outside-bridge',
      'Grafana internal exports may only be evaluated inside the audited source bridge.'
    );
  }
  if (/(?:^|\/)public\/app\//i.test(id)) {
    const sourceIsReviewed = isReviewedSource(id, roots, files);
    const importerIsReviewed = isReviewedSource(importer, roots, files);
    const admittedResolution =
      sourceIsReviewed && (!importer || importerIsReviewed || isBridgeModule(importer));
    if (!admittedResolution) {
      return violation(
        'grafana-application-source-outside-bridge',
        'Grafana application source may only be imported by the audited source bridge.'
      );
    }
  }
  return undefined;
}

export function forbiddenGrafanaImportPlugin(
  options: ForbiddenGrafanaImportOptions = {}
): Plugin {
  const repositoryRoot = options.repositoryRoot ?? process.cwd();
  const sourceBridgeRoots = [
    ...(options.sourceBridgeRoots ?? []),
  ];
  const sourceBridgeFiles = [...(options.sourceBridgeFiles ?? [])];
  const inspectedModuleIds = new Set<string>();
  const reviewedExemptions = new Set<string>();
  const violations = new Map<string, ForbiddenGrafanaImport>();
  const inspect = (source: string, importer?: string) => {
    inspectedModuleIds.add(normalizeModuleId(source));
    const finding = classifyForbiddenGrafanaImport(source, importer, {
      sourceBridgeFiles,
      sourceBridgeRoots,
      testDataRuntimeExperimentRoot: options.testDataRuntimeExperimentRoot,
      textRendererExperimentRoot: options.textRendererExperimentRoot,
    });
    if (finding) {
      violations.set(`${finding.category}:${finding.id}:${finding.importer ?? ''}`, finding);
    }
    return finding;
  };

  return {
    name: 'poc-forbidden-grafana-imports',
    enforce: 'pre',
    buildStart() {
      inspectedModuleIds.clear();
      reviewedExemptions.clear();
      violations.clear();
    },
    resolveId(source, importer) {
      const finding = inspect(source, importer);
      if (finding) {
        this.error(`${finding.category}: ${finding.id} (${finding.reason})`);
      }
      return null;
    },
    moduleParsed(moduleInfo) {
      const moduleFinding = inspect(moduleInfo.id, moduleInfo.id);
      if (moduleFinding) {
        this.error(
          `${moduleFinding.category}: ${moduleFinding.id} imported by ${moduleFinding.importer ?? '<entry>'} (${moduleFinding.reason})`
        );
      }
      for (const importedId of [...moduleInfo.importedIds, ...moduleInfo.dynamicallyImportedIds]) {
        const finding = inspect(importedId, moduleInfo.id);
        if (finding) {
          this.error(
            `${finding.category}: ${finding.id} imported by ${finding.importer ?? '<entry>'} (${finding.reason})`
          );
        }
      }
    },
    transform(code, id) {
      if (/\bGrafanaApp\s*\.\s*init\s*\(/.test(code)) {
        const finding: ForbiddenGrafanaImport = {
          category: 'application-entrypoint',
          id: normalizeModuleId(id),
          reason: 'GrafanaApp.init call is forbidden.',
        };
        violations.set(`grafana-app-init:${id}`, finding);
        this.error(`${finding.category}: ${finding.id} (${finding.reason})`);
      }
      if (/\bSystem\s*\.\s*import\s*\(/.test(code)) {
        if (isReviewedDormantRuntimeSystemImport(code, id)) {
          reviewedExemptions.add(normalizeModuleId(id));
          return null;
        }
        const finding: ForbiddenGrafanaImport = {
          category: 'arbitrary-systemjs',
          id: normalizeModuleId(id),
          reason: 'System.import fallback is forbidden.',
        };
        violations.set(`system-import:${id}`, finding);
        this.error(`${finding.category}: ${finding.id} (${finding.reason})`);
      }
      return null;
    },
    buildEnd(error) {
      if (!error && violations.size > 0) {
        const details = [...violations.values()]
          .map((finding) => `${finding.category}: ${finding.id} (${finding.reason})`)
          .join('\n');
        this.error(`Forbidden Grafana dependency boundary crossed:\n${details}`);
      }
    },
    generateBundle() {
      const evidenceViolations = [...violations.values()].map((violation) => ({
        ...violation,
        id: evidenceModuleId(violation.id, repositoryRoot),
        ...(violation.importer
          ? { importer: evidenceModuleId(violation.importer, repositoryRoot) }
          : {}),
      }));
      this.emitFile({
        fileName: options.reportFile ?? 'evidence/forbidden-import-report.json',
        source: `${JSON.stringify(
          {
            inspectedModuleIds: [...inspectedModuleIds]
              .map((id) => evidenceModuleId(id, repositoryRoot))
              .sort(),
            policyVersion: 1,
            reviewedExemptions: [...reviewedExemptions]
              .map((id) => evidenceModuleId(id, repositoryRoot))
              .sort(),
            violations: evidenceViolations,
          },
          null,
          2
        )}\n`,
        type: 'asset',
      });
    },
  };
}
