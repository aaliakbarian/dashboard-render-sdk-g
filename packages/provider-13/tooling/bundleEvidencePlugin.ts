import { gzipSync } from 'node:zlib';

import type { Plugin, Rolldown } from 'vite';

import { GRAFANA_13_APPLICATION_SOURCES, GRAFANA_13_TESTDATA_SOURCES, GRAFANA_13_NATIVE_SOURCES } from './sourceIdentity.ts';
import { inspectNativeUiProvenance } from './nativeUiProvenance.mjs';

export interface ProviderBundleChunkEvidence {
  readonly dynamicImports: readonly string[];
  readonly fileName: string;
  readonly gzipSize: number;
  readonly imports: readonly string[];
  readonly isEntry: boolean;
  readonly modules: readonly string[];
  readonly rawSize: number;
}

export interface ProviderBundleEvidence {
  readonly assets: readonly { readonly fileName: string; readonly rawSize: number }[];
  readonly chunks: readonly ProviderBundleChunkEvidence[];
  readonly moduleIds: readonly string[];
}

interface EmittedBrowserChunk {
  readonly code: string;
  readonly fileName: string;
}

const reactRuntimeRequest = String.raw`react(?:-dom)?(?:\/(?:client|server|jsx-runtime|jsx-dev-runtime))?`;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Rolldown export `i` is its browser-time CommonJS external loader. A provider
 * chunk that calls that loader for React bypasses the explicit ESM externals
 * and fails in browsers where `require` is intentionally absent.
 */
export function assertNoBrowserReactRuntimeRequires(chunks: readonly EmittedBrowserChunk[]): void {
  for (const chunk of chunks) {
    if (/(?:^|\/)rolldown-runtime-[^/]+\.js$/.test(chunk.fileName)) continue;

    const loaderAliases: string[] = [];
    for (const match of chunk.code.matchAll(
      /import\s*\{([^}]*)\}\s*from\s*["'][^"']*rolldown-runtime[^"']*["']/g
    )) {
      for (const specifier of (match[1] ?? '').split(',')) {
        const loader = specifier.trim().match(/^i(?:\s+as\s+([A-Za-z_$][\w$]*))?$/);
        if (loader) loaderAliases.push(loader[1] ?? 'i');
      }
    }

    const callsRuntimeLoader = loaderAliases.some((alias) =>
      new RegExp(
        `(?:^|[^\\w$])${escapeRegExp(alias)}\\s*\\(\\s*(?:["']${reactRuntimeRequest}["']|\`${reactRuntimeRequest}\`)`
      ).test(chunk.code)
    );
    const callsGlobalRequire = new RegExp(
      `(?:^|[^\\w$])require\\s*\\(\\s*(?:["']${reactRuntimeRequest}["']|\`${reactRuntimeRequest}\`)`
    ).test(chunk.code);

    if (callsRuntimeLoader || callsGlobalRequire) {
      throw new Error(
        `Provider chunk ${chunk.fileName} contains a browser-time React require instead of an external ESM import.`
      );
    }
  }
}

function allModules(report: ProviderBundleEvidence): string[] {
  return [...new Set([...report.moduleIds, ...report.chunks.flatMap((chunk) => chunk.modules)])];
}

const cohortPackages = new Set([
  '@emotion/css',
  '@emotion/react',
  '@grafana/data',
  '@grafana/e2e-selectors',
  '@grafana/i18n',
  '@grafana/runtime',
  '@grafana/scenes',
  '@grafana/schema',
  '@grafana/ui',
  '@visx/bounds',
  '@visx/curve',
  '@visx/event',
  '@visx/gradient',
  '@visx/group',
  '@visx/point',
  '@visx/scale',
  '@visx/shape',
  '@visx/tooltip',
  '@visx/vendor',
  'rxjs',
  'uplot',
]);

function cohortPackageOwner(moduleId: string) {
  const normalized = moduleId.replaceAll('\\', '/');
  const marker = '/node_modules/';
  const index = normalized.lastIndexOf(marker);
  if (index < 0) return undefined;
  const packagePath = normalized.slice(index + marker.length).split('/');
  const packageName = packagePath[0]?.startsWith('@')
    ? `${packagePath[0]}/${packagePath[1] ?? ''}`
    : packagePath[0];
  if (!packageName || !cohortPackages.has(packageName)) return undefined;
  return {
    packageName,
    physicalRoot: normalized.slice(0, index + marker.length) + packageName,
  };
}

export function inspectProviderBundleEvidence(report: ProviderBundleEvidence) {
  const modules = allModules(report);
  const applicationSources = modules
    .filter((id) => id.startsWith('<grafana-source>/public/app/'))
    .map((id) => id.slice('<grafana-source>/'.length))
    .sort();
  const hasQuerySource = applicationSources.some(id => id.includes('/datasource/'));
  const hasNativeSource = applicationSources.some(id => /\/panel\/(?:stat|timeseries|gauge|bargauge|piechart|barchart)\//.test(id));
  const nativeUiProvenance = inspectNativeUiProvenance(report);
  const nativeUiSources = nativeUiProvenance.loadedSources.map(id => id.slice('<grafana-source>/'.length));
  const expectedSources = [...GRAFANA_13_APPLICATION_SOURCES, ...(hasQuerySource ? GRAFANA_13_TESTDATA_SOURCES : []), ...(hasNativeSource ? GRAFANA_13_NATIVE_SOURCES : [])].sort();
  const byFile = new Map(report.chunks.map(chunk => [chunk.fileName, chunk]));
  const textClosure = new Set<string>();
  const visit = (file: string) => {
    if (textClosure.has(file)) return;
    textClosure.add(file);
    for (const imported of byFile.get(file)?.imports ?? []) visit(imported);
  };
  for (const chunk of report.chunks) {
    if (chunk.modules.some(id => /\/src\/(?:runtime\/cohort\.ts|panels\/textPlugin\.ts)$/.test(id) ||
        /\/node_modules\/@grafana\/(?:data|runtime|scenes|ui)\/dist\/esm\/index\.(?:m?js)$/.test(id))) visit(chunk.fileName);
  }
  const eagerQuerySources = report.chunks.filter(chunk => textClosure.has(chunk.fileName)).flatMap(chunk => chunk.modules)
    .filter(id => id.includes('<grafana-source>/public/app/plugins/datasource/') || /\/src\/(?:datasource\/|query\/|runtime\/installQueryRuntime\.ts)/.test(id));
  const eagerNativeModules = report.chunks.filter(chunk => textClosure.has(chunk.fileName)).flatMap(chunk => chunk.modules)
    .filter(id => /<grafana-source>\/packages\/grafana-ui\/|\/node_modules\/(?:uplot\/|@grafana\/ui\/dist\/esm\/components\/(?:BigValue|BarGauge|Sparkline|uPlot)\/)/.test(id));
  const bundledImplementations = {
    jsxDevRuntime: modules.filter((id) => /node_modules\/react\/(?:cjs\/)?react-jsx-dev-runtime/.test(id)).length,
    jsxRuntime: modules.filter((id) => /node_modules\/react\/(?:cjs\/)?react-jsx-runtime/.test(id)).length,
    react: modules.filter((id) => /node_modules\/react\//.test(id)).length,
    reactDom: modules.filter((id) => /node_modules\/react-dom\//.test(id)).length,
  };
  const forbidden = modules.filter((id) =>
    !/\/node_modules\/@grafana\/data\/dist\/esm\/field\/standardFieldConfigEditorRegistry\.mjs$/.test(
      id
    ) &&
    /(?:monaco|codicon|systemjs|(?:^|\/)[^/]*editor[^/]*(?:\/|$)|public\/app\/(?:routes|core\/navigation|core\/components\/AppChrome))/i.test(id)
  );
  const executableQueryModules = modules.filter((id) =>
    (!hasNativeSource && /\/querying\/(?:SceneQueryRunner|RuntimeDataSource)\.(?:m?js)$/.test(id)) ||
    (!hasQuerySource && /\/services\/dataSourceSrv\.mjs$/.test(id))
  );
  const nativeFeatures = ['stat', 'timeseries', 'gauge', 'bargauge', 'piechart', 'barchart'];
  const auditedCrossFeatureSources = new Set([
    '<grafana-source>/public/app/plugins/panel/timeseries/TimeSeriesTooltip.tsx',
    '<grafana-source>/public/app/plugins/panel/timeseries/utils.ts',
  ]);
  const featureClosures = Object.fromEntries(nativeFeatures.map(feature => {
    const files = new Set<string>();
    const visitFeature = (file: string) => {
      if (files.has(file)) return;
      files.add(file);
      for (const imported of byFile.get(file)?.imports ?? []) visitFeature(imported);
    };
    for (const chunk of report.chunks) if (chunk.modules.some(id => id.includes(`/panel/${feature}/`))) visitFeature(chunk.fileName);
    return [feature, [...files].flatMap(file => byFile.get(file)?.modules ?? [])];
  }));
  const crossedFeatureSources = nativeFeatures.flatMap(feature => (featureClosures[feature] ?? []).filter(id =>
    nativeFeatures.some(other => other !== feature && id.includes(`/panel/${other}/`)) &&
    !(feature === 'barchart' && auditedCrossFeatureSources.has(id))));
  const inertEntryGrafanaModules = report.chunks
    .filter((chunk) => chunk.isEntry)
    .flatMap((chunk) => chunk.modules)
    .filter((id) => /(?:\/node_modules\/@grafana\/|<grafana-source>\/)/.test(id));
  const inertEntryDeferredModules = report.chunks
    .filter((chunk) => chunk.isEntry)
    .flatMap((chunk) => chunk.modules)
    .filter((id) =>
      /<repo>\/packages\/provider-13\/src\/(?:panels\/catalog|runtime\/|scenes\/)\b/.test(id)
    );
  const misplacedTslibOwners = report.chunks
    .filter((chunk) =>
      chunk.modules.some((id) => /<repo>\/node_modules\/tslib\//.test(id)) &&
      !/(?:^|\/)provider-tslib-[^/]+\.js$/.test(chunk.fileName)
    )
    .map((chunk) => chunk.fileName);
  const misplacedUuidOwners = report.chunks
    .filter((chunk) =>
      chunk.modules.some((id) => /<repo>\/node_modules\/uuid\//.test(id)) &&
      !/(?:^|\/)provider-uuid-[^/]+\.js$/.test(chunk.fileName)
    )
    .map((chunk) => chunk.fileName);
  const misplacedScenesDependencyOwners = report.chunks
    .filter((chunk) =>
      chunk.modules.some((id) =>
        /<repo>\/node_modules\/(?:clsx|fast-equals|prop-types|react-draggable|react-grid-layout|react-resizable|react-use|resize-observer-polyfill)\//.test(
          id
        )
      ) && !/(?:^|\/)provider-scenes-dependencies-[^/]+\.js$/.test(chunk.fileName)
    )
    .map((chunk) => chunk.fileName);
  const cyclicReactDomExternalWrappers = report.chunks
    .filter(
      (chunk) =>
        chunk.modules.includes('builtin:esm-external-require-react-dom') &&
        chunk.imports.some((dependency) => /provider-scenes/.test(dependency))
    )
    .map((chunk) => chunk.fileName);
  const owners = new Map<string, string[]>();
  for (const chunk of report.chunks) {
    for (const moduleId of chunk.modules) {
      owners.set(moduleId, [...(owners.get(moduleId) ?? []), chunk.fileName]);
    }
  }
  const duplicateCohortOwners = [...owners]
    .filter(([moduleId, chunkOwners]) =>
      /\/node_modules\/(?:@grafana\/|@emotion\/|@visx\/|rxjs\/|uplot\/)/.test(moduleId) &&
      new Set(chunkOwners).size > 1
    )
    .map(([moduleId]) => moduleId);
  const physicalOwners = new Map<string, Set<string>>();
  for (const moduleId of modules) {
    const owner = cohortPackageOwner(moduleId);
    if (!owner) continue;
    const roots = physicalOwners.get(owner.packageName) ?? new Set<string>();
    roots.add(owner.physicalRoot);
    physicalOwners.set(owner.packageName, roots);
  }
  for (const [packageName, roots] of physicalOwners) {
    if (roots.size > 1) duplicateCohortOwners.push(packageName);
  }
  if (
    applicationSources.join('\n') !== expectedSources.join('\n') ||
    eagerQuerySources.length > 0 ||
    eagerNativeModules.length > 0 ||
    Object.values(bundledImplementations).some((count) => count !== 0) ||
    forbidden.length > 0 ||
    executableQueryModules.length > 0 ||
    inertEntryGrafanaModules.length > 0 ||
    inertEntryDeferredModules.length > 0 ||
    misplacedTslibOwners.length > 0 ||
    misplacedUuidOwners.length > 0 ||
    misplacedScenesDependencyOwners.length > 0 ||
    cyclicReactDomExternalWrappers.length > 0 ||
    duplicateCohortOwners.length > 0
    || crossedFeatureSources.length > 0
  ) {
    throw new Error(`Provider bundle boundary evidence did not match the exact audited closure. ${JSON.stringify({
      applicationSources,
      expectedSources,
      eagerQuerySources,
      eagerNativeModules,
      forbidden,
      executableQueryModules,
      crossedFeatureSources,
      duplicateCohortOwners,
      inertEntryGrafanaModules,
      inertEntryDeferredModules,
      misplacedTslibOwners,
      misplacedUuidOwners,
      misplacedScenesDependencyOwners,
      cyclicReactDomExternalWrappers,
    })}`);
  }
  return Object.freeze({
    applicationSources,
    nativeUiSources,
    nativeUiProvenance,
    crossedFeatureSources,
    eagerQuerySources,
    eagerNativeModules,
    bundledImplementations,
    duplicateCohortOwners,
    executableQueryModules,
    forbiddenModules: forbidden,
    inertEntryDeferredModules,
    inertEntryGrafanaModules,
    misplacedTslibOwners,
    misplacedUuidOwners,
    misplacedScenesDependencyOwners,
    cyclicReactDomExternalWrappers,
  });
}

function evidenceId(id: string, repositoryRoot: string, grafanaSourceRoot: string): string {
  const normalized = id.replace(/^\0+/, '').replaceAll('\\', '/');
  const repository = repositoryRoot.replaceAll('\\', '/').replace(/\/$/, '');
  const grafana = grafanaSourceRoot.replaceAll('\\', '/').replace(/\/$/, '');
  const virtualPrefix = 'provider-13-pinned-grafana-source:text:';
  const queryPrefix = 'provider-13-pinned-grafana-source:testdata:';
  const nativePrefix = 'provider-13-pinned-grafana-source:native:';
  if (normalized.startsWith(nativePrefix)) return `<grafana-source>/${normalized.slice(nativePrefix.length).replace(/\.js$/, '')}`;
  if (normalized.startsWith(queryPrefix)) {
    return `<grafana-source>/public/app/plugins/datasource/grafana-testdata-datasource/${normalized.slice(queryPrefix.length).replace(/\.js$/, '')}`;
  }
  if (normalized.startsWith(virtualPrefix)) {
    return `<grafana-source>/public/app/plugins/panel/text/${normalized
      .slice(virtualPrefix.length)
      .replace(/\.js$/, '')}`;
  }
  if (normalized.startsWith(`${grafana}/`)) return `<grafana-source>/${normalized.slice(grafana.length + 1)}`;
  if (normalized.startsWith(`${repository}/`)) return `<repo>/${normalized.slice(repository.length + 1)}`;
  return normalized;
}

export function bundleEvidencePlugin(options: {
  readonly grafanaSourceRoot: string;
  readonly repositoryRoot: string;
}): Plugin {
  return {
    name: 'provider-13-bundle-evidence',
    generateBundle(_outputOptions, bundle) {
      const outputChunks = Object.values(bundle).filter(
        (entry): entry is Rolldown.OutputChunk => entry.type === 'chunk'
      );
      assertNoBrowserReactRuntimeRequires(outputChunks);
      const chunks = outputChunks
        .map((chunk) => ({
          dynamicImports: [...chunk.dynamicImports].sort(),
          fileName: chunk.fileName,
          gzipSize: gzipSync(Buffer.from(chunk.code)).byteLength,
          imports: [...chunk.imports].sort(),
          isEntry: chunk.isEntry,
          modules: Object.keys(chunk.modules)
            .map((id) => evidenceId(id, options.repositoryRoot, options.grafanaSourceRoot))
            .sort(),
          rawSize: Buffer.byteLength(chunk.code),
        }))
        .sort((left, right) => left.fileName.localeCompare(right.fileName));
      const assets = Object.values(bundle)
        .filter((entry): entry is Rolldown.OutputAsset => entry.type === 'asset')
        .map((asset) => ({
          fileName: asset.fileName,
          rawSize: typeof asset.source === 'string' ? Buffer.byteLength(asset.source) : asset.source.byteLength,
        }))
        .sort((left, right) => left.fileName.localeCompare(right.fileName));
      const report: ProviderBundleEvidence = {
        assets,
        chunks,
        moduleIds: [...this.getModuleIds()]
          .map((id) => evidenceId(id, options.repositoryRoot, options.grafanaSourceRoot))
          .sort(),
      };
      inspectProviderBundleEvidence(report);
      this.emitFile({
        fileName: 'evidence/bundle-evidence.json',
        source: `${JSON.stringify(report, null, 2)}\n`,
        type: 'asset',
      });
    },
  };
}
