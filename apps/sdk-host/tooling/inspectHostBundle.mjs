import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const exactOnePrefixes = Object.freeze({
  featurePieChunks: 'assets/feature-piechart-',
  featureTextChunks: 'assets/feature-text-',
  hostReactChunks: 'assets/host-react-',
  providerImplementationChunks: 'assets/provider-implementation-',
  providerPieChartChunks: 'assets/provider-piechart-source-',
  providerPieChartDependencyChunks: 'assets/provider-piechart-dependencies-',
  providerReactDomWrappers: 'assets/provider-react-dom-external-',
  providerReactWrappers: 'assets/provider-react-external-',
});

const forbiddenSourcePatterns = Object.freeze([
  /GrafanaApp\.init\s*\(/,
  /\bSystem(?:JS)?\.import\s*\(/i,
  /\bsystemjs\b/i,
  /createElement\(\s*[`'"]iframe[`'"]\s*\)/i,
  /<iframe\b/i,
  /public\/app\/(?:routes|core\/navigation|core\/components\/AppChrome)/i,
]);

function filesWithPrefix(files, prefix) {
  return [...files.keys()].filter((fileName) => fileName.startsWith(prefix));
}

const moduleAnalysisCache = new Map();

function analyzeModuleSource(source) {
  const text = source ?? '';
  const cached = moduleAnalysisCache.get(text);
  if (cached) return cached;
  const staticImports = new Set();
  const dynamicImports = new Set();
  const reExports = new Set();
  const sourceFile = ts.createSourceFile(
    'bundle.js',
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS
  );
  for (const statement of sourceFile.statements) {
    if (ts.isImportDeclaration(statement) && ts.isStringLiteralLike(statement.moduleSpecifier)) {
      staticImports.add(statement.moduleSpecifier.text);
    } else if (
      ts.isExportDeclaration(statement) &&
      statement.moduleSpecifier &&
      ts.isStringLiteralLike(statement.moduleSpecifier)
    ) {
      reExports.add(statement.moduleSpecifier.text);
    }
  }
  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length >= 1 &&
      ts.isStringLiteralLike(node.arguments[0])
    ) {
      dynamicImports.add(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  const analysis = Object.freeze({
    dynamicImports,
    reExports,
    staticImports,
    valid: sourceFile.parseDiagnostics.length === 0,
  });
  moduleAnalysisCache.set(text, analysis);
  return analysis;
}

function chunkSpecifier(fileName) {
  return `./${path.basename(fileName)}`;
}

function hasDynamicImport(source, fileName) {
  return analyzeModuleSource(source).dynamicImports.has(chunkSpecifier(fileName));
}

function hasStaticImport(source, fileName) {
  return analyzeModuleSource(source).staticImports.has(chunkSpecifier(fileName));
}

function hasStaticReExport(source, fileName) {
  return analyzeModuleSource(source).reExports.has(chunkSpecifier(fileName));
}

function hasModuleReference(source, fileName) {
  return hasStaticImport(source, fileName) || hasDynamicImport(source, fileName) || hasStaticReExport(source, fileName);
}

function allModuleIds(evidence) {
  return [...new Set([
    ...(Array.isArray(evidence?.moduleIds) ? evidence.moduleIds : []),
    ...(Array.isArray(evidence?.chunks)
      ? evidence.chunks.flatMap((chunk) => Array.isArray(chunk.modules) ? chunk.modules : [])
      : []),
  ])];
}

function physicalPackageRoots(modules, packageName) {
  const roots = new Set();
  for (const moduleId of modules) {
    const normalized = moduleId.replaceAll('\\', '/');
    const marker = '/node_modules/';
    const packageMarker = `${marker}${packageName}/`;
    const index = normalized.lastIndexOf(packageMarker);
    if (index >= 0) roots.add(normalized.slice(0, index + packageMarker.length - 1));
  }
  return roots;
}

export function inspectHostBundleFiles(files, evidence) {
  const summary = {};
  let valid = true;
  for (const [name, prefix] of Object.entries(exactOnePrefixes)) {
    const matches = filesWithPrefix(files, prefix);
    summary[name] = matches.length;
    if (matches.length !== 1) valid = false;
  }

  const hostReactFile = filesWithPrefix(files, exactOnePrefixes.hostReactChunks)[0];
  const implementationFile = filesWithPrefix(
    files,
    exactOnePrefixes.providerImplementationChunks
  )[0];
  const textFile = filesWithPrefix(files, exactOnePrefixes.featureTextChunks)[0];
  for (const id of ['stat', 'timeseries', 'table', 'gauge', 'bargauge', 'piechart', 'barchart']) {
    const nativeFiles = filesWithPrefix(files, `assets/feature-${id}-`);
    if (nativeFiles.length !== 1 || nativeFiles.some(file => !hasDynamicImport(files.get(implementationFile), file))) valid = false;
  }
  const pieFeatureFile = filesWithPrefix(files, exactOnePrefixes.featurePieChunks)[0];
  const pieSourceFile = filesWithPrefix(files, exactOnePrefixes.providerPieChartChunks)[0];
  const pieDependenciesFile = filesWithPrefix(
    files,
    exactOnePrefixes.providerPieChartDependencyChunks
  )[0];
  const pieSources = [implementationFile, pieFeatureFile, pieSourceFile, pieDependenciesFile]
    .map((fileName) => files.get(fileName));
  if (
    !implementationFile ||
    !pieFeatureFile ||
    !pieSourceFile ||
    !pieDependenciesFile ||
    pieSources.some((source) => !analyzeModuleSource(source).valid) ||
    !hasStaticImport(files.get(pieFeatureFile), pieSourceFile) ||
    !hasStaticImport(files.get(pieSourceFile), pieDependenciesFile) ||
    hasStaticImport(files.get(implementationFile), pieFeatureFile) ||
    hasStaticReExport(files.get(implementationFile), pieFeatureFile) ||
    hasDynamicImport(files.get(pieFeatureFile), pieSourceFile) ||
    hasStaticReExport(files.get(pieFeatureFile), pieSourceFile) ||
    hasDynamicImport(files.get(pieSourceFile), pieDependenciesFile) ||
    hasStaticReExport(files.get(pieSourceFile), pieDependenciesFile) ||
    hasModuleReference(files.get(implementationFile), pieSourceFile) ||
    hasModuleReference(files.get(implementationFile), pieDependenciesFile) ||
    hasModuleReference(files.get(pieFeatureFile), implementationFile) ||
    hasModuleReference(files.get(pieFeatureFile), pieDependenciesFile) ||
    hasModuleReference(files.get(pieSourceFile), implementationFile) ||
    hasModuleReference(files.get(pieSourceFile), pieFeatureFile) ||
    hasModuleReference(files.get(pieDependenciesFile), implementationFile) ||
    hasModuleReference(files.get(pieDependenciesFile), pieFeatureFile) ||
    hasModuleReference(files.get(pieDependenciesFile), pieSourceFile)
  ) {
    valid = false;
  }
  const reactWrapperFile = filesWithPrefix(files, exactOnePrefixes.providerReactWrappers)[0];
  const reactDomWrapperFile = filesWithPrefix(
    files,
    exactOnePrefixes.providerReactDomWrappers
  )[0];
  const entryFile = [...files.keys()].find((name) => /^assets\/index-[^/]+\.js$/.test(name));

  if (
    !hostReactFile ||
    !implementationFile ||
    !textFile ||
    !reactWrapperFile ||
    !reactDomWrapperFile ||
    !entryFile ||
    !files.get(reactWrapperFile)?.includes(path.basename(hostReactFile)) ||
    !files.get(reactDomWrapperFile)?.includes(path.basename(hostReactFile)) ||
    !hasDynamicImport(files.get(entryFile), implementationFile) ||
    !hasDynamicImport(files.get(implementationFile), textFile)
  ) {
    valid = false;
  }

  const emittedSource = [...files.entries()]
    .filter(([fileName]) => fileName.endsWith('.js') || fileName.endsWith('.html'))
    .map(([, source]) => source)
    .join('\n');
  if (forbiddenSourcePatterns.some((pattern) => pattern.test(emittedSource))) valid = false;
  const queryRuntime = filesWithPrefix(files, 'assets/provider-query-runtime-');
  const testdataRuntime = filesWithPrefix(files, 'assets/feature-testdata-runtime-');
  const hasQueryRuntime = queryRuntime.length === 1 && testdataRuntime.length === 1 &&
    hasDynamicImport(files.get(implementationFile), queryRuntime[0]) &&
    hasDynamicImport(files.get(queryRuntime[0]), testdataRuntime[0]);
  for (const [fileName, source] of files) {
    if (/\/api\/ds\/query/i.test(source) &&
      !(hasQueryRuntime && (fileName === entryFile || fileName === implementationFile || /^assets\/provider-grafana-[^/]+\.js$/.test(fileName)))) valid = false;
  }

  const modules = allModuleIds(evidence);
  const reactRoots = physicalPackageRoots(modules, 'react');
  const reactDomRoots = physicalPackageRoots(modules, 'react-dom');
  summary.reactPhysicalRoots = reactRoots.size;
  summary.reactDomPhysicalRoots = reactDomRoots.size;
  const forbiddenModules = modules.filter((moduleId) =>
    /(?:\/querying\/(?:SceneQueryRunner|RuntimeDataSource)\.(?:m?js|tsx?)|\/services\/dataSourceSrv\.mjs|public\/app\/(?:routes|core\/navigation|core\/components\/AppChrome)|systemjs)/i.test(
      moduleId
    )
  );
  if (reactRoots.size !== 1 || reactDomRoots.size !== 1 || forbiddenModules.length > 0) {
    valid = false;
  }

  if (!valid) throw new Error('SDK host bundle boundary inspection failed.');
  return Object.freeze(summary);
}

async function readBundle(directory) {
  const output = new Map();
  const visit = async (current, prefix = '') => {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      const target = path.join(current, entry.name);
      if (entry.isDirectory()) await visit(target, relative);
      else output.set(relative, await readFile(target, 'utf8'));
    }
  };
  await visit(directory);
  return output;
}

const isCli = process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isCli) {
  const directory = path.resolve(
    process.argv[2] ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../artifacts/sdk/host')
  );
  const files = await readBundle(directory);
  const evidenceSource = files.get('evidence/bundle-evidence.json');
  const evidence = evidenceSource ? JSON.parse(evidenceSource) : undefined;
  console.log(JSON.stringify(inspectHostBundleFiles(files, evidence), null, 2));
}
