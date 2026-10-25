import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { inspectProductionTypeScriptBoundary } from './check-provider-contract-boundary.mjs';

const CORE_PACKAGE_PATH = 'packages/core';
const PROVIDER_CONTRACT_PACKAGE = '@dashboard-render-sdk-g/provider-contract';
const REQUIRED_PROVIDER_CONTRACT_RANGE = 'workspace:*';
const FORBIDDEN_DEPENDENCY_SECTIONS = [
  'devDependencies',
  'peerDependencies',
  'peerDependenciesMeta',
  'optionalDependencies',
  'bundledDependencies',
  'bundleDependencies',
  'dependenciesMeta',
  'resolutions',
  'overrides',
  'pnpm',
];
const STATIC_IMPORT_KINDS = new Set([
  'import',
  'import-type-declaration',
  'typescript-import-type',
]);
const RELATIVE_STATIC_KINDS = new Set([
  ...STATIC_IMPORT_KINDS,
  're-export',
  'type-re-export',
]);

function isPlainRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isRelativeSpecifier(specifier) {
  return (
    specifier === '.' ||
    specifier === '..' ||
    specifier.startsWith('./') ||
    specifier.startsWith('../')
  );
}

function dependencyFinding(file, kind, pathName, message) {
  return { file, kind, message, path: pathName };
}

function inspectCoreManifest(manifest, file) {
  const findings = [];
  const dependencies = manifest.dependencies;

  if (!isPlainRecord(dependencies)) {
    findings.push(
      dependencyFinding(
        file,
        'missing-required-dependency',
        `dependencies.${PROVIDER_CONTRACT_PACKAGE}`,
        `Core must declare ${PROVIDER_CONTRACT_PACKAGE} at ${REQUIRED_PROVIDER_CONTRACT_RANGE}.`
      )
    );
  } else {
    const dependencyNames = Object.keys(dependencies).sort();
    if (!Object.prototype.hasOwnProperty.call(dependencies, PROVIDER_CONTRACT_PACKAGE)) {
      findings.push(
        dependencyFinding(
          file,
          'missing-required-dependency',
          `dependencies.${PROVIDER_CONTRACT_PACKAGE}`,
          `Core must declare ${PROVIDER_CONTRACT_PACKAGE} at ${REQUIRED_PROVIDER_CONTRACT_RANGE}.`
        )
      );
    } else if (dependencies[PROVIDER_CONTRACT_PACKAGE] !== REQUIRED_PROVIDER_CONTRACT_RANGE) {
      findings.push(
        dependencyFinding(
          file,
          'invalid-dependency-range',
          `dependencies.${PROVIDER_CONTRACT_PACKAGE}`,
          `${PROVIDER_CONTRACT_PACKAGE} must use ${REQUIRED_PROVIDER_CONTRACT_RANGE}.`
        )
      );
    }
    for (const dependency of dependencyNames) {
      if (dependency === PROVIDER_CONTRACT_PACKAGE) continue;
      findings.push(
        dependencyFinding(
          file,
          'forbidden-dependency',
          `dependencies.${dependency}`,
          `Core may depend only on ${PROVIDER_CONTRACT_PACKAGE}.`
        )
      );
    }
  }

  for (const section of FORBIDDEN_DEPENDENCY_SECTIONS) {
    if (!Object.prototype.hasOwnProperty.call(manifest, section)) continue;
    findings.push(
      dependencyFinding(
        file,
        'forbidden-dependency-section',
        section,
        `Core package.json must not declare ${section}.`
      )
    );
  }

  return findings;
}

function isAllowedReference({ kind, specifier }) {
  if (isRelativeSpecifier(specifier)) return RELATIVE_STATIC_KINDS.has(kind);
  return specifier === PROVIDER_CONTRACT_PACKAGE && STATIC_IMPORT_KINDS.has(kind);
}

export async function inspectCoreBoundary(repositoryRoot = process.cwd()) {
  const packageRoot = path.join(repositoryRoot, CORE_PACKAGE_PATH);
  const manifestPath = path.join(packageRoot, 'package.json');
  const relativeManifestPath = path.relative(repositoryRoot, manifestPath);
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const sourceFindings = inspectProductionTypeScriptBoundary(
    repositoryRoot,
    CORE_PACKAGE_PATH,
    { includeRelativeReferences: true }
  );
  const compilerFindings = sourceFindings.dependencyFindings.map(
    ({ file, packages, section }) =>
      dependencyFinding(
        file,
        'compiler-dependency',
        section,
        `Compiler configuration introduces ${packages.join(', ')}.`
      )
  );

  return {
    dependencyFindings: [
      ...inspectCoreManifest(manifest, relativeManifestPath),
      ...compilerFindings,
    ],
    importFindings: sourceFindings.importFindings.filter(
      (finding) => !isAllowedReference(finding)
    ),
  };
}

function formatFindings({ dependencyFindings, importFindings }) {
  return [
    ...dependencyFindings.map(
      ({ file, kind, message, path: pathName }) =>
        `${file}: ${kind} at ${pathName}: ${message}`
    ),
    ...importFindings.map(
      ({ file, line, column, kind, specifier }) =>
        `${file}:${line}:${column}: forbidden ${kind} from ${JSON.stringify(specifier)}`
    ),
  ];
}

async function main() {
  const diagnostics = formatFindings(await inspectCoreBoundary());
  if (diagnostics.length > 0) {
    for (const diagnostic of diagnostics) console.error(diagnostic);
    process.exitCode = 1;
    return;
  }
  console.log('core boundary: clean');
}

const isDirectExecution =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isDirectExecution) {
  await main();
}
