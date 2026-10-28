import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const exactOnePrefixes = Object.freeze({
  featureTextChunks: 'assets/feature-text-',
  hostReactChunks: 'assets/host-react-',
  providerImplementationChunks: 'assets/provider-implementation-',
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
  /feature-(?:table|gauge|bargauge|piechart|barchart)-/i,
]);

function filesWithPrefix(files, prefix) {
  return [...files.keys()].filter((fileName) => fileName.startsWith(prefix));
}

function hasDynamicImport(source, fileName) {
  const escaped = path.basename(fileName).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`import\\s*\\(\\s*['\"\\\`]\\./${escaped}['\"\\\`]`).test(source ?? '');
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
  for (const id of ['stat', 'timeseries']) {
    const nativeFiles = filesWithPrefix(files, `assets/feature-${id}-`);
    if (nativeFiles.length !== 1 || nativeFiles.some(file => !hasDynamicImport(files.get(implementationFile), file))) valid = false;
  }
  if ([...files.keys()].some(file => /^assets\/feature-(?:table|gauge|bargauge|piechart|barchart)-/.test(file))) valid = false;
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
